from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import uuid4

from db.client import get_client, tenant_query

logger = logging.getLogger(__name__)

_VALID_KEYS = {"writer", "critic", "judge"}


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _validate_key(prompt_key: str) -> None:
    if prompt_key not in _VALID_KEYS:
        raise ValueError(f"prompt_key must be one of {_VALID_KEYS}, got {prompt_key!r}")


def create_prompt_version(
    workspace_id: str,
    prompt_key: str,
    version: str,
    content: str,
    description: str | None = None,
    author: str | None = None,
) -> str:
    _validate_key(prompt_key)
    client = get_client()
    prompt_id = str(uuid4())
    client.table("prompt_versions").insert({
        "id": prompt_id,
        "workspace_id": workspace_id,
        "prompt_key": prompt_key,
        "version": version,
        "content": content,
        "description": description,
        "author": author,
        "active": False,
        "retired": False,
        "created_at": _now_iso(),
    }).execute()
    return prompt_id


def activate_prompt_version(workspace_id: str, prompt_id: str) -> None:
    """Mark this version active; deactivate all other versions for the same key."""
    client = get_client()
    row_result = (
        tenant_query("prompt_versions", workspace_id)
        .eq("id", prompt_id)
        .limit(1)
        .select("prompt_key")
        .execute()
    )
    row = (row_result.data or [None])[0]
    if not row:
        raise ValueError(f"Prompt version {prompt_id} not found")
    prompt_key = row["prompt_key"]

    # Deactivate all others for this key first
    client.table("prompt_versions").update({"active": False}).eq(
        "workspace_id", workspace_id
    ).eq("prompt_key", prompt_key).execute()

    # Activate the target
    client.table("prompt_versions").update({"active": True}).eq(
        "id", prompt_id
    ).eq("workspace_id", workspace_id).execute()


def retire_prompt_version(workspace_id: str, prompt_id: str) -> None:
    get_client().table("prompt_versions").update({
        "retired": True,
        "active": False,
    }).eq("id", prompt_id).eq("workspace_id", workspace_id).execute()


def get_active_prompt(workspace_id: str, prompt_key: str) -> dict | None:
    _validate_key(prompt_key)
    result = (
        tenant_query("prompt_versions", workspace_id)
        .eq("prompt_key", prompt_key)
        .eq("active", True)
        .limit(1)
        .execute()
    )
    return (result.data or [None])[0]


def list_prompt_versions(workspace_id: str, prompt_key: str | None = None) -> list[dict]:
    query = (
        tenant_query("prompt_versions", workspace_id)
        .eq("retired", False)
        .order("created_at", desc=True)
    )
    if prompt_key:
        _validate_key(prompt_key)
        query = query.eq("prompt_key", prompt_key)
    result = query.limit(100).execute()
    return result.data or []


def get_prompt_version(workspace_id: str, prompt_id: str) -> dict | None:
    result = (
        tenant_query("prompt_versions", workspace_id)
        .eq("id", prompt_id)
        .limit(1)
        .execute()
    )
    return (result.data or [None])[0]
