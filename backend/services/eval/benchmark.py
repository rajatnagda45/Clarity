from __future__ import annotations

import logging
import time
from datetime import UTC, datetime
from uuid import uuid4

from db.client import get_client, tenant_query
from services.eval.engine import run_eval_for_answer
from services.answer_generation.service import build_answer_stream
from config import settings

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _load_dataset(workspace_id: str, dataset_id: str) -> dict | None:
    result = (
        tenant_query("benchmark_datasets", workspace_id)
        .eq("id", dataset_id)
        .limit(1)
        .execute()
    )
    return (result.data or [None])[0]


def _load_cases(workspace_id: str, dataset_id: str) -> list[dict]:
    result = (
        tenant_query("benchmark_cases", workspace_id)
        .eq("dataset_id", dataset_id)
        .order("created_at")
        .execute()
    )
    return result.data or []


def _create_run(workspace_id: str, dataset_id: str, total_cases: int) -> str:
    client = get_client()
    run_id = str(uuid4())
    client.table("benchmark_runs").insert({
        "id": run_id,
        "workspace_id": workspace_id,
        "dataset_id": dataset_id,
        "prompt_version": settings.judge_prompt_version,
        "model_version": settings.llm_model,
        "writer_version": settings.writer_version,
        "verification_runtime_version": "b1.runtime.v1",
        "status": "running",
        "total_cases": total_cases,
        "completed_cases": 0,
        "failed_cases": 0,
        "started_at": _now_iso(),
        "created_at": _now_iso(),
    }).execute()
    return run_id


def _insert_case_result(
    workspace_id: str,
    run_id: str,
    case_id: str,
    answer_run_id: str | None,
    eval_id: str | None,
    judge_overall: int | None,
    trust_confidence: float | None,
    latency_ms: int,
    abstained: bool,
    error: str | None,
) -> None:
    client = get_client()
    client.table("benchmark_run_results").insert({
        "id": str(uuid4()),
        "workspace_id": workspace_id,
        "run_id": run_id,
        "case_id": case_id,
        "answer_run_id": answer_run_id,
        "eval_id": eval_id,
        "judge_overall": judge_overall,
        "trust_confidence": trust_confidence,
        "latency_ms": latency_ms,
        "abstained": abstained,
        "error": error,
        "created_at": _now_iso(),
    }).execute()


def _finalise_run(
    run_id: str,
    completed: int,
    failed: int,
    results: list[dict],
    status: str = "completed",
    error_detail: str | None = None,
) -> None:
    client = get_client()
    overalls = [r["judge_overall"] for r in results if r.get("judge_overall") is not None]
    latencies = [r["latency_ms"] for r in results if r.get("latency_ms") is not None]

    avg_overall: float | None = round(sum(overalls) / len(overalls), 2) if overalls else None
    avg_latency: int | None = int(sum(latencies) / len(latencies)) if latencies else None

    client.table("benchmark_runs").update({
        "status": status,
        "completed_cases": completed,
        "failed_cases": failed,
        "avg_judge_overall": avg_overall,
        "avg_latency_ms": avg_latency,
        "completed_at": _now_iso(),
        "error_detail": error_detail,
    }).eq("id", run_id).execute()


async def _run_single_case(workspace_id: str, run_id: str, case: dict) -> dict:
    case_id = case["id"]
    question = case["question"]
    document_ids: list[str] = case.get("document_ids") or []
    t0 = time.monotonic()

    answer_run_id: str | None = None
    eval_id: str | None = None
    judge_overall: int | None = None
    trust_confidence: float | None = None
    abstained = False
    error: str | None = None

    try:
        prepared = await build_answer_stream(
            workspace_id=workspace_id,
            query=question,
            conversation_id=None,
            document_ids=document_ids,
            request_id=str(uuid4()),
        )
        answer_run_id = prepared.answer_run_id

        # Check if the answer abstained
        for event in prepared.events:
            if event.get("type") == "abstain":
                abstained = True
                break

        if not abstained:
            eval_id = await run_eval_for_answer(answer_run_id, workspace_id)

        if eval_id:
            result = (
                get_client()
                .table("answer_evals")
                .select("judge_overall,overall")
                .eq("id", eval_id)
                .limit(1)
                .execute()
            )
            row = (result.data or [None])[0]
            if row:
                judge_overall = row.get("judge_overall")
                trust_confidence = row.get("overall")

    except Exception as exc:
        error = str(exc)
        logger.error("Benchmark case %s failed: %s", case_id, exc)

    latency_ms = int((time.monotonic() - t0) * 1000)
    result_dict = {
        "case_id": case_id,
        "answer_run_id": answer_run_id,
        "eval_id": eval_id,
        "judge_overall": judge_overall,
        "trust_confidence": trust_confidence,
        "latency_ms": latency_ms,
        "abstained": abstained,
        "error": error,
    }

    _insert_case_result(
        workspace_id=workspace_id,
        run_id=run_id,
        case_id=case_id,
        answer_run_id=answer_run_id,
        eval_id=eval_id,
        judge_overall=judge_overall,
        trust_confidence=trust_confidence,
        latency_ms=latency_ms,
        abstained=abstained,
        error=error,
    )
    return result_dict


async def run_benchmark(workspace_id: str, dataset_id: str) -> str:
    """Execute all cases in a dataset sequentially. Returns benchmark_run ID."""
    dataset = _load_dataset(workspace_id, dataset_id)
    if not dataset:
        raise ValueError(f"Dataset {dataset_id} not found for workspace {workspace_id}")

    cases = _load_cases(workspace_id, dataset_id)
    run_id = _create_run(workspace_id, dataset_id, total_cases=len(cases))

    if not cases:
        _finalise_run(run_id, completed=0, failed=0, results=[])
        return run_id

    results: list[dict] = []
    completed = 0
    failed = 0

    for case in cases:
        result = await _run_single_case(workspace_id, run_id, case)
        results.append(result)
        if result["error"]:
            failed += 1
        else:
            completed += 1

        # Update progress after each case
        get_client().table("benchmark_runs").update({
            "completed_cases": completed,
            "failed_cases": failed,
        }).eq("id", run_id).execute()

    _finalise_run(run_id, completed=completed, failed=failed, results=results)
    return run_id
