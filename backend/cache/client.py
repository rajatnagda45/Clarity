"""
Redis-backed distributed cache.

Falls back gracefully to returning None (cache miss) when Redis is
unavailable, so in-process LRU caches remain as a second layer.

Serialization: JSON only. pickle is intentionally absent — deserializing
untrusted pickle bytes is arbitrary code execution.

Usage:
    from cache.client import cache_get, cache_set, init_redis, close_redis

    value = await cache_get("key")
    if value is None:
        value = compute_expensive()
        await cache_set("key", value, ttl=60)
"""
from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

try:
    import redis.asyncio as aioredis
    _HAS_REDIS = True
except ImportError:
    _HAS_REDIS = False
    aioredis = None  # type: ignore[assignment]

_redis: Any = None  # aioredis.Redis | None


def get_redis() -> Any:
    """Return the Redis client or None."""
    return _redis


async def init_redis(redis_url: str) -> Any:
    """Create Redis connection pool. No-op if redis not installed or URL empty."""
    global _redis
    if not _HAS_REDIS:
        logger.warning("redis not installed — distributed cache disabled")
        return None
    if not redis_url:
        return None
    try:
        _redis = aioredis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=False,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        await _redis.ping()
        logger.info("Redis cache connected")
        return _redis
    except Exception as exc:
        logger.warning("Redis cache init failed: %s", exc)
        _redis = None
        return None


async def close_redis() -> None:
    """Close Redis connection pool on shutdown."""
    global _redis
    if _redis is not None:
        try:
            await _redis.aclose()
        except Exception:
            pass
        _redis = None


async def cache_get(key: str) -> Any:
    """
    Return a cached value or None on miss / unavailability.
    Values are stored as JSON bytes. Only JSON-serializable types are supported.
    """
    r = get_redis()
    if r is None:
        return None
    try:
        raw = await r.get(key)
        return json.loads(raw) if raw is not None else None
    except Exception as exc:
        logger.debug("cache_get error for key=%s: %s", key, exc)
        return None


async def cache_set(key: str, value: Any, ttl: int = 60) -> None:
    """Store a JSON-serializable value with a TTL in seconds. Silent no-op on failure."""
    r = get_redis()
    if r is None:
        return
    try:
        await r.setex(key, ttl, json.dumps(value, default=str))
    except Exception as exc:
        logger.debug("cache_set error for key=%s: %s", key, exc)


async def cache_delete(key: str) -> None:
    """Invalidate a cached key."""
    r = get_redis()
    if r is None:
        return
    try:
        await r.delete(key)
    except Exception as exc:
        logger.debug("cache_delete error for key=%s: %s", key, exc)


async def cache_ping() -> bool:
    """Health probe — True if Redis is reachable."""
    r = get_redis()
    if r is None:
        return False
    try:
        return await r.ping()
    except Exception:
        return False


async def redis_info() -> dict[str, Any]:
    """Return Redis INFO stats for monitoring (empty dict on failure)."""
    r = get_redis()
    if r is None:
        return {}
    try:
        raw = await r.info()
        return {
            "used_memory_human": raw.get("used_memory_human", "?"),
            "connected_clients": raw.get("connected_clients", 0),
            "keyspace_hits": raw.get("keyspace_hits", 0),
            "keyspace_misses": raw.get("keyspace_misses", 0),
            "uptime_in_seconds": raw.get("uptime_in_seconds", 0),
        }
    except Exception:
        return {}
