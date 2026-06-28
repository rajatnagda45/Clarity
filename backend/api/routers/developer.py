from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import require_workspace_role
from config import settings
from db.client import tenant_query
from schemas import (
    DeveloperDashboardDocument,
    DeveloperDashboardResponse,
    EmbeddingMetricsResponse,
    IndexMetricsResponse,
    RetrievalExplorerResponse,
    RetrievalMetricsResponse,
    RetrievalSearchRequest,
)
from services.embeddings.metrics import build_embedding_metrics
from services.indexing.metrics import build_index_metrics
from services.retrieval.metrics import build_retrieval_metrics
from services.retrieval.models import RetrievalRequest
from services.retrieval.service import retrieve_evidence


router = APIRouter(prefix="/api/developer", tags=["developer"])


def _error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


@router.get("/metrics/embeddings", response_model=EmbeddingMetricsResponse)
async def get_embedding_metrics(
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> EmbeddingMetricsResponse:
    if settings.environment == "production":
        raise _error(status.HTTP_404_NOT_FOUND, "not_found", "Developer metrics unavailable.")

    workspace_id, _ = membership
    documents = (
        tenant_query("documents", workspace_id)
        .execute()
    )
    embedding_rows = (
        tenant_query("chunk_embeddings", workspace_id)
        .execute()
    )
    return EmbeddingMetricsResponse(
        **build_embedding_metrics(documents.data or [], embedding_rows.data or [])
    )


@router.get("/metrics/indexing", response_model=IndexMetricsResponse)
async def get_index_metrics(
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> IndexMetricsResponse:
    if settings.environment == "production":
        raise _error(status.HTTP_404_NOT_FOUND, "not_found", "Developer metrics unavailable.")

    workspace_id, _ = membership
    documents = tenant_query("documents", workspace_id).execute()
    index_rows = tenant_query("chunk_vector_index_records", workspace_id).execute()
    return IndexMetricsResponse(
        **build_index_metrics(documents.data or [], index_rows.data or [])
    )


@router.get("/metrics/retrieval", response_model=RetrievalMetricsResponse)
async def get_retrieval_metrics(
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> RetrievalMetricsResponse:
    if settings.environment == "production":
        raise _error(status.HTTP_404_NOT_FOUND, "not_found", "Developer metrics unavailable.")

    workspace_id, _ = membership
    event_rows = tenant_query("retrieval_events", workspace_id).execute()
    return RetrievalMetricsResponse(
        **build_retrieval_metrics(event_rows.data or [])
    )


@router.post("/retrieval/explore", response_model=RetrievalExplorerResponse)
async def explore_retrieval(
    payload: RetrievalSearchRequest,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> RetrievalExplorerResponse:
    if settings.environment == "production":
        raise _error(status.HTTP_404_NOT_FOUND, "not_found", "Developer retrieval explorer unavailable.")

    workspace_id, _ = membership
    if payload.filters and payload.filters.page_start and payload.filters.page_end:
        if payload.filters.page_start > payload.filters.page_end:
            raise _error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "invalid_page_range",
                "pageStart cannot be greater than pageEnd.",
            )

    request = RetrievalRequest.model_validate(payload.model_dump())
    _, explorer = await retrieve_evidence(request, workspace_id)
    return RetrievalExplorerResponse(**explorer.model_dump(mode="json", by_alias=True))


@router.get("/dashboard", response_model=DeveloperDashboardResponse)
async def get_developer_dashboard(
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> DeveloperDashboardResponse:
    if settings.environment == "production":
        raise _error(status.HTTP_404_NOT_FOUND, "not_found", "Developer dashboard unavailable.")

    workspace_id, _ = membership
    documents = (
        tenant_query("documents", workspace_id)
        .order("created_at", desc=True)
        .execute()
    )

    dashboard_documents = [
        DeveloperDashboardDocument(
            id=str(row["id"]),
            filename=row["filename"],
            status=row["status"],
            sourceType=row["source_type"],
            createdAt=row["created_at"],
            error=row.get("error"),
            embeddingQueuedAt=row.get("embedding_queued_at"),
            embeddingStartedAt=row.get("embedding_started_at"),
            embeddingCompletedAt=row.get("embedding_completed_at"),
            indexQueuedAt=row.get("index_queued_at"),
            indexStartedAt=row.get("index_started_at"),
            indexCompletedAt=row.get("index_completed_at"),
        )
        for row in documents.data or []
    ]
    status_counts: dict[str, int] = {}
    for row in documents.data or []:
        status_name = row["status"]
        status_counts[status_name] = status_counts.get(status_name, 0) + 1

    return DeveloperDashboardResponse(
        documents=dashboard_documents,
        statusCounts=status_counts,
        failedJobs=[document for document in dashboard_documents if document.status == "failed"],
    )
