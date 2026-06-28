from __future__ import annotations

from tempfile import SpooledTemporaryFile
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, UploadFile, status

from api.deps import require_workspace_role
from config import settings
from db.client import tenant_query, get_client
from schemas import DocumentChunkListResponse, DocumentChunkSummary, DocumentDetailResponse, DocumentListResponse, DocumentSummary
from services.ingestion.pipeline import run_document_ingestion_task
from services.ingestion.url import (
    UrlIngestionNotImplementedError,
    enqueue_url_ingestion,
    validate_url_ingestion_request,
)
from services.storage.r2 import build_document_storage_key, sanitize_filename, upload_document_file, delete_document_object


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
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


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
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> DocumentListResponse:
    workspace_id, _ = membership
    rows = (
        tenant_query("documents", workspace_id)
        .order("created_at", desc=True)
        .execute()
    )
    documents = [_document_summary_from_row(row) for row in rows.data or []]
    return DocumentListResponse(documents=documents)


@router.get("/{document_id}/chunks", response_model=DocumentChunkListResponse)
async def inspect_document_chunks(
    document_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> DocumentChunkListResponse:
    if settings.environment == "production":
        raise _error(status.HTTP_404_NOT_FOUND, "not_found", "Developer chunk inspector unavailable.")

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


@router.get("/{document_id}", response_model=DocumentDetailResponse)
async def get_document(
    document_id: str,
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

    return DocumentDetailResponse(
        **_document_summary_from_row(row).model_dump(),
        clauses=[],
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
