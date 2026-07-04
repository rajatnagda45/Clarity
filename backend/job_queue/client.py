"""
Distributed job queue client — ARQ over Redis.

Degrades gracefully when Redis is unavailable: callers fall back to
FastAPI BackgroundTasks so the application never hard-fails due to
a missing queue backend.

Usage:
    from job_queue.client import enqueue_job, get_pool

    # In a route handler:
    await enqueue_job("run_document_ingestion", doc_id, workspace_id,
                      _fallback=background_tasks.add_task,
                      _fallback_fn=run_document_ingestion_task)
"""
from __future__ import annotations

import logging
from typing import Any, Callable

logger = logging.getLogger(__name__)

try:
    from arq import create_pool
    from arq.connections import RedisSettings, ArqRedis
    _HAS_ARQ = True
except ImportError:
    _HAS_ARQ = False
    ArqRedis = None  # type: ignore[assignment,misc]

_pool: Any = None  # ArqRedis | None


def get_pool() -> Any:
    """Return the ARQ pool, or None if not initialised."""
    return _pool


async def init_pool(redis_url: str) -> Any:
    """Create and cache the ARQ connection pool. No-op if ARQ is unavailable."""
    global _pool
    if not _HAS_ARQ:
        logger.warning("arq not installed — distributed queue disabled")
        return None
    if not redis_url:
        logger.info("REDIS_URL not configured — distributed queue disabled")
        return None
    try:
        settings = RedisSettings.from_dsn(redis_url)
        _pool = await create_pool(settings)
        logger.info("ARQ queue pool connected to Redis")
        return _pool
    except Exception as exc:
        logger.warning("ARQ pool init failed (queue disabled): %s", exc)
        _pool = None
        return None


async def close_pool() -> None:
    """Close the ARQ pool on shutdown."""
    global _pool
    if _pool is not None:
        try:
            await _pool.aclose()
        except Exception:
            pass
        _pool = None


async def enqueue_job(task_name: str, *args: Any, **kwargs: Any) -> Any:
    """
    Enqueue a task to ARQ. Returns the Job object or None if unavailable.

    Never raises — failures are logged and the caller decides whether to
    fall back to an in-process BackgroundTask.
    """
    pool = get_pool()
    if pool is None:
        return None
    try:
        job = await pool.enqueue_job(task_name, *args, **kwargs)
        logger.debug("enqueued job %s → %s", task_name, getattr(job, "job_id", "?"))
        return job
    except Exception as exc:
        logger.warning("Failed to enqueue %s: %s", task_name, exc)
        return None


async def enqueue_or_background(
    task_name: str,
    fallback_fn: Callable,
    *args: Any,
    background_tasks: Any = None,
) -> None:
    """
    Try ARQ first; fall back to FastAPI BackgroundTasks if the queue is down.

    This is the primary dispatch helper used by route handlers.
    """
    job = await enqueue_job(task_name, *args)
    if job is None:
        if background_tasks is not None:
            background_tasks.add_task(fallback_fn, *args)
        else:
            logger.warning(
                "No queue and no background_tasks for %s — task dropped", task_name
            )


async def queue_depth() -> int:
    """Return the number of jobs currently queued (best-effort, 0 on error)."""
    pool = get_pool()
    if pool is None:
        return 0
    try:
        jobs = await pool.queued_jobs()
        return len(jobs)
    except Exception:
        return 0


async def active_worker_count() -> int:
    """Return a best-effort count of live worker processes (0 on error)."""
    pool = get_pool()
    if pool is None:
        return 0
    try:
        info = await pool.all_job_results()
        return len({j.worker_name for j in info if j.worker_name})
    except Exception:
        return 0
