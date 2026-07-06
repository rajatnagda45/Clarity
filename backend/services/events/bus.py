"""
In-process asyncio event bus for pipeline stage events.

All pipeline status transitions call event_bus.publish(). Each SSE subscriber
holds one asyncio.Queue. publish() is safe to call from sync code that runs in
the event loop thread (i.e., sync functions called directly from async
coroutines — not from asyncio.to_thread workers).
"""
from __future__ import annotations

import asyncio
import json
import os
import socket
from dataclasses import asdict, dataclass
from datetime import UTC, datetime

_WORKER_ID = f"{os.getpid()}@{socket.gethostname()}"

# Internal DB status → user-visible stage name
STATUS_TO_STAGE: dict[str, str] = {
    "uploaded": "queued",
    "extracted": "extracting",
    "normalized": "normalizing",
    "metadata_ready": "clause_extraction",
    "awaiting_chunking": "chunking",
    "chunking": "chunking",
    "chunked": "chunking",
    "awaiting_embeddings": "embedding",
    "embedding": "embedding",
    "embedded": "embedding",
    "awaiting_index": "indexing",
    "indexing": "indexing",
    "indexed": "completed",
    "failed": "failed",
}

# Internal DB status → progress percentage (0–100)
STATUS_TO_PROGRESS: dict[str, int] = {
    "uploaded": 2,
    "extracted": 15,
    "normalized": 25,
    "metadata_ready": 30,
    "awaiting_chunking": 35,
    "chunking": 45,
    "chunked": 55,
    "awaiting_embeddings": 60,
    "embedding": 72,
    "embedded": 82,
    "awaiting_index": 85,
    "indexing": 92,
    "indexed": 100,
    "failed": 0,
}


@dataclass
class PipelineEvent:
    document_id: str
    workspace_id: str
    stage: str
    status: str
    progress: int
    elapsed_ms: int
    worker: str
    retry_count: int
    timestamp: str
    filename: str | None = None
    error: str | None = None

    def to_sse(self) -> str:
        return f"data: {json.dumps(asdict(self))}\n\n"


class EventBus:
    def __init__(self) -> None:
        self._subs: dict[str, list[asyncio.Queue[PipelineEvent]]] = {}

    def subscribe(self, workspace_id: str) -> asyncio.Queue[PipelineEvent]:
        q: asyncio.Queue[PipelineEvent] = asyncio.Queue(maxsize=256)
        self._subs.setdefault(workspace_id, []).append(q)
        return q

    def unsubscribe(self, workspace_id: str, q: asyncio.Queue[PipelineEvent]) -> None:
        subs = self._subs.get(workspace_id, [])
        try:
            subs.remove(q)
        except ValueError:
            pass

    def publish(self, event: PipelineEvent) -> None:
        for q in list(self._subs.get(event.workspace_id, [])):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass  # slow consumer — drop rather than block the pipeline


def make_event(
    document_id: str,
    workspace_id: str,
    status: str,
    elapsed_ms: int,
    retry_count: int = 0,
    filename: str | None = None,
    error: str | None = None,
) -> PipelineEvent:
    return PipelineEvent(
        document_id=document_id,
        workspace_id=workspace_id,
        stage=STATUS_TO_STAGE.get(status, "unknown"),
        status=status,
        progress=STATUS_TO_PROGRESS.get(status, 0),
        elapsed_ms=elapsed_ms,
        worker=_WORKER_ID,
        retry_count=retry_count,
        timestamp=datetime.now(UTC).isoformat(),
        filename=filename,
        error=error,
    )


# Application-wide singleton — imported by all pipeline modules
event_bus = EventBus()
