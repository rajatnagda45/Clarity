"""
Memory node — read/write the StepMemory window.

The runtime calls this node between every tool call so the dev console
gets a Memory Inspector view of what the agent knows at each step.

This is intentionally lightweight; the heavy LLM-driven recall is in
the `retriever` and `writer` nodes. Here we just record observations
and prepend a short recall summary to the next prompt.
"""
from __future__ import annotations

import logging
from typing import Any

from services.agent_runtime.nodes import NodeContext, NodeResult, node

logger = logging.getLogger(__name__)


@node("memory", description="Record a recall snapshot for the dev console")
async def memory_node(state: dict[str, Any], ctx: NodeContext) -> NodeResult:
    plan = state.get("plan", [])
    step_index = state.get("current_step_index", 0)
    if step_index >= len(plan):
        return NodeResult(next_node_type="decision", state_delta={})

    current = plan[step_index]
    # Pull a tiny recall summary (last 2 entries) — the LLM nodes can
    # pull more if they need to.
    recent = ctx.memory.recall(limit=2)
    recall = "\n".join(f"- {e.get('role', '?')}: {e.get('content', '')[:200]}" for e in recent)

    ctx.memory.add(
        role="system",
        content=f"Recall before step '{current.get('id')}': {recall or '(empty)'}",
        tool=None,
        metadata={"step_index": step_index, "step_id": current.get("id")},
    )

    from services.agent_runtime.events import make_event
    ctx.recorder.append(
        make_event(
            "memory_recalled",
            ctx.run_id,
            ctx.recorder.next(),
            node_id=ctx.runtime.current_node_id or "n_memory",
            node_type="memory",
            payload={
                "step_index": step_index,
                "step_id": current.get("id"),
                "recall_preview": recall[:500],
                "memory_size": len(ctx.memory.recall()),
            },
            elapsed_ms=ctx.recorder.elapsed_ms(),
        )
    )

    # After memory, advance to the appropriate next node for this step
    tool = current.get("tool")
    if tool is None:
        return NodeResult(next_node_type="decision", state_delta={})
    return NodeResult(next_node_type="action", state_delta={})
