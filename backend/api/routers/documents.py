from __future__ import annotations

from datetime import UTC, datetime
from tempfile import SpooledTemporaryFile
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, UploadFile, status

from api.deps import require_developer, require_workspace_role
from api.errors import api_error
from config import settings
from db.client import tenant_query, get_client
from schemas import (
    ClauseSummary,
    DocumentChunkListResponse,
    DocumentChunkSummary,
    DocumentDetailResponse,
    DocumentEmbeddingListResponse,
    DocumentEmbeddingSummary,
    DocumentFileResponse,
    DocumentListResponse,
    DocumentSummary,
    DocumentVectorIndexListResponse,
    DocumentVectorIndexSummary,
)
from services.indexing.factory import get_index_provider
from services.embeddings.inspector import is_current_embedding_row
from services.embeddings.pipeline import run_document_embedding_task
from services.ingestion.pipeline import run_document_ingestion_task
from services.indexing.models import IndexingTarget
from services.indexing.inspector import build_index_namespace, is_current_index_row
from services.indexing.pipeline import queue_document_for_indexing, run_document_indexing_task
from services.ingestion.url import (
    UrlIngestionNotImplementedError,
    enqueue_url_ingestion,
    validate_url_ingestion_request,
)
from services.storage.r2 import (
    build_document_storage_key,
    build_signed_document_url,
    sanitize_filename,
    upload_document_file,
    delete_document_object,
)


router = APIRouter(prefix="/api/documents", tags=["documents"])

SUPPORTED_EXTENSIONS = {
    ".pdf": "pdf",
    ".docx": "docx",
}
SUPPORTED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
UPLOAD_CHUNK_BYTES = 1024 * 1024


def _error(status_code: int, code: str, message: str) -> HTTPException:
    return api_error(status_code, code, message)


def _document_summary_from_row(row: dict) -> DocumentSummary:
    return DocumentSummary(
        id=str(row["id"]),
        filename=row["filename"],
        status=row["status"],
        sourceType=row["source_type"],
        pageCount=row.get("page_count"),
        createdAt=row["created_at"],
        error=row.get("error"),
    )


def _clause_summary_from_row(row: dict) -> ClauseSummary:
    return ClauseSummary(
        id=str(row["id"]),
        workspaceId=str(row["workspace_id"]),
        documentId=str(row["document_id"]),
        clauseType=row["clause_type"],
        text=row["text"],
        page=row["page"],
        riskFlag=row["risk_flag"],
        rationale=row.get("rationale"),
        benchmarkMatchId=str(row["benchmark_match_id"]) if row.get("benchmark_match_id") else None,
        deviationNote=row.get("deviation_note"),
        riskScore=float(row["risk_score"]) if row.get("risk_score") is not None else None,
        createdAt=row["created_at"],
    )


def _document_embedding_target_matches(row: dict) -> bool:
    return (
        row.get("current_embedding_provider") == settings.embedding_provider
        and row.get("current_embedding_model") == settings.embed_model
        and row.get("current_embedding_dimension") == settings.embed_dim
        and row.get("current_embedding_version") == settings.embedding_version
        and row.get("current_embedding_parser_version") == settings.parser_version
        and row.get("current_embedding_chunk_version") == settings.chunk_version
    )


def _queue_embedding_refresh(document_id: str, workspace_id: str) -> None:
    (
        get_client()
        .table("documents")
        .update(
            {
                "status": "awaiting_embeddings",
                "error": None,
                "embedding_queued_at": datetime.now(UTC).isoformat(),
            }
        )
        .eq("id", document_id)
        .eq("workspace_id", workspace_id)
        .is_("embedding_run_id", "null")
        .execute()
    )


def _document_has_current_embedding_identity(row: dict) -> bool:
    return all(
        row.get(field)
        for field in (
            "current_embedding_provider",
            "current_embedding_model",
            "current_embedding_dimension",
            "current_embedding_version",
            "current_embedding_parser_version",
            "current_embedding_chunk_version",
        )
    )


def _document_index_target_matches(row: dict, workspace_id: str) -> bool:
    return (
        row.get("current_index_provider") == settings.index_provider
        and row.get("current_index_name") == settings.pinecone_index
        and row.get("current_index_namespace") == build_index_namespace(workspace_id)
    )


def _should_refresh_index(row: dict, workspace_id: str) -> bool:
    if not _document_has_current_embedding_identity(row):
        return False
    if not _document_embedding_target_matches(row):
        return False
    if row["status"] in {"embedded", "awaiting_index"}:
        return True
    if row["status"] == "failed":
        return True
    return row["status"] == "indexed" and not _document_index_target_matches(row, workspace_id)


def _schedule_index_refresh(
    background_tasks: BackgroundTasks | None,
    row: dict,
    workspace_id: str,
) -> None:
    if not background_tasks or not _should_refresh_index(row, workspace_id):
        return
    if queue_document_for_indexing(str(row["id"]), workspace_id):
        background_tasks.add_task(run_document_indexing_task, str(row["id"]), workspace_id)


def _should_refresh_embeddings(row: dict) -> bool:
    if row["status"] in {"embedded", "indexed"} and not _document_embedding_target_matches(row):
        return True
    return row["status"] in {"chunked", "awaiting_embeddings"}


def _schedule_embedding_refresh(
    background_tasks: BackgroundTasks | None,
    row: dict,
    workspace_id: str,
) -> None:
    if not background_tasks or not _should_refresh_embeddings(row):
        return
    _queue_embedding_refresh(str(row["id"]), workspace_id)
    background_tasks.add_task(run_document_embedding_task, str(row["id"]), workspace_id)


def require_editor_workspace(request: Request) -> tuple[str, str]:
    return require_workspace_role(request, "editor")


def _validate_upload_metadata(file: UploadFile) -> tuple[str, str]:
    safe_filename = sanitize_filename(file.filename or "")
    extension = Path(safe_filename).suffix.lower()
    source_type = SUPPORTED_EXTENSIONS.get(extension)
    if not source_type:
        raise _error(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "unsupported_file_type",
            "Only PDF and DOCX uploads are supported.",
        )

    content_type = (file.content_type or "").lower().strip()
    if content_type and content_type not in SUPPORTED_MIME_TYPES:
        raise _error(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "unsupported_mime_type",
            "The uploaded file MIME type is not supported.",
        )

    return safe_filename, source_type


async def _buffer_upload(file: UploadFile) -> SpooledTemporaryFile[bytes]:
    buffered = SpooledTemporaryFile(max_size=UPLOAD_CHUNK_BYTES, mode="w+b")
    total_bytes = 0

    while True:
        chunk = await file.read(UPLOAD_CHUNK_BYTES)
        if not chunk:
            break

        total_bytes += len(chunk)
        if total_bytes > settings.max_upload_bytes:
            buffered.close()
            raise _error(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                "file_too_large",
                f"File exceeds the maximum allowed size of {settings.max_upload_bytes} bytes.",
            )

        buffered.write(chunk)

    if total_bytes == 0:
        buffered.close()
        raise _error(status.HTTP_400_BAD_REQUEST, "empty_file", "Uploaded file is empty.")

    buffered.seek(0)
    return buffered


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    background_tasks: BackgroundTasks,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> DocumentListResponse:
    workspace_id, _ = membership
    rows = (
        tenant_query("documents", workspace_id)
        .order("created_at", desc=True)
        .execute()
    )
    for row in rows.data or []:
        _schedule_embedding_refresh(background_tasks, row, workspace_id)
        _schedule_index_refresh(background_tasks, row, workspace_id)
    documents = [_document_summary_from_row(row) for row in rows.data or []]
    return DocumentListResponse(documents=documents)


@router.get("/{document_id}/chunks", response_model=DocumentChunkListResponse)
async def inspect_document_chunks(
    document_id: str,
    _: str = Depends(require_developer),
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> DocumentChunkListResponse:
    workspace_id, _ = membership
    document = (
        tenant_query("documents", workspace_id)
        .eq("id", document_id)
        .limit(1)
        .execute()
    )
    if not document.data:
        raise _error(status.HTTP_404_NOT_FOUND, "document_not_found", "Document was not found.")

    chunk_rows = (
        tenant_query("chunks", workspace_id)
        .eq("document_id", document_id)
        .order("chunk_index")
        .execute()
    )
    chunks = [
        DocumentChunkSummary(
            chunkId=row["chunk_id"],
            chunkIndex=row["chunk_index"],
            sectionTitle=row.get("section_title"),
            clauseNumber=row.get("clause_number"),
            pageStart=row["page_start"],
            pageEnd=row["page_end"],
            sourceOffsets=[
                {
                    "page": offset["page"],
                    "blockOrder": offset["block_order"],
                    "charStart": offset["char_start"],
                    "charEnd": offset["char_end"],
                }
                for offset in row.get("source_offsets") or []
            ],
            tokenCount=row["token_count"],
            checksum=row["checksum"],
            parserVersion=row["parser_version"],
            chunkVersion=row["chunk_version"],
            chunkKind=row["chunk_kind"],
            fragmentIndex=row.get("fragment_index", 0),
            fragmentCount=row.get("fragment_count", 1),
            crossReferences=row.get("cross_references") or [],
            text=row["text"],
        )
        for row in chunk_rows.data or []
    ]
    return DocumentChunkListResponse(documentId=document_id, chunks=chunks)


@router.get("/{document_id}/embeddings", response_model=DocumentEmbeddingListResponse)
async def inspect_document_embeddings(
    document_id: str,
    _: str = Depends(require_developer),
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> DocumentEmbeddingListResponse:
    workspace_id, _ = membership
    document_result = (
        tenant_query("documents", workspace_id)
        .eq("id", document_id)
        .limit(1)
        .execute()
    )
    document = (document_result.data or [None])[0]
    if not document:
        raise _error(status.HTTP_404_NOT_FOUND, "document_not_found", "Document was not found.")

    embedding_rows = (
        tenant_query("chunk_embeddings", workspace_id)
        .eq("document_id", document_id)
        .order("chunk_index")
        .execute()
    )
    embeddings = [
        DocumentEmbeddingSummary(
            chunkId=row["chunk_id"],
            chunkIndex=row["chunk_index"],
            status="current" if is_current_embedding_row(document, row) else "stale",
            embeddingProvider=row["embedding_provider"],
            embeddingModel=row["embedding_model"],
            embeddingDimension=row["embedding_dimension"],
            embeddingVersion=row["embedding_version"],
            parserVersion=row["parser_version"],
            chunkVersion=row["chunk_version"],
            checksum=row["checksum"],
            tokenCount=row["token_count"],
            latencyMs=row.get("latency_ms"),
            retryCount=row.get("retry_count", 0),
            estimatedCostUsd=float(row.get("estimated_cost_usd", 0) or 0),
            vectorPreview=[float(value) for value in row.get("vector_preview") or []],
            createdAt=row["created_at"],
        )
        for row in embedding_rows.data or []
    ]

    return DocumentEmbeddingListResponse(
        documentId=document_id,
        currentEmbeddingProvider=document.get("current_embedding_provider"),
        currentEmbeddingModel=document.get("current_embedding_model"),
        currentEmbeddingDimension=document.get("current_embedding_dimension"),
        currentEmbeddingVersion=document.get("current_embedding_version"),
        currentEmbeddingParserVersion=document.get("current_embedding_parser_version"),
        currentEmbeddingChunkVersion=document.get("current_embedding_chunk_version"),
        embeddings=embeddings,
    )


@router.get("/{document_id}/vectors", response_model=DocumentVectorIndexListResponse)
async def inspect_document_vectors(
    document_id: str,
    _: str = Depends(require_developer),
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> DocumentVectorIndexListResponse:
    workspace_id, _ = membership
    document_result = (
        tenant_query("documents", workspace_id)
        .eq("id", document_id)
        .limit(1)
        .execute()
    )
    document = (document_result.data or [None])[0]
    if not document:
        raise _error(status.HTTP_404_NOT_FOUND, "document_not_found", "Document was not found.")

    index_rows = (
        tenant_query("chunk_vector_index_records", workspace_id)
        .eq("document_id", document_id)
        .order("chunk_index")
        .execute()
    )
    chunk_rows = (
        tenant_query("chunks", workspace_id)
        .eq("document_id", document_id)
        .order("chunk_index")
        .execute()
    )
    chunk_text_by_id = {row["chunk_id"]: row.get("text", "") for row in chunk_rows.data or []}

    vectors = [
        DocumentVectorIndexSummary(
            chunkId=row["chunk_id"],
            chunkIndex=row["chunk_index"],
            chunkText=chunk_text_by_id.get(row["chunk_id"], ""),
            vectorId=row["vector_id"],
            namespace=row["namespace"],
            status="current" if is_current_index_row(document, row) else "stale",
            indexProvider=row["index_provider"],
            indexName=row["index_name"],
            embeddingProvider=row["embedding_provider"],
            embeddingModel=row["embedding_model"],
            embeddingDimension=row["embedding_dimension"],
            embeddingVersion=row["embedding_version"],
            parserVersion=row["parser_version"],
            chunkVersion=row["chunk_version"],
            checksum=row["checksum"],
            sectionTitle=row.get("section_title"),
            clauseNumber=row.get("clause_number"),
            pageStart=row["page_start"],
            pageEnd=row["page_end"],
            retryCount=row.get("retry_count", 0),
            latencyMs=row.get("latency_ms"),
            indexedAt=row.get("indexed_at"),
        )
        for row in index_rows.data or []
    ]

    return DocumentVectorIndexListResponse(
        documentId=document_id,
        currentIndexProvider=document.get("current_index_provider"),
        currentIndexName=document.get("current_index_name"),
        currentIndexNamespace=document.get("current_index_namespace"),
        vectors=vectors,
    )


@router.get("/{document_id}", response_model=DocumentDetailResponse)
async def get_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> DocumentDetailResponse:
    workspace_id, _ = membership
    result = (
        tenant_query("documents", workspace_id)
        .eq("id", document_id)
        .limit(1)
        .execute()
    )
    row = (result.data or [None])[0]
    if not row:
        raise _error(status.HTTP_404_NOT_FOUND, "document_not_found", "Document was not found.")

    _schedule_embedding_refresh(background_tasks, row, workspace_id)
    _schedule_index_refresh(background_tasks, row, workspace_id)
    clauses_result = (
        tenant_query("clauses", workspace_id)
        .eq("document_id", document_id)
        .order("page")
        .execute()
    )

    return DocumentDetailResponse(
        **_document_summary_from_row(row).model_dump(),
        clauses=[_clause_summary_from_row(clause_row) for clause_row in clauses_result.data or []],
    )


@router.get("/{document_id}/file", response_model=DocumentFileResponse)
async def get_document_file(
    document_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> DocumentFileResponse:
    workspace_id, _ = membership
    result = (
        tenant_query("documents", workspace_id)
        .eq("id", document_id)
        .limit(1)
        .execute()
    )
    row = (result.data or [None])[0]
    if not row:
        raise _error(status.HTTP_404_NOT_FOUND, "document_not_found", "Document was not found.")
    return DocumentFileResponse(
        documentId=document_id,
        filename=row["filename"],
        signedUrl=build_signed_document_url(row["r2_key"]),
        expiresInSeconds=settings.signed_document_url_ttl_seconds,
    )


@router.post("", response_model=DocumentSummary, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile | None = File(default=None),
    membership: tuple[str, str] = Depends(require_editor_workspace),
) -> DocumentSummary:
    workspace_id, _ = membership
    request_content_type = (request.headers.get("content-type") or "").split(";")[0].strip().lower()

    if request_content_type == "application/json":
        try:
            payload = await request.json()
            url_request = validate_url_ingestion_request(payload)
            enqueue_url_ingestion(url_request)
        except UrlIngestionNotImplementedError as exc:
            raise _error(
                status.HTTP_501_NOT_IMPLEMENTED,
                "url_ingestion_not_implemented",
                str(exc),
            ) from exc
        except Exception as exc:
            raise _error(
                status.HTTP_400_BAD_REQUEST,
                "invalid_url_ingestion_request",
                "A valid URL ingestion payload is required.",
            ) from exc
        raise _error(
            status.HTTP_501_NOT_IMPLEMENTED,
            "url_ingestion_not_implemented",
            "URL ingestion architecture is defined, but implementation starts in a later milestone.",
        )

    if file is None:
        raise _error(status.HTTP_400_BAD_REQUEST, "missing_file", "A file upload is required.")

    safe_filename, source_type = _validate_upload_metadata(file)
    buffered_upload = await _buffer_upload(file)

    document_id = str(uuid4())
    storage_key = build_document_storage_key(workspace_id, document_id, safe_filename)

    try:
        upload_document_file(storage_key, buffered_upload, file.content_type)
    except Exception as exc:  # pragma: no cover - exercised via tests with mocks
        buffered_upload.close()
        raise _error(
            status.HTTP_502_BAD_GATEWAY,
            "storage_upload_failed",
            "Failed to store the uploaded document securely.",
        ) from exc

    row = {
        "id": document_id,
        "workspace_id": workspace_id,
        "filename": safe_filename,
        "source_type": source_type,
        "r2_key": storage_key,
        "page_count": None,
        "status": "uploaded",
        "error": None,
    }

    try:
        result = get_client().table("documents").insert(row).execute()
    except Exception as exc:
        buffered_upload.close()
        try:
            delete_document_object(storage_key)
        except Exception:
            pass
        raise _error(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "document_metadata_persist_failed",
            "Document was uploaded but metadata persistence failed.",
        ) from exc
    finally:
        buffered_upload.close()

    created_row = (result.data or [row])[0]
    background_tasks.add_task(run_document_ingestion_task, document_id, workspace_id)
    return _document_summary_from_row(created_row)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    membership: tuple[str, str] = Depends(require_editor_workspace),
):
    workspace_id, _role = membership
    result = (
        tenant_query("documents", workspace_id)
        .eq("id", document_id)
        .limit(1)
        .execute()
    )
    row = (result.data or [None])[0]
    if not row:
        raise _error(status.HTTP_404_NOT_FOUND, "document_not_found", "Document was not found.")

    index_rows = (
        tenant_query("chunk_vector_index_records", workspace_id)
        .eq("document_id", document_id)
        .execute()
    )
    vector_ids = [index_row["vector_id"] for index_row in index_rows.data or []]
    if vector_ids:
        target = IndexingTarget(
            provider=settings.index_provider,
            index_name=settings.pinecone_index,
            namespace=build_index_namespace(workspace_id),
            embedding_provider=row.get("current_embedding_provider") or settings.embedding_provider,
            embedding_model=row.get("current_embedding_model") or settings.embed_model,
            embedding_dimension=row.get("current_embedding_dimension") or settings.embed_dim,
            embedding_version=row.get("current_embedding_version") or settings.embedding_version,
            parser_version=row.get("current_embedding_parser_version") or settings.parser_version,
            chunk_version=row.get("current_embedding_chunk_version") or settings.chunk_version,
        )
        await get_index_provider().delete(target, vector_ids)

    delete_document_object(row["r2_key"])
    (
        get_client()
        .table("documents")
        .delete()
        .eq("id", document_id)
        .eq("workspace_id", workspace_id)
        .execute()
    )
