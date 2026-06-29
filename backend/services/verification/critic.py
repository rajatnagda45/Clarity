"""
Critic LLM — first signal in the two-signal verifier.

The Critic reviews each claim from the Writer's answer against the
evidence spans retrieved from the document store.  It produces per-claim
verdicts (supported / unsupported / uncertain) and optional debate turns.

Constraints:
- JSON-structured output via response_format=json_object
- Max 2 debate loop iterations (loop_cap in config, default 2)
- Pydantic models validate every LLM response so bad JSON never propagates
"""
from __future__ import annotations

import json
import logging
from typing import Literal

from openai import OpenAI
from pydantic import BaseModel, Field

from config import settings

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# Pydantic models                                                              #
# --------------------------------------------------------------------------- #

class ClaimVerdict(BaseModel):
    claim: str
    verdict: Literal["supported", "unsupported", "uncertain"]
    evidence_spans: list[str] = Field(default_factory=list)
    reasoning: str = ""
    debate_turn: int = 1


class CriticResponse(BaseModel):
    verdicts: list[ClaimVerdict]
    overall_confidence: float = Field(ge=0.0, le=1.0, default=0.5)


# --------------------------------------------------------------------------- #
# System prompt                                                                #
# --------------------------------------------------------------------------- #

_CRITIC_SYSTEM = """\
You are a strict legal-document Critic.

You will receive:
1. CLAIMS — a numbered list of assertions made by an AI answer about a contract.
2. EVIDENCE — one or more text spans extracted from the source document.

Your job is to verify each claim against the evidence spans.

Rules:
- "supported"   → at least one evidence span directly and unambiguously proves the claim.
- "unsupported" → no evidence span supports the claim, or a span contradicts it.
- "uncertain"   → some evidence exists but is incomplete, ambiguous, or conditional.
- Cite only text that actually appears in the EVIDENCE block — do not use background knowledge.
- Limit evidence_spans to 1-3 of the most relevant excerpts (≤120 chars each).

Respond with ONLY a JSON object matching this schema (no commentary outside the JSON):
{
  "verdicts": [
    {
      "claim": "<exact claim text>",
      "verdict": "supported|unsupported|uncertain",
      "evidence_spans": ["<span text>", ...],
      "reasoning": "<one sentence>",
      "debate_turn": 1
    },
    ...
  ],
  "overall_confidence": 0.0-1.0
}
"""


# --------------------------------------------------------------------------- #
# Public API                                                                   #
# --------------------------------------------------------------------------- #

def run_critic(
    claims: list[str],
    evidence_spans: list[str],
    loop_iteration: int = 1,
) -> CriticResponse:
    """
    Run the Critic LLM over the given claims and evidence.
    Returns a CriticResponse with per-claim verdicts.
    Falls back to all-uncertain on LLM or parsing error.
    """
    if not claims:
        return CriticResponse(verdicts=[], overall_confidence=0.5)

    claims_text = "\n".join(f"{i + 1}. {c}" for i, c in enumerate(claims))
    evidence_text = "\n---\n".join(evidence_spans[:20])  # cap at 20 spans

    user_prompt = (
        f"CLAIMS:\n{claims_text}\n\n"
        f"EVIDENCE:\n{evidence_text}\n\n"
        f"Debate turn: {loop_iteration}"
    )

    try:
        client = OpenAI(api_key=settings.openai_api_key)
        resp = client.chat.completions.create(
            model=settings.judge_model,
            messages=[
                {"role": "system", "content": _CRITIC_SYSTEM},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.0,
            max_tokens=1500,
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content or "{}"
        data = json.loads(raw)
        # stamp loop iteration on each verdict
        for v in data.get("verdicts", []):
            v["debate_turn"] = loop_iteration
        return CriticResponse.model_validate(data)
    except Exception as exc:
        logger.warning("Critic LLM failed (turn %d): %s", loop_iteration, exc)
        return CriticResponse(
            verdicts=[
                ClaimVerdict(
                    claim=c,
                    verdict="uncertain",
                    reasoning="Critic unavailable",
                    debate_turn=loop_iteration,
                )
                for c in claims
            ],
            overall_confidence=0.5,
        )


def extract_claims(answer_text: str) -> list[str]:
    """
    Extract atomic factual claims from an answer using GPT-4o-mini.
    Returns a list of claim strings.  Falls back to the full answer as one claim.
    """
    if not answer_text.strip():
        return []

    system_msg = (
        "You are a claim extractor. Given an answer paragraph, extract every factual "
        "claim as a separate item. A claim is a specific, testable assertion about a "
        "contract's content, dates, parties, obligations, or rights. "
        "Respond ONLY with JSON: {\"claims\": [\"claim 1\", \"claim 2\", ...]}"
    )
    try:
        client = OpenAI(api_key=settings.openai_api_key)
        resp = client.chat.completions.create(
            model=settings.judge_model,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": answer_text},
            ],
            temperature=0.0,
            max_tokens=500,
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content or "{}"
        data = json.loads(raw)
        claims = data.get("claims", [])
        return [str(c).strip() for c in claims if str(c).strip()]
    except Exception as exc:
        logger.warning("Claim extraction failed: %s", exc)
        return [answer_text[:500]]  # fallback: treat full answer as one claim
