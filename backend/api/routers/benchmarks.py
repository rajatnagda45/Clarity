from __future__ import annotations

import io
import csv
import json

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Response, UploadFile, status

from api.deps import require_workspace_role
from db.client import tenant_query
from schemas import (
    BenchmarkCaseResponse,
    BenchmarkDatasetDetailResponse,
    BenchmarkDatasetResponse,
    BenchmarkImportResponse,
    BenchmarkRunDetailResponse,
    BenchmarkRunResponse,
    CreateBenchmarkCaseRequest,
    CreateBenchmarkDatasetRequest,
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


@router.get("/datasets/{dataset_id}", response_model=BenchmarkDatasetDetailResponse)
def get_dataset(
    dataset_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> BenchmarkDatasetDetailResponse:
    workspace_id, _ = membership
    result = (
        tenant_query("benchmark_datasets", workspace_id)
        .eq("id", dataset_id)
        .limit(1)
        .execute()
    )
    row = (result.data or [None])[0]
    if not row:
        raise _error(status.HTTP_404_NOT_FOUND, "dataset_not_found", "Dataset not found.")

    case_count = len(
        (tenant_query("benchmark_cases", workspace_id).eq("dataset_id", dataset_id).execute()).data or []
    )
    run_count = len(
        (tenant_query("benchmark_runs", workspace_id).eq("dataset_id", dataset_id).execute()).data or []
    )
    return BenchmarkDatasetDetailResponse(
        id=row["id"],
        workspace_id=workspace_id,
        name=row["name"],
        dataset_type=row["dataset_type"],
        description=row.get("description"),
        case_count=case_count,
        run_count=run_count,
        created_at=row["created_at"],
    )


@router.delete("/datasets/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dataset(
    dataset_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> Response:
    from db.client import get_client
    workspace_id, _ = membership
    result = (
        tenant_query("benchmark_datasets", workspace_id)
        .eq("id", dataset_id)
        .limit(1)
        .execute()
    )
    if not (result.data or []):
        raise _error(status.HTTP_404_NOT_FOUND, "dataset_not_found", "Dataset not found.")
    get_client().table("benchmark_cases").delete().eq("dataset_id", dataset_id).execute()
    get_client().table("benchmark_datasets").delete().eq("id", dataset_id).eq("workspace_id", workspace_id).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/datasets/{dataset_id}/import", response_model=BenchmarkImportResponse, status_code=status.HTTP_201_CREATED)
def import_cases(
    dataset_id: str,
    file: UploadFile = File(...),
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> BenchmarkImportResponse:
    """Import benchmark cases from JSONL or CSV. Each row needs 'question'; 'reference_answer' is optional."""
    from uuid import uuid4
    from datetime import UTC, datetime
    from db.client import get_client

    workspace_id, _ = membership

    ds_check = (
        tenant_query("benchmark_datasets", workspace_id).eq("id", dataset_id).limit(1).execute()
    )
    if not (ds_check.data or []):
        raise _error(status.HTTP_404_NOT_FOUND, "dataset_not_found", "Dataset not found.")

    raw = file.file.read()
    content_type = file.content_type or ""
    filename = file.filename or ""

    records: list[dict] = []
    errors: list[str] = []

    if filename.endswith(".jsonl") or "jsonl" in content_type:
        for i, line in enumerate(raw.decode("utf-8", errors="replace").splitlines()):
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as e:
                errors.append(f"Line {i + 1}: {e}")
    elif filename.endswith(".csv") or "csv" in content_type or "text/plain" in content_type:
        reader = csv.DictReader(io.StringIO(raw.decode("utf-8", errors="replace")))
        for i, row in enumerate(reader):
            records.append(dict(row))
    else:
        try:
            records = json.loads(raw.decode("utf-8", errors="replace"))
        except json.JSONDecodeError:
            raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid_format", "File must be JSONL, CSV, or JSON array.")

    imported = 0
    now = datetime.now(UTC).isoformat()
    for rec in records:
        q = rec.get("question") or rec.get("Question") or rec.get("query") or ""
        if not q.strip():
            errors.append(f"Skipped record with empty question: {str(rec)[:60]}")
            continue
        ref = rec.get("reference_answer") or rec.get("answer") or rec.get("Reference Answer") or None
        try:
            get_client().table("benchmark_cases").insert({
                "id": str(uuid4()),
                "workspace_id": workspace_id,
                "dataset_id": dataset_id,
                "question": q.strip(),
                "reference_answer": ref.strip() if ref else None,
                "document_ids": [],
                "expected_citations": [],
                "created_at": now,
            }).execute()
            imported += 1
        except Exception as e:
            errors.append(f"Insert failed for question '{q[:40]}': {e}")

    return BenchmarkImportResponse(imported=imported, skipped=len(records) - imported, errors=errors[:20])


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
async def trigger_run(
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

    from job_queue.client import enqueue_or_background

    async def _run_fallback() -> None:
        await run_benchmark(workspace_id, dataset_id)

    await enqueue_or_background(
        "run_benchmark_job",
        _run_fallback,
        workspace_id,
        dataset_id,
        background_tasks=background_tasks,
    )

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


@router.get("/datasets/{dataset_id}/runs", response_model=list[BenchmarkRunResponse])
def list_dataset_runs(
    dataset_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> list[BenchmarkRunResponse]:
    workspace_id, _ = membership
    result = (
        tenant_query("benchmark_runs", workspace_id)
        .eq("dataset_id", dataset_id)
        .order("created_at", desc=True)
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


@router.get("/runs/{run_id}", response_model=BenchmarkRunDetailResponse)
def get_run(
    run_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> BenchmarkRunDetailResponse:
    workspace_id, _ = membership
    result = (
        tenant_query("benchmark_runs", workspace_id)
        .eq("id", run_id)
        .limit(1)
        .execute()
    )
    row = (result.data or [None])[0]
    if not row:
        raise _error(status.HTTP_404_NOT_FOUND, "run_not_found", "Benchmark run not found.")
    return BenchmarkRunDetailResponse(
        id=row["id"],
        workspace_id=workspace_id,
        dataset_id=row["dataset_id"],
        prompt_version=row.get("prompt_version"),
        model_version=row.get("model_version"),
        writer_version=row.get("writer_version"),
        status=row["status"],
        total_cases=row.get("total_cases", 0),
        completed_cases=row.get("completed_cases", 0),
        failed_cases=row.get("failed_cases", 0),
        avg_judge_overall=row.get("avg_judge_overall"),
        avg_trust_confidence=row.get("avg_trust_confidence"),
        avg_latency_ms=row.get("avg_latency_ms"),
        total_cost_usd=row.get("total_cost_usd"),
        started_at=row.get("started_at"),
        completed_at=row.get("completed_at"),
        created_at=row["created_at"],
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
