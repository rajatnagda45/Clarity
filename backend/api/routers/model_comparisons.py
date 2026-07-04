from __future__ import annotations

from fastapi import APIRouter, Depends

from api.deps import require_workspace_role
from db.client import tenant_query
from schemas import ModelComparisonResponse, ModelComparisonListResponse

router = APIRouter(prefix="/api/model-comparisons", tags=["model-comparisons"])


@router.get("", response_model=ModelComparisonListResponse)
def list_model_comparisons(
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> ModelComparisonListResponse:
    """Aggregate benchmark run results grouped by model_version.

    Returns one summary row per distinct model_version seen in benchmark_runs.
    """
    workspace_id, _ = membership

    runs_result = (
        tenant_query("benchmark_runs", workspace_id)
        .eq("status", "completed")
        .not_.is_("avg_judge_overall", "null")
        .order("created_at", desc=True)
        .limit(200)
        .select(
            "model_version,avg_judge_overall,avg_trust_confidence,"
            "avg_latency_ms,total_cost_usd,completed_cases"
        )
        .execute()
    )
    rows = runs_result.data or []

    # Group by model_version
    groups: dict[str, list[dict]] = {}
    for row in rows:
        mv = row.get("model_version") or "unknown"
        groups.setdefault(mv, []).append(row)

    comparisons: list[ModelComparisonResponse] = []
    for model_version, group_rows in groups.items():
        def _avg(field: str) -> float | None:
            vals = [float(r[field]) for r in group_rows if r.get(field) is not None]
            return round(sum(vals) / len(vals), 2) if vals else None

        total_cases = sum(r.get("completed_cases", 0) for r in group_rows)

        comparisons.append(ModelComparisonResponse(
            model_version=model_version,
            run_count=len(group_rows),
            total_cases=total_cases,
            avg_judge_overall=_avg("avg_judge_overall"),
            avg_trust_confidence=_avg("avg_trust_confidence"),
            avg_latency_ms=_avg("avg_latency_ms"),
        ))

    # Sort by avg_judge_overall descending (best first)
    comparisons.sort(key=lambda c: c.avg_judge_overall or 0, reverse=True)
    return ModelComparisonListResponse(comparisons=comparisons, total=len(comparisons))
