"""GET /api/metrics — live in-process operational metrics."""
from __future__ import annotations

from fastapi import APIRouter

from api.middleware.metrics import get_metrics_store

router = APIRouter(prefix="/api", tags=["metrics"])


@router.get("/metrics", include_in_schema=True)
async def live_metrics():
    return get_metrics_store().snapshot()
