from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import require_workspace_role
from db.client import tenant_query
from schemas import (
    EvalRunListResponse,
    EvalRunResponse,
    QualityDashboardResponse,
    QualityRollupResponse,
)
from services.eval.metrics import build_quality_trend, compute_quality_rollup

router = APIRouter(prefix="/api/evaluations", tags=["evaluations"])


def _error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


@router.get("", response_model=EvalRunListResponse)
def list_evals(
    limit: int = 20,
    offset: int = 0,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> EvalRunListResponse:
    workspace_id, _ = membership
    result = (
        tenant_query("answer_evals", workspace_id)
        .not_.is_("judge_overall", "null")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .select(
            "id,workspace_id,answer_run_id,judge_provider,judge_model,"
            "judge_prompt_version,judge_latency_ms,judge_faithfulness,"
            "judge_grounding,judge_completeness,judge_correctness,"
            "judge_clarity,judge_citation_quality,judge_hallucination_risk,"
            "judge_overall,judge_reasoning,created_at"
        )
        .execute()
    )
    rows = result.data or []
    evals = [_row_to_response(r) for r in rows]
    return EvalRunListResponse(evaluations=evals, total=len(evals))


@router.get("/{eval_id}", response_model=EvalRunResponse)
def get_eval(
    eval_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> EvalRunResponse:
    workspace_id, _ = membership
    result = (
        tenant_query("answer_evals", workspace_id)
        .eq("id", eval_id)
        .limit(1)
        .execute()
    )
    row = (result.data or [None])[0]
    if not row:
        raise _error(status.HTTP_404_NOT_FOUND, "eval_not_found", "Eval record not found.")
    return _row_to_response(row)


@router.get("/quality/dashboard", response_model=QualityDashboardResponse)
def quality_dashboard(
    days: int = 30,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> QualityDashboardResponse:
    workspace_id, _ = membership
    trend = build_quality_trend(workspace_id, days=days)
    rollups = [
        QualityRollupResponse(
            id=r.id,
            workspace_id=r.workspace_id,
            day=r.day,
            avg_faithfulness=r.avg_faithfulness,
            abstention_rate=r.abstention_rate,
            n=r.n,
            avg_judge_overall=r.avg_judge_overall,
            avg_hallucination_risk=r.avg_hallucination_risk,
            avg_confidence_score=r.avg_confidence_score,
            abstention_count=r.abstention_count,
            verification_pass_count=r.verification_pass_count,
            total_answers=r.total_answers,
        )
        for r in trend
    ]
    return QualityDashboardResponse(rollups=rollups, days=days)


@router.post("/quality/rollup", response_model=QualityRollupResponse)
def trigger_rollup(
    day: str | None = None,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> QualityRollupResponse:
    """Manually trigger a quality rollup computation for a given day (YYYY-MM-DD)."""
    workspace_id, _ = membership
    rollup = compute_quality_rollup(workspace_id, day=day)
    return QualityRollupResponse(
        id=rollup.id,
        workspace_id=rollup.workspace_id,
        day=rollup.day,
        avg_faithfulness=rollup.avg_faithfulness,
        abstention_rate=rollup.abstention_rate,
        n=rollup.n,
        avg_judge_overall=rollup.avg_judge_overall,
        avg_hallucination_risk=rollup.avg_hallucination_risk,
        avg_confidence_score=rollup.avg_confidence_score,
        abstention_count=rollup.abstention_count,
        verification_pass_count=rollup.verification_pass_count,
        total_answers=rollup.total_answers,
    )


def _row_to_response(r: dict) -> EvalRunResponse:
    scores = None
    if r.get("judge_overall") is not None:
        from schemas import JudgeScoresResponse
        scores = JudgeScoresResponse(
            faithfulness=r.get("judge_faithfulness"),
            grounding=r.get("judge_grounding"),
            completeness=r.get("judge_completeness"),
            correctness=r.get("judge_correctness"),
            clarity=r.get("judge_clarity"),
            citation_quality=r.get("judge_citation_quality"),
            hallucination_risk=r.get("judge_hallucination_risk"),
            overall=r["judge_overall"],
            reasoning=r.get("judge_reasoning"),
        )
    return EvalRunResponse(
        id=r["id"],
        workspace_id=r["workspace_id"],
        answer_run_id=r.get("answer_run_id"),
        judge_provider=r.get("judge_provider"),
        judge_model=r.get("judge_model"),
        judge_prompt_version=r.get("judge_prompt_version"),
        judge_latency_ms=r.get("judge_latency_ms"),
        scores=scores,
        created_at=r["created_at"],
    )
