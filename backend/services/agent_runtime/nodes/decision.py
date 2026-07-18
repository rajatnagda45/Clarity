"""
Decision node — the router.

After each Action (or skipped step), the Decision node:
  1. Checks `cancel_event` → route to `finish` (status=cancelled)
  2. Checks `max_depth` and `loop_count` → route to `finish` (status=failed)
  3. Checks whether the just-executed step succeeded
  4. Increments `current_step_index` if the step is done
  5. Decides whether the overall goal is met (LLM check on a "decision agent"
     only if the plan's final step is complete) — otherwise, routes to
     the next step's first node
  6. If the last step is done, routes to the `finish` node (which may
     trigger the verification pipeline)
"""
from __future__ import annotations

import logging
from typing import Any

from services.agent_runtime.nodes import NodeContext, NodeResult, node

logger = logging.getLogger(__name__)


@node("decision", description="Route to the next step or finish")
async def decision_node(state: dict[str, Any], ctx: NodeContext) -> NodeResult:
    plan = state.get("plan", [])
    step_index = state.get("current_step_index", 0)
    depth_used = state.get("max_depth", 0)
    depth_cap = state.get("max_depth_cap", 25)
    last_result = state.get("last_tool_result")

    # 1. Cancellation
    if state.get("cancel_requested") or ctx.cancel_event.is_set():
        return NodeResult(
            next_node_type="finish",
            state_delta={"status": "cancelled"},
            output={"decision": "cancelled"},
        )

    # 2. Depth cap
    if depth_used >= depth_cap:
        return NodeResult(
            next_node_type="finish",
            state_delta={"status": "failed", "last_error": "max_depth_reached"},
            error="max_depth_reached",
        )

    # 3. Last step failed and the tool is not recoverable → finish with error
    if last_result and not last_result.get("ok"):
        # If this was the final step, propagate the failure; otherwise skip
        if step_index + 1 >= len(plan):
            return NodeResult(
                next_node_type="finish",
                state_delta={"status": "failed", "last_error": last_result.get("error")},
                error=last_result.get("error"),
                output={"decision": "fail_on_final_step"},
            )
        # Skip to the next step
        return NodeResult(
            next_node_type="memory",
            state_delta={
                "current_step_index": step_index + 1,
                "last_tool_result": None,
            },
            output={"decision": "skip_failed_step", "skipped_step": step_index},
        )

    # 4. Advance the cursor
    next_index = step_index + 1
    if next_index >= len(plan):
        # All steps complete → route to finish (which runs the verification pipeline)
        return NodeResult(
            next_node_type="finish",
            state_delta={"current_step_index": next_index},
            output={"decision": "all_steps_complete"},
        )

    # 5. Move to the next step
    return NodeResult(
        next_node_type="memory",
        state_delta={
            "current_step_index": next_index,
            "last_tool_result": None,
        },
        output={"decision": "continue", "next_step_index": next_index, "next_step_id": plan[next_index].get("id")},
    )
