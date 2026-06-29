from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import require_workspace_role
from schemas import (
    OptimizationRecommendationResponse,
    OptimizationListResponse,
    UpdateRecommendationRequest,
)
from services.optimization.engine import (
    list_recommendations,
    run_optimization_analysis,
    update_recommendation_status,
)

router = APIRouter(prefix="/api/optimization", tags=["optimization"])


def _error(code_: int, code: str, msg: str) -> HTTPException:
    return HTTPException(status_code=code_, detail={"code": code, "message": msg})


def _to_response(row: dict) -> OptimizationRecommendationResponse:
    return OptimizationRecommendationResponse(
        id=row["id"],
        workspace_id=row["workspace_id"],
        dimension=row["dimension"],
        severity=row["severity"],
        recommendation=row["recommendation"],
        evidence=row.get("evidence"),
        status=row["status"],
        resolved_at=row.get("resolved_at"),
        created_at=row["created_at"],
    )


@router.get("", response_model=OptimizationListResponse)
def list_recommendations_route(
    status_filter: str | None = None,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> OptimizationListResponse:
    workspace_id, _ = membership
    rows = list_recommendations(workspace_id, status=status_filter)
    return OptimizationListResponse(
        recommendations=[_to_response(r) for r in rows],
        total=len(rows),
    )


@router.post("/analyze", response_model=OptimizationListResponse)
def run_analysis(
    window: int = 50,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> OptimizationListResponse:
    """Run optimization analysis on recent evals and persist new recommendations."""
    workspace_id, _ = membership
    run_optimization_analysis(workspace_id, window=window)
    rows = list_recommendations(workspace_id, status="pending")
    return OptimizationListResponse(
        recommendations=[_to_response(r) for r in rows],
        total=len(rows),
    )


@router.patch("/{rec_id}", response_model=OptimizationRecommendationResponse)
def update_recommendation(
    rec_id: str,
    payload: UpdateRecommendationRequest,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> OptimizationRecommendationResponse:
    workspace_id, _ = membership
    try:
        update_recommendation_status(workspace_id, rec_id, payload.status)
    except ValueError as exc:
        raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid_status", str(exc)) from exc

    rows = list_recommendations(workspace_id)
    row = next((r for r in rows if r["id"] == rec_id), None)
    if not row:
        raise _error(status.HTTP_404_NOT_FOUND, "not_found", "Recommendation not found")
    return _to_response(row)
