"""
Pipeline event bus — in-process pub/sub with Redis relay and DB persistence.

Architecture
────────────
Pipeline stage
    ↓
event_bus.publish(event)          ← synchronous, non-blocking
    ├─→ asyncio.Queue per local SSE subscriber    (immediate, in-process)
    ├─→ Redis PUBLISH clarity:pipeline:{ws_id}    (cross-instance relay, async)
    └─→ INSERT INTO pipeline_events               (history, async fire-and-forget)

Redis relay (background task per instance)
    ↓
Subscribes to clarity:pipeline:*
    ↓
Forwards events from OTHER instances to local subscribers only
    (own events are skipped to prevent double-dispatch)

Graceful degradation
────────────────────
- Redis unavailable → in-process only (single-instance mode)
- pipeline_events table missing → DB writes silently skipped (log warning once)
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import socket
from dataclasses import asdict, dataclass
from datetime import UTC, datetime

import psutil

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Worker identity & process handle
# ---------------------------------------------------------------------------

_WORKER_ID = f"{os.getpid()}@{socket.gethostname()}"
_WORKER_VERSION = os.getenv("WORKER_VERSION", "dev")
_BUILD_SHA = os.getenv("BUILD_SHA", "unknown")
_PROCESS = psutil.Process(os.getpid())


def _get_worker_info() -> dict:
    try:
        mem_mb = round(_PROCESS.memory_info().rss / 1_048_576, 1)
        # cpu_percent(interval=None) is non-blocking — uses time since last call
        cpu = round(_PROCESS.cpu_percent(), 1)
    except Exception:
        mem_mb, cpu = 0.0, 0.0
    return {
        "pid": os.getpid(),
        "hostname": socket.gethostname(),
        "memory_mb": mem_mb,
        "cpu_percent": cpu,
        "worker_version": _WORKER_VERSION,
        "build": _BUILD_SHA,
    }


# ---------------------------------------------------------------------------
# Status mappings
# ---------------------------------------------------------------------------

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

# Baseline progress when no batch-level tracking is available.
# Batch loops (embed, upsert) override this with real-time computed values.
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


# ---------------------------------------------------------------------------
# Event dataclass
# ---------------------------------------------------------------------------

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
    # Cumulative wall-clock durations for each stage completed so far (ms).
    # Keys: fetch_ms, extract_ms, normalize_ms, preprocess_ms, chunk_ms,
    #       persist_ms, embed_ms, upsert_ms
    stage_timings: dict | None = None
    # Snapshot of the worker process at event creation time.
    # Keys: pid, hostname, memory_mb, cpu_percent, worker_version, build
    worker_info: dict | None = None

    def to_sse(self) -> str:
        return f"data: {json.dumps(asdict(self))}\n\n"


# ---------------------------------------------------------------------------
# Event bus
# ---------------------------------------------------------------------------

# Set once from bus internals to skip own events from Redis
_DB_PERSIST_WARNED = False


class EventBus:
    def __init__(self) -> None:
        self._subs: dict[str, list[asyncio.Queue[PipelineEvent]]] = {}

    def subscribe(self, workspace_id: str) -> asyncio.Queue[PipelineEvent]:
        q: asyncio.Queue[PipelineEvent] = asyncio.Queue(maxsize=512)
        self._subs.setdefault(workspace_id, []).append(q)
        return q

    def unsubscribe(self, workspace_id: str, q: asyncio.Queue[PipelineEvent]) -> None:
        subs = self._subs.get(workspace_id, [])
        try:
            subs.remove(q)
        except ValueError:
            pass

    def _dispatch_local(self, event: PipelineEvent) -> None:
        """Push to all local subscriber queues without triggering relay or persistence."""
        for q in list(self._subs.get(event.workspace_id, [])):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass  # slow consumer — drop rather than block pipeline

    def publish(self, event: PipelineEvent) -> None:
        """
        Dispatch to local subscribers immediately, then fire-and-forget the
        async tasks for Redis relay and DB persistence.

        Safe to call from synchronous code that runs within an asyncio event
        loop (i.e., sync functions called directly from async coroutines).
        """
        self._dispatch_local(event)
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self._relay_and_persist(event))
        except RuntimeError:
            pass  # no running loop (test context, etc.)

    async def _relay_and_persist(self, event: PipelineEvent) -> None:
        await asyncio.gather(
            _publish_to_redis(event),
            _persist_to_db(event),
            return_exceptions=True,
        )


# Singleton
event_bus = EventBus()


# ---------------------------------------------------------------------------
# Redis relay
# ---------------------------------------------------------------------------

async def _publish_to_redis(event: PipelineEvent) -> None:
    from cache.client import get_redis
    r = get_redis()
    if r is None:
        return
    try:
        channel = f"clarity:pipeline:{event.workspace_id}"
        await r.publish(channel, json.dumps(asdict(event)))
    except Exception as exc:
        logger.debug("redis_publish error: %s", exc)


async def start_redis_relay() -> None:
    """
    Background task: subscribe to the Redis pipeline channel pattern and
    forward events from OTHER instances into the local EventBus.

    Run once at application startup via asyncio.create_task().
    Reconnects automatically if the subscription drops.
    """
    from cache.client import get_redis
    while True:
        r = get_redis()
        if r is None:
            await asyncio.sleep(30)
            continue
        try:
            pubsub = r.pubsub()
            await pubsub.psubscribe("clarity:pipeline:*")
            logger.info("redis_relay_started pattern=clarity:pipeline:*")
            async for msg in pubsub.listen():
                if msg.get("type") != "pmessage":
                    continue
                try:
                    raw = msg["data"]
                    data = json.loads(raw if isinstance(raw, str) else raw.decode())
                    # Skip events we published — already dispatched locally
                    if data.get("worker") == _WORKER_ID:
                        continue
                    fields = PipelineEvent.__dataclass_fields__
                    event = PipelineEvent(**{k: data.get(k) for k in fields})
                    event_bus._dispatch_local(event)
                except Exception as exc:
                    logger.debug("redis_relay parse error: %s", exc)
        except Exception as exc:
            logger.warning("redis_relay_loop exited: %s — reconnecting in 5 s", exc)
            await asyncio.sleep(5)


# ---------------------------------------------------------------------------
# DB persistence
# ---------------------------------------------------------------------------

async def _persist_to_db(event: PipelineEvent) -> None:
    global _DB_PERSIST_WARNED
    try:
        from db.client import get_client
        row = {
            "workspace_id": event.workspace_id,
            "document_id": event.document_id,
            "filename": event.filename,
            "stage": event.stage,
            "status": event.status,
            "progress": event.progress,
            "elapsed_ms": event.elapsed_ms,
            "worker": event.worker,
            "retry_count": event.retry_count,
            "error": event.error,
            "stage_timings": event.stage_timings,
            "worker_info": event.worker_info,
        }
        await asyncio.to_thread(
            lambda: get_client().table("pipeline_events").insert(row).execute()
        )
    except Exception as exc:
        if not _DB_PERSIST_WARNED:
            logger.warning(
                "pipeline_events table not available — run migrations/001_pipeline_events.sql. error=%s",
                exc,
            )
            _DB_PERSIST_WARNED = True


# ---------------------------------------------------------------------------
# Event factory
# ---------------------------------------------------------------------------

def make_event(
    document_id: str,
    workspace_id: str,
    status: str,
    elapsed_ms: int,
    retry_count: int = 0,
    filename: str | None = None,
    error: str | None = None,
    progress_override: int | None = None,
    stage_timings: dict | None = None,
) -> PipelineEvent:
    """
    Create a PipelineEvent with worker metadata and stage timings snapshot.

    progress_override: use this instead of the status-based default, e.g.
        when reporting mid-batch progress during embedding or indexing loops.
    stage_timings: pass dict(stage_timings) to snapshot the current timings.
    """
    return PipelineEvent(
        document_id=document_id,
        workspace_id=workspace_id,
        stage=STATUS_TO_STAGE.get(status, "unknown"),
        status=status,
        progress=(
            progress_override
            if progress_override is not None
            else STATUS_TO_PROGRESS.get(status, 0)
        ),
        elapsed_ms=elapsed_ms,
        worker=_WORKER_ID,
        retry_count=retry_count,
        timestamp=datetime.now(UTC).isoformat(),
        filename=filename,
        error=error,
        stage_timings=stage_timings,
        worker_info=_get_worker_info(),
    )
