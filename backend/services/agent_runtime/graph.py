"""
ExecutionGraph — declarative graph definition + per-node execution.

The graph is a dict of node-type → async (state, ctx) → NodeResult. The
runtime iterates the graph, dispatches each step to the right node, and
collects the result. The graph enforces:
  - Max depth (loop prevention)
  - Cancellation (cancel_event)
  - Per-node attempt caps (for action retry decisions)

Adding a new node type is two changes:
  1. Define an async function decorated with `@node("type_name", ...)`
  2. Add the entry to the `GRAPH` dict below
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from services.agent_runtime.nodes import NodeResult

logger = logging.getLogger(__name__)


# ─── Node registry ────────────────────────────────────────────────────────────

# Each node is the wrapped async function (decorated with @node).
# The wrapper returns (node_id, NodeResult). The runtime is responsible
# for persisting the node row, emitting events, and merging the delta.
# Importing here avoids a circular import at module load (nodes import
# from runtime for NodeContext.runtime).
from services.agent_runtime.nodes import (  # noqa: E402
    planner as _planner,
    memory as _memory,
    action as _action,
    decision as _decision,
    retriever as _retriever,
    writer as _writer,
    critic as _critic,
    verifier as _verifier,
    judge as _judge,
    approval as _approval,
    finish as _finish,
)


GRAPH: dict[str, Callable[..., Awaitable[tuple[str, NodeResult]]]] = {
    "planner": _planner.planner_node,
    "memory": _memory.memory_node,
    "action": _action.action_node,
    "decision": _decision.decision_node,
    "retriever": _retriever.retriever_node,
    "writer": _writer.writer_node,
    "critic": _critic.critic_node,
    "verifier": _verifier.verifier_node,
    "judge": _judge.judge_node,
    "approval": _approval.approval_node,
    "finish": _finish.finish_node,
}


# ─── ExecutionGraph façade ────────────────────────────────────────────────────

class ExecutionGraph:
    """Lightweight façade over the node registry.

    Exists for the public surface of `services.agent_runtime.__init__`
    and for the dev console's "load graph for run" tooling. The actual
    iteration is owned by `AgentRuntime._run_loop`.
    """

    def __init__(self, node_types: list[str] | None = None) -> None:
        self._allowed = set(node_types) if node_types else set(GRAPH.keys())

    def node_types(self) -> list[str]:
        return sorted(self._allowed)

    def is_allowed(self, node_type: str) -> bool:
        return node_type in self._allowed

    def get(self, node_type: str) -> Callable[..., Awaitable[tuple[str, NodeResult]]]:
        if not self.is_allowed(node_type):
            raise KeyError(f"node_type_not_allowed:{node_type}")
        return GRAPH[node_type]

    def validate_plan(self, plan: list[dict[str, Any]]) -> list[str]:
        """Return a list of validation errors for a plan produced by the Planner."""
        errors: list[str] = []
        for i, step in enumerate(plan or []):
            if not isinstance(step, dict):
                errors.append(f"step_{i}: not a dict")
                continue
            tool = step.get("tool")
            if tool is not None and not isinstance(tool, str):
                errors.append(f"step_{i}: tool must be a string or null")
        return errors


# ─── Loop prevention ──────────────────────────────────────────────────────────

@dataclass
class NodeVisitCounter:
    """Tracks how many times each node type has been visited. The runtime
    uses this to detect infinite loops and stop the run with `failed`."""
    counts: dict[str, int]
    max_per_node: int = 3

    def visit(self, node_type: str) -> bool:
        """Returns True if the visit is allowed; False if the cap is reached."""
        self.counts[node_type] = self.counts.get(node_type, 0) + 1
        return self.counts[node_type] <= self.max_per_node

    def snapshot(self) -> dict[str, int]:
        return dict(self.counts)


# ─── Public API ───────────────────────────────────────────────────────────────

def get_node(node_type: str) -> Callable[..., Awaitable[tuple[str, NodeResult]]]:
    fn = GRAPH.get(node_type)
    if fn is None:
        raise KeyError(f"unknown_node_type:{node_type}")
    return fn


def list_node_types() -> list[str]:
    return sorted(GRAPH.keys())


# ─── Status enum ──────────────────────────────────────────────────────────────

class NodeStatus:
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    ERROR = "error"
    SKIPPED = "skipped"
    AWAITING_APPROVAL = "awaiting_approval"
