from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import uuid4

from db.client import get_client, tenant_query
from services.eval.models import Experiment, ExperimentCandidate

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def create_experiment(
    workspace_id: str,
    name: str,
    description: str | None = None,
) -> str:
    client = get_client()
    exp_id = str(uuid4())
    client.table("experiments").insert({
        "id": exp_id,
        "workspace_id": workspace_id,
        "name": name,
        "description": description,
        "status": "active",
        "created_at": _now_iso(),
    }).execute()
    return exp_id


def add_candidate(
    workspace_id: str,
    experiment_id: str,
    name: str,
    prompt_version: str,
    model_version: str,
    writer_version: str,
) -> str:
    client = get_client()
    cand_id = str(uuid4())
    client.table("experiment_candidates").insert({
        "id": cand_id,
        "workspace_id": workspace_id,
        "experiment_id": experiment_id,
        "name": name,
        "prompt_version": prompt_version,
        "model_version": model_version,
        "writer_version": writer_version,
        "eval_count": 0,
        "created_at": _now_iso(),
    }).execute()
    return cand_id


def _update_candidate_metrics(workspace_id: str, candidate_id: str) -> None:
    """Recompute avg_judge_overall and avg_trust_confidence from all evals for this candidate."""
    # Evals are linked through answer_runs that carry the prompt/model/writer version
    # matching this candidate. We approximate by querying recent evals in this workspace.
    # A production implementation would tag each answer_run with the experiment_candidate_id.
    client = get_client()
    result = (
        tenant_query("answer_evals", workspace_id)
        .not_.is_("judge_overall", "null")
        .order("created_at", desc=True)
        .limit(50)
        .select("judge_overall,overall")
        .execute()
    )
    rows = result.data or []
    if not rows:
        return

    overalls = [r["judge_overall"] for r in rows if r.get("judge_overall") is not None]
    trusts = [float(r["overall"]) for r in rows if r.get("overall") is not None]

    client.table("experiment_candidates").update({
        "avg_judge_overall": round(sum(overalls) / len(overalls), 2) if overalls else None,
        "avg_trust_confidence": round(sum(trusts) / len(trusts), 2) if trusts else None,
        "eval_count": len(overalls),
    }).eq("id", candidate_id).eq("workspace_id", workspace_id).execute()


def complete_experiment(workspace_id: str, experiment_id: str, winner_candidate_id: str) -> None:
    client = get_client()
    client.table("experiments").update({
        "status": "completed",
        "winner_candidate_id": winner_candidate_id,
    }).eq("id", experiment_id).eq("workspace_id", workspace_id).execute()


def get_experiment(workspace_id: str, experiment_id: str) -> Experiment | None:
    exp_result = (
        tenant_query("experiments", workspace_id)
        .eq("id", experiment_id)
        .limit(1)
        .execute()
    )
    row = (exp_result.data or [None])[0]
    if not row:
        return None

    cand_result = (
        tenant_query("experiment_candidates", workspace_id)
        .eq("experiment_id", experiment_id)
        .order("created_at")
        .execute()
    )
    candidates = [
        ExperimentCandidate(
            id=c["id"],
            workspace_id=c["workspace_id"],
            experiment_id=c["experiment_id"],
            name=c["name"],
            prompt_version=c["prompt_version"],
            model_version=c["model_version"],
            writer_version=c["writer_version"],
            avg_judge_overall=c.get("avg_judge_overall"),
            avg_trust_confidence=c.get("avg_trust_confidence"),
            eval_count=c.get("eval_count", 0),
            created_at=c["created_at"],
        )
        for c in (cand_result.data or [])
    ]

    return Experiment(
        id=row["id"],
        workspace_id=row["workspace_id"],
        name=row["name"],
        description=row.get("description"),
        status=row["status"],
        winner_candidate_id=row.get("winner_candidate_id"),
        candidates=candidates,
        created_at=row["created_at"],
    )


def list_experiments(workspace_id: str) -> list[Experiment]:
    result = (
        tenant_query("experiments", workspace_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return [
        Experiment(
            id=r["id"],
            workspace_id=r["workspace_id"],
            name=r["name"],
            description=r.get("description"),
            status=r["status"],
            winner_candidate_id=r.get("winner_candidate_id"),
            candidates=[],
            created_at=r["created_at"],
        )
        for r in (result.data or [])
    ]
