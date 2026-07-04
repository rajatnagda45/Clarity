from __future__ import annotations

import logging
from typing import Literal

from fastapi import Request

from api.errors import api_error
from config import settings
from db.client import get_client

logger = logging.getLogger(__name__)

WorkspaceRole = Literal["owner", "editor", "viewer"]
ROLE_ORDER: dict[WorkspaceRole, int] = {
    "viewer": 1,
    "editor": 2,
    "owner": 3,
}

_ROLE_CACHE_TTL = 60  # seconds


async def _get_cached_role(workspace_id: str, user_id: str) -> str | None:
    """Return cached membership role from Redis, or None on miss/unavailability."""
    try:
        from cache.client import get_redis
        r = get_redis()
        if r is None:
            return None
        raw = await r.get(f"role:{workspace_id}:{user_id}")
        return raw.decode() if raw else None
    except Exception:
        return None


async def _set_cached_role(workspace_id: str, user_id: str, role: str) -> None:
    try:
        from cache.client import get_redis
        r = get_redis()
        if r is None:
            return
        await r.setex(f"role:{workspace_id}:{user_id}", _ROLE_CACHE_TTL, role)
    except Exception:
        pass


async def invalidate_role_cache(workspace_id: str, user_id: str) -> None:
    """Call when a membership is changed so the cache is cleared immediately."""
    try:
        from cache.client import get_redis
        r = get_redis()
        if r is None:
            return
        await r.delete(f"role:{workspace_id}:{user_id}")
    except Exception:
        pass


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

    # Fast path: check Redis cache before hitting the DB
    cached_role: str | None = None
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        if not loop.is_closed():
            cached_role = loop.run_until_complete(_get_cached_role(workspace_id, user_id))
    except Exception:
        cached_role = None

    if cached_role is None:
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
        cached_role = row["role"]
        try:
            loop = asyncio.get_event_loop()
            if not loop.is_closed():
                loop.run_until_complete(_set_cached_role(workspace_id, user_id, cached_role))
        except Exception:
            pass

    role: WorkspaceRole = cached_role  # type: ignore[assignment]
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
