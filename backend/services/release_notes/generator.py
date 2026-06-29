from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from uuid import uuid4

from openai import OpenAI

from config import settings
from db.client import get_client, tenant_query

logger = logging.getLogger(__name__)

_RELEASE_SYSTEM = """\
You are a technical writer generating a concise AI release note for a legal document AI platform.

You will receive metric deltas between two prompt/model versions (positive = improvement,
negative = regression). Each value is on a 0–100 scale except latency (milliseconds).

Write a 2–3 sentence executive summary describing what changed and what engineers should know.
Be specific about the direction and rough magnitude of changes.
Use non-technical language where possible.
Never fabricate metrics not provided.
"""


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _load_benchmark_run(workspace_id: str, run_id: str) -> dict | None:
    result = (
        tenant_query("benchmark_runs", workspace_id)
        .eq("id", run_id)
        .limit(1)
        .execute()
    )
    return (result.data or [None])[0]


def _compute_delta(from_run: dict, to_run: dict) -> dict[str, float]:
    fields = {
        "avg_judge_overall": "judge_overall",
        "avg_trust_confidence": "trust",
        "avg_latency_ms": "latency_ms",
    }
    delta: dict[str, float] = {}
    for db_field, label in fields.items():
        a = from_run.get(db_field)
        b = to_run.get(db_field)
        if a is not None and b is not None:
            delta[label] = round(float(b) - float(a), 2)
    return delta


def generate_release_note(
    workspace_id: str,
    to_version: str,
    to_benchmark_run_id: str,
    from_version: str | None = None,
    from_benchmark_run_id: str | None = None,
    title: str | None = None,
) -> str:
    """Generate and persist a release note. Returns the release_notes row ID."""
    to_run = _load_benchmark_run(workspace_id, to_benchmark_run_id)
    if not to_run:
        raise ValueError(f"Benchmark run {to_benchmark_run_id} not found")

    metrics_delta: dict = {}
    if from_benchmark_run_id:
        from_run = _load_benchmark_run(workspace_id, from_benchmark_run_id)
        if from_run:
            metrics_delta = _compute_delta(from_run, to_run)

    delta_text = json.dumps(metrics_delta, indent=2) if metrics_delta else "(no comparison data)"
    user_message = (
        f"From version: {from_version or 'baseline'}\n"
        f"To version: {to_version}\n"
        f"Metric deltas: {delta_text}"
    )

    ai_client = OpenAI(api_key=settings.openai_api_key)
    summary = "(Unable to generate summary)"
    try:
        response = ai_client.chat.completions.create(
            model=settings.judge_model,
            temperature=0.2,
            messages=[
                {"role": "system", "content": _RELEASE_SYSTEM},
                {"role": "user", "content": user_message},
            ],
        )
        summary = (response.choices[0].message.content or "").strip()
    except Exception as exc:
        logger.error("Release note LLM call failed: %s", exc)

    note_id = str(uuid4())
    note_title = title or f"Release: {to_version}"

    get_client().table("release_notes").insert({
        "id": note_id,
        "workspace_id": workspace_id,
        "title": note_title,
        "from_version": from_version,
        "to_version": to_version,
        "summary": summary,
        "metrics_delta": metrics_delta,
        "benchmark_run_id": to_benchmark_run_id,
        "created_at": _now_iso(),
    }).execute()

    return note_id


def list_release_notes(workspace_id: str, limit: int = 20) -> list[dict]:
    return (
        tenant_query("release_notes", workspace_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data or []
    )


def get_release_note(workspace_id: str, note_id: str) -> dict | None:
    result = (
        tenant_query("release_notes", workspace_id)
        .eq("id", note_id)
        .limit(1)
        .execute()
    )
    return (result.data or [None])[0]
