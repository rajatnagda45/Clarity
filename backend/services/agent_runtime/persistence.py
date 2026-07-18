"""
Persistence — every long-lived entity the runtime writes to the DB.

All writes are tenant-scoped (`workspace_id` in the payload + RLS).
All writes are best-effort: persistence failures are logged and
swallowed so a transient DB issue never crashes the live run. The
runtime keeps its own authoritative state in memory; persistence is
for the dev console, resume, and the existing review queue UI.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any

from db.client import get_client

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


# ─── agent_runs extensions (migration 018) ────────────────────────────────────

def _update_run_status(
    run_id: str,
    workspace_id: str,
    *,
    status: str | None = None,
    output: str | None = None,
    trust_score: float | None = None,
    confidence: float | None = None,
    total_tokens_in: int | None = None,
    total_tokens_out: int | None = None,
    total_cost_usd: float | None = None,
    completed_at: str | None = None,
    human_review_required: bool | None = None,
    current_node: str | None = None,
    plan: list[dict[str, Any]] | None = None,
) -> None:
    update: dict[str, Any] = {}
    if status is not None:
        update["status"] = status
    if output is not None:
        update["output"] = output
    if trust_score is not None:
        update["trust_score"] = trust_score
    if confidence is not None:
        update["confidence"] = confidence
    if total_tokens_in is not None:
        update["total_tokens_in"] = total_tokens_in
    if total_tokens_out is not None:
        update["total_tokens_out"] = total_tokens_out
    if total_cost_usd is not None:
        update["total_cost_usd"] = total_cost_usd
    if completed_at is not None:
        update["completed_at"] = completed_at
    if human_review_required is not None:
        update["human_review_required"] = human_review_required
    if current_node is not None:
        update["current_node"] = current_node
    if plan is not None:
        update["plan"] = plan
    if not update:
        return
    try:
        (
            get_client()
            .table("agent_runs")
            .update(update)
            .eq("id", run_id)
            .eq("workspace_id", workspace_id)
            .execute()
        )
    except Exception as exc:
        logger.warning("update_run_status_failed run=%s: %s", run_id, exc)


# ─── agent_run_nodes ──────────────────────────────────────────────────────────

def _insert_node_row(
    run_id: str,
    workspace_id: str,
    *,
    node_id: str,
    node_type: str,
    parent_node_id: str | None,
    attempt: int,
    status: str = "running",
    input_summary: dict[str, Any] | None = None,
    output: dict[str, Any] | None = None,
    error: str | None = None,
    latency_ms: int = 0,
    tokens_in: int = 0,
    tokens_out: int = 0,
    cost_usd: float = 0.0,
) -> None:
    row = {
        "id": node_id,
        "run_id": run_id,
        "workspace_id": workspace_id,
        "node_type": node_type,
        "parent_node_id": parent_node_id,
        "attempt": attempt,
        "status": status,
        "input": input_summary or {},
        "output": output or {},
        "error": error,
        "latency_ms": latency_ms,
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
        "cost_usd": cost_usd,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    try:
        (
            get_client()
            .table("agent_run_nodes")
            .upsert(row, on_conflict="id")
            .execute()
        )
    except Exception as exc:
        logger.debug("insert_node_row_failed node=%s: %s", node_id, exc)


def _update_node_row(
    node_id: str,
    workspace_id: str,
    *,
    status: str,
    output: dict[str, Any] | None = None,
    error: str | None = None,
    latency_ms: int | None = None,
    tokens_in: int | None = None,
    tokens_out: int | None = None,
    cost_usd: float | None = None,
) -> None:
    update: dict[str, Any] = {"status": status, "updated_at": _now_iso()}
    if output is not None:
        update["output"] = output
    if error is not None:
        update["error"] = error
    if latency_ms is not None:
        update["latency_ms"] = latency_ms
    if tokens_in is not None:
        update["tokens_in"] = tokens_in
    if tokens_out is not None:
        update["tokens_out"] = tokens_out
    if cost_usd is not None:
        update["cost_usd"] = cost_usd
    try:
        (
            get_client()
            .table("agent_run_nodes")
            .update(update)
            .eq("id", node_id)
            .eq("workspace_id", workspace_id)
            .execute()
        )
    except Exception as exc:
        logger.debug("update_node_row_failed node=%s: %s", node_id, exc)


# ─── agent_run_events ─────────────────────────────────────────────────────────

def _insert_event_row(event: dict[str, Any]) -> None:
    try:
        (
            get_client()
            .table("agent_run_events")
            .insert({
                "id": f"ev_{event['sequence']}_{event['run_id'][:8]}",
                "run_id": event["run_id"],
                "workspace_id": event.get("workspace_id") or "",  # filled by caller
                "sequence": event["sequence"],
                "event_type": event["type"],
                "node_id": event.get("node_id"),
                "node_type": event.get("node_type"),
                "parent_node_id": event.get("parent_node_id"),
                "attempt": event.get("attempt", 1),
                "payload": event.get("payload", {}),
                "elapsed_ms": event.get("elapsed_ms", 0),
                "tokens_in": event.get("total_tokens_in", 0),
                "tokens_out": event.get("total_tokens_out", 0),
                "cost_usd": event.get("total_cost_usd", 0.0),
                "created_at": event.get("timestamp") or _now_iso(),
            })
            .execute()
        )
    except Exception as exc:
        logger.debug("insert_event_row_failed seq=%s: %s", event.get("sequence"), exc)


# ─── agent_run_memory ─────────────────────────────────────────────────────────

def _insert_memory_row(entry: dict[str, Any], run_id: str, workspace_id: str) -> None:
    try:
        (
            get_client()
            .table("agent_run_memory")
            .insert({
                "id": entry.get("id"),
                "run_id": run_id,
                "workspace_id": workspace_id,
                "scope": "global" if entry.get("global_") else "run",
                "role": entry.get("role"),
                "content": entry.get("content", ""),
                "tool": entry.get("tool"),
                "metadata": entry.get("metadata", {}),
                "token_count": entry.get("token_count", 0),
                "created_at": entry.get("created_at") or _now_iso(),
            })
            .execute()
        )
    except Exception as exc:
        logger.debug("insert_memory_row_failed: %s", exc)


# ─── agent_run_approvals ──────────────────────────────────────────────────────

def _insert_approval_row(payload: dict[str, Any]) -> None:
    try:
        (
            get_client()
            .table("agent_run_approvals")
            .insert(payload)
            .execute()
        )
    except Exception as exc:
        logger.warning("insert_approval_row_failed: %s", exc)


# ─── Public, async-friendly façade ───────────────────────────────────────────

class PersistenceLayer:
    """All DB writes used by the runtime, exposed as `async def` so the
    runtime can call them without blocking the event loop."""

    def __init__(self, workspace_id: str) -> None:
        self.workspace_id = workspace_id

    async def upsert_run_status(
        self,
        run_id: str,
        **kwargs: Any,
    ) -> None:
        await asyncio.to_thread(_update_run_status, run_id, self.workspace_id, **kwargs)

    async def insert_node_row(
        self,
        run_id: str,
        **kwargs: Any,
    ) -> None:
        await asyncio.to_thread(_insert_node_row, run_id, self.workspace_id, **kwargs)

    async def update_node_row(self, node_id: str, **kwargs: Any) -> None:
        await asyncio.to_thread(_update_node_row, node_id, self.workspace_id, **kwargs)

    async def insert_event_row(self, event: dict[str, Any]) -> None:
        if "workspace_id" not in event:
            event["workspace_id"] = self.workspace_id
        await asyncio.to_thread(_insert_event_row, event)

    async def insert_memory_row(self, entry: dict[str, Any], run_id: str) -> None:
        await asyncio.to_thread(_insert_memory_row, entry, run_id, self.workspace_id)

    async def insert_approval_row(self, payload: dict[str, Any]) -> None:
        await asyncio.to_thread(_insert_approval_row, payload)
