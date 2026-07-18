"""
Agent Runtime — production-grade execution engine for autonomous Clarity agents.

Public surface
──────────────
- `RuntimeState` and node types       (state.py)
- `ExecutionGraph`                   (graph.py)
- `AgentRuntimeEvent`                (events.py)
- `StepMemory`                       (memory.py)
- `ToolRegistry` and tool functions   (tools/__init__.py)
- `Node` base + decorators           (nodes/__init__.py)
- All built-in node implementations  (nodes/*.py)
- `AgentRuntime` (the executor)      (runtime.py)
- `persist_node`, `persist_memory`   (persistence.py)
- `resume_run`                       (resume.py)

Reused (not duplicated)
───────────────────────
- services/retrieval/service.py::retrieve_evidence      (retrieval tools)
- services/answer_generation/{service,prompt_builder,claim_extractor}.py
- services/verification/{critic,ensemble,nli,confidence,calibrator}.py
- services/eval/{engine,judge,metrics,regression}.py
- services/events/bus.py                               (extended with agent channel)
- cache/client.py                                       (semantic cache)
- db/client.py::tenant_query                           (tenant isolation)
"""
from __future__ import annotations

from services.agent_runtime.events import AgentRuntimeEvent
from services.agent_runtime.graph import ExecutionGraph, NodeStatus
from services.agent_runtime.memory import StepMemory
from services.agent_runtime.runtime import AgentRuntime
from services.agent_runtime.state import NodeType, RuntimeState
from services.agent_runtime.tools import ToolRegistry, get_tool_registry

__all__ = [
    "AgentRuntime",
    "AgentRuntimeEvent",
    "ExecutionGraph",
    "NodeStatus",
    "NodeType",
    "RuntimeState",
    "StepMemory",
    "ToolRegistry",
    "get_tool_registry",
]
