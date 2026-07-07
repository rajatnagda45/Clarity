"""
Pipeline performance profiling endpoint.

Returns a before/after analysis of the ingestion → embedding → indexing pipeline
for a given document. Uses real stage_timings from stored pipeline events when
available, falling back to a typical-document model otherwise.

Requires developer access — not exposed to end users.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import require_developer, require_workspace_role
from db.client import get_client
from services.performance.profiler import build_profile, profile_to_dict


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/performance", tags=["performance"])


def _latest_stage_timings(document_id: str, workspace_id: str) -> tuple[dict[str, int], int]:
    """
    Fetch the most recent merged stage_timings and chunk count for a document
    by scanning pipeline_events stored during ingestion/embedding/indexing.
    Returns (merged_timings, chunk_count).
    """
    merged: dict[str, int] = {}
    chunk_count = 0

    try:
        events_result = (
            get_client()
            .table("pipeline_events")
            .select("payload")
            .eq("document_id", document_id)
            .eq("workspace_id", workspace_id)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        for row in events_result.data or []:
            payload: dict[str, Any] = row.get("payload") or {}
            timings: dict[str, Any] = payload.get("stage_timings") or {}
            for k, v in timings.items():
                if isinstance(v, int | float) and v > 0:
                    # Keep the largest value seen for each stage (most complete run).
                    merged[k] = max(merged.get(k, 0), int(v))
    except Exception:
        pass  # best-effort; fall back to estimated model

    try:
        chunks_result = (
            get_client()
            .table("chunks")
            .select("chunk_id", count="exact")
            .eq("document_id", document_id)
            .eq("workspace_id", workspace_id)
            .limit(1)
            .execute()
        )
        chunk_count = chunks_result.count or 0
    except Exception:
        pass

    return merged, chunk_count


@router.get("/pipeline-profile/{document_id}")
async def get_pipeline_profile(
    document_id: str,
    ctx: tuple = Depends(require_workspace_role),
    _: str = Depends(require_developer),
) -> dict[str, Any]:
    """
    Return a before/after pipeline performance profile for a document.

    Reads real stage_timings from pipeline_events when available; falls back to
    a model-based estimate for a 50-chunk document when no events exist.
    """
    workspace_id: str = ctx[0]

    doc_result = (
        get_client()
        .table("documents")
        .select("id, filename, status, source_type")
        .eq("id", document_id)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    doc = (doc_result.data or [None])[0]
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    stage_timings, chunk_count = _latest_stage_timings(document_id, workspace_id)
    profile = build_profile(document_id, stage_timings, chunk_count or None)
    result = profile_to_dict(profile)
    result["document"] = {
        "filename": doc.get("filename"),
        "status": doc.get("status"),
        "sourceType": doc.get("source_type"),
    }
    return result


@router.get("/pipeline-config")
async def get_pipeline_config(
    _ctx: tuple = Depends(require_workspace_role),
    __: str = Depends(require_developer),
) -> dict[str, Any]:
    """
    Return the current pipeline configuration so developers can see active batch
    sizes, timeouts, and concurrency settings without reading the source code.
    """
    from config import settings

    return {
        "embedding": {
            "provider": settings.embedding_provider,
            "model": settings.embed_model,
            "batchSize": settings.embedding_batch_size,
            "maxRetries": settings.embedding_max_retries,
            "timeoutSeconds": settings.embedding_timeout_seconds,
            "leaseSeconds": settings.embedding_lease_seconds,
        },
        "indexing": {
            "provider": settings.index_provider,
            "indexName": settings.pinecone_index,
            "batchSize": settings.index_batch_size,
            "maxRetries": settings.index_max_retries,
            "timeoutSeconds": settings.index_timeout_seconds,
            "leaseSeconds": settings.index_lease_seconds,
        },
        "ingestion": {
            "leaseSeconds": settings.ingestion_lease_seconds,
            "chunkTargetTokens": settings.chunk_target_tokens,
            "chunkMaxTokens": settings.chunk_max_tokens,
            "chunkOverlapTokens": settings.chunk_overlap_tokens,
            "parserVersion": settings.parser_version,
            "chunkVersion": settings.chunk_version,
        },
        "worker": {
            "maxJobs": 20,
            "maxTries": settings.arq_max_tries,
            "jobTimeoutSeconds": settings.arq_job_timeout,
        },
        "optimizationsActive": [
            "async_openai_client",
            "pipelined_embed_persist",
            "pipelined_upsert_persist",
            "parallel_chunk_clause_persist",
            "parallel_index_record_load",
            "jitter_backoff",
            "larger_embed_batch",
            "larger_index_batch",
            "higher_worker_concurrency",
        ],
    }
