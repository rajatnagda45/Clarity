"""
SSE endpoint for real-time document pipeline events.

GET /api/events/documents
  Streams PipelineEvent JSON over text/event-stream for every pipeline stage
  transition in the caller's workspace. On connect, a 'connected' snapshot
  event is sent with the current state of all in-progress documents so clients
  can display accurate progress immediately on (re)connect.

  A `: ping` comment is emitted every 15 s to keep the TCP connection alive
  through load balancers and proxies that close idle streams.

Auth: same Bearer token + X-Workspace-Id header as every other endpoint.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from db.client import get_client
from services.events.bus import STATUS_TO_PROGRESS, STATUS_TO_STAGE, event_bus

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/events", tags=["events"])

_HEARTBEAT_SECONDS = 15.0
_TERMINAL_STATUSES = {"indexed", "failed"}


def _load_active_documents(workspace_id: str) -> list[dict]:
    result = (
        get_client()
        .table("documents")
        .select("id, workspace_id, filename, status")
        .eq("workspace_id", workspace_id)
        .execute()
    )
    rows = result.data or []
    return [r for r in rows if r.get("status") not in _TERMINAL_STATUSES]


@router.get("/documents")
async def stream_document_events(request: Request) -> StreamingResponse:
    workspace_id: str = request.headers.get("X-Workspace-Id", "")

    async def generate():
        if not workspace_id:
            yield 'data: {"error":"X-Workspace-Id header required"}\n\n'
            return

        q = event_bus.subscribe(workspace_id)
        try:
            # --- Initial snapshot ---
            active = _load_active_documents(workspace_id)
            snapshot = {
                "type": "connected",
                "workspace_id": workspace_id,
                "timestamp": datetime.now(UTC).isoformat(),
                "documents": [
                    {
                        "document_id": row["id"],
                        "workspace_id": row["workspace_id"],
                        "filename": row.get("filename"),
                        "stage": STATUS_TO_STAGE.get(row["status"], "unknown"),
                        "status": row["status"],
                        "progress": STATUS_TO_PROGRESS.get(row["status"], 0),
                    }
                    for row in active
                ],
            }
            yield f"data: {json.dumps(snapshot)}\n\n"

            # --- Event stream ---
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(q.get(), timeout=_HEARTBEAT_SECONDS)
                    yield event.to_sse()
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            event_bus.unsubscribe(workspace_id, q)
            logger.debug("sse_disconnected ws=%s", workspace_id)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
