"""
ARQ worker entry point.

Start with:
    arq worker.WorkerSettings

Or via the Dockerfile.worker CMD. Workers consume jobs from Redis and run
them as async coroutines. Scale horizontally — each worker is stateless.

Worker settings are pulled from config.py so the same .env file used by
the API server drives worker behaviour.
"""
from __future__ import annotations

import logging
import os

from tasks.ingestion import run_document_ingestion
from tasks.embedding import run_document_embedding
from tasks.indexing import run_document_indexing
from tasks.eval import run_eval
from tasks.benchmark import run_benchmark_job
from tasks.agent import run_agent_execution

logger = logging.getLogger(__name__)


def _redis_settings():
    try:
        from arq.connections import RedisSettings
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        return RedisSettings.from_dsn(redis_url)
    except ImportError:
        raise RuntimeError("arq is not installed. Run: pip install arq")


async def startup(ctx: dict) -> None:
    """Worker startup hook — initialise shared resources."""
    logger.info("worker starting up")
    from cache.client import init_redis
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    ctx["redis"] = await init_redis(redis_url)


async def shutdown(ctx: dict) -> None:
    """Worker shutdown hook — release shared resources."""
    logger.info("worker shutting down")
    from cache.client import close_redis
    await close_redis()


async def on_job_abort(ctx: dict) -> None:
    """
    Called by ARQ when a job exhausts all retry attempts (max_tries reached).

    Stores the failure in a dead letter queue (DLQ) Redis key so it can be
    inspected by operators and surfaced in monitoring. The document or agent
    run status is updated to 'failed' so users see a terminal state.
    """
    import json as _json
    import traceback as _tb

    job_id = ctx.get("job_id", "unknown")
    function = ctx.get("function", "unknown")
    args = ctx.get("args", [])
    kwargs = ctx.get("kwargs", {})
    exc = ctx.get("exc")

    tb_str = "".join(_tb.format_exception(type(exc), exc, exc.__traceback__)) if exc else ""

    entry = {
        "job_id": job_id,
        "function": function,
        "args": [str(a) for a in args],
        "kwargs": {k: str(v) for k, v in kwargs.items()},
        "error": str(exc) if exc else "unknown",
        "traceback": tb_str[-2000:],
        "retry_count": ctx.get("job_try", 0),
        "aborted_at": __import__("datetime").datetime.utcnow().isoformat(),
    }

    logger.error(
        "job_abort function=%s job_id=%s error=%s",
        function, job_id, entry["error"],
    )

    try:
        r = ctx.get("redis")
        if r is not None:
            dlq_key = "dlq:aborted_jobs"
            await r.lpush(dlq_key, _json.dumps(entry))
            await r.ltrim(dlq_key, 0, 999)  # keep last 1000 DLQ entries
    except Exception as dlq_exc:
        logger.warning("Failed to write to DLQ: %s", dlq_exc)

    # Best-effort: mark the associated document/agent run as failed
    try:
        if function == "run_document_ingestion" and args:
            document_id = args[0]
            from db.client import get_client
            get_client().table("documents").update({
                "status": "failed",
                "error": f"Job aborted after max retries: {entry['error'][:200]}",
            }).eq("id", document_id).execute()
    except Exception:
        pass

    try:
        if function == "run_agent_execution" and args:
            run_id = args[0]
            from db.client import get_client
            from datetime import UTC, datetime
            get_client().table("agent_runs").update({
                "status": "failed",
                "completed_at": datetime.now(UTC).isoformat(),
            }).eq("id", run_id).execute()
    except Exception:
        pass


class WorkerSettings:
    """
    ARQ worker configuration.

    ARQ discovers all callable task functions via `functions`. Each function
    must accept `ctx: dict` as its first argument.
    """
    functions = [
        run_document_ingestion,
        run_document_embedding,
        run_document_indexing,
        run_eval,
        run_benchmark_job,
        run_agent_execution,
    ]

    redis_settings = _redis_settings()

    # Per-job execution timeout (seconds). Long-running benchmarks may need
    # more time — override via WORKER_JOB_TIMEOUT env var.
    job_timeout: int = int(os.getenv("WORKER_JOB_TIMEOUT", "3600"))

    # Maximum concurrent jobs per worker process.
    max_jobs: int = int(os.getenv("WORKER_MAX_JOBS", "10"))

    # Retry failed jobs up to this many times (with exponential backoff).
    max_tries: int = int(os.getenv("WORKER_MAX_TRIES", "3"))

    # Keep job results in Redis for this many seconds (for status polling).
    keep_result: int = int(os.getenv("WORKER_KEEP_RESULT", "86400"))

    on_startup = startup
    on_shutdown = shutdown
    on_job_abort = on_job_abort
