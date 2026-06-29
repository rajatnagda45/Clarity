from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import uuid4

from db.client import get_client, tenant_query

logger = logging.getLogger(__name__)

_LOW_TRUST_THRESHOLD = 0.50
_LOW_JUDGE_THRESHOLD = 60
_HIGH_HALLUCINATION_THRESHOLD = 60


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _load_query_for_run(workspace_id: str, answer_run_id: str) -> str:
    result = (
        tenant_query("answer_runs", workspace_id)
        .eq("id", answer_run_id)
        .limit(1)
        .select("query")
        .execute()
    )
    row = (result.data or [None])[0]
    return row["query"] if row and row.get("query") else ""


def _already_suggested(workspace_id: str, answer_run_id: str) -> bool:
    result = (
        tenant_query("benchmark_suggestions", workspace_id)
        .eq("answer_run_id", answer_run_id)
        .limit(1)
        .execute()
    )
    return bool(result.data)


def _insert_suggestion(workspace_id: str, answer_run_id: str, question: str, reason: str) -> str:
    suggestion_id = str(uuid4())
    get_client().table("benchmark_suggestions").insert({
        "id": suggestion_id,
        "workspace_id": workspace_id,
        "answer_run_id": answer_run_id,
        "question": question,
        "suggested_reason": reason,
        "status": "pending",
        "created_at": _now_iso(),
    }).execute()
    return suggestion_id


def scan_for_suggestions(workspace_id: str, window: int = 100) -> list[str]:
    """Scan recent answer_runs and evals. Suggest weak answers as benchmark candidates.

    Criteria (any one triggers):
    - abstained
    - trust_confidence < LOW_TRUST_THRESHOLD
    - judge_overall < LOW_JUDGE_THRESHOLD (from linked eval)
    - judge_hallucination_risk > HIGH_HALLUCINATION_THRESHOLD

    Never auto-promotes. Returns list of created suggestion IDs.
    """
    # Load recent answer runs
    runs_result = (
        tenant_query("answer_runs", workspace_id)
        .order("created_at", desc=True)
        .limit(window)
        .select("id,query,abstained,trust_confidence")
        .execute()
    )
    runs = runs_result.data or []

    # Load recent eval scores (indexed by answer_run_id)
    evals_result = (
        tenant_query("answer_evals", workspace_id)
        .not_.is_("judge_overall", "null")
        .order("created_at", desc=True)
        .limit(window)
        .select("answer_run_id,judge_overall,judge_hallucination_risk")
        .execute()
    )
    eval_index: dict[str, dict] = {
        e["answer_run_id"]: e
        for e in (evals_result.data or [])
        if e.get("answer_run_id")
    }

    created: list[str] = []

    for run in runs:
        run_id = run["id"]
        question = run.get("query") or ""
        if not question:
            continue

        if _already_suggested(workspace_id, run_id):
            continue

        reasons: list[str] = []

        if run.get("abstained"):
            reasons.append("abstained")

        trust = run.get("trust_confidence")
        if trust is not None and float(trust) < _LOW_TRUST_THRESHOLD:
            reasons.append(f"low_trust ({float(trust):.2f})")

        eval_row = eval_index.get(run_id)
        if eval_row:
            judge_overall = eval_row.get("judge_overall")
            if judge_overall is not None and judge_overall < _LOW_JUDGE_THRESHOLD:
                reasons.append(f"low_judge_score ({judge_overall})")
            hallucination = eval_row.get("judge_hallucination_risk")
            if hallucination is not None and hallucination > _HIGH_HALLUCINATION_THRESHOLD:
                reasons.append(f"high_hallucination_risk ({hallucination})")

        if reasons:
            reason_text = "; ".join(reasons)
            suggestion_id = _insert_suggestion(workspace_id, run_id, question, reason_text)
            created.append(suggestion_id)
            logger.info("Benchmark suggestion created for run %s: %s", run_id, reason_text)

    return created


def list_suggestions(workspace_id: str, status: str | None = "pending") -> list[dict]:
    query = (
        tenant_query("benchmark_suggestions", workspace_id)
        .order("created_at", desc=True)
        .limit(50)
    )
    if status:
        query = query.eq("status", status)
    return query.execute().data or []


def approve_suggestion(
    workspace_id: str,
    suggestion_id: str,
    dataset_id: str,
    reference_answer: str | None = None,
    document_ids: list[str] | None = None,
) -> str:
    """Approve a suggestion — creates a benchmark case and marks suggestion approved.

    Returns the new benchmark_cases row ID.
    """
    suggestion_result = (
        tenant_query("benchmark_suggestions", workspace_id)
        .eq("id", suggestion_id)
        .limit(1)
        .execute()
    )
    row = (suggestion_result.data or [None])[0]
    if not row or row.get("status") != "pending":
        raise ValueError(f"Suggestion {suggestion_id} not found or not pending")

    case_id = str(uuid4())
    now = _now_iso()
    client = get_client()

    client.table("benchmark_cases").insert({
        "id": case_id,
        "workspace_id": workspace_id,
        "dataset_id": dataset_id,
        "question": row["question"],
        "reference_answer": reference_answer,
        "document_ids": document_ids or [],
        "created_at": now,
    }).execute()

    client.table("benchmark_suggestions").update({
        "status": "approved",
        "approved_case_id": case_id,
    }).eq("id", suggestion_id).eq("workspace_id", workspace_id).execute()

    return case_id


def dismiss_suggestion(workspace_id: str, suggestion_id: str) -> None:
    get_client().table("benchmark_suggestions").update({
        "status": "dismissed",
    }).eq("id", suggestion_id).eq("workspace_id", workspace_id).execute()
