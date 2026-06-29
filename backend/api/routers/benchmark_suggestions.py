from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import require_workspace_role
from schemas import (
    ApproveSuggestionRequest,
    BenchmarkSuggestionResponse,
    BenchmarkSuggestionListResponse,
)
from services.benchmark_growth.suggester import (
    approve_suggestion,
    dismiss_suggestion,
    list_suggestions,
    scan_for_suggestions,
)

router = APIRouter(prefix="/api/benchmark-suggestions", tags=["benchmark-suggestions"])


def _error(code_: int, code: str, msg: str) -> HTTPException:
    return HTTPException(status_code=code_, detail={"code": code, "message": msg})


def _to_response(r: dict) -> BenchmarkSuggestionResponse:
    return BenchmarkSuggestionResponse(
        id=r["id"],
        workspace_id=r["workspace_id"],
        answer_run_id=r.get("answer_run_id"),
        question=r["question"],
        suggested_reason=r["suggested_reason"],
        status=r["status"],
        approved_case_id=r.get("approved_case_id"),
        created_at=r["created_at"],
    )


@router.get("", response_model=BenchmarkSuggestionListResponse)
def list_suggestions_route(
    suggestion_status: str | None = "pending",
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> BenchmarkSuggestionListResponse:
    workspace_id, _ = membership
    rows = list_suggestions(workspace_id, status=suggestion_status)
    return BenchmarkSuggestionListResponse(suggestions=[_to_response(r) for r in rows], total=len(rows))


@router.post("/scan", response_model=BenchmarkSuggestionListResponse)
def scan_suggestions(
    window: int = 100,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> BenchmarkSuggestionListResponse:
    """Scan recent answers for weak quality signals and create suggestions."""
    workspace_id, _ = membership
    scan_for_suggestions(workspace_id, window=window)
    rows = list_suggestions(workspace_id, status="pending")
    return BenchmarkSuggestionListResponse(suggestions=[_to_response(r) for r in rows], total=len(rows))


@router.post("/{suggestion_id}/approve", response_model=BenchmarkSuggestionResponse)
def approve_suggestion_route(
    suggestion_id: str,
    payload: ApproveSuggestionRequest,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> BenchmarkSuggestionResponse:
    workspace_id, _ = membership
    try:
        approve_suggestion(
            workspace_id=workspace_id,
            suggestion_id=suggestion_id,
            dataset_id=payload.dataset_id,
            reference_answer=payload.reference_answer,
            document_ids=payload.document_ids,
        )
    except ValueError as exc:
        raise _error(status.HTTP_404_NOT_FOUND, "not_found", str(exc)) from exc

    rows = list_suggestions(workspace_id, status=None)
    row = next((r for r in rows if r["id"] == suggestion_id), None)
    if not row:
        raise _error(status.HTTP_404_NOT_FOUND, "not_found", "Suggestion not found")
    return _to_response(row)


@router.post("/{suggestion_id}/dismiss", response_model=BenchmarkSuggestionResponse)
def dismiss_suggestion_route(
    suggestion_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> BenchmarkSuggestionResponse:
    workspace_id, _ = membership
    rows_before = list_suggestions(workspace_id, status=None)
    row = next((r for r in rows_before if r["id"] == suggestion_id), None)
    if not row:
        raise _error(status.HTTP_404_NOT_FOUND, "not_found", "Suggestion not found")
    dismiss_suggestion(workspace_id, suggestion_id)
    row["status"] = "dismissed"
    return _to_response(row)
