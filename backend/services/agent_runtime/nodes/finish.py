"""
Finish node — finalise the run.

Persists the run's final state to `agent_runs` (extended columns from
migration 018), emits the `completed` or `failed` runtime event, and
inserts a row into `review_queue` if human review is required (so the
existing UI surfaces it).

The run can finish in one of:
  - completed:        normal completion
  - failed:           unrecoverable error
  - cancelled:        user cancelled
  - awaiting_approval: parked for human review
  - review_required:  completed but trust below threshold
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from services.agent_runtime.events import make_event
from services.agent_runtime.nodes import NodeContext, NodeResult, node

logger = logging.getLogger(__name__)


@node("finish", description="Persist final state, emit terminal event, optional review_queue row")
async def finish_node(state: dict[str, Any], ctx: NodeContext) -> NodeResult:
    now = datetime.now(UTC).isoformat()
    status = state.get("status") or "completed"
    if state.get("abstained") and status == "completed":
        status = "review_required"
    if state.get("cancel_requested"):
        status = "cancelled"
    if state.get("last_error") and status == "completed":
        status = "failed"

    final_output = state.get("final_output") or state.get("last_tool_result", {}).get("data", {}).get("report", "")
    review_required = status == "review_required"

    persisted = {
        "status": status,
        "output": final_output,
        "trust_score": state.get("trust_score"),
        "confidence": state.get("confidence"),
        "total_tokens_in": state.get("total_tokens_in", 0),
        "total_tokens_out": state.get("total_tokens_out", 0),
        "total_cost_usd": float(state.get("total_cost_usd", 0.0)),
        "completed_at": now,
        "human_review_required": review_required,
    }
    ctx.runtime.persist_run_finalisation(persisted)

    if review_required:
        try:
            review_row = {
                "id": str(uuid4()),
                "workspace_id": ctx.workspace_id,
                "agent_id": ctx.agent_id,
                "agent_name": state.get("agent_config", {}).get("name", ""),
                "run_id": ctx.run_id,
                "input": state.get("user_input", ""),
                "output": final_output or "",
                "trust_score": state.get("trust_score"),
                "confidence": state.get("confidence"),
                "reason": state.get("abstention_reason") or "trust_below_threshold",
                "priority": "high" if (state.get("trust_score") or 1.0) < 0.4 else "medium",
                "status": "pending",
                "created_at": now,
            }
            ctx.runtime.persist_review_queue(review_row)
        except Exception as exc:
            logger.warning("review_queue_insert_failed: %s", exc)

    event_type = (
        "completed" if status == "completed"
        else "cancelled" if status == "cancelled"
        else "error"
    )
    ctx.recorder.append(
        make_event(
            event_type,
            ctx.run_id,
            ctx.recorder.next(),
            node_id=ctx.runtime.current_node_id or "n_finish",
            node_type="finish",
            payload={
                "status": status,
                "trust_score": state.get("trust_score"),
                "confidence": state.get("confidence"),
                "abstained": state.get("abstained", False),
                "total_cost_usd": float(state.get("total_cost_usd", 0.0)),
                "review_required": review_required,
            },
            elapsed_ms=ctx.recorder.elapsed_ms(),
            tokens_in=state.get("total_tokens_in", 0),
            tokens_out=state.get("total_tokens_out", 0),
            cost_usd=float(state.get("total_cost_usd", 0.0)),
        )
    )

    return NodeResult(
        state_delta={"status": status, "completed_at": now},
        next_node_type=None,
        output={"final_status": status},
    )
