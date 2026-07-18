"""
Resume — load a paused agent run from the DB and continue.

Two scenarios:
  1. Crash recovery: the run is in `status='running'` but no worker is
     driving it (process restart, OOM, etc.). `resume_run` reloads the
     state from `agent_runs` + `agent_run_nodes` + `agent_run_memory` and
     continues from the last persisted `current_node`.

  2. Human approval: the run is in `status='awaiting_approval'` with a
     pending `agent_run_approvals` row. The user calls
     `POST /api/agents/runs/{id}/approve` (or `/reject`). The API router
     calls `resume_run` after updating the approval row and the run
     status to `running`.
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from db.client import get_client
from services.agent_runtime.runtime import AgentRuntime

logger = logging.getLogger(__name__)


def _load_run_state(run_id: str, workspace_id: str) -> dict[str, Any] | None:
    """Read agent_runs and return a state dict suitable for the runtime."""
    try:
        rows = (
            get_client()
            .table("agent_runs")
            .select("*")
            .eq("id", run_id)
            .eq("workspace_id", workspace_id)
            .execute()
        ).data or []
    except Exception as exc:
        logger.warning("load_run_state_failed: %s", exc)
        return None
    if not rows:
        return None
    r = rows[0]
    return {
        "run_id": r["id"],
        "agent_id": r["agent_id"],
        "workspace_id": r["workspace_id"],
        "user_id": r.get("created_by"),
        "input": r.get("input"),
        "status": r.get("status"),
        "plan": r.get("plan") or [],
        "current_step_index": r.get("current_step_index", 0),
        "current_node": r.get("current_node"),
        "trust_score": r.get("trust_score"),
        "confidence": r.get("confidence"),
        "total_tokens_in": r.get("total_tokens_in", 0),
        "total_tokens_out": r.get("total_tokens_out", 0),
        "total_cost_usd": float(r.get("total_cost_usd", 0.0)),
        "agent_config": r.get("agent_config") or {},
    }


def _load_memory_entries(run_id: str, workspace_id: str) -> list[dict[str, Any]]:
    try:
        rows = (
            get_client()
            .table("agent_run_memory")
            .select("*")
            .eq("run_id", run_id)
            .eq("workspace_id", workspace_id)
            .order("created_at")
            .execute()
        ).data or []
    except Exception:
        return []
    out: list[dict[str, Any]] = []
    for r in rows:
        out.append({
            "id": r["id"],
            "role": r.get("role"),
            "content": r.get("content", ""),
            "tool": r.get("tool"),
            "metadata": r.get("metadata", {}) or {},
            "created_at": r.get("created_at"),
            "token_count": r.get("token_count", 0),
            "global_": r.get("scope") == "global",
        })
    return out


async def resume_run(
    run_id: str,
    workspace_id: str,
    *,
    on_token=None,
    on_event=None,
) -> AgentRuntime | None:
    """Rebuild a runtime from the DB and continue execution."""
    state_row = _load_run_state(run_id, workspace_id)
    if state_row is None:
        return None
    if state_row.get("status") not in ("running", "awaiting_approval", "queued"):
        logger.info("resume_skipped_not_resumable status=%s", state_row.get("status"))
        return None

    agent_config = state_row.get("agent_config") or {}
    user_input = state_row.get("input") or ""

    runtime = AgentRuntime(
        run_id=run_id,
        workspace_id=workspace_id,
        agent_config=agent_config,
        user_input=user_input,
        on_token=on_token,
        on_event=on_event,
    )
    # Hydrate state
    runtime.state["plan"] = state_row.get("plan") or []
    runtime.state["current_step_index"] = state_row.get("current_step_index", 0)
    runtime.state["trust_score"] = state_row.get("trust_score")
    runtime.state["confidence"] = state_row.get("confidence")
    runtime.state["total_tokens_in"] = state_row.get("total_tokens_in", 0)
    runtime.state["total_tokens_out"] = state_row.get("total_tokens_out", 0)
    runtime.state["total_cost_usd"] = state_row.get("total_cost_usd", 0.0)
    runtime.state["user_id"] = state_row.get("user_id")
    runtime.state["agent_config"] = agent_config
    # Reload memory entries into the StepMemory window
    for entry in _load_memory_entries(run_id, workspace_id):
        runtime.memory.window.add(entry)
    # Where to resume?
    cur = state_row.get("current_node")
    if cur and cur != "finish":
        runtime.state["next_node_type"] = cur
    elif not runtime.state["plan"]:
        runtime.state["next_node_type"] = "planner"
    else:
        runtime.state["next_node_type"] = "memory"
    runtime.state["status"] = "running"
    return runtime


async def mark_approval_decision(
    *,
    run_id: str,
    workspace_id: str,
    approval_id: str,
    decision: str,            # "approved" | "rejected" | "edited"
    edited_output: str | None = None,
    reviewed_by: str | None = None,
) -> None:
    """Persist a decision to agent_run_approvals and update the run."""
    now = datetime.now(UTC).isoformat()
    try:
        (
            get_client()
            .table("agent_run_approvals")
            .update({
                "status": decision,
                "reviewed_by": reviewed_by,
                "reviewed_at": now,
                "edited_output": edited_output,
            })
            .eq("id", approval_id)
            .eq("workspace_id", workspace_id)
            .execute()
        )
    except Exception as exc:
        logger.warning("mark_approval_decision_failed: %s", exc)

    if decision == "rejected":
        (
            get_client()
            .table("agent_runs")
            .update({"status": "failed", "completed_at": now, "last_error": "rejected_by_reviewer"})
            .eq("id", run_id)
            .eq("workspace_id", workspace_id)
            .execute()
        )
    else:
        # approved/edited: bump the run back to running and let the
        # caller re-invoke it.
        (
            get_client()
            .table("agent_runs")
            .update({"status": "running", "human_review_required": False, "current_node": "finish"})
            .eq("id", run_id)
            .eq("workspace_id", workspace_id)
            .execute()
        )
