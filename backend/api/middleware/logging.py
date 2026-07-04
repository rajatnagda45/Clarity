"""
Structured JSON request logging middleware.

Emits one log line per request containing:
  request_id, method, path, status_code, duration_ms,
  user_id, workspace_id, content_length.

The request_id is generated here and attached to request.state so
error handlers and route code can include it in their own log lines.
"""
from __future__ import annotations

import logging
import time
import uuid
from typing import Callable

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

logger = logging.getLogger("clarity.access")


class LoggingMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable):
        request_id = str(uuid.uuid4())
        # Attach to state so downstream handlers can reference it
        request.state.request_id = request_id

        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1_000

        user_id: str = getattr(request.state, "user_id", "")
        workspace_id: str = getattr(request.state, "workspace_id", "")

        logger.info(
            "request",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2),
                "user_id": user_id or None,
                "workspace_id": workspace_id or None,
                "content_length": response.headers.get("content-length"),
            },
        )

        response.headers["X-Request-Id"] = request_id
        return response
