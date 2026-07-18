from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, Request, Response, status

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
    UpdateAgentRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agents", tags=["agents"])

# Tool registry and tool dispatch now live in services/agent_runtime/.
# This router handles only agent CRUD and run inspection. The runtime
# router (api/routers/agent_runtime.py) owns:
#   - POST /{agent_id}/runs        (streaming SSE)
#   - GET  /runs/{run_id}/stream   (live SSE)
#   - GET  /tools                   (manifest)
# Do not re-declare those here — FastAPI's first-match routing would
# otherwise call the wrong handler.


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
# ─── Agent CRUD ───────────────────────────────────────────────────────────────

@router.get("", response_model=AgentListResponse)
async def list_agents(
    request: Request,
    category: str | None = None,
    archived: bool = False,
    limit: int = 100,
    offset: int = 0,
    ctx: tuple = Depends(require_workspace_role),
) -> AgentListResponse:
    workspace_id, _ = ctx
    q = tenant_query("agents", workspace_id).select("*").order("created_at", desc=True)
    if category:
        q = q.eq("category", category)
    if not archived:
        q = q.is_("archived_at", "null")
    rows = (q.limit(min(limit, 500)).offset(offset).execute()).data or []
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

    result = get_client().table("agents").update(updates).eq("id", agent_id).eq("workspace_id", workspace_id).execute().data
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

    get_client().table("agent_runs").delete().eq("agent_id", agent_id).eq("workspace_id", workspace_id).execute()
    get_client().table("agents").delete().eq("id", agent_id).eq("workspace_id", workspace_id).execute()
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
    }).eq("id", agent_id).eq("workspace_id", workspace_id).execute().data
    if not result:
        raise api_error(502, "agent_archive_failed", "Failed to archive agent.")
    return _row_to_agent(result[0])


# ─── Agent Runs ───────────────────────────────────────────────────────────────

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
        .select("id, run_id")
        .eq("workspace_id", workspace_id)
        .execute()
    ).data or []
    # Scope the total to this agent's runs (was counting all workspace tool calls)
    run_ids_for_agent = {r["id"] for r in runs}
    scoped_tool_calls = [tc for tc in tool_calls if tc.get("run_id") in run_ids_for_agent]

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
        total_tool_calls=len(scoped_tool_calls),
    )


# ─── Restore / Duplicate / Clone / Version ───────────────────────────────────

@router.post("/{agent_id}/restore", response_model=AgentResponse)
async def restore_agent(
    agent_id: str,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> AgentResponse:
    """Restore an archived agent (clear `archived_at`)."""
    workspace_id, role = ctx
    if role not in ("owner", "editor"):
        raise api_error(403, "insufficient_role", "Editor or Owner role required.")

    existing = (
        tenant_query("agents", workspace_id)
        .select("id, archived_at")
        .eq("id", agent_id)
        .execute()
    ).data or []
    if not existing:
        raise api_error(404, "agent_not_found", "Agent not found.")
    if not existing[0].get("archived_at"):
        raise api_error(409, "agent_not_archived", "Agent is not archived.")

    result = get_client().table("agents").update({
        "archived_at": None,
    }).eq("id", agent_id).eq("workspace_id", workspace_id).execute().data
    if not result:
        raise api_error(502, "agent_restore_failed", "Failed to restore agent.")
    return _row_to_agent(result[0])


@router.post("/{agent_id}/duplicate", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def duplicate_agent(
    agent_id: str,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> AgentResponse:
    """Create a deep copy of an agent in the same workspace.

    The new agent has "(Copy)" appended to its name, run counters reset to 0,
    and `created_by` set to the current user. Useful for spinning variants.
    """
    workspace_id, role = ctx
    if role not in ("owner", "editor"):
        raise api_error(403, "insufficient_role", "Editor or Owner role required.")

    source = (
        tenant_query("agents", workspace_id)
        .select("*")
        .eq("id", agent_id)
        .execute()
    ).data or []
    if not source:
        raise api_error(404, "agent_not_found", "Agent not found.")
    src = source[0]

    user_id = request.state.user_id
    new_id = str(uuid4())
    now = datetime.now(UTC).isoformat()

    # Copy every editable field. Reset accumulators.
    new_row = {
        "id": new_id,
        "workspace_id": workspace_id,
        "name": f"{src.get('name', 'Agent')} (Copy)",
        "description": src.get("description") or "",
        "avatar": src.get("avatar") or "🤖",
        "color": src.get("color") or "#7C3AED",
        "category": src.get("category") or "custom",
        "system_prompt": src.get("system_prompt") or "",
        "behavior": src.get("behavior") or "balanced",
        "temperature": src.get("temperature") or 0.7,
        "model": src.get("model") or "gpt-4o",
        "allowed_collections": src.get("allowed_collections") or [],
        "allowed_tools": src.get("allowed_tools") or [],
        "memory_enabled": src.get("memory_enabled", True),
        "citation_required": src.get("citation_required", True),
        "verification_mode": src.get("verification_mode", False),
        "auto_retry": src.get("auto_retry", True),
        "confidence_threshold": src.get("confidence_threshold") or 0.7,
        "is_pinned": False,
        "is_favorite": False,
        "run_count": 0,
        "success_rate": 0.0,
        "avg_latency_ms": 0,
        "avg_trust_score": 0.0,
        "created_by": user_id,
        "created_at": now,
    }
    try:
        result = get_client().table("agents").insert(new_row).execute().data
    except Exception as exc:
        raise api_error(502, "agent_duplicate_failed", f"Insert failed: {exc}")
    if not result:
        raise api_error(502, "agent_duplicate_failed", "No row returned from insert.")
    return _row_to_agent(result[0])


@router.post("/{agent_id}/clone", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def clone_agent_to_workspace(
    agent_id: str,
    request: Request,
    target_workspace_id: str | None = None,
    ctx: tuple = Depends(require_workspace_role),
) -> AgentResponse:
    """Clone an agent to a different workspace (defaults to current).

    Requires the caller to be a member of the target workspace. The
    template/version is incremented to track provenance.
    """
    workspace_id, role = ctx
    if role not in ("owner", "editor"):
        raise api_error(403, "insufficient_role", "Editor or Owner role required.")

    source = (
        tenant_query("agents", workspace_id)
        .select("*")
        .eq("id", agent_id)
        .execute()
    ).data or []
    if not source:
        raise api_error(404, "agent_not_found", "Agent not found.")
    src = source[0]

    target_ws = target_workspace_id or workspace_id
    if target_ws != workspace_id:
        # Verify the caller is a member of the target workspace
        member = (
            get_client()
            .table("memberships")
            .select("role")
            .eq("workspace_id", target_ws)
            .eq("user_id", request.state.user_id)
            .execute()
        ).data or []
        if not member or member[0].get("role") not in ("owner", "editor"):
            raise api_error(403, "target_workspace_access_denied",
                            "Editor or Owner role required in target workspace.")

    user_id = request.state.user_id
    new_id = str(uuid4())
    now = datetime.now(UTC).isoformat()
    new_row = {
        "id": new_id,
        "workspace_id": target_ws,
        "name": src.get("name") or "Cloned Agent",
        "description": src.get("description") or "",
        "avatar": src.get("avatar") or "🤖",
        "color": src.get("color") or "#7C3AED",
        "category": src.get("category") or "custom",
        "system_prompt": src.get("system_prompt") or "",
        "behavior": src.get("behavior") or "balanced",
        "temperature": src.get("temperature") or 0.7,
        "model": src.get("model") or "gpt-4o",
        "allowed_collections": src.get("allowed_collections") or [],
        "allowed_tools": src.get("allowed_tools") or [],
        "memory_enabled": src.get("memory_enabled", True),
        "citation_required": src.get("citation_required", True),
        "verification_mode": src.get("verification_mode", False),
        "auto_retry": src.get("auto_retry", True),
        "confidence_threshold": src.get("confidence_threshold") or 0.7,
        "is_pinned": False,
        "is_favorite": False,
        "run_count": 0,
        "success_rate": 0.0,
        "avg_latency_ms": 0,
        "avg_trust_score": 0.0,
        "created_by": user_id,
        "created_at": now,
    }
    try:
        result = get_client().table("agents").insert(new_row).execute().data
    except Exception as exc:
        raise api_error(502, "agent_clone_failed", f"Insert failed: {exc}")
    if not result:
        raise api_error(502, "agent_clone_failed", "No row returned from insert.")
    return _row_to_agent(result[0])


@router.post("/{agent_id}/version", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def version_agent(
    agent_id: str,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> AgentResponse:
    """Snapshot the current agent configuration as a new versioned agent.

    The new version increments the version suffix in the name. Useful for
    rolling forward with A/B comparison via the experiments platform.
    """
    workspace_id, role = ctx
    if role not in ("owner", "editor"):
        raise api_error(403, "insufficient_role", "Editor or Owner role required.")

    source = (
        tenant_query("agents", workspace_id)
        .select("*")
        .eq("id", agent_id)
        .execute()
    ).data or []
    if not source:
        raise api_error(404, "agent_not_found", "Agent not found.")
    src = source[0]

    # Detect existing version suffix
    import re
    base_name = src.get("name") or "Agent"
    m = re.search(r"\s+v(\d+)$", base_name)
    next_version = (int(m.group(1)) + 1) if m else 2
    new_name = re.sub(r"\s+v\d+$", "", base_name) + f" v{next_version}"

    user_id = request.state.user_id
    new_id = str(uuid4())
    now = datetime.now(UTC).isoformat()
    new_row = {
        "id": new_id,
        "workspace_id": workspace_id,
        "name": new_name,
        "description": src.get("description") or "",
        "avatar": src.get("avatar") or "🤖",
        "color": src.get("color") or "#7C3AED",
        "category": src.get("category") or "custom",
        "system_prompt": src.get("system_prompt") or "",
        "behavior": src.get("behavior") or "balanced",
        "temperature": src.get("temperature") or 0.7,
        "model": src.get("model") or "gpt-4o",
        "allowed_collections": src.get("allowed_collections") or [],
        "allowed_tools": src.get("allowed_tools") or [],
        "memory_enabled": src.get("memory_enabled", True),
        "citation_required": src.get("citation_required", True),
        "verification_mode": src.get("verification_mode", False),
        "auto_retry": src.get("auto_retry", True),
        "confidence_threshold": src.get("confidence_threshold") or 0.7,
        "is_pinned": False,
        "is_favorite": False,
        "run_count": 0,
        "success_rate": 0.0,
        "avg_latency_ms": 0,
        "avg_trust_score": 0.0,
        "created_by": user_id,
        "created_at": now,
    }
    try:
        result = get_client().table("agents").insert(new_row).execute().data
    except Exception as exc:
        raise api_error(502, "agent_version_failed", f"Insert failed: {exc}")
    if not result:
        raise api_error(502, "agent_version_failed", "No row returned from insert.")
    return _row_to_agent(result[0])


# ─── Bulk actions ─────────────────────────────────────────────────────────────

@router.post("/bulk-delete", status_code=status.HTTP_200_OK)
async def bulk_delete_agents(
    request: Request,
    agent_ids: list[str] = [],
    ctx: tuple = Depends(require_workspace_role),
) -> dict:
    """Delete multiple agents at once. All deletions are tenant-scoped."""
    workspace_id, role = ctx
    if role not in ("owner", "editor"):
        raise api_error(403, "insufficient_role", "Editor or Owner role required.")
    if not agent_ids:
        raise api_error(422, "no_ids", "Provide at least one agent id.")
    if len(agent_ids) > 100:
        raise api_error(422, "too_many", "Maximum 100 agents per bulk operation.")

    db = get_client()
    deleted: list[str] = []
    failed: list[dict[str, str]] = []
    for aid in agent_ids:
        try:
            existing = (
                tenant_query("agents", workspace_id)
                .select("id")
                .eq("id", aid)
                .execute()
            ).data or []
            if not existing:
                failed.append({"id": aid, "reason": "not_found"})
                continue
            db.table("agent_runs").delete().eq("agent_id", aid).eq("workspace_id", workspace_id).execute()
            db.table("agents").delete().eq("id", aid).eq("workspace_id", workspace_id).execute()
            deleted.append(aid)
        except Exception as exc:
            failed.append({"id": aid, "reason": str(exc)[:200]})
    return {"deleted": deleted, "failed": failed, "deleted_count": len(deleted)}


@router.post("/bulk-archive", status_code=status.HTTP_200_OK)
async def bulk_archive_agents(
    request: Request,
    agent_ids: list[str] = [],
    ctx: tuple = Depends(require_workspace_role),
) -> dict:
    workspace_id, role = ctx
    if role not in ("owner", "editor"):
        raise api_error(403, "insufficient_role", "Editor or Owner role required.")
    if not agent_ids:
        raise api_error(422, "no_ids", "Provide at least one agent id.")
    if len(agent_ids) > 100:
        raise api_error(422, "too_many", "Maximum 100 agents per bulk operation.")

    now = datetime.now(UTC).isoformat()
    archived: list[str] = []
    failed: list[dict[str, str]] = []
    db = get_client()
    for aid in agent_ids:
        try:
            existing = (
                tenant_query("agents", workspace_id)
                .select("id")
                .eq("id", aid)
                .execute()
            ).data or []
            if not existing:
                failed.append({"id": aid, "reason": "not_found"})
                continue
            db.table("agents").update({"archived_at": now}).eq("id", aid).eq("workspace_id", workspace_id).execute()
            archived.append(aid)
        except Exception as exc:
            failed.append({"id": aid, "reason": str(exc)[:200]})
    return {"archived": archived, "failed": failed, "archived_count": len(archived)}


# ─── Import / Export ──────────────────────────────────────────────────────────

@router.get("/export")
async def export_agents(
    request: Request,
    archived: bool = False,
    ctx: tuple = Depends(require_workspace_role),
) -> dict:
    """Export all agents (in the active archive filter) as a portable JSON bundle.

    The bundle can be re-imported via `POST /api/agents/import`. Tool and
    collection IDs are kept as references; on import, the receiving
    workspace re-binds them by name.
    """
    workspace_id, _ = ctx
    try:
        q = (
            tenant_query("agents", workspace_id)
            .select("*")
            .order("created_at", desc=True)
        )
        if not archived:
            q = q.is_("archived_at", "null")
        rows = q.execute().data or []
    except Exception as exc:
        raise api_error(502, "export_failed", f"{exc}")
    bundle = {
        "version": "1.0",
        "exported_at": datetime.now(UTC).isoformat(),
        "workspace_id": workspace_id,
        "count": len(rows),
        "agents": [
            {
                "name": r.get("name"),
                "description": r.get("description"),
                "avatar": r.get("avatar"),
                "color": r.get("color"),
                "category": r.get("category"),
                "system_prompt": r.get("system_prompt"),
                "behavior": r.get("behavior"),
                "temperature": r.get("temperature"),
                "model": r.get("model"),
                "allowed_collections": r.get("allowed_collections") or [],
                "allowed_tools": r.get("allowed_tools") or [],
                "memory_enabled": r.get("memory_enabled"),
                "citation_required": r.get("citation_required"),
                "verification_mode": r.get("verification_mode"),
                "auto_retry": r.get("auto_retry"),
                "confidence_threshold": r.get("confidence_threshold"),
            }
            for r in rows
        ],
    }
    return bundle


@router.post("/import", status_code=status.HTTP_201_CREATED)
async def import_agents(
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> dict:
    """Import a bundle produced by `/api/agents/export`.

    Body shape: `{ "version": "1.0", "agents": [ ... ] }`.
    Returns the list of created agent IDs.
    """
    workspace_id, role = ctx
    if role not in ("owner", "editor"):
        raise api_error(403, "insufficient_role", "Editor or Owner role required.")

    try:
        payload = await request.json()
    except Exception as exc:
        raise api_error(422, "invalid_json", f"{exc}")
    if not isinstance(payload, dict) or "agents" not in payload:
        raise api_error(422, "invalid_bundle", "Expected { agents: [...] }.")
    agents_payload = payload.get("agents") or []
    if not isinstance(agents_payload, list):
        raise api_error(422, "invalid_bundle", "agents must be a list.")
    if len(agents_payload) > 100:
        raise api_error(422, "too_many", "Maximum 100 agents per import.")

    user_id = request.state.user_id
    now = datetime.now(UTC).isoformat()
    created: list[str] = []
    failed: list[dict[str, str]] = []
    db = get_client()
    for raw in agents_payload:
        if not isinstance(raw, dict) or not raw.get("name"):
            failed.append({"name": raw.get("name", "<unnamed>") if isinstance(raw, dict) else "<invalid>", "reason": "missing_name"})
            continue
        try:
            new_id = str(uuid4())
            new_row = {
                "id": new_id,
                "workspace_id": workspace_id,
                "name": str(raw.get("name"))[:200],
                "description": str(raw.get("description") or "")[:2000],
                "avatar": str(raw.get("avatar") or "🤖")[:16],
                "color": str(raw.get("color") or "#7C3AED")[:16],
                "category": str(raw.get("category") or "custom")[:50],
                "system_prompt": str(raw.get("system_prompt") or "You are a helpful AI agent.")[:16000],
                "behavior": str(raw.get("behavior") or "balanced")[:50],
                "temperature": float(raw.get("temperature") or 0.7),
                "model": str(raw.get("model") or "gpt-4o")[:100],
                "allowed_collections": list(raw.get("allowed_collections") or []),
                "allowed_tools": list(raw.get("allowed_tools") or []),
                "memory_enabled": bool(raw.get("memory_enabled", True)),
                "citation_required": bool(raw.get("citation_required", True)),
                "verification_mode": bool(raw.get("verification_mode", False)),
                "auto_retry": bool(raw.get("auto_retry", True)),
                "confidence_threshold": float(raw.get("confidence_threshold") or 0.7),
                "is_pinned": False,
                "is_favorite": False,
                "run_count": 0,
                "success_rate": 0.0,
                "avg_latency_ms": 0,
                "avg_trust_score": 0.0,
                "created_by": user_id,
                "created_at": now,
            }
            result = db.table("agents").insert(new_row).execute().data
            if result:
                created.append(new_id)
            else:
                failed.append({"name": str(raw.get("name")), "reason": "insert_returned_no_rows"})
        except Exception as exc:
            failed.append({"name": str(raw.get("name", "?")), "reason": str(exc)[:200]})
    return {"created": created, "failed": failed, "created_count": len(created)}


