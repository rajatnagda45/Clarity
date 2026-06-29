from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from uuid import uuid4

from openai import OpenAI

from config import settings
from db.client import get_client, tenant_query

logger = logging.getLogger(__name__)

_ANALYSIS_SYSTEM = """\
You are a prompt engineer analyzing AI answer quality data for a legal document AI platform.

You will receive aggregated evaluation scores (0-100 scale) for a workspace over recent answers.
Each score represents the average across recent answers.

Identify the weakest dimensions (lowest scores). For each weak dimension, produce one concrete,
actionable optimization recommendation for the prompt engineer.

Rules:
- A score below 70 is weak.
- A score 70-79 is suboptimal.
- Do not mention specific scores or internal implementation details.
- Each recommendation must be a single sentence stating WHAT to change and WHY.
- Severity: "high" if score < 60, "medium" if 60-70, "low" if 70-79.
- Skip dimensions scoring 80+.

Respond with valid JSON only — a list of objects:
[
  {
    "dimension": "<dimension_name>",
    "severity": "high|medium|low",
    "recommendation": "<one-sentence actionable instruction>",
    "avg_score": <float>
  }
]
Return an empty list [] if all dimensions score 80+.
"""


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _load_recent_eval_averages(workspace_id: str, window: int = 50) -> dict[str, float]:
    """Return per-dimension averages from the most recent N judge-scored evals."""
    result = (
        tenant_query("answer_evals", workspace_id)
        .not_.is_("judge_overall", "null")
        .order("created_at", desc=True)
        .limit(window)
        .select(
            "judge_faithfulness,judge_grounding,judge_completeness,"
            "judge_correctness,judge_clarity,judge_citation_quality,"
            "judge_hallucination_risk,judge_overall"
        )
        .execute()
    )
    rows = result.data or []
    if not rows:
        return {}

    dimensions = [
        "judge_faithfulness", "judge_grounding", "judge_completeness",
        "judge_correctness", "judge_clarity", "judge_citation_quality",
        "judge_hallucination_risk", "judge_overall",
    ]

    averages: dict[str, float] = {}
    for dim in dimensions:
        vals = [r[dim] for r in rows if r.get(dim) is not None]
        if vals:
            averages[dim.removeprefix("judge_")] = round(sum(vals) / len(vals), 2)
    return averages


def _parse_recommendations(raw: str) -> list[dict]:
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return data
    except (json.JSONDecodeError, TypeError):
        pass
    return []


def run_optimization_analysis(workspace_id: str, window: int = 50) -> list[str]:
    """Analyze recent evals and persist optimization recommendations.

    Returns list of persisted recommendation IDs.
    """
    averages = _load_recent_eval_averages(workspace_id, window=window)
    if not averages:
        logger.info("No eval data for workspace %s — skipping optimization analysis", workspace_id)
        return []

    prompt_data = json.dumps(averages, indent=2)
    user_message = f"Workspace eval averages (last {window} answers):\n{prompt_data}"

    client_ai = OpenAI(api_key=settings.openai_api_key)
    try:
        response = client_ai.chat.completions.create(
            model=settings.judge_model,
            temperature=0.0,
            messages=[
                {"role": "system", "content": _ANALYSIS_SYSTEM},
                {"role": "user", "content": user_message},
            ],
        )
    except Exception as exc:
        logger.error("Optimization analysis LLM call failed: %s", exc)
        return []

    raw = (response.choices[0].message.content or "").strip()
    recommendations = _parse_recommendations(raw)

    db_client = get_client()
    created_ids: list[str] = []
    now = _now_iso()

    for rec in recommendations:
        if not isinstance(rec, dict):
            continue
        dimension = rec.get("dimension", "")
        severity = rec.get("severity", "low")
        recommendation_text = rec.get("recommendation", "")
        avg_score = rec.get("avg_score")

        if not dimension or not recommendation_text:
            continue
        if severity not in ("low", "medium", "high"):
            severity = "low"

        rec_id = str(uuid4())
        db_client.table("optimization_recommendations").insert({
            "id": rec_id,
            "workspace_id": workspace_id,
            "dimension": dimension,
            "severity": severity,
            "recommendation": recommendation_text,
            "evidence": {"avg_score": avg_score, "window": window},
            "status": "pending",
            "created_at": now,
        }).execute()
        created_ids.append(rec_id)

    return created_ids


def list_recommendations(workspace_id: str, status: str | None = None) -> list[dict]:
    query = (
        tenant_query("optimization_recommendations", workspace_id)
        .order("created_at", desc=True)
        .limit(50)
    )
    if status:
        query = query.eq("status", status)
    return query.execute().data or []


def update_recommendation_status(workspace_id: str, rec_id: str, status: str) -> None:
    if status not in ("accepted", "dismissed"):
        raise ValueError(f"status must be 'accepted' or 'dismissed', got {status!r}")
    get_client().table("optimization_recommendations").update({
        "status": status,
        "resolved_at": _now_iso(),
    }).eq("id", rec_id).eq("workspace_id", workspace_id).execute()
