"""ARQ task wrapper — benchmark dataset execution."""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def run_benchmark_job(ctx: dict, workspace_id: str, dataset_id: str) -> dict:
    """
    ARQ entrypoint for benchmark execution. Iterates all cases in a
    dataset, generates answers, scores with the judge, and writes
    results to the database.
    """
    logger.info("task:run_benchmark_job ws=%s dataset=%s", workspace_id, dataset_id)
    try:
        from services.eval.benchmark import run_benchmark
        await run_benchmark(workspace_id, dataset_id)
        return {"status": "ok", "dataset_id": dataset_id}
    except Exception as exc:
        logger.exception("benchmark task failed dataset=%s: %s", dataset_id, exc)
        raise
