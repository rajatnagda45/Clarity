"""GET /api/metrics — live in-process operational metrics + queue depth."""
from __future__ import annotations

from fastapi import APIRouter

from api.middleware.metrics import get_metrics_store

router = APIRouter(prefix="/api", tags=["metrics"])


@router.get("/metrics", include_in_schema=True)
async def live_metrics():
    snapshot = get_metrics_store().snapshot()

    # Augment with queue and Redis metrics (best-effort — zeros on failure)
    from job_queue.client import queue_depth
    from cache.client import redis_info

    snapshot["queue"] = {
        "depth": await queue_depth(),
    }
    snapshot["redis"] = await redis_info()

    return snapshot
