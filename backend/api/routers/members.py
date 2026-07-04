"""
Workspace member management — list, add, update role, remove.

All mutation endpoints require the caller to be an owner of the workspace.
The last owner cannot be demoted or removed.
"""
from __future__ import annotations

import logging
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, status
from fastapi.responses import Response

from api.deps import WorkspaceRole, require_workspace_role
from api.errors import api_error
from db.client import get_client
from schemas import (
    AddMemberRequest,
    MembersListResponse,
    UpdateMemberRoleRequest,
    WorkspaceMember,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/workspaces", tags=["members"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _verify_workspace_path(path_id: str, state_id: str) -> None:
    """Reject requests where the URL workspace_id doesn't match the auth context."""
    if path_id != state_id:
        raise api_error(
            403,
            "workspace_mismatch",
            "The workspace ID in the URL must match the X-Workspace-Id header.",
        )


def _require_owner(role: WorkspaceRole) -> None:
    if role != "owner":
        raise api_error(403, "owner_required", "Only workspace owners can perform this action.")


def _count_owners(client, workspace_id: str) -> int:
    result = (
        client.table("memberships")
        .select("user_id")
        .eq("workspace_id", workspace_id)
        .eq("role", "owner")
        .execute()
    )
    return len(result.data or [])


def _get_member_role(client, workspace_id: str, user_id: str) -> str | None:
    result = (
        client.table("memberships")
        .select("role")
        .eq("workspace_id", workspace_id)
        .eq("user_id", user_id)
        .execute()
    )
    row = (result.data or [None])[0]
    return row["role"] if row else None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/{workspace_id}/members", response_model=MembersListResponse)
async def list_members(
    workspace_id: str,
    ws: Annotated[tuple[str, WorkspaceRole], Depends(require_workspace_role)],
) -> MembersListResponse:
    active_ws_id, _role = ws
    _verify_workspace_path(workspace_id, active_ws_id)

    result = (
        get_client()
        .table("memberships")
        .select("user_id, role, created_at")
        .eq("workspace_id", workspace_id)
        .order("created_at")
        .execute()
    )
    members = [
        WorkspaceMember(
            userId=row["user_id"],
            role=row["role"],
            joinedAt=row.get("created_at"),
        )
        for row in (result.data or [])
    ]
    return MembersListResponse(members=members, total=len(members))


@router.post(
    "/{workspace_id}/members",
    response_model=WorkspaceMember,
    status_code=status.HTTP_201_CREATED,
)
async def add_member(
    workspace_id: str,
    body: AddMemberRequest,
    ws: Annotated[tuple[str, WorkspaceRole], Depends(require_workspace_role)],
) -> WorkspaceMember:
    active_ws_id, role = ws
    _verify_workspace_path(workspace_id, active_ws_id)
    _require_owner(role)

    client = get_client()

    existing = (
        client.table("memberships")
        .select("id")
        .eq("workspace_id", workspace_id)
        .eq("user_id", body.user_id)
        .execute()
    )
    if existing.data:
        raise api_error(409, "member_already_exists", "This user is already a member of the workspace.")

    result = client.table("memberships").insert({
        "id": str(uuid4()),
        "workspace_id": workspace_id,
        "user_id": body.user_id,
        "role": body.role,
    }).execute()

    row = (result.data or [{}])[0]
    return WorkspaceMember(
        userId=row["user_id"],
        role=row["role"],
        joinedAt=row.get("created_at"),
    )


@router.patch("/{workspace_id}/members/{target_user_id}", response_model=WorkspaceMember)
async def update_member_role(
    workspace_id: str,
    target_user_id: str,
    body: UpdateMemberRoleRequest,
    ws: Annotated[tuple[str, WorkspaceRole], Depends(require_workspace_role)],
) -> WorkspaceMember:
    active_ws_id, role = ws
    _verify_workspace_path(workspace_id, active_ws_id)
    _require_owner(role)

    client = get_client()

    current_role = _get_member_role(client, workspace_id, target_user_id)
    if current_role is None:
        raise api_error(404, "member_not_found", "Member not found in this workspace.")

    if current_role == "owner" and body.role != "owner":
        if _count_owners(client, workspace_id) <= 1:
            raise api_error(
                422,
                "last_owner",
                "Cannot demote the last owner. Assign another owner first.",
            )

    result = (
        client.table("memberships")
        .update({"role": body.role})
        .eq("workspace_id", workspace_id)
        .eq("user_id", target_user_id)
        .execute()
    )
    row = (result.data or [{}])[0]
    return WorkspaceMember(
        userId=row["user_id"],
        role=row["role"],
        joinedAt=row.get("created_at"),
    )


@router.delete("/{workspace_id}/members/{target_user_id}")
async def remove_member(
    workspace_id: str,
    target_user_id: str,
    ws: Annotated[tuple[str, WorkspaceRole], Depends(require_workspace_role)],
) -> Response:
    active_ws_id, role = ws
    _verify_workspace_path(workspace_id, active_ws_id)
    _require_owner(role)

    client = get_client()

    current_role = _get_member_role(client, workspace_id, target_user_id)
    if current_role is None:
        raise api_error(404, "member_not_found", "Member not found in this workspace.")

    if current_role == "owner" and _count_owners(client, workspace_id) <= 1:
        raise api_error(
            422,
            "last_owner",
            "Cannot remove the last owner. Assign another owner first.",
        )

    client.table("memberships").delete().eq("workspace_id", workspace_id).eq(
        "user_id", target_user_id
    ).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
