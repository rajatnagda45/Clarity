"""
StepMemory — context preservation across a run (short-term) and across runs
(episodic long-term).

Two scopes:
  - Short-term: the active run's `state["memory"]` list. Bounded by
    `state["memory_window"]`; oldest entries are summarised or dropped.
  - Long-term (episodic): entries with `global_=True` are persisted to
    `agent_run_memory` with a `scope='global'` flag. Future runs of the
    same agent can recall relevant entries via lightweight semantic match.

The Memory node (nodes/memory_node.py) is the only place that reads or
writes memory. The runtime calls it explicitly so the dev console can
surface a Memory Inspector view.
"""
from __future__ import annotations

import hashlib
import logging
import time
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class MemoryWindow:
    """A bounded in-memory buffer of MemoryEntry dicts.

    The window is FIFO with optional summarisation. When the buffer hits
    `max_entries`, the oldest entry is summarised (one LLM call) and the
    summary replaces the evicted entries. If summarisation is disabled,
    entries are dropped entirely.
    """
    max_entries: int = 20
    summarise_on_evict: bool = True
    _entries: list[dict[str, Any]] = field(default_factory=list)
    _running_summary: str = ""

    def add(self, entry: dict[str, Any]) -> None:
        self._entries.append(entry)
        if len(self._entries) > self.max_entries:
            # Evict exactly enough to bring us back to max_entries
            excess = len(self._entries) - self.max_entries
            evicted = self._entries[:excess]
            self._entries = self._entries[excess:]
            if self.summarise_on_evict and evicted:
                self._running_summary = (self._running_summary + " " + " ".join(
                    e.get("content", "")[:200] for e in evicted
                )).strip()[-2000:]

    def recall(self, limit: int | None = None) -> list[dict[str, Any]]:
        if limit is None:
            return list(self._entries)
        return list(self._entries[-limit:])

    def as_context_string(self) -> str:
        """Serialise the window into a single context block for LLM prompts."""
        lines: list[str] = []
        if self._running_summary:
            lines.append(f"[Running summary of earlier steps]\n{self._running_summary}")
        for e in self._entries:
            role = e.get("role", "user")
            tool = e.get("tool")
            tag = f" ({tool})" if tool else ""
            lines.append(f"[{role}{tag}] {e.get('content', '')}")
        return "\n\n".join(lines)

    def to_serializable(self) -> dict[str, Any]:
        return {
            "max_entries": self.max_entries,
            "running_summary": self._running_summary,
            "entries": list(self._entries),
        }

    @classmethod
    def from_serializable(cls, data: dict[str, Any]) -> "MemoryWindow":
        w = cls(max_entries=data.get("max_entries", 20), summarise_on_evict=True)
        w._running_summary = data.get("running_summary", "")
        w._entries = list(data.get("entries", []))
        return w


class StepMemory:
    """Per-run memory facade.

    Combines the bounded in-memory window with a persistence hook
    (`persist_fn`). The runtime injects a closure that writes to
    `agent_run_memory` so memory survives process restarts and is
    queryable by the dev console.
    """

    def __init__(
        self,
        run_id: str,
        workspace_id: str,
        *,
        max_entries: int = 20,
        persist_fn=None,
    ) -> None:
        self.run_id = run_id
        self.workspace_id = workspace_id
        self.window = MemoryWindow(max_entries=max_entries)
        self._persist_fn = persist_fn

    def add(
        self,
        role: str,
        content: str,
        *,
        tool: str | None = None,
        metadata: dict[str, Any] | None = None,
        global_: bool = False,
    ) -> dict[str, Any]:
        entry = {
            "id": hashlib.sha256(
                f"{self.run_id}:{time.monotonic_ns()}:{len(self.window._entries)}".encode()
            ).hexdigest()[:24],
            "role": role,
            "content": content,
            "tool": tool,
            "metadata": metadata or {},
            "created_at": _now_iso(),
            "token_count": _approx_tokens(content),
            "global_": global_,
        }
        self.window.add(entry)
        if self._persist_fn is not None:
            try:
                self._persist_fn(entry)
            except Exception as exc:  # never let persistence crash the run
                logger.warning("memory_persist_failed run=%s: %s", self.run_id, exc)
        return entry

    def recall(self, limit: int | None = None) -> list[dict[str, Any]]:
        return self.window.recall(limit)

    def as_context(self) -> str:
        return self.window.as_context_string()

    def snapshot(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "workspace_id": self.workspace_id,
            "window": self.window.to_serializable(),
        }

    def restore(self, snapshot: dict[str, Any]) -> None:
        self.window = MemoryWindow.from_serializable(snapshot.get("window", {}))


def _approx_tokens(text: str) -> int:
    """Cheap token estimate — 4 chars per token, minimum 1."""
    return max(1, len(text) // 4)


def _now_iso() -> str:
    from datetime import UTC, datetime
    return datetime.now(UTC).isoformat()
