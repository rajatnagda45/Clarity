"""
AgentRuntime — the executor.

Owns:
  - RuntimeState (per run)
  - StepMemory (per run)
  - EventRecorder (per run)
  - ToolContext (per Action node)
  - NodeContext (per node invocation)
  - Cancellation (per run, shared via asyncio.Event)
  - Persistence (shared across all runs in a workspace)

Public API:
  runtime = AgentRuntime(run_id, workspace_id, agent_config, user_input)
  await runtime.execute(user_id=...)  # runs to completion or cancellation

The executor is the only public entry point used by the API router
(`api/routers/agent_runtime.py`).
"""
from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any, Callable
from uuid import uuid4

from db.client import get_client
from services.agent_runtime.events import AgentRuntimeEvent, EventRecorder, make_event
from services.agent_runtime.graph import NodeVisitCounter, get_node
from services.agent_runtime.memory import StepMemory
from services.agent_runtime.nodes import NodeContext
from services.agent_runtime.persistence import PersistenceLayer
from services.agent_runtime.state import RuntimeState

logger = logging.getLogger(__name__)


class AgentRuntime:
    """One instance per agent run. Holds live state; runs the graph to
    completion (or cancellation). Not thread-safe — instantiate per run."""

    def __init__(
        self,
        run_id: str,
        workspace_id: str,
        agent_config: dict[str, Any],
        user_input: str,
        *,
        allowed_tools: list[str] | None = None,
        on_token: Callable[[str], None] | None = None,
        on_event: Callable[[AgentRuntimeEvent], None] | None = None,
        max_depth: int = 25,
        max_loop_count: int = 3,
        memory_window: int = 20,
    ) -> None:
        self.run_id = run_id
        self.workspace_id = workspace_id
        self.config = {
            **agent_config,
            "allowed_tools": list(allowed_tools or agent_config.get("allowed_tools") or []),
            "allowed_collections": list(agent_config.get("allowed_collections") or []),
        }
        self.user_input = user_input
        self.on_token = on_token
        self.on_event = on_event
        self.max_depth = max_depth
        self.max_loop_count = max_loop_count
        self.cancel_event = asyncio.Event()
        self.recorder = EventRecorder(run_id)
        self.persistence = PersistenceLayer(workspace_id)
        self.memory = StepMemory(
            run_id=run_id,
            workspace_id=workspace_id,
            max_entries=memory_window,
            persist_fn=self._persist_memory,
        )
        self.state: RuntimeState = {
            "run_id": run_id,
            "agent_id": agent_config.get("id", ""),
            "workspace_id": workspace_id,
            "request_id": str(uuid4()),
            "plan": [],
            "current_step_index": 0,
            "current_node_id": None,
            "next_node_type": "planner",
            "loop_count": 0,
            "max_depth": 0,
            "max_depth_cap": max_depth,
            "max_loop_count": max_loop_count,
            "status": "queued",
            "memory": [],
            "memory_window": memory_window,
            "pending_tool_call": None,
            "tool_history": [],
            "claims": [],
            "evidence_spans": [],
            "trust_score": None,
            "confidence": None,
            "abstained": False,
            "abstention_reason": None,
            "total_tokens_in": 0,
            "total_tokens_out": 0,
            "total_cost_usd": 0.0,
            "started_at": datetime.now(UTC).isoformat(),
            "completed_at": None,
            "node_history": [],
            "final_output": None,
            "final_citations": [],
            "cancel_requested": False,
            "pause_reason": None,
            "agent_config": agent_config,
            "user_input": user_input,
        }
        self._visits = NodeVisitCounter(counts={}, max_per_node=max_loop_count)

    # ─── Public lifecycle ────────────────────────────────────────────────────

    async def execute(self, *, user_id: str | None = None) -> RuntimeState:
        """Run the graph to completion. Returns the final state."""
        self.state["user_id"] = user_id
        self.state["status"] = "running"
        await self._emit(
            "run_started",
            payload={"agent_id": self.config.get("id"), "user_id": user_id},
        )
        await self._persist_status(status="running")

        try:
            await self._run_loop()
        except asyncio.CancelledError:
            self.state["status"] = "cancelled"
            self.state["cancel_requested"] = True
            self.state["completed_at"] = datetime.now(UTC).isoformat()
            await self._persist_status(status="cancelled", completed_at=self.state["completed_at"])
            await self._emit("cancelled", payload={"reason": "external_cancel"})
            raise
        except Exception as exc:
            logger.exception("runtime_execute_failed run=%s", self.run_id)
            self.state["status"] = "failed"
            self.state["completed_at"] = datetime.now(UTC).isoformat()
            self.state["last_error"] = str(exc)
            await self._persist_status(
                status="failed",
                completed_at=self.state["completed_at"],
            )
            await self._emit("error", payload={"error": str(exc)})

        return self.state

    def request_cancel(self) -> None:
        """Signal the runtime to stop at the next node boundary. Idempotent."""
        if not self.cancel_event.is_set():
            self.cancel_event.set()
            self.state["cancel_requested"] = True

    # ─── Persistence hooks used by the nodes ────────────────────────────────

    async def persist_node_start(
        self,
        *,
        node_id: str,
        node_type: str,
        parent_node_id: str | None,
        attempt: int,
        input_summary: dict[str, Any],
    ) -> None:
        await self.persistence.insert_node_row(
            self.run_id,
            node_id=node_id,
            node_type=node_type,
            parent_node_id=parent_node_id,
            attempt=attempt,
            status="running",
            input_summary=input_summary,
        )

    async def persist_node_complete(
        self,
        *,
        node_id: str,
        node_type: str,
        parent_node_id: str | None,
        attempt: int,
        status: str,
        input_summary: dict[str, Any],
        output: dict[str, Any],
        error: str | None,
        latency_ms: int,
        tokens_in: int,
        tokens_out: int,
        cost_usd: float,
    ) -> None:
        await self.persistence.update_node_row(
            node_id,
            status=status,
            output=output,
            error=error,
            latency_ms=latency_ms,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            cost_usd=cost_usd,
        )

    def persist_tool_call(self, payload: dict[str, Any]) -> None:
        """Insert a row into agent_tool_calls (the existing table)."""
        try:
            get_client().table("agent_tool_calls").insert(payload).execute()
        except Exception as exc:
            logger.warning("persist_tool_call_failed: %s", exc)

    def persist_approval(self, payload: dict[str, Any]) -> None:
        asyncio.create_task(self.persistence.insert_approval_row(payload))

    def persist_run_finalisation(self, payload: dict[str, Any]) -> None:
        async def _do() -> None:
            try:
                await self.persistence.upsert_run_status(
                    self.run_id,
                    status=payload.get("status"),
                    output=payload.get("output"),
                    trust_score=payload.get("trust_score"),
                    confidence=payload.get("confidence"),
                    total_tokens_in=payload.get("total_tokens_in"),
                    total_tokens_out=payload.get("total_tokens_out"),
                    total_cost_usd=payload.get("total_cost_usd"),
                    completed_at=payload.get("completed_at"),
                    human_review_required=payload.get("human_review_required"),
                )
            except Exception as exc:
                logger.warning("persist_run_finalisation_failed: %s", exc)
        asyncio.create_task(_do())

    def persist_review_queue(self, payload: dict[str, Any]) -> None:
        try:
            get_client().table("review_queue").insert(payload).execute()
        except Exception as exc:
            logger.warning("persist_review_queue_failed: %s", exc)

    def _persist_memory(self, entry: dict[str, Any]) -> None:
        asyncio.create_task(self.persistence.insert_memory_row(entry, self.run_id))

    @property
    def current_node_id(self) -> str | None:
        return self.state.get("current_node_id")

    # ─── Graph execution loop ────────────────────────────────────────────────

    async def _run_loop(self) -> None:
        max_iterations = self.max_depth * 3  # safety cap
        iteration = 0

        while iteration < max_iterations:
            iteration += 1
            if self.cancel_event.is_set():
                self.state["status"] = "cancelled"
                return

            next_type = self.state.get("next_node_type") or "planner"
            if next_type is None or next_type == "finish":
                # The graph terminated via the finish node's no-op next
                return

            # Loop prevention: cap how many times the same node runs
            if not self._visits.visit(next_type):
                self.state["status"] = "failed"
                self.state["last_error"] = f"loop_cap_reached:{next_type}"
                await self._emit(
                    "node_failed",
                    node_type=next_type,
                    payload={"reason": "loop_cap", "visits": self._visits.snapshot()},
                )
                return

            fn = get_node(next_type)
            ctx = NodeContext(
                workspace_id=self.workspace_id,
                run_id=self.run_id,
                agent_id=self.config.get("id", ""),
                user_id=self.state.get("user_id"),
                memory=self.memory,
                runtime=self,
                recorder=self.recorder,
                cancel_event=self.cancel_event,
                allowed_tools=self.config.get("allowed_tools") or [],
                parent_node_id=self.state.get("current_node_id"),
                attempt=self._visits.counts[next_type],
            )

            try:
                node_id, result = await fn(self.state, ctx)
            except asyncio.CancelledError:
                self.state["status"] = "cancelled"
                self.state["cancel_requested"] = True
                raise
            except Exception as exc:
                logger.exception("node_dispatch_failed type=%s", next_type)
                self.state["status"] = "failed"
                self.state["last_error"] = str(exc)
                await self._emit("node_failed", node_type=next_type, payload={"error": str(exc)})
                return

            # Apply the delta and update cursors
            self.state["current_node_id"] = node_id
            self.state["max_depth"] = self.state.get("max_depth", 0) + 1
            self._apply_delta(result.state_delta)

            if result.next_node_type is not None:
                self.state["next_node_type"] = result.next_node_type
            if result.tokens_in:
                self.state["total_tokens_in"] = self.state.get("total_tokens_in", 0) + result.tokens_in
            if result.tokens_out:
                self.state["total_tokens_out"] = self.state.get("total_tokens_out", 0) + result.tokens_out
            if result.cost_usd:
                self.state["total_cost_usd"] = float(self.state.get("total_cost_usd", 0.0)) + result.cost_usd

            self.state["node_history"] = list(self.state.get("node_history") or []) + [{
                "id": node_id,
                "node_type": next_type,
                "status": "error" if result.error else "success",
                "output": result.output or {},
                "error": result.error,
                "latency_ms": (result.output or {}).get("latency_ms", 0),
                "tokens_in": result.tokens_in,
                "tokens_out": result.tokens_out,
                "cost_usd": result.cost_usd,
            }]

            # Persist the running status (best-effort)
            await self._persist_status(
                status=self.state.get("status", "running"),
                current_node=next_type,
            )

            if self.state.get("status") in ("completed", "failed", "cancelled", "awaiting_approval"):
                return

            if next_type == "finish" or result.next_node_type is None:
                return

    def _apply_delta(self, delta: dict[str, Any]) -> None:
        for k, v in delta.items():
            self.state[k] = v  # type: ignore[literal-required]

    # ─── Event helpers ───────────────────────────────────────────────────────

    async def _emit(
        self,
        event_type: str,
        *,
        node_id: str | None = None,
        node_type: str | None = None,
        parent_node_id: str | None = None,
        attempt: int = 1,
        payload: dict[str, Any] | None = None,
        tokens_in: int | None = None,
        tokens_out: int | None = None,
        cost_usd: float | None = None,
    ) -> None:
        ev = make_event(
            event_type,
            self.run_id,
            self.recorder.next(),
            node_id=node_id,
            node_type=node_type,
            parent_node_id=parent_node_id,
            attempt=attempt,
            payload=payload or {},
            elapsed_ms=self.recorder.elapsed_ms(),
            tokens_in=tokens_in if tokens_in is not None else self.state.get("total_tokens_in", 0),
            tokens_out=tokens_out if tokens_out is not None else self.state.get("total_tokens_out", 0),
            cost_usd=cost_usd if cost_usd is not None else float(self.state.get("total_cost_usd", 0.0)),
        )
        # Persist (best-effort)
        await self.persistence.insert_event_row(ev.to_dict())
        # Publish to the agent bus (in-process + cross-pod Redis)
        try:
            from services.agent_runtime.bus import agent_bus
            agent_bus.publish(ev)
        except Exception as exc:
            logger.debug("agent_bus_publish_failed: %s", exc)
        # Stream callback
        if self.on_event is not None:
            try:
                self.on_event(ev)
            except Exception as exc:
                logger.debug("on_event_callback_failed: %s", exc)

    async def _persist_status(
        self,
        *,
        status: str | None = None,
        current_node: str | None = None,
        completed_at: str | None = None,
    ) -> None:
        await self.persistence.upsert_run_status(
            self.run_id,
            status=status,
            current_node=current_node,
            completed_at=completed_at,
            plan=self.state.get("plan"),
        )
