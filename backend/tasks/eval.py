"""ARQ task wrapper — LLM-as-judge post-chat evaluation."""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def run_eval(ctx: dict, answer_run_id: str, workspace_id: str) -> dict:
    """
    ARQ entrypoint for automatic judge evaluation triggered after each
    chat answer. Runs faithfulness / grounding scoring and regression
    detection.
    """
    logger.info("task:run_eval answer_run=%s ws=%s", answer_run_id, workspace_id)
    try:
        from services.eval.engine import schedule_eval
        await schedule_eval(answer_run_id, workspace_id)
        return {"status": "ok", "answer_run_id": answer_run_id}
    except Exception as exc:
        logger.exception("eval task failed answer_run=%s: %s", answer_run_id, exc)
        raise
