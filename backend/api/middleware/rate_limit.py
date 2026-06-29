"""
Upstash Redis sliding-window rate limiting.

Limits are per user_id (from JWT), not per IP, so they survive
load balancers and are immune to IP spoofing.

Free-tier defaults:
  - query endpoints: 60 requests / minute
  - ingest endpoints: 10 requests / minute
"""

import logging
import time
from typing import Callable
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import httpx
from api.errors import error_response
from config import settings

# (methods, prefix, window_seconds, max_requests)
_ROUTE_LIMITS: list[tuple[frozenset[str] | None, str, int, int]] = [
    (frozenset({"POST"}), "/api/documents", 60, 10),
    (None, "/api/chat", 60, 60),
    (None, "/api/", 60, 120),
]
logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable):
        user_id: str = getattr(request.state, "user_id", "")
        if not user_id:
            return await call_next(request)

        window_seconds, max_requests = _match_limit(request.method, request.url.path)
        key = f"rl:{user_id}:{request.method}:{request.url.path}:{int(time.time()) // window_seconds}"

        try:
            count = await _increment(key, window_seconds)
        except httpx.HTTPError:
            logger.warning(
                "rate_limit_provider_unavailable",
                extra={"path": request.url.path, "user_id": user_id},
            )
            return await call_next(request)
        if count > max_requests:
            return error_response(
                429,
                "rate_limit_exceeded",
                "Rate limit exceeded.",
                headers={"Retry-After": str(window_seconds)},
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Remaining"] = str(max(0, max_requests - count))
        return response


def _match_limit(method: str, path: str) -> tuple[int, int]:
    for methods, prefix, window, max_req in _ROUTE_LIMITS:
        if path.startswith(prefix) and (methods is None or method in methods):
            return window, max_req
    return 60, 120


async def _increment(key: str, ttl: int) -> int:
    """
    Calls Upstash Redis REST API to INCR the key and set TTL on first write.
    Returns the new count. Fails open (returns 0) on any Upstash error so a
    Redis outage never blocks legitimate requests.
    """
    import logging
    logger = logging.getLogger(__name__)

    url = f"{settings.upstash_redis_rest_url}/pipeline"
    headers = {"Authorization": f"Bearer {settings.upstash_redis_rest_token}"}
    pipeline = [["INCR", key], ["EXPIRE", key, ttl]]

    try:
        async with httpx.AsyncClient(timeout=1.0) as client:
            resp = await client.post(url, json=pipeline, headers=headers)
            resp.raise_for_status()
            results = resp.json()
            return int(results[0]["result"])
    except Exception as exc:
        logger.warning("Upstash rate-limit check failed (fail-open): %s", exc)
        return 0  # fail open — do not block the request
