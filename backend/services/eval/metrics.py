from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import uuid4

from db.client import get_client, tenant_query
from services.eval.models import QualityRollup

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _today_date() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%d")


def compute_quality_rollup(workspace_id: str, day: str | None = None) -> QualityRollup:
    """Aggregate eval and answer_run metrics for a given day (ISO date string).

    Upserts a quality_rollups row and returns the rollup.
    """
    target_day = day or _today_date()
    day_start = f"{target_day}T00:00:00+00:00"
    day_end = f"{target_day}T23:59:59+00:00"

    client = get_client()

    # Eval metrics for the day
    eval_result = (
        tenant_query("answer_evals", workspace_id)
        .gte("created_at", day_start)
        .lte("created_at", day_end)
        .select("faithfulness,judge_overall,judge_hallucination_risk,overall")
        .execute()
    )
    evals = eval_result.data or []

    # Answer run metrics for the day (count abstentions, verification passes)
    run_result = (
        tenant_query("answer_runs", workspace_id)
        .gte("created_at", day_start)
        .lte("created_at", day_end)
        .select("abstained,verification_passes,trust_confidence")
        .execute()
    )
    runs = run_result.data or []

    def _avg_float(rows: list[dict], field: str) -> float | None:
        vals = [float(r[field]) for r in rows if r.get(field) is not None]
        return round(sum(vals) / len(vals), 4) if vals else None

    def _avg_int(rows: list[dict], field: str) -> float | None:
        vals = [r[field] for r in rows if r.get(field) is not None]
        return round(sum(vals) / len(vals), 2) if vals else None

    total_answers = len(runs)
    abstention_count = sum(1 for r in runs if r.get("abstained"))
    verification_pass_count = sum(
        r.get("verification_passes", 1) for r in runs if r.get("verification_passes", 1) > 1
    )
    abstention_rate = round(abstention_count / total_answers, 4) if total_answers > 0 else 0.0

    avg_faithfulness = _avg_float(evals, "faithfulness")
    avg_judge_overall = _avg_int(evals, "judge_overall")
    avg_hallucination_risk = _avg_int(evals, "judge_hallucination_risk")
    avg_confidence_score = _avg_float(runs, "trust_confidence")

    # Upsert rollup row
    existing = (
        tenant_query("quality_rollups", workspace_id)
        .eq("day", target_day)
        .limit(1)
        .execute()
    )
    rollup_id: str
    if existing.data:
        rollup_id = existing.data[0]["id"]
        client.table("quality_rollups").update({
            "avg_faithfulness": avg_faithfulness,
            "abstention_rate": abstention_rate,
            "n": total_answers,
            "avg_judge_overall": avg_judge_overall,
            "avg_hallucination_risk": avg_hallucination_risk,
            "avg_confidence_score": avg_confidence_score,
            "abstention_count": abstention_count,
            "verification_pass_count": verification_pass_count,
            "total_answers": total_answers,
        }).eq("id", rollup_id).execute()
    else:
        rollup_id = str(uuid4())
        client.table("quality_rollups").insert({
            "id": rollup_id,
            "workspace_id": workspace_id,
            "day": target_day,
            "avg_faithfulness": avg_faithfulness,
            "abstention_rate": abstention_rate,
            "n": total_answers,
            "avg_judge_overall": avg_judge_overall,
            "avg_hallucination_risk": avg_hallucination_risk,
            "avg_confidence_score": avg_confidence_score,
            "abstention_count": abstention_count,
            "verification_pass_count": verification_pass_count,
            "total_answers": total_answers,
            "created_at": _now_iso(),
        }).execute()

    return QualityRollup(
        id=rollup_id,
        workspace_id=workspace_id,
        day=target_day,
        avg_faithfulness=avg_faithfulness,
        abstention_rate=abstention_rate,
        n=total_answers,
        avg_judge_overall=avg_judge_overall,
        avg_hallucination_risk=avg_hallucination_risk,
        avg_confidence_score=avg_confidence_score,
        abstention_count=abstention_count,
        verification_pass_count=verification_pass_count,
        total_answers=total_answers,
    )


def build_quality_trend(workspace_id: str, days: int = 30) -> list[QualityRollup]:
    """Return the most recent N rollup rows for dashboard trend lines."""
    result = (
        tenant_query("quality_rollups", workspace_id)
        .order("day", desc=True)
        .limit(days)
        .execute()
    )
    return [
        QualityRollup(
            id=r["id"],
            workspace_id=r["workspace_id"],
            day=r["day"],
            avg_faithfulness=r.get("avg_faithfulness"),
            abstention_rate=r.get("abstention_rate", 0.0),
            n=r.get("n", 0),
            avg_judge_overall=r.get("avg_judge_overall"),
            avg_hallucination_risk=r.get("avg_hallucination_risk"),
            avg_confidence_score=r.get("avg_confidence_score"),
            abstention_count=r.get("abstention_count", 0),
            verification_pass_count=r.get("verification_pass_count", 0),
            total_answers=r.get("total_answers", 0),
        )
        for r in (result.data or [])
    ]
