"""
Runtime state — the single source of truth for one agent run.

The state is a TypedDict so it is serialisable, JSON-safe, and can be
persisted/restored for resume-after-disconnect and human-approval pauses.

Every node reads and returns a shallow copy with its own fields mutated.
This is the reducer pattern: the runtime composes node outputs into the
next state's input, one node at a time.
"""
from __future__ import annotations

from typing import Any, Literal, TypedDict


# All node types the runtime supports. The graph editor uses this enum;
# the planner may only emit a subset; nodes are validated against the
# agent's allowed_tools during graph construction.
NodeType = Literal[
    "planner",
    "retriever",
    "writer",
    "critic",
    "verifier",
    "judge",
    "memory",
    "decision",
    "action",
    "approval",
    "finish",
]


class PlanStep(TypedDict):
    """A single planned step emitted by the Planner node."""
    id: str
    description: str
    tool: str | None           # tool name to call (None for pure-LLM steps)
    tool_args: dict[str, Any]  # arguments to pass to the tool
    depends_on: list[str]      # step IDs that must complete first
    expected_output: str       # plain-text expectation for the critic


class ToolCallRecord(TypedDict):
    """A tool invocation record, persisted to agent_tool_calls and streamed."""
    id: str
    tool: str
    input: dict[str, Any]
    output: dict[str, Any] | None
    status: Literal["pending", "running", "success", "error", "timeout"]
    error_message: str | None
    retry_count: int
    latency_ms: int
    started_at: str
    completed_at: str | None


class MemoryEntry(TypedDict):
    """One episodic memory entry, scoped to the run unless `global_=True`."""
    id: str
    role: Literal["system", "user", "assistant", "tool", "observation"]
    content: str
    tool: str | None
    metadata: dict[str, Any]
    created_at: str
    token_count: int
    global_: bool  # True ⇒ also persisted to agent memory bank for future runs


class NodeResult(TypedDict):
    """The result of one node execution — appended to RuntimeState.node_history."""
    id: str
    node_type: NodeType
    tool: str | None
    status: Literal["success", "error", "skipped", "awaiting_approval"]
    input: dict[str, Any]
    output: dict[str, Any] | None
    error: str | None
    started_at: str
    completed_at: str | None
    latency_ms: int
    tokens_in: int
    tokens_out: int
    cost_usd: float
    parent_node_id: str | None
    attempt: int


class RuntimeState(TypedDict, total=False):
    # ─── Identity ────────────────────────────────────────────────────────
    run_id: str
    agent_id: str
    workspace_id: str
    user_id: str | None
    request_id: str
    # ─── Plan (produced by Planner) ─────────────────────────────────────
    plan: list[PlanStep]
    current_step_index: int
    # ─── Execution graph cursor ─────────────────────────────────────────
    current_node_id: str | None
    next_node_type: NodeType
    loop_count: int                  # how many times we've revisited the same node
    max_depth: int                  # hard cap on total nodes executed
    max_loop_count: int              # loop prevention per node
    status: Literal[
        "queued", "planning", "running", "awaiting_approval",
        "completed", "failed", "cancelled", "review_required",
    ]
    # ─── Memory ──────────────────────────────────────────────────────────
    memory: list[MemoryEntry]
    memory_window: int              # max entries to include in LLM context
    # ─── Tool calls ──────────────────────────────────────────────────────
    pending_tool_call: ToolCallRecord | None
    tool_history: list[ToolCallRecord]
    # ─── Verification pipeline state (reused from services/verification) ─
    claims: list[dict[str, Any]]
    evidence_spans: list[str]
    trust_score: float | None
    confidence: float | None
    abstained: bool
    abstention_reason: str | None
    # ─── Cost / tokens ──────────────────────────────────────────────────
    total_tokens_in: int
    total_tokens_out: int
    total_cost_usd: float
    # ─── Timing ─────────────────────────────────────────────────────────
    started_at: str
    completed_at: str | None
    # ─── Node execution history (append-only) ───────────────────────────
    node_history: list[NodeResult]
    # ─── Final answer (set by Finish node) ──────────────────────────────
    final_output: str | None
    final_citations: list[dict[str, Any]]
    # ─── Cancellation / pause ──────────────────────────────────────────
    cancel_requested: bool
    pause_reason: str | None
    # ─── Agent configuration snapshot (so resume is self-contained) ───
    agent_config: dict[str, Any]
    user_input: str
