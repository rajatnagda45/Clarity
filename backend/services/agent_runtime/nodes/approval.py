"""
Approval node — pauses the run for human review.

Triggered when:
  - The agent has `human_review_required=True` and the run's trust
    score fell below the configured threshold
  - The user explicitly configured the agent to require approval for
    certain tool calls (e.g. `run_benchmark`, `generate_report` for
    external destinations)

The node persists a row to `agent_run_approvals` and emits an
`approval_requested` event. The runtime then sets the run status to
`awaiting_approval` and parks. Resuming requires the user to call
`POST /api/agents/runs/{id}/approve` (or `/reject`).
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from services.agent_runtime.events import make_event
from services.agent_runtime.nodes import NodeContext, NodeResult, node

logger = logging.getLogger(__name__)


@node("approval", description="Park the run for human review")
async def approval_node(state: dict[str, Any], ctx: NodeContext) -> NodeResult:
    approval_id = f"apr_{uuid4().hex[:12]}"
    now = datetime.now(UTC).isoformat()
    payload = {
        "id": approval_id,
        "run_id": ctx.run_id,
        "workspace_id": ctx.workspace_id,
        "agent_id": ctx.agent_id,
        "status": "pending",
        "reason": state.get("abstention_reason") or "trust_below_threshold",
        "trust_score": state.get("trust_score"),
        "confidence": state.get("confidence"),
        "final_output_excerpt": (state.get("final_output") or "")[:1000],
        "created_at": now,
    }
    ctx.runtime.persist_approval(payload)

    ctx.recorder.append(
        make_event(
            "approval_requested",
            ctx.run_id,
            ctx.recorder.next(),
            node_id=ctx.runtime.current_node_id or "n_approval",
            node_type="approval",
            payload=payload,
            elapsed_ms=ctx.recorder.elapsed_ms(),
        )
    )

    return NodeResult(
        state_delta={"status": "awaiting_approval", "approval_id": approval_id},
        next_node_type="finish",
        output={"approval_id": approval_id, "status": "awaiting_approval"},
    )
