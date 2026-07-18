"""
Agent Runtime event bus — extends the existing pipeline event bus with
a per-run pub/sub channel for live SSE streaming.

Pattern mirrors `services.events.bus.py`:
  - In-process asyncio.Queue per run_id (immediate, low latency)
  - Redis PUBLISH on `clarity:agent:{run_id}` (cross-pod relay)
  - Best-effort DB persistence to `agent_run_events` (history + resume)

The runtime publishes events through `AgentRuntimeEventBus.publish()`;
the API router subscribes per-request via `subscribe()` to stream SSE
to the browser. The bus is a sibling of the pipeline bus so the two
systems never interfere.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import socket
from dataclasses import asdict

from services.agent_runtime.events import AgentRuntimeEvent

logger = logging.getLogger(__name__)

_WORKER_ID = f"{os.getpid()}@{socket.gethostname()}"


class AgentRuntimeEventBus:
    """Per-run pub/sub. Singleton."""

    def __init__(self) -> None:
        self._subs: dict[str, list[asyncio.Queue[AgentRuntimeEvent]]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, run_id: str) -> asyncio.Queue[AgentRuntimeEvent]:
        q: asyncio.Queue[AgentRuntimeEvent] = asyncio.Queue(maxsize=1024)
        async with self._lock:
            self._subs.setdefault(run_id, []).append(q)
        return q

    async def unsubscribe(self, run_id: str, q: asyncio.Queue[AgentRuntimeEvent]) -> None:
        async with self._lock:
            subs = self._subs.get(run_id, [])
            try:
                subs.remove(q)
            except ValueError:
                pass

    def publish(self, event: AgentRuntimeEvent) -> None:
        """Push to local subscribers immediately, fire-and-forget the
        Redis relay. Safe to call from sync code paths.
        """
        for q in list(self._subs.get(event.run_id, [])):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass  # slow consumer — drop rather than block
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self._publish_to_redis(event))
        except RuntimeError:
            pass

    async def _publish_to_redis(self, event: AgentRuntimeEvent) -> None:
        try:
            from cache.client import get_redis
            r = get_redis()
            if r is None:
                return
            channel = f"clarity:agent:{event.run_id}"
            payload = {**asdict(event), "_worker": _WORKER_ID}
            await r.publish(channel, json.dumps(payload, default=str))
        except Exception as exc:
            logger.debug("agent_bus_redis_publish error: %s", exc)


# Singleton
agent_bus = AgentRuntimeEventBus()


async def start_agent_redis_relay() -> None:
    """Background task: subscribe to clarity:agent:* and forward events
    from OTHER worker processes into the local bus. Reconnects on failure.
    """
    from cache.client import get_redis
    while True:
        r = get_redis()
        if r is None:
            await asyncio.sleep(30)
            continue
        try:
            pubsub = r.pubsub()
            await pubsub.psubscribe("clarity:agent:*")
            logger.info("agent_redis_relay_started pattern=clarity:agent:*")
            async for msg in pubsub.listen():
                if msg.get("type") != "pmessage":
                    continue
                try:
                    raw = msg["data"]
                    data = json.loads(raw if isinstance(raw, str) else raw.decode())
                    if data.get("_worker") == _WORKER_ID:
                        continue
                    data.pop("_worker", None)
                    event = AgentRuntimeEvent(**{
                        k: v for k, v in data.items()
                        if k in AgentRuntimeEvent.__dataclass_fields__
                    })
                    # Dispatch to local subscribers
                    for q in list(agent_bus._subs.get(event.run_id, [])):
                        try:
                            q.put_nowait(event)
                        except asyncio.QueueFull:
                            pass
                except Exception as exc:
                    logger.debug("agent_relay_parse_error: %s", exc)
        except Exception as exc:
            logger.warning("agent_relay_loop_exited: %s — reconnecting in 5s", exc)
            await asyncio.sleep(5)
