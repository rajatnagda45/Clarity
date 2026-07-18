"""
run_evaluation — schedule an evaluation of the current draft answer.

If the agent's Writer produced a draft and the Verification node is not
satisfied with the trust score, the Decision node may call this tool to
trigger an LLM-as-judge evaluation against the existing eval engine.
The tool waits for completion so the next node can read the result.
"""
from __future__ import annotations

import logging
from typing import Any

from services.agent_runtime.tools.base import ToolContext, ToolError, tool

logger = logging.getLogger(__name__)


@tool(
    "run_evaluation",
    timeout_s=60.0,
    max_retries=1,
    backoff_base=1.0,
)
async def run_evaluation(
    ctx: ToolContext,
    answer_run_id: str | None = None,
) -> dict[str, Any]:
    """Trigger the existing eval engine. Returns the judge scores."""
    from services.eval.engine import run_eval_for_answer

    if not answer_run_id:
        # Caller didn't supply a run_id — try to use the most recent one
        # from the agent's own memory or fail gracefully.
        recent = [m for m in ctx.memory.recall() if m.get("metadata", {}).get("answer_run_id")]
        if recent:
            answer_run_id = recent[-1]["metadata"]["answer_run_id"]
    if not answer_run_id:
        raise ToolError("answer_run_id is required (no recent answer found in memory)", kind="fatal")

    try:
        eval_id = await run_eval_for_answer(answer_run_id, ctx.workspace_id)
    except Exception as exc:
        raise ToolError(f"eval_engine_failed:{exc}", kind="retryable")

    if not eval_id:
        return {
            "evaluated": False,
            "reason": "eval_engine_returned_none",
        }

    # Read the resulting eval row so the tool result includes the actual scores
    from db.client import tenant_query
    try:
        rows = (
            tenant_query("answer_evals", ctx.workspace_id)
            .select("*")
            .eq("id", eval_id)
            .execute()
        ).data or []
    except Exception as exc:
        raise ToolError(f"eval_read_failed:{exc}", kind="retryable")

    if not rows:
        return {"evaluated": True, "eval_id": eval_id, "scores": None}

    r = rows[0]
    scores = {
        "judge_overall": r.get("judge_overall"),
        "judge_faithfulness": r.get("judge_faithfulness"),
        "judge_grounding": r.get("judge_grounding"),
        "judge_completeness": r.get("judge_completeness"),
        "judge_correctness": r.get("judge_correctness"),
        "judge_clarity": r.get("judge_clarity"),
        "judge_citation_quality": r.get("judge_citation_quality"),
        "judge_hallucination_risk": r.get("judge_hallucination_risk"),
    }

    ctx.memory.add(
        role="observation",
        content=(
            f"run_evaluation judge_overall={scores['judge_overall']} "
            f"hallucination_risk={scores['judge_hallucination_risk']}"
        ),
        tool="run_evaluation",
        metadata={"answer_run_id": answer_run_id, "eval_id": eval_id, "scores": scores},
    )

    return {
        "evaluated": True,
        "eval_id": eval_id,
        "answer_run_id": answer_run_id,
        "scores": scores,
    }
