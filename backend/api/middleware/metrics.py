"""
In-process latency and request metrics.

Uses threading.Lock for thread safety without external dependencies.
Counters are accumulated since process start — consumers subtract
snapshots to compute rates over windows.

All state lives in the module-level `_store` singleton so middleware
and the /api/metrics endpoint share the same object.
"""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Callable

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

_START_TIME = time.monotonic()


@dataclass
class _EndpointStats:
    count: int = 0
    total_ms: float = 0.0
    errors: int = 0


class MetricsStore:
    """Thread-safe cumulative counters for API observability."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._request_count: int = 0
        self._error_count: int = 0
        self._total_ms: float = 0.0
        self._active: int = 0
        self._endpoints: dict[str, _EndpointStats] = {}

    # ------------------------------------------------------------------ mutators

    def record(self, path_key: str, duration_ms: float, *, is_error: bool) -> None:
        with self._lock:
            self._request_count += 1
            self._total_ms += duration_ms
            if is_error:
                self._error_count += 1
            ep = self._endpoints.setdefault(path_key, _EndpointStats())
            ep.count += 1
            ep.total_ms += duration_ms
            if is_error:
                ep.errors += 1

    def increment_active(self) -> None:
        with self._lock:
            self._active += 1

    def decrement_active(self) -> None:
        with self._lock:
            self._active = max(0, self._active - 1)

    # ------------------------------------------------------------------ snapshot

    def snapshot(self) -> dict:
        with self._lock:
            uptime = time.monotonic() - _START_TIME
            avg_ms = self._total_ms / self._request_count if self._request_count else 0.0
            endpoints = {
                k: {
                    "count": v.count,
                    "total_ms": round(v.total_ms, 2),
                    "errors": v.errors,
                }
                for k, v in self._endpoints.items()
            }
            return {
                "uptime_seconds": round(uptime, 1),
                "request_count": self._request_count,
                "error_count": self._error_count,
                "avg_latency_ms": round(avg_ms, 2),
                "active_requests": self._active,
                "endpoints": endpoints,
            }


_store = MetricsStore()


def get_metrics_store() -> MetricsStore:
    return _store


def _path_key(path: str) -> str:
    """Collapse dynamic segments so /api/documents/abc123 → /api/documents/{id}."""
    parts = path.split("/")
    collapsed = []
    for part in parts:
        if len(part) > 20 or (part and part[0].isdigit()):
            collapsed.append("{id}")
        else:
            collapsed.append(part)
    return "/".join(collapsed)


class MetricsMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable):
        key = _path_key(request.url.path)
        _store.increment_active()
        start = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            duration_ms = (time.perf_counter() - start) * 1_000
            _store.decrement_active()
            # response may not exist if call_next raised; check attribute
            status = getattr(response, "status_code", 500) if "response" in dir() else 500
            _store.record(key, duration_ms, is_error=status >= 500)
        return response
