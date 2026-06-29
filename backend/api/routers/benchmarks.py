from __future__ import annotations

import asyncio

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from api.deps import require_workspace_role
from db.client import tenant_query
from schemas import (
    BenchmarkDatasetResponse,
    BenchmarkRunResponse,
    CreateBenchmarkDatasetRequest,
    CreateBenchmarkCaseRequest,
    BenchmarkCaseResponse,
)
from services.eval.benchmark import run_benchmark

router = APIRouter(prefix="/api/benchmarks", tags=["benchmarks"])


def _error(code_: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=code_, detail={"code": code, "message": message})


# ─── Datasets ─────────────────────────────────────────────────────────────────

@router.get("/datasets", response_model=list[BenchmarkDatasetResponse])
def list_datasets(
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> list[BenchmarkDatasetResponse]:
    workspace_id, _ = membership
    result = (
        tenant_query("benchmark_datasets", workspace_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [
        BenchmarkDatasetResponse(
            id=r["id"],
            workspace_id=r["workspace_id"],
            name=r["name"],
            dataset_type=r["dataset_type"],
            description=r.get("description"),
            created_at=r["created_at"],
        )
        for r in (result.data or [])
    ]


@router.post("/datasets", response_model=BenchmarkDatasetResponse, status_code=status.HTTP_201_CREATED)
def create_dataset(
    payload: CreateBenchmarkDatasetRequest,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> BenchmarkDatasetResponse:
    from uuid import uuid4
    from datetime import UTC, datetime

    workspace_id, _ = membership
    from db.client import get_client

    dataset_id = str(uuid4())
    now = datetime.now(UTC).isoformat()
    get_client().table("benchmark_datasets").insert({
        "id": dataset_id,
        "workspace_id": workspace_id,
        "name": payload.name,
        "dataset_type": payload.dataset_type,
        "description": payload.description,
        "created_at": now,
    }).execute()

    return BenchmarkDatasetResponse(
        id=dataset_id,
        workspace_id=workspace_id,
        name=payload.name,
        dataset_type=payload.dataset_type,
        description=payload.description,
        created_at=now,
    )


# ─── Cases ────────────────────────────────────────────────────────────────────

@router.get("/datasets/{dataset_id}/cases", response_model=list[BenchmarkCaseResponse])
def list_cases(
    dataset_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> list[BenchmarkCaseResponse]:
    workspace_id, _ = membership
    result = (
        tenant_query("benchmark_cases", workspace_id)
        .eq("dataset_id", dataset_id)
        .order("created_at")
        .execute()
    )
    return [
        BenchmarkCaseResponse(
            id=r["id"],
            workspace_id=r["workspace_id"],
            dataset_id=r["dataset_id"],
            question=r["question"],
            reference_answer=r.get("reference_answer"),
            document_ids=r.get("document_ids") or [],
            created_at=r["created_at"],
        )
        for r in (result.data or [])
    ]


@router.post(
    "/datasets/{dataset_id}/cases",
    response_model=BenchmarkCaseResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_case(
    dataset_id: str,
    payload: CreateBenchmarkCaseRequest,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> BenchmarkCaseResponse:
    from uuid import uuid4
    from datetime import UTC, datetime
    from db.client import get_client

    workspace_id, _ = membership
    case_id = str(uuid4())
    now = datetime.now(UTC).isoformat()
    get_client().table("benchmark_cases").insert({
        "id": case_id,
        "workspace_id": workspace_id,
        "dataset_id": dataset_id,
        "question": payload.question,
        "reference_answer": payload.reference_answer,
        "document_ids": payload.document_ids,
        "expected_citations": payload.expected_citations,
        "created_at": now,
    }).execute()

    return BenchmarkCaseResponse(
        id=case_id,
        workspace_id=workspace_id,
        dataset_id=dataset_id,
        question=payload.question,
        reference_answer=payload.reference_answer,
        document_ids=payload.document_ids,
        created_at=now,
    )


# ─── Runs ─────────────────────────────────────────────────────────────────────

@router.post("/datasets/{dataset_id}/runs", response_model=BenchmarkRunResponse, status_code=status.HTTP_202_ACCEPTED)
def trigger_run(
    dataset_id: str,
    background_tasks: BackgroundTasks,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> BenchmarkRunResponse:
    """Kick off a benchmark run asynchronously. Returns the run record immediately."""
    from uuid import uuid4
    from datetime import UTC, datetime
    from db.client import get_client, tenant_query

    workspace_id, _ = membership

    dataset_check = (
        tenant_query("benchmark_datasets", workspace_id)
        .eq("id", dataset_id)
        .limit(1)
        .execute()
    )
    if not dataset_check.data:
        raise _error(status.HTTP_404_NOT_FOUND, "dataset_not_found", "Dataset not found.")

    run_id = str(uuid4())
    now = datetime.now(UTC).isoformat()
    from config import settings
    get_client().table("benchmark_runs").insert({
        "id": run_id,
        "workspace_id": workspace_id,
        "dataset_id": dataset_id,
        "prompt_version": settings.judge_prompt_version,
        "model_version": settings.llm_model,
        "writer_version": settings.writer_version,
        "verification_runtime_version": "b1.runtime.v1",
        "status": "running",
        "total_cases": 0,
        "completed_cases": 0,
        "failed_cases": 0,
        "started_at": now,
        "created_at": now,
    }).execute()

    def _run() -> None:
        asyncio.run(run_benchmark(workspace_id, dataset_id))

    background_tasks.add_task(_run)

    return BenchmarkRunResponse(
        id=run_id,
        workspace_id=workspace_id,
        dataset_id=dataset_id,
        status="running",
        total_cases=0,
        completed_cases=0,
        failed_cases=0,
        avg_judge_overall=None,
        avg_trust_confidence=None,
        avg_latency_ms=None,
        created_at=now,
    )


@router.get("/runs", response_model=list[BenchmarkRunResponse])
def list_runs(
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> list[BenchmarkRunResponse]:
    workspace_id, _ = membership
    result = (
        tenant_query("benchmark_runs", workspace_id)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    return [
        BenchmarkRunResponse(
            id=r["id"],
            workspace_id=r["workspace_id"],
            dataset_id=r["dataset_id"],
            status=r["status"],
            total_cases=r.get("total_cases", 0),
            completed_cases=r.get("completed_cases", 0),
            failed_cases=r.get("failed_cases", 0),
            avg_judge_overall=r.get("avg_judge_overall"),
            avg_trust_confidence=r.get("avg_trust_confidence"),
            avg_latency_ms=r.get("avg_latency_ms"),
            created_at=r["created_at"],
        )
        for r in (result.data or [])
    ]
