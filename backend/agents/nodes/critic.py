from __future__ import annotations

import json
import logging
from typing import Any

from agents.prompts.critic import CRITIC_SYSTEM
from agents.state import AgentState, DraftClaim, DebateTurnEntry
from config import settings
from services.verification.ensemble import apply_ensemble
from services.verification.nli import check_entailment

logger = logging.getLogger(__name__)


class _CriticOutput:
    __slots__ = ("verdicts", "refined_query")

    def __init__(self, verdicts: list[dict], refined_query: str | None) -> None:
        self.verdicts = verdicts
        self.refined_query = refined_query


async def _call_critic_llm(claims: list[DraftClaim], spans: list[dict]) -> _CriticOutput:
    try:
        import openai  # type: ignore[import]
    except ImportError as exc:
        raise RuntimeError("openai package required") from exc

    client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
    span_payload = [
        {
            "id": span["chunk_id"],
            "text": span["text"],
            "page": span.get("page", 0),
            "document_id": span.get("document_id", ""),
        }
        for span in spans
    ]
    claim_payload = [
        {"claim_id": c["id"], "text": c["text"], "span_ids": c["span_ids"]}
        for c in claims
    ]
    user_msg = json.dumps({"claims": claim_payload, "spans": span_payload}, ensure_ascii=False)

    response = await client.chat.completions.create(
        model=settings.llm_model,
        messages=[
            {"role": "system", "content": CRITIC_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        temperature=0,
        max_tokens=1200,
    )
    raw = (response.choices[0].message.content or "").strip()
    try:
        parsed = json.loads(raw)
        verdicts = parsed.get("verdicts") or []
        refined_query = parsed.get("refined_query") or None
        return _CriticOutput(verdicts=verdicts, refined_query=refined_query)
    except (json.JSONDecodeError, AttributeError):
        logger.warning("Critic returned non-JSON; marking all claims uncertain. raw=%r", raw[:200])
        return _CriticOutput(
            verdicts=[{"claim_id": c["id"], "status": "unsupported"} for c in claims],
            refined_query=None,
        )


def _find_claim(claims: list[DraftClaim], claim_id: str) -> DraftClaim | None:
    for c in claims:
        if c["id"] == claim_id:
            return c
    return None


def _best_span_text(spans: list[dict], span_ids: list[str]) -> str:
    for span in spans:
        if span["chunk_id"] in span_ids:
            return span["text"]
    return " ".join(s["text"] for s in spans[:1])


async def run_critic_node(state: AgentState) -> AgentState:
    """
    Critic node: calls Critic LLM + NLI entailment for every claim.
    Mutates state in place: updates claims, debate, critic_loops.
    Returns the updated state with routing hint in state["_route"].
    """
    claims = state["claims"]
    spans = state["spans"]
    current_round = state["critic_loops"]

    if not claims:
        state["_route"] = "calibrate"  # type: ignore[typeddict-unknown-key]
        return state

    critic_output = await _call_critic_llm(claims, spans)

    verdict_map: dict[str, dict] = {v["claim_id"]: v for v in critic_output.verdicts}

    nli_pairs: list[tuple[str, str]] = []
    for claim in claims:
        verdict = verdict_map.get(claim["id"], {"status": "unsupported"})
        span_text = _best_span_text(spans, claim["span_ids"])
        claim_text = verdict.get("corrected_text") or claim["text"]
        nli_pairs.append((claim_text, span_text))

    nli_results = await _batch_nli(nli_pairs)

    all_ok = True
    for i, claim in enumerate(claims):
        verdict = verdict_map.get(claim["id"], {"status": "unsupported"})
        nli_result = nli_results[i]
        critic_status = verdict.get("status", "unsupported")

        if critic_status == "partial" and verdict.get("corrected_text"):
            claim["text"] = verdict["corrected_text"]
            claim["corrected_text"] = verdict["corrected_text"]

        ev = apply_ensemble(
            claim_id=claim["id"],
            critic_status=critic_status,
            nli_result=nli_result,
        )
        claim["critic_status"] = critic_status
        claim["critic_note"] = verdict.get("note")
        claim["entailment_label"] = ev.entailment_label
        claim["entailment_score"] = ev.entailment_score
        claim["support_probability"] = ev.support_probability
        claim["contradiction_probability"] = ev.contradiction_probability

        turn: DebateTurnEntry
        if ev.supported:
            claim["supported"] = True
            turn = {
                "round": current_round,
                "actor": "critic",
                "action": "resolve",
                "claim_id": claim["id"],
                "note": "Critic+NLI agree",
            }
        else:
            all_ok = False
            claim["supported"] = False
            turn = {
                "round": current_round,
                "actor": "critic",
                "action": "flag",
                "claim_id": claim["id"],
                "note": f"Critic={critic_status}, NLI={nli_result.label}",
            }
        state["debate"].append(turn)

    if all_ok or state["critic_loops"] >= settings.critic_max_iterations:
        for claim in claims:
            if not claim["supported"]:
                claim["uncertain"] = True
        state["_route"] = "calibrate"  # type: ignore[typeddict-unknown-key]
    else:
        state["critic_loops"] += 1
        state["query"] = critic_output.refined_query or state["query"]
        reretrieve_turn: DebateTurnEntry = {
            "round": state["critic_loops"],
            "actor": "writer",
            "action": "reretrieve",
            "claim_id": None,
            "note": f"Refined query: {state['query']}",
        }
        state["debate"].append(reretrieve_turn)
        state["_route"] = "retriever"  # type: ignore[typeddict-unknown-key]

    return state


async def _batch_nli(pairs: list[tuple[str, str]]) -> list[Any]:
    import asyncio

    return list(await asyncio.gather(*[check_entailment(c, s) for c, s in pairs]))
