from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import require_workspace_role
from schemas import (
    CreateReleaseNoteRequest,
    ReleaseNoteResponse,
    ReleaseNoteListResponse,
)
from services.release_notes.generator import (
    generate_release_note,
    get_release_note,
    list_release_notes,
)

router = APIRouter(prefix="/api/release-notes", tags=["release-notes"])


def _error(code_: int, code: str, msg: str) -> HTTPException:
    return HTTPException(status_code=code_, detail={"code": code, "message": msg})


def _to_response(row: dict) -> ReleaseNoteResponse:
    return ReleaseNoteResponse(
        id=row["id"],
        workspace_id=row["workspace_id"],
        title=row["title"],
        from_version=row.get("from_version"),
        to_version=row["to_version"],
        summary=row["summary"],
        metrics_delta=row.get("metrics_delta") or {},
        benchmark_run_id=row.get("benchmark_run_id"),
        created_at=row["created_at"],
    )


@router.get("", response_model=ReleaseNoteListResponse)
def list_notes(
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> ReleaseNoteListResponse:
    workspace_id, _ = membership
    rows = list_release_notes(workspace_id)
    return ReleaseNoteListResponse(notes=[_to_response(r) for r in rows], total=len(rows))


@router.post("", response_model=ReleaseNoteResponse, status_code=status.HTTP_201_CREATED)
def create_note(
    payload: CreateReleaseNoteRequest,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> ReleaseNoteResponse:
    workspace_id, _ = membership
    try:
        note_id = generate_release_note(
            workspace_id=workspace_id,
            to_version=payload.to_version,
            to_benchmark_run_id=payload.to_benchmark_run_id,
            from_version=payload.from_version,
            from_benchmark_run_id=payload.from_benchmark_run_id,
            title=payload.title,
        )
    except ValueError as exc:
        raise _error(status.HTTP_404_NOT_FOUND, "not_found", str(exc)) from exc

    row = get_release_note(workspace_id, note_id)
    if not row:
        raise _error(status.HTTP_500_INTERNAL_SERVER_ERROR, "create_failed", "Failed to create release note")
    return _to_response(row)


@router.get("/{note_id}", response_model=ReleaseNoteResponse)
def get_note(
    note_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> ReleaseNoteResponse:
    workspace_id, _ = membership
    row = get_release_note(workspace_id, note_id)
    if not row:
        raise _error(status.HTTP_404_NOT_FOUND, "not_found", "Release note not found")
    return _to_response(row)
