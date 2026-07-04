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
