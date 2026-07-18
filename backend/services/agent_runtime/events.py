"""
Agent Runtime events — emitted on every state transition.

These events are:
- Pushed to the in-process asyncio.Queue (per-run subscriber)
- Published to Redis on `clarity:agent:{run_id}` (cross-pod relay)
- Persisted to agent_run_events (history + resume)
- Sent verbatim to the SSE client as `data: {json}\n\n`

Event types are the contract between the runtime, the API, and the
frontend reducer. The frontend mirrors these in `StreamEvent` union.
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Literal

EventType = Literal[
    "run_started",
    "plan_created",
    "node_started",
    "node_completed",
    "node_failed",
    "tool_started",
    "tool_completed",
    "tool_retried",
    "tool_timeout",
    "tool_failed",
    "memory_written",
    "memory_recalled",
    "critic_verdict",
    "trust_score",
    "abstention",
    "decision",
    "approval_requested",
    "approval_received",
    "token",          # streamed text token from the writer node
    "message",        # final assistant message
    "error",
    "cancelled",
    "completed",
    "resumed",
]


@dataclass
class AgentRuntimeEvent:
    """One event in the run's timeline.

    Fields use snake_case to match the SSE wire format. The frontend
    reducer (lib/agentStream.ts::applyAgentStreamEvent) reads these
    directly. Order of fields is preserved by `to_sse()`.
    """
    type: EventType
    run_id: str
    sequence: int
    timestamp: str
    node_id: str | None = None
    node_type: str | None = None
    parent_node_id: str | None = None
    attempt: int = 1
    payload: dict[str, Any] = field(default_factory=dict)
    elapsed_ms: int = 0
    total_tokens_in: int = 0
    total_tokens_out: int = 0
    total_cost_usd: float = 0.0

    def to_sse(self) -> str:
        return f"id: {self.sequence}\ndata: {json.dumps(self.__dict__, default=str)}\n\n"

    def to_dict(self) -> dict[str, Any]:
        return self.__dict__.copy()


def make_event(
    event_type: EventType,
    run_id: str,
    sequence: int,
    *,
    node_id: str | None = None,
    node_type: str | None = None,
    parent_node_id: str | None = None,
    attempt: int = 1,
    payload: dict[str, Any] | None = None,
    elapsed_ms: int = 0,
    tokens_in: int = 0,
    tokens_out: int = 0,
    cost_usd: float = 0.0,
) -> AgentRuntimeEvent:
    return AgentRuntimeEvent(
        type=event_type,
        run_id=run_id,
        sequence=sequence,
        timestamp=datetime.now(UTC).isoformat(),
        node_id=node_id,
        node_type=node_type,
        parent_node_id=parent_node_id,
        attempt=attempt,
        payload=payload or {},
        elapsed_ms=elapsed_ms,
        total_tokens_in=tokens_in,
        total_tokens_out=tokens_out,
        total_cost_usd=cost_usd,
    )


# Sequence-number allocation is per-run, monotonic, thread-safe via the
# runtime's asyncio.Lock. SSE clients use `Last-Event-ID` (the sequence
# number) to resume after a disconnect — the REST replay endpoint
# returns events with sequence > `last-event-id` from agent_run_events.


class EventRecorder:
    """Wraps a sequence counter + in-memory ring buffer for an active run.

    The full history is also persisted to `agent_run_events` (one row per
    event) so a reconnecting client can replay via the REST endpoint
    `/api/agents/runs/{id}/stream?after=N`.
    """
    def __init__(self, run_id: str, max_buffer: int = 1024) -> None:
        self.run_id = run_id
        self._seq = 0
        self._buffer: list[AgentRuntimeEvent] = []
        self._max = max_buffer
        self._t0 = time.monotonic()

    def elapsed_ms(self) -> int:
        return int((time.monotonic() - self._t0) * 1000)

    def next(self) -> int:
        self._seq += 1
        return self._seq

    def append(self, event: AgentRuntimeEvent) -> AgentRuntimeEvent:
        self._buffer.append(event)
        if len(self._buffer) > self._max:
            # Keep the most recent half — older events are in DB anyway
            self._buffer = self._buffer[-self._max // 2 :]
        return event

    def history(self, after_sequence: int = 0) -> list[AgentRuntimeEvent]:
        return [e for e in self._buffer if e.sequence > after_sequence]
