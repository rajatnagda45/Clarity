"""
Judge node — wraps `services.eval.judge` for the LLM-as-judge evaluation.

Called after the Writer + Verifier, when the user (or the agent's own
configuration) wants the 8-dimension judge score. Reuses the exact same
judge provider the B3 eval platform uses, so the scores are directly
comparable with the eval dashboard.
"""
from __future__ import annotations

import logging
from typing import Any

from services.agent_runtime.nodes import NodeContext, NodeResult, node

logger = logging.getLogger(__name__)


@node("judge", description="LLM-as-judge (8 dimensions) for the current run")
async def judge_node(state: dict[str, Any], ctx: NodeContext) -> NodeResult:
    from services.eval.judge.factory import get_judge_provider

    final_output = state.get("final_output")
    if not final_output:
        return NodeResult(
            next_node_type="decision",
            state_delta={"judge_scores": None},
            output={"skipped": True, "reason": "no_final_output"},
        )

    # Build the JudgeInput from prior memory
    evidence_texts: list[str] = []
    claim_texts: list[str] = []
    citation_keys: list[str] = []
    for entry in ctx.memory.recall():
        md = entry.get("metadata", {}) or {}
        for r in md.get("results", []) or []:
            if r.get("text"):
                evidence_texts.append(r["text"][:1500])
            if r.get("chunk_id"):
                citation_keys.append(r["chunk_id"])
    for c in state.get("claims") or []:
        if isinstance(c, dict):
            claim_texts.append(c.get("text", ""))
        else:
            claim_texts.append(str(c))

    from services.eval.models import JudgeInput
    inp = JudgeInput(
        question=state.get("user_input", ""),
        answer=final_output,
        evidence_texts=evidence_texts,
        claim_texts=claim_texts,
        citation_keys=citation_keys,
        answer_run_id=state.get("answer_run_id"),
        workspace_id=ctx.workspace_id,
    )

    provider = get_judge_provider()
    try:
        scores = await provider.judge(inp)
    except Exception as exc:
        logger.warning("judge_failed: %s", exc)
        return NodeResult(
            next_node_type="decision",
            state_delta={"judge_scores": None, "last_error": f"judge_failed:{exc}"},
            error=f"judge_failed:{exc}",
        )

    score_dict = {
        "judge_faithfulness": scores.faithfulness,
        "judge_grounding": scores.grounding,
        "judge_completeness": scores.completeness,
        "judge_correctness": scores.correctness,
        "judge_clarity": scores.clarity,
        "judge_citation_quality": scores.citation_quality,
        "judge_hallucination_risk": scores.hallucination_risk,
        "judge_overall": scores.overall,
    }

    ctx.memory.add(
        role="observation",
        content=f"judge_overall={scores.overall} hallucination_risk={scores.hallucination_risk}",
        tool=None,
        metadata={"scores": score_dict},
    )

    return NodeResult(
        state_delta={"judge_scores": score_dict},
        next_node_type="decision",
        output=score_dict,
    )
