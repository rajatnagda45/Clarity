from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request, status

from db.client import get_client
from schemas import (
    CreateWorkspaceRequest,
    CreateWorkspaceResponse,
    MeResponse,
    WorkspaceSummary,
)


router = APIRouter(prefix="/api", tags=["workspaces"])


@router.get("/me", response_model=MeResponse)
async def get_me(request: Request) -> MeResponse:
    user_id = getattr(request.state, "user_id", "")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user missing from request state",
        )

    client = get_client()
    memberships_result = (
        client.table("memberships")
        .select("workspace_id, role, workspaces(id, name, plan)")
        .eq("user_id", user_id)
        .execute()
    )

    workspace_summaries: list[WorkspaceSummary] = []
    for row in memberships_result.data or []:
        workspace = row.get("workspaces") or {}
        if not workspace:
            continue
        workspace_summaries.append(
            WorkspaceSummary(
                id=str(workspace["id"]),
                name=workspace["name"],
                role=row["role"],
                plan=workspace["plan"],
            )
        )

    return MeResponse(userId=user_id, workspaces=workspace_summaries)


@router.post("/workspaces", response_model=CreateWorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    payload: CreateWorkspaceRequest,
    request: Request,
) -> CreateWorkspaceResponse:
    user_id = getattr(request.state, "user_id", "")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user missing from request state",
        )

    workspace_name = payload.name.strip()
    if not workspace_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Workspace name must not be empty",
        )

    workspace_id = str(uuid4())
    membership_id = str(uuid4())
    client = get_client()

    workspace_insert = client.table("workspaces").insert(
        {
            "id": workspace_id,
            "name": workspace_name,
            "owner_user_id": user_id,
            "plan": "free",
        }
    ).execute()

    if not workspace_insert.data:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create workspace",
        )

    membership_insert = client.table("memberships").insert(
        {
            "id": membership_id,
            "workspace_id": workspace_id,
            "user_id": user_id,
            "role": "owner",
        }
    ).execute()

    if not membership_insert.data:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Workspace created but membership insertion failed",
        )

    return CreateWorkspaceResponse(
        id=workspace_id,
        name=workspace_name,
        role="owner",
        plan="free",
    )
