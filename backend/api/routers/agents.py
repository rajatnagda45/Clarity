from __future__ import annotations

import asyncio
import json
import time
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status
from fastapi.responses import StreamingResponse

from api.deps import require_workspace_role
from api.errors import api_error
from db.client import get_client, tenant_query
from schemas import (
    AgentAnalyticsResponse,
    AgentListResponse,
    AgentResponse,
    AgentRunListResponse,
    AgentRunResponse,
    AgentToolCallResponse,
    CreateAgentRequest,
    TriggerAgentRunRequest,
    UpdateAgentRequest,
)

router = APIRouter(prefix="/api/agents", tags=["agents"])

_TOOL_REGISTRY = {
    "search_documents": "Search across indexed workspace documents",
    "read_collection": "Read all documents within a named collection",
    "summarize": "Summarize a document or text chunk",
    "extract_clauses": "Extract key clauses from a legal document",
    "run_benchmark": "Trigger a benchmark evaluation run",
    "generate_report": "Generate a structured report from retrieved context",
    "run_evaluation": "Run an evaluation on a set of Q&A pairs",
    "search_workspace": "Search the entire workspace knowledge base",
    "webhook_trigger": "Fire a registered webhook endpoint",
    "automation_trigger": "Trigger an automation rule by ID",
}


def _row_to_agent(row: dict) -> AgentResponse:
    return AgentResponse(
        id=str(row["id"]),
        workspace_id=str(row["workspace_id"]),
        name=row["name"],
        description=row.get("description") or "",
        avatar=row.get("avatar") or "🤖",
        color=row.get("color") or "#7C3AED",
        category=row.get("category") or "custom",
        system_prompt=row.get("system_prompt") or "",
        behavior=row.get("behavior") or "balanced",
        temperature=float(row.get("temperature") or 0.7),
        model=row.get("model") or "gpt-4o",
        allowed_collections=row.get("allowed_collections") or [],
        allowed_tools=row.get("allowed_tools") or [],
        memory_enabled=bool(row.get("memory_enabled", True)),
        citation_required=bool(row.get("citation_required", True)),
        verification_mode=bool(row.get("verification_mode", False)),
        auto_retry=bool(row.get("auto_retry", True)),
        confidence_threshold=float(row.get("confidence_threshold") or 0.7),
        is_pinned=bool(row.get("is_pinned", False)),
        is_favorite=bool(row.get("is_favorite", False)),
        run_count=int(row.get("run_count") or 0),
        success_rate=float(row.get("success_rate") or 0.0),
        avg_latency_ms=int(row.get("avg_latency_ms") or 0),
        avg_trust_score=float(row.get("avg_trust_score") or 0.0),
        created_by=row.get("created_by"),
        archived_at=row.get("archived_at"),
        created_at=row["created_at"],
    )


def _tool_call_row_to_schema(row: dict) -> AgentToolCallResponse:
    return AgentToolCallResponse(
        id=str(row["id"]),
        run_id=str(row["run_id"]),
        tool_name=row["tool_name"],
        input=row.get("input") or {},
        output=row.get("output"),
        status=row.get("status") or "success",
        latency_ms=int(row.get("latency_ms") or 0),
        created_at=row["created_at"],
    )


def _run_row_to_schema(row: dict, tool_calls: list[dict] | None = None) -> AgentRunResponse:
    return AgentRunResponse(
        id=str(row["id"]),
        workspace_id=str(row["workspace_id"]),
        agent_id=str(row["agent_id"]),
        agent_name=row.get("agent_name") or "",
        status=row.get("status") or "queued",
        input=row["input"],
        output=row.get("output"),
        tool_calls=[_tool_call_row_to_schema(tc) for tc in (tool_calls or [])],
        tokens_used=int(row.get("tokens_used") or 0),
        latency_ms=int(row.get("latency_ms") or 0),
        trust_score=row.get("trust_score"),
        confidence=row.get("confidence"),
        cost_estimate=row.get("cost_estimate"),
        human_review_required=bool(row.get("human_review_required", False)),
        reviewed_by=row.get("reviewed_by"),
        review_verdict=row.get("review_verdict"),
        review_comment=row.get("review_comment"),
        pipeline_agents=row.get("pipeline_agents") or [],
        created_by=row.get("created_by"),
        completed_at=row.get("completed_at"),
        created_at=row["created_at"],
    )


def _execute_agent_run(run_id: str, agent_id: str, workspace_id: str, user_input: str, pipeline_agents: list[str]) -> None:
    """Synchronous agent execution run in a background thread."""
    client = get_client()
    start_ts = time.monotonic()

    try:
        agent_rows = (
            tenant_query("agents", workspace_id).select("*").eq("id", agent_id).execute()
        ).data or []
        if not agent_rows:
            return

        agent = agent_rows[0]
        allowed_tools = agent.get("allowed_tools") or []
        confidence_threshold = float(agent.get("confidence_threshold") or 0.7)

        executed_tool_calls: list[dict] = []

        tools_to_run = [t for t in allowed_tools if t in _TOOL_REGISTRY][:3]
        for tool_name in tools_to_run:
            tc_start = time.monotonic()
            tc_id = str(uuid4())
            tc_now = datetime.now(UTC).isoformat()
            tool_input = {"query": user_input, "tool": tool_name}
            tool_output = {"result": f"Tool {tool_name} executed successfully.", "items": []}
            tc_latency = int((time.monotonic() - tc_start) * 1000)

            client.table("agent_tool_calls").insert({
                "id": tc_id,
                "run_id": run_id,
                "workspace_id": workspace_id,
                "tool_name": tool_name,
                "input": tool_input,
                "output": tool_output,
                "status": "success",
                "latency_ms": tc_latency,
                "created_at": tc_now,
            }).execute()

            executed_tool_calls.append({
                "id": tc_id,
                "tool_name": tool_name,
                "latency_ms": tc_latency,
            })

        total_latency = int((time.monotonic() - start_ts) * 1000)
        simulated_trust = round(0.65 + (hash(user_input) % 100) / 300, 3)
        simulated_confidence = round(0.60 + (hash(agent_id) % 100) / 250, 3)
        simulated_tokens = 200 + len(user_input) // 4
        simulated_cost = round(simulated_tokens * 0.000002, 6)

        output_text = (
            f"Agent analysis completed for query: '{user_input[:120]}'. "
            f"Executed {len(executed_tool_calls)} tool(s). "
            f"Trust score: {simulated_trust:.2f}. "
            f"Confidence: {simulated_confidence:.2f}."
        )
        if pipeline_agents:
            output_text += f" Pipeline involved {len(pipeline_agents)} additional agent(s)."

        needs_review = simulated_confidence < confidence_threshold

        now_iso = datetime.now(UTC).isoformat()
        client.table("agent_runs").update({
            "status": "review_required" if needs_review else "completed",
            "output": output_text,
            "tokens_used": simulated_tokens,
            "latency_ms": total_latency,
            "trust_score": simulated_trust,
            "confidence": simulated_confidence,
            "cost_estimate": simulated_cost,
            "human_review_required": needs_review,
            "completed_at": now_iso,
        }).eq("id", run_id).execute()

        if needs_review:
            client.table("review_queue").insert({
                "id": str(uuid4()),
                "workspace_id": workspace_id,
                "agent_id": agent_id,
                "agent_name": agent.get("name") or "",
                "run_id": run_id,
                "input": user_input,
                "output": output_text,
                "trust_score": simulated_trust,
                "confidence": simulated_confidence,
                "reason": f"Confidence {simulated_confidence:.2f} below threshold {confidence_threshold:.2f}",
                "priority": "high" if simulated_confidence < 0.4 else "medium",
                "status": "pending",
                "created_at": now_iso,
            }).execute()

        client.table("agents").update({
            "run_count": agent.get("run_count", 0) + 1,
        }).eq("id", agent_id).execute()

    except Exception:
        now_iso = datetime.now(UTC).isoformat()
        client.table("agent_runs").update({
            "status": "failed",
            "completed_at": now_iso,
        }).eq("id", run_id).execute()


# ─── Agent CRUD ───────────────────────────────────────────────────────────────

@router.get("", response_model=AgentListResponse)
async def list_agents(
    request: Request,
    category: str | None = None,
    archived: bool = False,
    ctx: tuple = Depends(require_workspace_role),
) -> AgentListResponse:
    workspace_id, _ = ctx
    q = tenant_query("agents", workspace_id).select("*").order("created_at", desc=True)
    if category:
        q = q.eq("category", category)
    if not archived:
        q = q.is_("archived_at", "null")
    rows = (q.execute()).data or []
    return AgentListResponse(agents=[_row_to_agent(r) for r in rows], total=len(rows))


@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    payload: CreateAgentRequest,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> AgentResponse:
    workspace_id, role = ctx
    if role not in ("owner", "editor"):
        raise api_error(403, "insufficient_role", "Editor or Owner role required.")

    user_id = request.state.user_id
    row_data = {
        "id": str(uuid4()),
        "workspace_id": workspace_id,
        "name": payload.name,
        "description": payload.description,
        "avatar": payload.avatar,
        "color": payload.color,
        "category": payload.category,
        "system_prompt": payload.system_prompt,
        "behavior": payload.behavior,
        "temperature": payload.temperature,
        "model": payload.model,
        "allowed_collections": payload.allowed_collections,
        "allowed_tools": payload.allowed_tools,
        "memory_enabled": payload.memory_enabled,
        "citation_required": payload.citation_required,
        "verification_mode": payload.verification_mode,
        "auto_retry": payload.auto_retry,
        "confidence_threshold": payload.confidence_threshold,
        "is_pinned": False,
        "is_favorite": False,
        "run_count": 0,
        "success_rate": 0.0,
        "avg_latency_ms": 0,
        "avg_trust_score": 0.0,
        "created_by": user_id,
    }
    result = get_client().table("agents").insert(row_data).execute().data
    if not result:
        raise api_error(502, "agent_creation_failed", "Failed to create agent.")
    return _row_to_agent(result[0])


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: str,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> AgentResponse:
    workspace_id, _ = ctx
    rows = (
        tenant_query("agents", workspace_id).select("*").eq("id", agent_id).execute()
    ).data or []
    if not rows:
        raise api_error(404, "agent_not_found", "Agent not found.")
    return _row_to_agent(rows[0])


@router.patch("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str,
    payload: UpdateAgentRequest,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> AgentResponse:
    workspace_id, role = ctx
    if role not in ("owner", "editor"):
        raise api_error(403, "insufficient_role", "Editor or Owner role required.")

    existing = (
        tenant_query("agents", workspace_id).select("id").eq("id", agent_id).execute()
    ).data or []
    if not existing:
        raise api_error(404, "agent_not_found", "Agent not found.")

    updates: dict = {}
    for field, value in payload.model_dump(exclude_none=True, by_alias=False).items():
        updates[field] = value

    if not updates:
        rows = (tenant_query("agents", workspace_id).select("*").eq("id", agent_id).execute()).data or []
        return _row_to_agent(rows[0])

    result = get_client().table("agents").update(updates).eq("id", agent_id).execute().data
    if not result:
        raise api_error(502, "agent_update_failed", "Failed to update agent.")
    return _row_to_agent(result[0])


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: str,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> Response:
    workspace_id, role = ctx
    if role not in ("owner", "editor"):
        raise api_error(403, "insufficient_role", "Editor or Owner role required.")

    existing = (
        tenant_query("agents", workspace_id).select("id").eq("id", agent_id).execute()
    ).data or []
    if not existing:
        raise api_error(404, "agent_not_found", "Agent not found.")

    get_client().table("agent_runs").delete().eq("agent_id", agent_id).execute()
    get_client().table("agents").delete().eq("id", agent_id).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{agent_id}/archive", response_model=AgentResponse)
async def archive_agent(
    agent_id: str,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> AgentResponse:
    workspace_id, role = ctx
    if role not in ("owner", "editor"):
        raise api_error(403, "insufficient_role", "Editor or Owner role required.")

    existing = (
        tenant_query("agents", workspace_id).select("id").eq("id", agent_id).execute()
    ).data or []
    if not existing:
        raise api_error(404, "agent_not_found", "Agent not found.")

    result = get_client().table("agents").update({
        "archived_at": datetime.now(UTC).isoformat(),
    }).eq("id", agent_id).execute().data
    if not result:
        raise api_error(502, "agent_archive_failed", "Failed to archive agent.")
    return _row_to_agent(result[0])


# ─── Agent Runs ───────────────────────────────────────────────────────────────

@router.post("/{agent_id}/runs", response_model=AgentRunResponse, status_code=status.HTTP_201_CREATED)
async def trigger_agent_run(
    agent_id: str,
    payload: TriggerAgentRunRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    ctx: tuple = Depends(require_workspace_role),
) -> AgentRunResponse:
    workspace_id, role = ctx
    if role not in ("owner", "editor"):
        raise api_error(403, "insufficient_role", "Editor or Owner role required.")

    agent_rows = (
        tenant_query("agents", workspace_id).select("*").eq("id", agent_id).execute()
    ).data or []
    if not agent_rows:
        raise api_error(404, "agent_not_found", "Agent not found.")

    agent = agent_rows[0]
    user_id = request.state.user_id
    run_id = str(uuid4())
    now_iso = datetime.now(UTC).isoformat()

    run_row = get_client().table("agent_runs").insert({
        "id": run_id,
        "workspace_id": workspace_id,
        "agent_id": agent_id,
        "agent_name": agent.get("name") or "",
        "status": "queued",
        "input": payload.input,
        "tokens_used": 0,
        "latency_ms": 0,
        "human_review_required": False,
        "pipeline_agents": payload.pipeline_agents,
        "created_by": user_id,
        "created_at": now_iso,
    }).execute().data

    if not run_row:
        raise api_error(502, "run_creation_failed", "Failed to create agent run.")

    from job_queue.client import enqueue_or_background
    await enqueue_or_background(
        "run_agent_execution",
        _execute_agent_run,
        run_id,
        agent_id,
        workspace_id,
        payload.input,
        payload.pipeline_agents,
        background_tasks=background_tasks,
    )

    return _run_row_to_schema(run_row[0])


@router.get("/{agent_id}/runs", response_model=AgentRunListResponse)
async def list_agent_runs(
    agent_id: str,
    request: Request,
    limit: int = 50,
    offset: int = 0,
    ctx: tuple = Depends(require_workspace_role),
) -> AgentRunListResponse:
    workspace_id, _ = ctx
    rows = (
        tenant_query("agent_runs", workspace_id)
        .select("*")
        .eq("agent_id", agent_id)
        .order("created_at", desc=True)
        .limit(min(limit, 200))
        .offset(offset)
        .execute()
    ).data or []
    return AgentRunListResponse(runs=[_run_row_to_schema(r) for r in rows], total=len(rows))


@router.get("/runs/{run_id}", response_model=AgentRunResponse)
async def get_agent_run(
    run_id: str,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> AgentRunResponse:
    workspace_id, _ = ctx
    rows = (
        tenant_query("agent_runs", workspace_id).select("*").eq("id", run_id).execute()
    ).data or []
    if not rows:
        raise api_error(404, "run_not_found", "Agent run not found.")

    tool_calls = (
        get_client().table("agent_tool_calls")
        .select("*")
        .eq("run_id", run_id)
        .order("created_at")
        .execute()
    ).data or []

    return _run_row_to_schema(rows[0], tool_calls)


@router.get("/{agent_id}/analytics", response_model=AgentAnalyticsResponse)
async def get_agent_analytics(
    agent_id: str,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> AgentAnalyticsResponse:
    workspace_id, _ = ctx
    runs = (
        tenant_query("agent_runs", workspace_id)
        .select("*")
        .eq("agent_id", agent_id)
        .execute()
    ).data or []

    total = len(runs)
    completed = [r for r in runs if r.get("status") == "completed"]
    failed = [r for r in runs if r.get("status") == "failed"]
    review_req = [r for r in runs if r.get("status") == "review_required"]

    tool_calls = (
        get_client().table("agent_tool_calls")
        .select("id")
        .eq("workspace_id", workspace_id)
        .execute()
    ).data or []

    def _avg(rows: list[dict], key: str) -> float:
        vals = [r.get(key) for r in rows if r.get(key) is not None]
        return round(sum(vals) / len(vals), 3) if vals else 0.0

    all_completed = completed + review_req
    return AgentAnalyticsResponse(
        agent_id=agent_id,
        total_runs=total,
        successful_runs=len(completed),
        failed_runs=len(failed),
        review_required_runs=len(review_req),
        success_rate=round(len(completed) / total, 3) if total else 0.0,
        avg_latency_ms=int(_avg(all_completed, "latency_ms")),
        avg_tokens_used=int(_avg(all_completed, "tokens_used")),
        avg_trust_score=_avg(all_completed, "trust_score"),
        avg_confidence=_avg(all_completed, "confidence"),
        total_tool_calls=len(tool_calls),
    )


@router.get("/runs/{run_id}/stream")
async def stream_agent_run(
    run_id: str,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
):
    workspace_id, _ = ctx

    async def _event_stream():
        for _ in range(20):
            rows = (
                tenant_query("agent_runs", workspace_id).select("status,output").eq("id", run_id).execute()
            ).data or []
            if not rows:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Run not found'})}\n\n"
                return

            run_status = rows[0].get("status", "queued")
            yield f"data: {json.dumps({'type': 'status', 'status': run_status})}\n\n"

            if run_status in ("completed", "failed", "review_required"):
                yield f"data: {json.dumps({'type': 'done', 'status': run_status, 'output': rows[0].get('output')})}\n\n"
                return

            await asyncio.sleep(0.5)

        yield f"data: {json.dumps({'type': 'timeout'})}\n\n"

    return StreamingResponse(_event_stream(), media_type="text/event-stream")


@router.get("/tools", response_model=dict)
async def list_available_tools(
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> dict:
    return {"tools": [{"name": k, "description": v} for k, v in _TOOL_REGISTRY.items()]}
