"""
SSE endpoint for real-time document pipeline events + history replay.

GET /api/events/documents
  Persistent SSE stream. On connect:
    1. Sends a "history" frame with the last 100 events for the workspace
       (from pipeline_events table — survives browser disconnects).
    2. Sends a "connected" snapshot of all currently in-progress documents.
    3. Streams new PipelineEvent frames as they arrive from the EventBus.
    4. Sends ": ping" heartbeat comments every 15 s.

GET /api/events/documents/history
  REST endpoint for paginated history replay. Used by the developer console
  to show the full pipeline timeline for a document or workspace.

Auth: Bearer token + X-Workspace-Id header (same as every other endpoint).
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from db.client import get_client
from services.events.bus import STATUS_TO_PROGRESS, STATUS_TO_STAGE, event_bus

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/events", tags=["events"])

_HEARTBEAT_SECONDS = 15.0
_TERMINAL_STATUSES = {"indexed", "failed"}
_HISTORY_LIMIT = 100


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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


def _load_event_history(workspace_id: str, limit: int = _HISTORY_LIMIT) -> list[dict]:
    """Return the most recent pipeline events for the workspace, newest first."""
    try:
        result = (
            get_client()
            .table("pipeline_events")
            .select("*")
            .eq("workspace_id", workspace_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []
    except Exception:
        # Table may not exist yet — silently return empty list
        return []


# ---------------------------------------------------------------------------
# SSE stream
# ---------------------------------------------------------------------------

@router.get("/documents")
async def stream_document_events(request: Request) -> StreamingResponse:
    workspace_id: str = request.headers.get("X-Workspace-Id", "")

    async def generate():
        if not workspace_id:
            yield 'data: {"error":"X-Workspace-Id header required"}\n\n'
            return

        q = event_bus.subscribe(workspace_id)
        try:
            # 1. Historical events — replay missed events after a disconnect
            history = _load_event_history(workspace_id)
            history_frame = {
                "type": "history",
                "workspace_id": workspace_id,
                "timestamp": datetime.now(UTC).isoformat(),
                "events": list(reversed(history)),  # oldest-first for replay
            }
            yield f"data: {json.dumps(history_frame)}\n\n"

            # 2. Current snapshot — in-progress documents right now
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

            # 3. Live event stream
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


# ---------------------------------------------------------------------------
# History REST endpoint (Developer Console)
# ---------------------------------------------------------------------------

@router.get("/documents/history")
async def get_event_history(
    request: Request,
    document_id: str | None = None,
    limit: int = 50,
    before: str | None = None,
) -> JSONResponse:
    """
    Return paginated pipeline event history from the pipeline_events table.

    Query params:
      document_id  Filter to a single document (optional).
      limit        Max events to return, 1–200 (default 50).
      before       ISO timestamp cursor for pagination.
    """
    workspace_id: str = request.headers.get("X-Workspace-Id", "")
    if not workspace_id:
        return JSONResponse({"error": "X-Workspace-Id header required"}, status_code=400)

    limit = max(1, min(limit, 200))

    try:
        query = (
            get_client()
            .table("pipeline_events")
            .select("*")
            .eq("workspace_id", workspace_id)
            .order("created_at", desc=True)
            .limit(limit)
        )
        if document_id:
            query = query.eq("document_id", document_id)
        if before:
            query = query.lt("created_at", before)

        result = query.execute()
        events = list(reversed(result.data or []))  # return oldest-first
        return JSONResponse({"events": events, "count": len(events)})
    except Exception as exc:
        logger.warning("history_query_failed ws=%s: %s", workspace_id, exc)
        return JSONResponse({"events": [], "count": 0})
