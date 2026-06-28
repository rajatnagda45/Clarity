"""
Upstash Redis sliding-window rate limiting.

Limits are per user_id (from JWT), not per IP, so they survive
load balancers and are immune to IP spoofing.

Free-tier defaults:
  - query endpoints: 60 requests / minute
  - ingest endpoints: 10 requests / minute
"""

import time
from typing import Callable
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import httpx
from config import settings

# (prefix, window_seconds, max_requests)
_ROUTE_LIMITS: list[tuple[str, int, int]] = [
    ("/api/ingest", 60, 10),
    ("/api/query", 60, 60),
    ("/api/", 60, 120),
]


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable):
        user_id: str = getattr(request.state, "user_id", "")
        if not user_id:
            return await call_next(request)

        window_seconds, max_requests = _match_limit(request.url.path)
        key = f"rl:{user_id}:{request.url.path}:{int(time.time()) // window_seconds}"

        count = await _increment(key, window_seconds)
        if count > max_requests:
            return JSONResponse(
                status_code=429,
                content={"error": "Rate limit exceeded", "retry_after": window_seconds},
                headers={"Retry-After": str(window_seconds)},
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Remaining"] = str(max(0, max_requests - count))
        return response


def _match_limit(path: str) -> tuple[int, int]:
    for prefix, window, max_req in _ROUTE_LIMITS:
        if path.startswith(prefix):
            return window, max_req
    return 60, 120


async def _increment(key: str, ttl: int) -> int:
    """
    Calls Upstash Redis REST API to INCR the key and set TTL on first write.
    Returns the new count.
    """
    url = f"{settings.upstash_redis_rest_url}/pipeline"
    headers = {"Authorization": f"Bearer {settings.upstash_redis_rest_token}"}
    pipeline = [["INCR", key], ["EXPIRE", key, ttl]]

    async with httpx.AsyncClient(timeout=1.0) as client:
        resp = await client.post(url, json=pipeline, headers=headers)
        resp.raise_for_status()
        results = resp.json()
        # pipeline returns list of [{"result": value}, ...]
        return int(results[0]["result"])
