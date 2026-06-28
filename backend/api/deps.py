from __future__ import annotations

from typing import Literal

from fastapi import HTTPException, Request, status

from db.client import get_client


WorkspaceRole = Literal["owner", "editor", "viewer"]
ROLE_ORDER: dict[WorkspaceRole, int] = {
    "viewer": 1,
    "editor": 2,
    "owner": 3,
}


def require_workspace_role(
    request: Request,
    minimum_role: WorkspaceRole = "viewer",
) -> tuple[str, WorkspaceRole]:
    workspace_id = getattr(request.state, "workspace_id", "")
    user_id = getattr(request.state, "user_id", "")

    if not workspace_id or not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated workspace context missing from request",
        )

    membership = (
        get_client()
        .table("memberships")
        .select("role")
        .eq("workspace_id", workspace_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    row = (membership.data or [None])[0]
    if not row:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a member of the selected workspace",
        )

    role: WorkspaceRole = row["role"]
    if ROLE_ORDER[role] < ROLE_ORDER[minimum_role]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{minimum_role.capitalize()} access required for this action",
        )

    return workspace_id, role
