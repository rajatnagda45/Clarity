"""GET /api/metrics — live in-process operational metrics + queue depth.

Protected: requires developer role (DEVELOPER_USER_IDS config).
Never exposed publicly — contains internal topology and error rate data.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from api.deps import require_developer
from api.middleware.metrics import get_metrics_store

router = APIRouter(prefix="/api", tags=["metrics"])


@router.get("/metrics", include_in_schema=True)
async def live_metrics(_user_id: str = Depends(require_developer)):
    snapshot = get_metrics_store().snapshot()

    # Augment with queue and Redis metrics (best-effort — zeros on failure)
    from job_queue.client import queue_depth
    from cache.client import redis_info

    snapshot["queue"] = {
        "depth": await queue_depth(),
    }
    snapshot["redis"] = await redis_info()

    return snapshot
