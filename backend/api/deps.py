from __future__ import annotations

from typing import Literal

from fastapi import Request

from api.errors import api_error
from config import settings
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
        raise api_error(
            401,
            "missing_workspace_context",
            "Authenticated workspace context missing from request.",
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
        raise api_error(
            403,
            "workspace_membership_required",
            "User is not a member of the selected workspace.",
        )

    role: WorkspaceRole = row["role"]
    if ROLE_ORDER[role] < ROLE_ORDER[minimum_role]:
        raise api_error(
            403,
            "insufficient_workspace_role",
            f"{minimum_role.capitalize()} access required for this action.",
        )

    return workspace_id, role


def require_developer(request: Request) -> str:
    user_id = getattr(request.state, "user_id", "")
    developer_ids = {value.strip() for value in settings.developer_user_ids.split(",") if value.strip()}
    if not user_id:
        raise api_error(401, "missing_user_context", "Authenticated user context missing from request.")
    if user_id not in developer_ids:
        raise api_error(403, "developer_access_required", "Developer access is required for this endpoint.")
    return user_id
