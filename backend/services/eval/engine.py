from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from uuid import uuid4

from db.client import get_client, tenant_query
from services.eval.judge.base import JudgeError
from services.eval.judge.factory import get_judge_provider
from services.eval.judge.prompts import JUDGE_PROMPT_VERSION
from services.eval.models import JudgeInput, JudgeScores
from services.eval.regression import detect_regression
from config import settings

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _load_answer_run(workspace_id: str, answer_run_id: str) -> dict | None:
    result = (
        tenant_query("answer_runs", workspace_id)
        .eq("id", answer_run_id)
        .limit(1)
        .execute()
    )
    return (result.data or [None])[0]


def _load_claims(workspace_id: str, answer_run_id: str) -> list[dict]:
    result = (
        tenant_query("claims", workspace_id)
        .eq("answer_run_id", answer_run_id)
        .select("text,supported,critic_status,support_probability")
        .execute()
    )
    return result.data or []


def _load_spans(workspace_id: str, answer_run_id: str) -> list[dict]:
    result = (
        tenant_query("spans", workspace_id)
        .eq("answer_run_id", answer_run_id)
        .select("text,citation_key,rerank_score")
        .execute()
    )
    return result.data or []


def _load_message_content(workspace_id: str, message_id: str) -> str:
    result = (
        tenant_query("messages", workspace_id)
        .eq("id", message_id)
        .select("content")
        .limit(1)
        .execute()
    )
    rows = result.data or []
    return rows[0]["content"] if rows else ""


def _upsert_eval(workspace_id: str, answer_run_id: str, scores: JudgeScores, latency_ms: int) -> str:
    client = get_client()
    eval_id = str(uuid4())
    client.table("answer_evals").insert({
        "id": eval_id,
        "workspace_id": workspace_id,
        "answer_run_id": answer_run_id,
        "judge_provider": get_judge_provider().provider_name,
        "judge_model": settings.judge_model,
        "judge_prompt_version": JUDGE_PROMPT_VERSION,
        "judge_latency_ms": latency_ms,
        "judge_faithfulness": scores.faithfulness,
        "judge_grounding": scores.grounding,
        "judge_completeness": scores.completeness,
        "judge_correctness": scores.correctness,
        "judge_clarity": scores.clarity,
        "judge_citation_quality": scores.citation_quality,
        "judge_hallucination_risk": scores.hallucination_risk,
        "judge_overall": scores.overall,
        "judge_reasoning": scores.reasoning,
        "created_at": _now_iso(),
    }).execute()
    return eval_id


async def run_eval_for_answer(answer_run_id: str, workspace_id: str) -> str | None:
    """Score an answer with the LLM judge and persist to answer_evals.

    Returns the eval row ID, or None if eval is disabled or the answer run is not found.
    This function is designed to run as a FastAPI BackgroundTask.
    """
    if not settings.eval_auto_judge:
        return None

    answer_run = _load_answer_run(workspace_id, answer_run_id)
    if not answer_run:
        logger.warning("run_eval_for_answer: answer_run %s not found", answer_run_id)
        return None

    # Don't evaluate abstained or failed answers
    if answer_run.get("abstained"):
        return None

    query = answer_run.get("query", "")
    assistant_message_id = answer_run.get("assistant_message_id")
    answer_text = ""
    if assistant_message_id:
        answer_text = _load_message_content(workspace_id, assistant_message_id)

    claims = _load_claims(workspace_id, answer_run_id)
    spans = _load_spans(workspace_id, answer_run_id)

    judge_input = JudgeInput(
        question=query,
        answer=answer_text,
        evidence_texts=[s["text"] for s in spans if s.get("text")],
        claim_texts=[c["text"] for c in claims if c.get("text")],
        citation_keys=list({s["citation_key"] for s in spans if s.get("citation_key")}),
        answer_run_id=answer_run_id,
        workspace_id=workspace_id,
    )

    try:
        provider = get_judge_provider()
        scores = await provider.judge(judge_input)
        latency_ms = scores.__dict__.pop("_latency_ms", 0)
    except JudgeError as exc:
        logger.error("Judge failed for answer_run %s: %s", answer_run_id, exc)
        return None

    eval_id = _upsert_eval(workspace_id, answer_run_id, scores, latency_ms)

    # Fire regression check without awaiting — errors here must not fail the response
    try:
        detect_regression(workspace_id, eval_id)
    except Exception as exc:
        logger.warning("Regression check failed for eval %s: %s", eval_id, exc)

    return eval_id


def schedule_eval(answer_run_id: str, workspace_id: str) -> None:
    """Synchronous entry point for FastAPI BackgroundTask."""
    asyncio.run(run_eval_for_answer(answer_run_id, workspace_id))
