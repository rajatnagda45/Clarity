from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import require_workspace_role
from db.client import tenant_query
from schemas import RegressionReportResponse, RegressionListResponse

router = APIRouter(prefix="/api/regressions", tags=["regressions"])


def _error(code_: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=code_, detail={"code": code, "message": message})


@router.get("", response_model=RegressionListResponse)
def list_regressions(
    only_flagged: bool = False,
    limit: int = 20,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> RegressionListResponse:
    workspace_id, _ = membership
    query = (
        tenant_query("regression_reports", workspace_id)
        .order("created_at", desc=True)
        .limit(limit)
    )
    if only_flagged:
        query = query.eq("has_regression", True)

    result = query.execute()
    rows = result.data or []
    reports = [_to_response(r) for r in rows]
    return RegressionListResponse(reports=reports, total=len(reports))


@router.get("/{report_id}", response_model=RegressionReportResponse)
def get_regression(
    report_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> RegressionReportResponse:
    workspace_id, _ = membership
    result = (
        tenant_query("regression_reports", workspace_id)
        .eq("id", report_id)
        .limit(1)
        .execute()
    )
    row = (result.data or [None])[0]
    if not row:
        raise _error(status.HTTP_404_NOT_FOUND, "report_not_found", "Regression report not found.")
    return _to_response(row)


def _to_response(r: dict) -> RegressionReportResponse:
    return RegressionReportResponse(
        id=r["id"],
        workspace_id=r["workspace_id"],
        current_eval_id=r["current_eval_id"],
        window_size=r["window_size"],
        baseline_avg_judge_overall=r.get("baseline_avg_judge_overall"),
        current_judge_overall=r.get("current_judge_overall"),
        judge_overall_delta=r.get("judge_overall_delta"),
        has_regression=r.get("has_regression", False),
        regression_flags=r.get("regression_flags") or [],
        created_at=r["created_at"],
    )
