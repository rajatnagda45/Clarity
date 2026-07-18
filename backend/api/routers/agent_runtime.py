"""
Agent Runtime API — the production endpoint the frontend calls.

Endpoints
─────────
POST   /api/agents/{id}/runs                    Trigger a run (streams SSE in same response)
GET    /api/agents/runs/{run_id}/stream         Live SSE stream (auto-resume via Last-Event-ID)
GET    /api/agents/runs/{run_id}/events         REST history (for dev console + replay)
GET    /api/agents/runs/{run_id}/graph          Full execution graph (nodes + edges)
GET    /api/agents/runs/{run_id}/memory         Memory entries
POST   /api/agents/runs/{run_id}/cancel         Request cancellation
POST   /api/agents/runs/{run_id}/resume         Resume a paused/failed run
POST   /api/agents/runs/{run_id}/approve        Approve a pending human-review item
POST   /api/agents/runs/{run_id}/reject         Reject a pending human-review item
GET    /api/agents/runs/{run_id}/tool-calls     Tool call history
GET    /api/agents/tools                        Tool manifest (for the planner and dev console)

The router does not duplicate the existing CRUD endpoints in
`api/routers/agents.py` — those remain authoritative for the agent
definition. This router owns the **execution** of a run.

SSE pattern
───────────
The POST endpoint returns a `StreamingResponse` that the runtime fills
via an `on_event` callback. The runtime is invoked in a background
task so the response begins streaming within ~50 ms. The legacy
non-streaming `POST` (returning the queued run row) is preserved for
clients that don't read the stream.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse

from api.errors import api_error
from db.client import get_client, tenant_query

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agents", tags=["agent-runtime"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _row_to_agent_dict(row: dict) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "name": row.get("name") or "",
        "description": row.get("description") or "",
        "system_prompt": row.get("system_prompt") or "",
        "behavior": row.get("behavior") or "balanced",
        "temperature": float(row.get("temperature") or 0.7),
        "model": row.get("model") or "gpt-4o-mini",
        "allowed_tools": row.get("allowed_tools") or [],
        "allowed_collections": row.get("allowed_collections") or [],
        "memory_enabled": bool(row.get("memory_enabled", True)),
        "citation_required": bool(row.get("citation_required", True)),
        "verification_mode": bool(row.get("verification_mode", False)),
        "auto_retry": bool(row.get("auto_retry", True)),
        "confidence_threshold": float(row.get("confidence_threshold") or 0.7),
    }


def _load_agent(workspace_id: str, agent_id: str) -> dict[str, Any] | None:
    rows = (
        tenant_query("agents", workspace_id)
        .select("*")
        .eq("id", agent_id)
        .execute()
    ).data or []
    return _row_to_agent_dict(rows[0]) if rows else None


def _make_run_row(workspace_id: str, agent_id: str, user_id: str | None, input_text: str) -> dict[str, Any]:
    now = datetime.now(UTC).isoformat()
    return {
        "id": str(uuid4()),
        "workspace_id": workspace_id,
        "agent_id": agent_id,
        "agent_name": "",
        "status": "queued",
        "input": input_text,
        "tokens_used": 0,
        "latency_ms": 0,
        "total_tokens_in": 0,
        "total_tokens_out": 0,
        "total_cost_usd": 0.0,
        "human_review_required": False,
        "stream_requested": False,
        "created_by": user_id,
        "created_at": now,
    }


def _update_run_name(workspace_id: str, run_id: str, name: str) -> None:
    try:
        (
            get_client()
            .table("agent_runs")
            .update({"agent_name": name})
            .eq("id", run_id)
            .eq("workspace_id", workspace_id)
            .execute()
        )
    except Exception:
        pass


def _serialise_event(ev) -> str:
    """SSE wire format. `id:` enables `Last-Event-ID` resume on the client."""
    try:
        payload = json.dumps(ev.to_dict(), default=str)
    except Exception:
        payload = json.dumps({"type": "error", "message": "serialise_failed"})
    return f"id: {ev.sequence}\ndata: {payload}\n\n"


# ─── POST /api/agents/{id}/runs ──────────────────────────────────────────────

@router.post("/{agent_id}/runs", response_model=None)
async def trigger_run(
    agent_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    input: str = Query(..., description="User input / goal"),
    stream: bool = Query(True, description="If true, returns SSE in the same response"),
) -> StreamingResponse | JSONResponse:
    """Trigger a new agent run. Streams SSE if `stream=true`.

    Backward-compatible: clients that pass `stream=false` (or omit the
    query param expecting JSON) get the queued run row as JSON and the
    run proceeds in the background, with the existing polling
    endpoint remaining authoritative for status.
    """
    workspace_id: str = request.state.workspace_id
    user_id: str | None = request.state.user_id

    agent = _load_agent(workspace_id, agent_id)
    if agent is None:
        raise api_error(404, "agent_not_found", "Agent not found.")

    run_row = _make_run_row(workspace_id, agent_id, user_id, input)
    run_row["agent_name"] = agent.get("name", "")
    run_row["stream_requested"] = stream
    run_row["agent_config"] = agent
    run_row["max_loop_count"] = 3

    try:
        result = get_client().table("agent_runs").insert(run_row).execute().data
    except Exception as exc:
        raise api_error(502, "run_creation_failed", f"Database insert failed: {exc}")
    if not result:
        raise api_error(502, "run_creation_failed", "No row returned from insert.")
    inserted = result[0]
    run_id = inserted["id"]

    if not stream:
        # Background execution (ARQ/BackgroundTask)
        background_tasks.add_task(_execute_run_background, run_id, workspace_id, agent, input)
        return JSONResponse(
            {"run_id": run_id, "status": "queued", "agent_id": agent_id},
            status_code=201,
        )

    # Streaming execution
    async def _event_stream():
        # The runtime's on_event callback writes into a queue that we drain here.
        from services.agent_runtime.bus import agent_bus
        from services.agent_runtime.runtime import AgentRuntime

        q = await agent_bus.subscribe(run_id)
        try:
            # Replay any events emitted before the client connected
            history = _load_event_history(workspace_id, run_id, after_sequence=0, limit=200)
            for ev in history:
                yield _serialise_event_dict(ev)

            # Build the runtime and run it
            runtime = AgentRuntime(
                run_id=run_id,
                workspace_id=workspace_id,
                agent_config=agent,
                user_input=input,
                on_event=lambda ev: None,  # already published to bus
            )

            async def _runner():
                try:
                    await runtime.execute(user_id=user_id)
                except Exception as exc:
                    logger.exception("runtime_failed run=%s", run_id)
                    err_ev = {
                        "type": "error",
                        "run_id": run_id,
                        "sequence": 0,
                        "timestamp": datetime.now(UTC).isoformat(),
                        "payload": {"error": str(exc)},
                    }
                    yield f"data: {json.dumps(err_ev)}\n\n"

            # Start the runner as a task; stream events from the bus
            runner_task = asyncio.create_task(_runner())
            try:
                while True:
                    if runner_task.done() and q.empty():
                        # Drain anything still buffered, then exit
                        try:
                            ev = await asyncio.wait_for(q.get(), timeout=0.5)
                            yield _serialise_event(ev)
                        except asyncio.TimeoutError:
                            break
                        break
                    try:
                        ev = await asyncio.wait_for(q.get(), timeout=15.0)
                        yield _serialise_event(ev)
                    except asyncio.TimeoutError:
                        yield ": ping\n\n"
            finally:
                if not runner_task.done():
                    runner_task.cancel()
                try:
                    await runner_task
                except (asyncio.CancelledError, Exception):
                    pass
        finally:
            await agent_bus.unsubscribe(run_id, q)

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


def _serialise_event_dict(ev: dict) -> str:
    """Render a dict event (from the DB history) in SSE format."""
    sequence = ev.get("sequence", 0)
    payload = {
        "type": ev.get("event_type"),
        "run_id": ev.get("run_id"),
        "sequence": sequence,
        "node_id": ev.get("node_id"),
        "node_type": ev.get("node_type"),
        "parent_node_id": ev.get("parent_node_id"),
        "attempt": ev.get("attempt", 1),
        "payload": ev.get("payload") or {},
        "elapsed_ms": ev.get("elapsed_ms", 0),
        "timestamp": ev.get("created_at"),
        "total_tokens_in": ev.get("tokens_in", 0),
        "total_tokens_out": ev.get("tokens_out", 0),
        "total_cost_usd": float(ev.get("cost_usd", 0.0)),
    }
    return f"id: {sequence}\ndata: {json.dumps(payload, default=str)}\n\n"


def _load_event_history(
    workspace_id: str,
    run_id: str,
    *,
    after_sequence: int = 0,
    limit: int = 200,
) -> list[dict[str, Any]]:
    try:
        q = (
            get_client()
            .table("agent_run_events")
            .select("*")
            .eq("run_id", run_id)
            .eq("workspace_id", workspace_id)
            .order("sequence")
            .limit(max(1, min(limit, 1000)))
        )
        if after_sequence:
            q = q.gt("sequence", after_sequence)
        rows = q.execute().data or []
        return rows
    except Exception as exc:
        logger.debug("load_event_history_failed: %s", exc)
        return []


# ─── Background execution (non-streaming path) ───────────────────────────────

async def _execute_run_background(
    run_id: str,
    workspace_id: str,
    agent_config: dict[str, Any],
    user_input: str,
) -> None:
    from services.agent_runtime.runtime import AgentRuntime

    runtime = AgentRuntime(
        run_id=run_id,
        workspace_id=workspace_id,
        agent_config=agent_config,
        user_input=user_input,
    )
    try:
        await runtime.execute()
    except Exception:
        logger.exception("background_run_failed run=%s", run_id)


# ─── GET /api/agents/runs/{run_id}/stream ────────────────────────────────────

@router.get("/runs/{run_id}/stream", response_model=None)
async def stream_run(
    run_id: str,
    request: Request,
    last_event_id: str | None = Query(None, alias="Last-Event-ID"),
):
    """SSE stream for an active or completed run.

    On connect:
      1. Replay events with sequence > Last-Event-ID (resume).
      2. Subscribe to the bus for live events.
      3. Send ": ping" every 15 s.
      4. Exit when the run is in a terminal state AND the queue is empty.
    """
    workspace_id: str = request.state.workspace_id
    after = int(last_event_id) if (last_event_id and last_event_id.isdigit()) else 0

    async def _event_stream():
        from services.agent_runtime.bus import agent_bus

        # 1. Replay
        history = _load_event_history(workspace_id, run_id, after_sequence=after, limit=200)
        for ev in history:
            yield _serialise_event_dict(ev)

        # 2. Determine terminal state
        run_row = (
            tenant_query("agent_runs", workspace_id)
            .select("status")
            .eq("id", run_id)
            .execute()
        ).data or []
        if not run_row:
            yield f"data: {json.dumps({'type': 'error', 'message': 'run_not_found'})}\n\n"
            return
        if run_row[0].get("status") in ("completed", "failed", "cancelled"):
            yield f"data: {json.dumps({'type': 'done', 'status': run_row[0]['status']})}\n\n"
            return

        # 3. Subscribe
        q = await agent_bus.subscribe(run_id)
        try:
            while True:
                if await request.is_disconnected():
                    return
                try:
                    ev = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield _serialise_event(ev)
                    if ev.type in ("completed", "cancelled", "error") and ev.payload.get("status") in (
                        "completed", "failed", "cancelled", "awaiting_approval",
                    ):
                        return
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
                    # Re-check run status; if terminal and queue is empty, exit
                    run_row = (
                        tenant_query("agent_runs", workspace_id)
                        .select("status")
                        .eq("id", run_id)
                        .execute()
                    ).data or []
                    if run_row and run_row[0].get("status") in ("completed", "failed", "cancelled") and q.empty():
                        yield f"data: {json.dumps({'type': 'done', 'status': run_row[0]['status']})}\n\n"
                        return
        except asyncio.CancelledError:
            return
        finally:
            await agent_bus.unsubscribe(run_id, q)

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ─── GET /api/agents/runs/{run_id}/events ────────────────────────────────────

@router.get("/runs/{run_id}/events")
async def list_run_events(
    run_id: str,
    request: Request,
    after: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
):
    workspace_id: str = request.state.workspace_id
    rows = _load_event_history(workspace_id, run_id, after_sequence=after, limit=limit)
    return JSONResponse({"events": rows, "count": len(rows)})


# ─── GET /api/agents/runs/{run_id}/graph ─────────────────────────────────────

@router.get("/runs/{run_id}/graph")
async def get_run_graph(
    run_id: str,
    request: Request,
):
    """Return the full execution graph for the dev console.

    The response is shaped for direct consumption by the frontend
    Graph Viewer (nodes + edges + summary stats).
    """
    workspace_id: str = request.state.workspace_id
    try:
        nodes = (
            get_client()
            .table("agent_run_nodes")
            .select("*")
            .eq("run_id", run_id)
            .eq("workspace_id", workspace_id)
            .order("created_at")
            .execute()
        ).data or []
        run = (
            tenant_query("agent_runs", workspace_id)
            .select("*")
            .eq("id", run_id)
            .execute()
        ).data or []
        if not run:
            raise api_error(404, "run_not_found", "Agent run not found.")
    except Exception as exc:
        # Re-raise FastAPI HTTPException so the global error handler renders it
        from fastapi import HTTPException
        if isinstance(exc, HTTPException):
            raise
        raise api_error(502, "graph_query_failed", f"{exc}")

    # Build edges from parent_node_id
    edges: list[dict[str, Any]] = []
    for n in nodes:
        if n.get("parent_node_id"):
            edges.append({
                "source": n["parent_node_id"],
                "target": n["id"],
                "type": "sequence",
            })

    total_cost = sum(float(n.get("cost_usd", 0.0)) for n in nodes)
    total_tokens_in = sum(int(n.get("tokens_in", 0)) for n in nodes)
    total_tokens_out = sum(int(n.get("tokens_out", 0)) for n in nodes)
    total_latency = sum(int(n.get("latency_ms", 0)) for n in nodes)

    return JSONResponse({
        "run_id": run_id,
        "status": run[0].get("status"),
        "plan": run[0].get("plan") or [],
        "nodes": [
            {
                "id": n["id"],
                "node_type": n["node_type"],
                "parent_node_id": n.get("parent_node_id"),
                "attempt": n.get("attempt", 1),
                "status": n.get("status"),
                "input": n.get("input") or {},
                "output": n.get("output") or {},
                "error": n.get("error"),
                "latency_ms": int(n.get("latency_ms", 0)),
                "tokens_in": int(n.get("tokens_in", 0)),
                "tokens_out": int(n.get("tokens_out", 0)),
                "cost_usd": float(n.get("cost_usd", 0.0)),
                "created_at": n.get("created_at"),
            }
            for n in nodes
        ],
        "edges": edges,
        "summary": {
            "node_count": len(nodes),
            "edge_count": len(edges),
            "total_latency_ms": total_latency,
            "total_tokens_in": total_tokens_in,
            "total_tokens_out": total_tokens_out,
            "total_cost_usd": round(total_cost, 6),
            "trust_score": run[0].get("trust_score"),
            "confidence": run[0].get("confidence"),
        },
    })


# ─── GET /api/agents/runs/{run_id}/memory ────────────────────────────────────

@router.get("/runs/{run_id}/memory")
async def get_run_memory(
    run_id: str,
    request: Request,
    scope: str | None = Query(None, pattern="^(run|global)$"),
    limit: int = Query(200, ge=1, le=1000),
):
    workspace_id: str = request.state.workspace_id
    try:
        q = (
            get_client()
            .table("agent_run_memory")
            .select("*")
            .eq("run_id", run_id)
            .eq("workspace_id", workspace_id)
            .order("created_at")
            .limit(limit)
        )
        if scope:
            q = q.eq("scope", scope)
        rows = q.execute().data or []
    except Exception as exc:
        raise api_error(502, "memory_query_failed", f"{exc}")
    return JSONResponse({
        "run_id": run_id,
        "entries": [
            {
                "id": r["id"],
                "role": r.get("role"),
                "content": r.get("content"),
                "tool": r.get("tool"),
                "metadata": r.get("metadata") or {},
                "scope": r.get("scope"),
                "token_count": int(r.get("token_count", 0)),
                "created_at": r.get("created_at"),
            }
            for r in rows
        ],
        "count": len(rows),
    })


# ─── POST /api/agents/runs/{run_id}/cancel ───────────────────────────────────

@router.post("/runs/{run_id}/cancel")
async def cancel_run(run_id: str, request: Request, ctx: tuple = None):
    workspace_id: str = request.state.workspace_id
    # Mark the run as cancelled in the DB so new stream connections exit
    try:
        get_client().table("agent_runs").update({
            "status": "cancelled",
            "completed_at": datetime.now(UTC).isoformat(),
        }).eq("id", run_id).eq("workspace_id", workspace_id).execute()
    except Exception as exc:
        raise api_error(502, "cancel_failed", f"{exc}")
    # Signal any in-memory runtime
    try:
        pass
        # The runtime reads cancel_event; this endpoint doesn't have a
        # handle to it, so we rely on the DB status check on the next
        # iteration. A future enhancement would maintain an in-process
        # registry of active runtimes.
    except Exception:
        pass
    return JSONResponse({"run_id": run_id, "status": "cancelled"})


# ─── POST /api/agents/runs/{run_id}/resume ───────────────────────────────────

@router.post("/runs/{run_id}/resume")
async def resume_run(run_id: str, request: Request, background_tasks: BackgroundTasks):
    workspace_id: str = request.state.workspace_id
    from services.agent_runtime.resume import resume_run as _resume

    runtime = await _resume(
        run_id=run_id,
        workspace_id=workspace_id,
    )
    if runtime is None:
        raise api_error(404, "run_not_resumable", "Run not found or not in a resumable state.")

    async def _runner():
        try:
            await runtime.execute()
        except Exception:
            logger.exception("resumed_run_failed run=%s", run_id)

    background_tasks.add_task(asyncio.create_task, _runner())
    return JSONResponse({"run_id": run_id, "status": "running"})


# ─── POST /api/agents/runs/{run_id}/approve + /reject ────────────────────────

@router.post("/runs/{run_id}/approve")
async def approve_run(
    run_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    edited_output: str | None = Query(None),
):
    workspace_id: str = request.state.workspace_id
    user_id: str | None = request.state.user_id

    # Find the pending approval row
    approvals = (
        get_client()
        .table("agent_run_approvals")
        .select("*")
        .eq("run_id", run_id)
        .eq("workspace_id", workspace_id)
        .eq("status", "pending")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    ).data or []
    if not approvals:
        raise api_error(404, "no_pending_approval", "No pending approval for this run.")
    approval = approvals[0]

    from services.agent_runtime.resume import mark_approval_decision, resume_run as _resume

    decision = "edited" if edited_output else "approved"
    await mark_approval_decision(
        run_id=run_id,
        workspace_id=workspace_id,
        approval_id=approval["id"],
        decision=decision,
        edited_output=edited_output,
        reviewed_by=user_id,
    )

    # If approved/edited, resume the run to the finish node
    if decision in ("approved", "edited"):
        runtime = await _resume(run_id=run_id, workspace_id=workspace_id)
        if runtime is not None:
            runtime.state["next_node_type"] = "finish"
            runtime.state["status"] = "running"

            async def _runner():
                try:
                    await runtime.execute()
                except Exception:
                    logger.exception("approved_run_resume_failed run=%s", run_id)
            background_tasks.add_task(asyncio.create_task, _runner())

    return JSONResponse({"run_id": run_id, "decision": decision, "approval_id": approval["id"]})


@router.post("/runs/{run_id}/reject")
async def reject_run(
    run_id: str,
    request: Request,
    reason: str | None = Query(None),
    ctx=None,
):
    workspace_id: str = request.state.workspace_id
    user_id: str | None = request.state.user_id
    approvals = (
        get_client()
        .table("agent_run_approvals")
        .select("*")
        .eq("run_id", run_id)
        .eq("workspace_id", workspace_id)
        .eq("status", "pending")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    ).data or []
    if not approvals:
        raise api_error(404, "no_pending_approval", "No pending approval for this run.")
    approval = approvals[0]

    from services.agent_runtime.resume import mark_approval_decision
    await mark_approval_decision(
        run_id=run_id,
        workspace_id=workspace_id,
        approval_id=approval["id"],
        decision="rejected",
        reviewed_by=user_id,
    )
    if reason:
        try:
            get_client().table("agent_runs").update({
                "last_error": f"rejected: {reason[:500]}",
            }).eq("id", run_id).eq("workspace_id", workspace_id).execute()
        except Exception:
            pass
    return JSONResponse({"run_id": run_id, "decision": "rejected", "approval_id": approval["id"]})


# ─── GET /api/agents/runs/{run_id}/tool-calls ────────────────────────────────

@router.get("/runs/{run_id}/tool-calls")
async def list_run_tool_calls(
    run_id: str,
    request: Request,
    limit: int = Query(100, ge=1, le=500),
):
    workspace_id: str = request.state.workspace_id
    try:
        rows = (
            get_client()
            .table("agent_tool_calls")
            .select("*")
            .eq("run_id", run_id)
            .eq("workspace_id", workspace_id)
            .order("created_at")
            .limit(limit)
            .execute()
        ).data or []
    except Exception as exc:
        raise api_error(502, "tool_calls_query_failed", f"{exc}")
    return JSONResponse({
        "run_id": run_id,
        "tool_calls": rows,
        "count": len(rows),
    })


# ─── GET /api/agents/tools ───────────────────────────────────────────────────

@router.get("/tools")
async def list_tools(request: Request, ctx: tuple = None):
    from services.agent_runtime.tools import get_tool_registry
    return JSONResponse({"tools": get_tool_registry().describe_all()})
