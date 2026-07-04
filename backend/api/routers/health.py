"""
Health endpoints for load balancers, k8s probes, and monitoring systems.

GET /health        — basic status (backward-compat, always public)
GET /health/live   — liveness: is the process up? (k8s livenessProbe)
GET /health/ready  — readiness: can we serve traffic? (k8s readinessProbe)
"""
from __future__ import annotations

import time
import logging

from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse

from config import settings
from schemas import HealthResponse, HealthProbeResult, LivenessResponse, ReadinessResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])

VERSION = "0.1.0"
_START_TIME = time.monotonic()


# ---------------------------------------------------------------------------
# /health  (backward-compatible basic probe)
# ---------------------------------------------------------------------------

@router.get("/health", response_model=HealthResponse, include_in_schema=True)
async def health(request: Request):
    return HealthResponse(
        status="ok",
        version=VERSION,
        environment=settings.environment,
    )


# ---------------------------------------------------------------------------
# /health/live  (k8s livenessProbe — is the process alive?)
# ---------------------------------------------------------------------------

@router.get("/health/live", response_model=LivenessResponse, include_in_schema=True)
async def health_live():
    return LivenessResponse(
        status="alive",
        uptime_seconds=round(time.monotonic() - _START_TIME, 1),
    )


# ---------------------------------------------------------------------------
# /health/ready  (k8s readinessProbe — can we serve traffic?)
# ---------------------------------------------------------------------------

@router.get("/health/ready", include_in_schema=True)
async def health_ready():
    checks: dict[str, HealthProbeResult] = {}

    checks["database"] = await _probe_database()
    checks["openai"] = await _probe_openai()
    checks["config"] = _probe_config()

    all_ok = all(c.ok for c in checks.values())
    any_critical_down = not checks["database"].ok

    if any_critical_down:
        overall = "unavailable"
        http_status = status.HTTP_503_SERVICE_UNAVAILABLE
    elif not all_ok:
        overall = "degraded"
        http_status = status.HTTP_200_OK
    else:
        overall = "ready"
        http_status = status.HTTP_200_OK

    body = ReadinessResponse(
        status=overall,
        version=VERSION,
        environment=settings.environment,
        checks=checks,
    )
    return JSONResponse(status_code=http_status, content=body.model_dump())


# ---------------------------------------------------------------------------
# Dependency probes
# ---------------------------------------------------------------------------

async def _probe_database() -> HealthProbeResult:
    """Ping Supabase with a lightweight query."""
    t0 = time.perf_counter()
    try:
        from db.client import get_client
        get_client().table("workspaces").select("id").limit(1).execute()
        return HealthProbeResult(ok=True, latency_ms=round((time.perf_counter() - t0) * 1000, 1))
    except Exception as exc:
        logger.warning("health_probe database failed: %s", exc)
        return HealthProbeResult(ok=False, latency_ms=None, detail=str(exc)[:120])


async def _probe_openai() -> HealthProbeResult:
    """Check OpenAI API key is configured (no live call — avoids billing)."""
    t0 = time.perf_counter()
    try:
        key = settings.openai_api_key
        if not key or key == "sk-placeholder":
            return HealthProbeResult(ok=False, detail="openai_api_key not configured")
        return HealthProbeResult(ok=True, latency_ms=round((time.perf_counter() - t0) * 1000, 1))
    except Exception as exc:
        return HealthProbeResult(ok=False, detail=str(exc)[:120])


def _probe_config() -> HealthProbeResult:
    """Verify critical config values are present."""
    missing = []
    for attr in ("supabase_url", "supabase_service_role_key", "clerk_secret_key"):
        val = getattr(settings, attr, "")
        if not val:
            missing.append(attr)
    if missing:
        return HealthProbeResult(ok=False, detail=f"Missing config: {', '.join(missing)}")
    return HealthProbeResult(ok=True)
