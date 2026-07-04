from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, Request, Response, status

from api.deps import require_workspace_role
from api.errors import api_error
from db.client import get_client, tenant_query
from schemas import (
    CreateWorkflowRequest,
    UpdateWorkflowRequest,
    WorkflowListResponse,
    WorkflowResponse,
)

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


def _row_to_workflow(row: dict) -> WorkflowResponse:
    return WorkflowResponse(
        id=str(row["id"]),
        workspace_id=str(row["workspace_id"]),
        name=row["name"],
        description=row.get("description") or "",
        nodes=row.get("nodes") or [],
        edges=row.get("edges") or [],
        enabled=bool(row.get("enabled", True)),
        run_count=int(row.get("run_count") or 0),
        last_run_at=row.get("last_run_at"),
        created_by=row.get("created_by"),
        created_at=row["created_at"],
    )


@router.get("", response_model=WorkflowListResponse)
async def list_workflows(
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> WorkflowListResponse:
    workspace_id, _ = ctx
    rows = (
        tenant_query("workflows", workspace_id)
        .select("*")
        .order("created_at", desc=True)
        .execute()
    ).data or []
    return WorkflowListResponse(workflows=[_row_to_workflow(r) for r in rows], total=len(rows))


@router.post("", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    payload: CreateWorkflowRequest,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> WorkflowResponse:
    workspace_id, role = ctx
    if role not in ("owner", "editor"):
        raise api_error(403, "insufficient_role", "Editor or Owner role required.")

    user_id = request.state.user_id
    nodes_data = [n.model_dump(by_alias=False) for n in payload.nodes]
    edges_data = [e.model_dump(by_alias=False) for e in payload.edges]

    result = get_client().table("workflows").insert({
        "id": str(uuid4()),
        "workspace_id": workspace_id,
        "name": payload.name,
        "description": payload.description,
        "nodes": nodes_data,
        "edges": edges_data,
        "enabled": True,
        "run_count": 0,
        "created_by": user_id,
    }).execute().data

    if not result:
        raise api_error(502, "workflow_creation_failed", "Failed to create workflow.")
    return _row_to_workflow(result[0])


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: str,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> WorkflowResponse:
    workspace_id, _ = ctx
    rows = (
        tenant_query("workflows", workspace_id).select("*").eq("id", workflow_id).execute()
    ).data or []
    if not rows:
        raise api_error(404, "workflow_not_found", "Workflow not found.")
    return _row_to_workflow(rows[0])


@router.patch("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: str,
    payload: UpdateWorkflowRequest,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> WorkflowResponse:
    workspace_id, role = ctx
    if role not in ("owner", "editor"):
        raise api_error(403, "insufficient_role", "Editor or Owner role required.")

    existing = (
        tenant_query("workflows", workspace_id).select("id").eq("id", workflow_id).execute()
    ).data or []
    if not existing:
        raise api_error(404, "workflow_not_found", "Workflow not found.")

    updates: dict = {}
    raw = payload.model_dump(exclude_none=True, by_alias=False)
    for field, value in raw.items():
        if field == "nodes":
            updates["nodes"] = [n if isinstance(n, dict) else n.model_dump(by_alias=False) for n in value]
        elif field == "edges":
            updates["edges"] = [e if isinstance(e, dict) else e.model_dump(by_alias=False) for e in value]
        else:
            updates[field] = value

    if not updates:
        rows = (tenant_query("workflows", workspace_id).select("*").eq("id", workflow_id).execute()).data or []
        return _row_to_workflow(rows[0])

    result = get_client().table("workflows").update(updates).eq("id", workflow_id).execute().data
    if not result:
        raise api_error(502, "workflow_update_failed", "Failed to update workflow.")
    return _row_to_workflow(result[0])


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    workflow_id: str,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> Response:
    workspace_id, role = ctx
    if role not in ("owner", "editor"):
        raise api_error(403, "insufficient_role", "Editor or Owner role required.")

    existing = (
        tenant_query("workflows", workspace_id).select("id").eq("id", workflow_id).execute()
    ).data or []
    if not existing:
        raise api_error(404, "workflow_not_found", "Workflow not found.")

    get_client().table("workflows").delete().eq("id", workflow_id).eq("workspace_id", workspace_id).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
