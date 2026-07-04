from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, Query, Request, Response, status

from api.deps import require_workspace_role
from api.errors import api_error
from db.client import get_client, tenant_query
from schemas import (
    CreatePromptLibraryEntryRequest,
    PromptLibraryEntryResponse,
    PromptLibraryListResponse,
    UpdatePromptLibraryEntryRequest,
)

router = APIRouter(prefix="/api/enterprise", tags=["enterprise-prompts"])


def _row_to_entry(row: dict) -> PromptLibraryEntryResponse:
    return PromptLibraryEntryResponse(
        id=str(row["id"]),
        workspace_id=str(row["workspace_id"]),
        title=row["title"],
        content=row["content"],
        category=row.get("category", "general"),
        variables=row.get("variables") or [],
        is_favorite=row.get("is_favorite", False),
        use_count=row.get("use_count", 0),
        created_by=row.get("created_by"),
        created_at=row["created_at"],
    )


@router.get("/prompt-library", response_model=PromptLibraryListResponse)
async def list_prompt_library(
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
    category: str | None = Query(default=None),
    favorites_only: bool = Query(default=False),
) -> PromptLibraryListResponse:
    workspace_id, _ = ctx
    q = (
        tenant_query("prompt_library", workspace_id)
        .select("*")
        .order("created_at", desc=True)
    )
    if category:
        q = q.eq("category", category)
    if favorites_only:
        q = q.eq("is_favorite", True)
    rows = q.execute().data or []
    return PromptLibraryListResponse(prompts=[_row_to_entry(r) for r in rows], total=len(rows))


@router.post("/prompt-library", response_model=PromptLibraryEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_prompt_entry(
    payload: CreatePromptLibraryEntryRequest,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> PromptLibraryEntryResponse:
    workspace_id, _ = ctx
    user_id = getattr(request.state, "user_id", None)
    row = get_client().table("prompt_library").insert({
        "id": str(uuid4()),
        "workspace_id": workspace_id,
        "title": payload.title,
        "content": payload.content,
        "category": payload.category,
        "variables": payload.variables,
        "is_favorite": False,
        "use_count": 0,
        "created_by": user_id,
    }).execute().data

    if not row:
        raise api_error(502, "prompt_creation_failed", "Failed to create prompt.")
    return _row_to_entry(row[0])


@router.patch("/prompt-library/{prompt_id}", response_model=PromptLibraryEntryResponse)
async def update_prompt_entry(
    prompt_id: str,
    payload: UpdatePromptLibraryEntryRequest,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> PromptLibraryEntryResponse:
    workspace_id, _ = ctx
    rows = (
        tenant_query("prompt_library", workspace_id)
        .select("*")
        .eq("id", prompt_id)
        .execute()
    ).data or []
    if not rows:
        raise api_error(404, "prompt_not_found", "Prompt not found.")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        return _row_to_entry(rows[0])

    updated = get_client().table("prompt_library").update(updates).eq("id", prompt_id).execute().data
    if not updated:
        raise api_error(502, "prompt_update_failed", "Failed to update prompt.")
    return _row_to_entry(updated[0])


@router.delete("/prompt-library/{prompt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prompt_entry(
    prompt_id: str,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> Response:
    workspace_id, _ = ctx
    rows = (
        tenant_query("prompt_library", workspace_id)
        .select("id")
        .eq("id", prompt_id)
        .execute()
    ).data or []
    if not rows:
        raise api_error(404, "prompt_not_found", "Prompt not found.")

    get_client().table("prompt_library").delete().eq("id", prompt_id).eq("workspace_id", workspace_id).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
