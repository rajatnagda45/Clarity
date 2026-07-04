from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, Request, Response, status

from api.deps import require_workspace_role
from api.errors import api_error
from db.client import get_client, tenant_query
from schemas import (
    ApiKeyCreatedResponse,
    ApiKeyListResponse,
    ApiKeyResponse,
    CreateApiKeyRequest,
)

router = APIRouter(prefix="/api/enterprise", tags=["enterprise-keys"])


def _hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def _row_to_response(row: dict) -> ApiKeyResponse:
    return ApiKeyResponse(
        id=str(row["id"]),
        workspace_id=str(row["workspace_id"]),
        name=row["name"],
        key_prefix=row["key_prefix"],
        scopes=row.get("scopes") or [],
        last_used_at=row.get("last_used_at"),
        expires_at=row.get("expires_at"),
        created_at=row["created_at"],
    )


@router.get("/api-keys", response_model=ApiKeyListResponse)
async def list_api_keys(
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> ApiKeyListResponse:
    workspace_id, _ = ctx
    rows = (
        tenant_query("api_keys", workspace_id)
        .select("id, workspace_id, name, key_prefix, scopes, last_used_at, expires_at, created_at")
        .is_("revoked_at", "null")
        .order("created_at", desc=True)
        .execute()
    ).data or []
    keys = [_row_to_response(r) for r in rows]
    return ApiKeyListResponse(keys=keys, total=len(keys))


@router.post("/api-keys", response_model=ApiKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    payload: CreateApiKeyRequest,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> ApiKeyCreatedResponse:
    workspace_id, _ = ctx
    raw_key = f"clarity_sk_{secrets.token_urlsafe(32)}"
    key_id = str(uuid4())
    expires_at = None
    if payload.expires_in_days:
        expires_at = (
            datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)
        ).isoformat()

    row = get_client().table("api_keys").insert({
        "id": key_id,
        "workspace_id": workspace_id,
        "name": payload.name,
        "key_prefix": raw_key[:16],
        "key_hash": _hash_key(raw_key),
        "scopes": payload.scopes,
        "expires_at": expires_at,
    }).execute().data

    if not row:
        raise api_error(502, "api_key_creation_failed", "Failed to create API key.")

    created = row[0]
    return ApiKeyCreatedResponse(
        id=str(created["id"]),
        workspace_id=str(created["workspace_id"]),
        name=created["name"],
        key_prefix=created["key_prefix"],
        scopes=created.get("scopes") or [],
        last_used_at=None,
        expires_at=expires_at,
        created_at=created["created_at"],
        plaintext_key=raw_key,
    )


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: str,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> Response:
    workspace_id, _ = ctx
    rows = (
        tenant_query("api_keys", workspace_id)
        .select("id")
        .eq("id", key_id)
        .is_("revoked_at", "null")
        .execute()
    ).data or []
    if not rows:
        raise api_error(404, "api_key_not_found", "API key not found.")

    get_client().table("api_keys").update({
        "revoked_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", key_id).execute()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
