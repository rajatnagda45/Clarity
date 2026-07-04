"""
Sliding-window rate limiting — Redis-native when configured, Upstash REST fallback.

Limits are per user_id (from JWT), not per IP, so they survive load balancers
and are immune to IP spoofing.

Priority:
  1. redis.asyncio (if REDIS_URL configured)
  2. Upstash REST API (if UPSTASH_REDIS_REST_URL configured)
  3. Fail-open (pass all requests) — never blocks users due to a missing rate-limiter

Rate limits:
  - POST /api/documents: 10 requests / 60 s
  - /api/chat:           60 requests / 60 s
  - /api/*:             120 requests / 60 s
"""

import logging
import time
from typing import Callable
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
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
        except Exception:
            logger.warning(
                "rate_limit_provider_unavailable path=%s user=%s",
                request.url.path, user_id,
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
    Increment the rate-limit counter.

    Tries redis.asyncio first (fast, persistent), then Upstash REST (HTTP-based),
    then fails open with count=0 so a Redis outage never blocks legitimate requests.
    """
    # Strategy 1: redis.asyncio (preferred when REDIS_URL is configured)
    if settings.redis_url:
        try:
            from cache.client import get_redis
            r = get_redis()
            if r is not None:
                count = await r.incr(key)
                if count == 1:
                    await r.expire(key, ttl)
                return int(count)
        except Exception as exc:
            logger.warning("Redis rate-limit failed (trying fallback): %s", exc)

    # Strategy 2: Upstash REST (HTTP-based fallback)
    if settings.upstash_redis_rest_url:
        try:
            import httpx
            url = f"{settings.upstash_redis_rest_url}/pipeline"
            headers = {"Authorization": f"Bearer {settings.upstash_redis_rest_token}"}
            pipeline = [["INCR", key], ["EXPIRE", key, ttl]]
            async with httpx.AsyncClient(timeout=1.0) as client:
                resp = await client.post(url, json=pipeline, headers=headers)
                resp.raise_for_status()
                results = resp.json()
                return int(results[0]["result"])
        except Exception as exc:
            logger.warning("Upstash rate-limit failed (fail-open): %s", exc)

    # Strategy 3: fail open
    return 0
