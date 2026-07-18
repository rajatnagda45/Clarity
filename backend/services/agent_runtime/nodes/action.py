"""
Action node — execute one tool call from the plan step.

Wraps `ToolRegistry.invoke` and:
  - Emits `tool_started` and `tool_completed`/`tool_failed`/`tool_timeout` events
  - Persists the tool call row to `agent_tool_calls` (reused table)
  - Updates the runtime's running token/cost counters
  - On failure, increments a retry counter; the Decision node decides
    whether to retry, skip, or finish

The retry policy is encoded in the tool decorator (`@tool(...)`). The
node itself does not retry; it just records the outcome.
"""
from __future__ import annotations

import logging
import time
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from services.agent_runtime.nodes import NodeContext, NodeResult, node
from services.agent_runtime.tools import get_tool_registry

logger = logging.getLogger(__name__)


@node("action", description="Execute the tool the planner selected for this step")
async def action_node(state: dict[str, Any], ctx: NodeContext) -> NodeResult:
    plan = state.get("plan", [])
    step_index = state.get("current_step_index", 0)
    if step_index >= len(plan):
        return NodeResult(next_node_type="decision", state_delta={})

    current = plan[step_index]
    tool_name = current.get("tool")
    tool_args = current.get("tool_args") or {}
    if not tool_name:
        return NodeResult(
            next_node_type="decision",
            state_delta={},
            output={"skipped": True, "reason": "no_tool_for_step"},
        )

    registry = get_tool_registry()
    if not registry.has(tool_name):
        return NodeResult(
            next_node_type="decision",
            state_delta={"last_error": f"unknown_tool:{tool_name}"},
            error=f"unknown_tool:{tool_name}",
        )

    tool_call_id = f"tc_{uuid4().hex[:12]}"
    started_at = datetime.now(UTC).isoformat()
    from services.agent_runtime.events import make_event
    ctx.recorder.append(
        make_event(
            "tool_started",
            ctx.run_id,
            ctx.recorder.next(),
            node_id=ctx.runtime.current_node_id or "n_action",
            node_type="action",
            payload={
                "tool_call_id": tool_call_id,
                "tool": tool_name,
                "tool_args": tool_args,
            },
            elapsed_ms=ctx.recorder.elapsed_ms(),
        )
    )

    from services.agent_runtime.tools.base import ToolContext
    tool_ctx = ToolContext(
        workspace_id=ctx.workspace_id,
        run_id=ctx.run_id,
        agent_id=ctx.agent_id,
        user_id=ctx.user_id,
        allowed_collections=ctx.runtime.config.get("allowed_collections", []),
        memory=ctx.memory,
        emit=lambda t, p: _emit_via_recorder(ctx, t, p, tool_call_id, tool_name),
        total_tokens_in=state.get("total_tokens_in", 0),
        total_tokens_out=state.get("total_tokens_out", 0),
        total_cost_usd=float(state.get("total_cost_usd", 0.0)),
        cancel_event=ctx.cancel_event,
    )

    t0 = time.monotonic()
    try:
        result = await registry.invoke(tool_name, tool_ctx, **tool_args)
    except Exception as exc:
        logger.warning("tool_invoke_unexpected tool=%s: %s", tool_name, exc)
        err_message = str(exc)
        result = type("R", (), {
            "ok": False,
            "data": {},
            "error": err_message,
            "error_kind": "fatal",
            "metadata": {},
            "tokens_in": 0,
            "tokens_out": 0,
            "cost_usd": 0.0,
            "to_dict": lambda self=None, _e=err_message: {
                "ok": False, "data": {}, "error": _e, "error_kind": "fatal",
            },
        })()

    latency_ms = int((time.monotonic() - t0) * 1000)
    completed_at = datetime.now(UTC).isoformat()

    # Build the public tool-call record (matches agent_tool_calls schema)
    public_payload = {
        "id": tool_call_id,
        "run_id": ctx.run_id,
        "workspace_id": ctx.workspace_id,
        "tool_name": tool_name,
        "input": tool_args,
        "output": result.data if result.ok else None,
        "status": (
            "success" if result.ok and result.error_kind != "cancelled"
            else ("timeout" if result.error_kind == "timeout" else "error")
        ),
        "latency_ms": latency_ms,
        "created_at": started_at,
        "completed_at": completed_at,
        "error_message": result.error,
        "error_kind": result.error_kind,
    }
    ctx.runtime.persist_tool_call(public_payload)

    # Emit the completion event
    event_type = (
        "tool_completed" if result.ok and result.error_kind != "cancelled"
        else "tool_failed" if result.error_kind in ("fatal", "retryable")
        else "tool_timeout" if result.error_kind == "timeout"
        else "cancelled"
    )
    ctx.recorder.append(
        make_event(
            event_type,
            ctx.run_id,
            ctx.recorder.next(),
            node_id=ctx.runtime.current_node_id or "n_action",
            node_type="action",
            payload={
                "tool_call_id": tool_call_id,
                "tool": tool_name,
                "ok": result.ok,
                "latency_ms": latency_ms,
                "tokens_in": result.tokens_in,
                "tokens_out": result.tokens_out,
                "cost_usd": result.cost_usd,
                "error": result.error,
                "error_kind": result.error_kind,
                "data_preview": _preview_data(result.data),
            },
            elapsed_ms=ctx.recorder.elapsed_ms(),
            tokens_in=result.tokens_in,
            tokens_out=result.tokens_out,
            cost_usd=result.cost_usd,
        )
    )

    delta: dict[str, Any] = {}
    if result.tokens_in:
        delta["total_tokens_in"] = state.get("total_tokens_in", 0) + result.tokens_in
    if result.tokens_out:
        delta["total_tokens_out"] = state.get("total_tokens_out", 0) + result.tokens_out
    if result.cost_usd:
        delta["total_cost_usd"] = float(state.get("total_cost_usd", 0.0)) + result.cost_usd
    delta["last_tool_result"] = {
        "tool": tool_name,
        "ok": result.ok,
        "data": result.data,
        "error": result.error,
    }
    if not result.ok:
        delta["last_error"] = result.error

    return NodeResult(
        state_delta=delta,
        next_node_type="verifier" if result.ok and result.tokens_in + result.tokens_out > 0 else "decision",
        output={
            "tool": tool_name,
            "tool_call_id": tool_call_id,
            "ok": result.ok,
            "data": result.data,
            "error": result.error,
            "latency_ms": latency_ms,
        },
        error=result.error,
        tokens_in=result.tokens_in,
        tokens_out=result.tokens_out,
        cost_usd=result.cost_usd,
    )


def _emit_via_recorder(ctx: NodeContext, event_type: str, payload: dict[str, Any], tool_call_id: str, tool_name: str) -> None:
    """Hook used by tool decorators to emit `tool_retried` and `tool_timeout` events."""
    from services.agent_runtime.events import make_event
    if event_type == "tool_retried":
        ctx.recorder.append(
            make_event(
                "tool_retried",
                ctx.run_id,
                ctx.recorder.next(),
                node_id=ctx.runtime.current_node_id or "n_action",
                node_type="action",
                payload={
                    "tool_call_id": tool_call_id,
                    "tool": tool_name,
                    **payload,
                },
                elapsed_ms=ctx.recorder.elapsed_ms(),
            )
        )
    elif event_type == "tool_timeout":
        ctx.recorder.append(
            make_event(
                "tool_timeout",
                ctx.run_id,
                ctx.recorder.next(),
                node_id=ctx.runtime.current_node_id or "n_action",
                node_type="action",
                payload={
                    "tool_call_id": tool_call_id,
                    "tool": tool_name,
                    **payload,
                },
                elapsed_ms=ctx.recorder.elapsed_ms(),
            )
        )


def _preview_data(data: dict[str, Any]) -> dict[str, Any]:
    """Truncate large tool outputs for the SSE event payload."""
    if not isinstance(data, dict):
        return {"value": str(data)[:200]}
    out: dict[str, Any] = {}
    for k, v in data.items():
        if isinstance(v, str) and len(v) > 400:
            out[k] = v[:400] + "…"
        elif isinstance(v, list) and len(v) > 5:
            out[k] = f"<{len(v)} items>"
        else:
            out[k] = v
    return out
