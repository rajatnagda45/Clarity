from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import require_workspace_role
from schemas import (
    CreatePromptVersionRequest,
    PromptVersionResponse,
    PromptVersionListResponse,
)
from services.prompts.manager import (
    activate_prompt_version,
    create_prompt_version,
    get_prompt_version,
    list_prompt_versions,
    retire_prompt_version,
)

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


def _error(code_: int, code: str, msg: str) -> HTTPException:
    return HTTPException(status_code=code_, detail={"code": code, "message": msg})


def _to_response(row: dict) -> PromptVersionResponse:
    return PromptVersionResponse(
        id=row["id"],
        workspace_id=row["workspace_id"],
        prompt_key=row["prompt_key"],
        version=row["version"],
        description=row.get("description"),
        content=row["content"],
        author=row.get("author"),
        active=row.get("active", False),
        retired=row.get("retired", False),
        created_at=row["created_at"],
    )


@router.get("", response_model=PromptVersionListResponse)
def list_prompts(
    prompt_key: str | None = None,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> PromptVersionListResponse:
    workspace_id, _ = membership
    rows = list_prompt_versions(workspace_id, prompt_key=prompt_key)
    return PromptVersionListResponse(
        versions=[_to_response(r) for r in rows],
        total=len(rows),
    )


@router.post("", response_model=PromptVersionResponse, status_code=status.HTTP_201_CREATED)
def create_prompt(
    payload: CreatePromptVersionRequest,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> PromptVersionResponse:
    workspace_id, _ = membership
    try:
        prompt_id = create_prompt_version(
            workspace_id=workspace_id,
            prompt_key=payload.prompt_key,
            version=payload.version,
            content=payload.content,
            description=payload.description,
            author=payload.author,
        )
    except ValueError as exc:
        raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid_prompt_key", str(exc)) from exc

    row = get_prompt_version(workspace_id, prompt_id)
    if not row:
        raise _error(status.HTTP_500_INTERNAL_SERVER_ERROR, "create_failed", "Failed to create prompt version")
    return _to_response(row)


@router.get("/{prompt_id}", response_model=PromptVersionResponse)
def get_prompt(
    prompt_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> PromptVersionResponse:
    workspace_id, _ = membership
    row = get_prompt_version(workspace_id, prompt_id)
    if not row:
        raise _error(status.HTTP_404_NOT_FOUND, "not_found", "Prompt version not found")
    return _to_response(row)


@router.post("/{prompt_id}/activate", response_model=PromptVersionResponse)
def activate_prompt(
    prompt_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> PromptVersionResponse:
    workspace_id, _ = membership
    try:
        activate_prompt_version(workspace_id, prompt_id)
    except ValueError as exc:
        raise _error(status.HTTP_404_NOT_FOUND, "not_found", str(exc)) from exc
    row = get_prompt_version(workspace_id, prompt_id)
    if not row:
        raise _error(status.HTTP_404_NOT_FOUND, "not_found", "Prompt version not found")
    return _to_response(row)


@router.post("/{prompt_id}/retire", response_model=PromptVersionResponse)
def retire_prompt(
    prompt_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> PromptVersionResponse:
    workspace_id, _ = membership
    row = get_prompt_version(workspace_id, prompt_id)
    if not row:
        raise _error(status.HTTP_404_NOT_FOUND, "not_found", "Prompt version not found")
    retire_prompt_version(workspace_id, prompt_id)
    updated = get_prompt_version(workspace_id, prompt_id)
    return _to_response(updated or row)
