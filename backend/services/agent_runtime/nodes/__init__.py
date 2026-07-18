"""
Node base + decorators for the Agent Runtime execution graph.

A node is a stateless async function that takes the live `RuntimeState`
plus a `NodeContext` (workspace, memory, event recorder, cancellation)
and returns a `NodeResult`. The runtime chains nodes via the
`next_node_type` field in the returned state.

The `node()` decorator:
  - Generates a unique node_id
  - Tracks timing, tokens, cost (via the recorder callback)
  - Emits `node_started` / `node_completed` / `node_failed` events
  - Persists the node row to `agent_run_nodes` (best-effort)
  - Catches exceptions and surfaces them as `node_failed` events
    so the runtime can decide to retry, loop, or finish

A node can read state but should not mutate it directly — instead it
returns a `state_delta` dict that the runtime merges.
"""
from __future__ import annotations

import asyncio
import functools
import logging
import time
import traceback
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, TYPE_CHECKING
from uuid import uuid4

if TYPE_CHECKING:
    from services.agent_runtime.runtime import AgentRuntime
    from services.agent_runtime.memory import StepMemory
    from services.agent_runtime.events import EventRecorder

logger = logging.getLogger(__name__)


@dataclass
class NodeContext:
    """Live per-invocation context passed to every node."""
    workspace_id: str
    run_id: str
    agent_id: str
    user_id: str | None
    memory: "StepMemory"
    runtime: "AgentRuntime"            # the running AgentRuntime (for nested invokes)
    recorder: "EventRecorder"
    cancel_event: asyncio.Event
    allowed_tools: list[str] = field(default_factory=list)
    parent_node_id: str | None = None
    attempt: int = 1


@dataclass
class NodeResult:
    """The structured return value of a node."""
    state_delta: dict[str, Any] = field(default_factory=dict)
    next_node_type: str | None = None
    tool_call: dict[str, Any] | None = None   # if the node is an action wrapper
    tool_result: dict[str, Any] | None = None
    output: dict[str, Any] | None = None
    error: str | None = None
    tokens_in: int = 0
    tokens_out: int = 0
    cost_usd: float = 0.0
    persist: dict[str, Any] | None = None    # arbitrary metadata to store on the node row
    parent_node_id: str | None = None


def node(
    node_type: str,
    *,
    max_attempts: int = 1,
    description: str = "",
) -> Callable[[Callable[..., Awaitable[NodeResult]]], Callable[..., Awaitable[tuple[str, NodeResult]]]]:
    """Decorator: turn an async function into an instrumented node.

    The wrapped function must accept `(state, ctx)` and return a NodeResult.
    The decorator emits start/complete/failed events, persists the row,
    and catches exceptions.
    """
    def decorator(
        fn: Callable[..., Awaitable[NodeResult]],
    ) -> Callable[..., Awaitable[tuple[str, NodeResult]]]:
        @functools.wraps(fn)
        async def wrapper(state: dict[str, Any], ctx: NodeContext) -> tuple[str, NodeResult]:
            from services.agent_runtime.events import make_event

            node_id = f"n_{uuid4().hex[:12]}"
            attempt = ctx.attempt
            t0 = time.monotonic()
            ctx.parent_node_id = state.get("current_node_id")

            started_payload: dict[str, Any] = {
                "node_id": node_id,
                "node_type": node_type,
                "attempt": attempt,
            }
            if description:
                started_payload["description"] = description
            ctx.recorder.append(
                make_event(
                    "node_started",
                    ctx.run_id,
                    ctx.recorder.next(),
                    node_id=node_id,
                    node_type=node_type,
                    parent_node_id=ctx.parent_node_id,
                    attempt=attempt,
                    payload=started_payload,
                    elapsed_ms=ctx.recorder.elapsed_ms(),
                    tokens_in=state.get("total_tokens_in", 0),
                    tokens_out=state.get("total_tokens_out", 0),
                    cost_usd=float(state.get("total_cost_usd", 0.0)),
                )
            )
            if ctx.runtime is not None:
                try:
                    await ctx.runtime.persist_node_start(
                        node_id=node_id,
                        node_type=node_type,
                        parent_node_id=ctx.parent_node_id,
                        attempt=attempt,
                        input_summary=_summarise_state(state),
                    )
                except Exception as exc:  # never let persistence crash the run
                    logger.debug("node_start_persist_failed: %s", exc)

            try:
                if ctx.cancel_event.is_set():
                    raise asyncio.CancelledError("cancelled_before_execution")

                result: NodeResult = await fn(state, ctx)
                latency_ms = int((time.monotonic() - t0) * 1000)

                if ctx.runtime is not None:
                    try:
                        await ctx.runtime.persist_node_complete(
                            node_id=node_id,
                            node_type=node_type,
                            parent_node_id=ctx.parent_node_id,
                            attempt=attempt,
                            status="success" if result.error is None else "error",
                            input_summary=_summarise_state(state),
                            output=result.output or {},
                            error=result.error,
                            latency_ms=latency_ms,
                            tokens_in=result.tokens_in,
                            tokens_out=result.tokens_out,
                            cost_usd=result.cost_usd,
                        )
                    except Exception as exc:
                        logger.debug("node_complete_persist_failed: %s", exc)

                ctx.recorder.append(
                    make_event(
                        "node_completed" if result.error is None else "node_failed",
                        ctx.run_id,
                        ctx.recorder.next(),
                        node_id=node_id,
                        node_type=node_type,
                        parent_node_id=ctx.parent_node_id,
                        attempt=attempt,
                        payload={
                            "latency_ms": latency_ms,
                            "next_node_type": result.next_node_type,
                            "error": result.error,
                            **(result.output or {}),
                        },
                        elapsed_ms=ctx.recorder.elapsed_ms(),
                        tokens_in=state.get("total_tokens_in", 0) + result.tokens_in,
                        tokens_out=state.get("total_tokens_out", 0) + result.tokens_out,
                        cost_usd=float(state.get("total_cost_usd", 0.0)) + result.cost_usd,
                    )
                )

                return node_id, result

            except asyncio.CancelledError:
                latency_ms = int((time.monotonic() - t0) * 1000)
                ctx.recorder.append(
                    make_event(
                        "cancelled",
                        ctx.run_id,
                        ctx.recorder.next(),
                        node_id=node_id,
                        node_type=node_type,
                        parent_node_id=ctx.parent_node_id,
                        attempt=attempt,
                        payload={"latency_ms": latency_ms, "reason": "cancelled_during_node"},
                        elapsed_ms=ctx.recorder.elapsed_ms(),
                    )
                )
                raise
            except Exception as exc:
                latency_ms = int((time.monotonic() - t0) * 1000)
                tb = traceback.format_exc()
                logger.warning("node_failed id=%s type=%s\n%s", node_id, node_type, tb)
                ctx.recorder.append(
                    make_event(
                        "node_failed",
                        ctx.run_id,
                        ctx.recorder.next(),
                        node_id=node_id,
                        node_type=node_type,
                        parent_node_id=ctx.parent_node_id,
                        attempt=attempt,
                        payload={"latency_ms": latency_ms, "error": str(exc), "traceback": tb[-2000:]},
                        elapsed_ms=ctx.recorder.elapsed_ms(),
                    )
                )
                if ctx.runtime is not None:
                    try:
                        await ctx.runtime.persist_node_complete(
                            node_id=node_id,
                            node_type=node_type,
                            parent_node_id=ctx.parent_node_id,
                            attempt=attempt,
                            status="error",
                            input_summary=_summarise_state(state),
                            output={},
                            error=str(exc),
                            latency_ms=latency_ms,
                            tokens_in=0,
                            tokens_out=0,
                            cost_usd=0.0,
                        )
                    except Exception:
                        pass
                return node_id, NodeResult(
                    error=str(exc),
                    state_delta={"last_error": str(exc)},
                    output={"traceback": tb[-1000:]},
                )

        wrapper.__node_type__ = node_type  # type: ignore[attr-defined]
        wrapper.__node_max_attempts__ = max_attempts  # type: ignore[attr-defined]
        wrapper.__node_description__ = description  # type: ignore[attr-defined]
        return wrapper

    return decorator


def _summarise_state(state: dict[str, Any]) -> dict[str, Any]:
    """Compact, JSON-safe summary of the live state for node-row persistence."""
    summary: dict[str, Any] = {}
    for key in (
        "current_step_index",
        "current_node_id",
        "next_node_type",
        "status",
        "trust_score",
        "confidence",
        "abstained",
        "loop_count",
        "max_depth",
        "total_tokens_in",
        "total_tokens_out",
        "total_cost_usd",
    ):
        if key in state:
            summary[key] = state[key]
    if "plan" in state and isinstance(state["plan"], list):
        summary["plan_length"] = len(state["plan"])
    if "memory" in state and isinstance(state["memory"], list):
        summary["memory_entries"] = len(state["memory"])
    return summary
