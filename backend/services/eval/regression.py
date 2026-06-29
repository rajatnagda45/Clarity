from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import uuid4

from db.client import get_client, tenant_query
from config import settings

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _load_eval(client, eval_id: str) -> dict | None:
    result = client.table("answer_evals").select(
        "id,workspace_id,judge_overall,judge_hallucination_risk,overall"
    ).eq("id", eval_id).limit(1).execute()
    return (result.data or [None])[0]


def _load_window_avg(workspace_id: str, exclude_eval_id: str) -> dict:
    """Load the last N eval scores for the workspace (excluding current)."""
    result = (
        tenant_query("answer_evals", workspace_id)
        .neq("id", exclude_eval_id)
        .not_.is_("judge_overall", "null")
        .order("created_at", desc=True)
        .limit(settings.eval_regression_window)
        .select("judge_overall,judge_hallucination_risk,overall")
        .execute()
    )
    rows = result.data or []
    if not rows:
        return {}

    def _avg(field: str) -> float | None:
        vals = [r[field] for r in rows if r.get(field) is not None]
        return round(sum(vals) / len(vals), 2) if vals else None

    return {
        "avg_judge_overall": _avg("judge_overall"),
        "avg_hallucination_risk": _avg("judge_hallucination_risk"),
        "avg_trust_confidence": _avg("overall"),
        "window_size": len(rows),
    }


def detect_regression(workspace_id: str, eval_id: str) -> str | None:
    """Compare current eval against recent window. Persists a regression_report row.

    Returns the regression_report ID, or None if insufficient history.
    """
    client = get_client()
    current = _load_eval(client, eval_id)
    if not current:
        logger.warning("detect_regression: eval %s not found", eval_id)
        return None

    window = _load_window_avg(workspace_id, exclude_eval_id=eval_id)
    if not window or window["window_size"] < 2:
        # Not enough history to detect regressions
        return None

    threshold = settings.eval_regression_threshold
    flags: list[str] = []

    current_overall = current.get("judge_overall")
    baseline_overall = window.get("avg_judge_overall")
    overall_delta: float | None = None
    if current_overall is not None and baseline_overall is not None:
        overall_delta = round(current_overall - baseline_overall, 2)
        if overall_delta < -threshold:
            flags.append(f"judge_overall dropped {abs(overall_delta):.1f} pts below window average")

    current_risk = current.get("judge_hallucination_risk")
    baseline_risk = window.get("avg_hallucination_risk")
    risk_delta: float | None = None
    if current_risk is not None and baseline_risk is not None:
        risk_delta = round(current_risk - baseline_risk, 2)
        if risk_delta > threshold:
            flags.append(f"hallucination_risk rose {risk_delta:.1f} pts above window average")

    current_trust = current.get("overall")
    baseline_trust = window.get("avg_trust_confidence")
    trust_delta: float | None = None
    if current_trust is not None and baseline_trust is not None:
        trust_delta = round(float(current_trust) - float(baseline_trust), 2)

    report_id = str(uuid4())
    client.table("regression_reports").insert({
        "id": report_id,
        "workspace_id": workspace_id,
        "current_eval_id": eval_id,
        "window_size": window["window_size"],
        "baseline_avg_judge_overall": baseline_overall,
        "current_judge_overall": current_overall,
        "judge_overall_delta": overall_delta,
        "baseline_avg_trust_confidence": baseline_trust,
        "current_trust_confidence": current_trust,
        "trust_confidence_delta": trust_delta,
        "baseline_avg_hallucination_risk": baseline_risk,
        "current_hallucination_risk": current_risk,
        "hallucination_risk_delta": risk_delta,
        "has_regression": bool(flags),
        "regression_flags": flags,
        "created_at": _now_iso(),
    }).execute()

    if flags:
        logger.warning("Regression detected for workspace %s eval %s: %s", workspace_id, eval_id, flags)

    return report_id
