from __future__ import annotations

import asyncio
import hashlib
import logging
import time
from datetime import UTC, datetime, timedelta
from typing import Any, Literal
from uuid import uuid4

from config import settings
from db.client import get_client
from services.events.bus import event_bus, make_event
from services.ingestion.extractors.docx import DocxExtractionError, extract_docx_document
from services.ingestion.extractors.pdf import PdfExtractionError, extract_pdf_document
from services.embeddings.pipeline import run_document_embedding_task
from services.ingestion.chunker import generate_chunks
from services.ingestion.fetcher import fetch_document_source
from services.ingestion.models import ExtractedDocument, GeneratedChunk, NormalizedDocument, PreprocessingResult
from services.ingestion.normalizer import normalize_extracted_document
from services.ingestion.preprocessor import preprocess_document


logger = logging.getLogger(__name__)


def _ms_since(t0: float) -> int:
    return int((time.perf_counter() - t0) * 1000)

DocumentStage = Literal[
    "uploaded",
    "extracted",
    "normalized",
    "metadata_ready",
    "awaiting_chunking",
    "chunking",
    "chunked",
    "awaiting_embeddings",
    "embedding",
    "embedded",
    "failed",
]


class IngestionError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class IngestionBusy(Exception):
    pass


class IngestionOwnershipLost(Exception):
    pass


_CLAUSE_TYPE_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("termination", ("terminate", "termination", "survival")),
    ("renewal", ("renew", "renewal", "auto-renew", "expiration")),
    ("liability", ("liability", "indemn", "damages", "warranty disclaimer", "limitation of liability")),
    ("payment", ("payment", "fees", "invoice", "pricing", "amount due")),
    ("ip", ("intellectual property", "license", "ownership", "copyright", "trademark")),
    ("confidentiality", ("confidential", "non-disclosure", "proprietary", "privacy")),
]

_FLAGGED_RISK_MARKERS = (
    "sole discretion",
    "automatic renewal",
    "irrevocable",
    "unlimited liability",
    "indemnify",
)
_NON_STANDARD_RISK_MARKERS = (
    "material breach",
    "convenience",
    "penalty",
    "liquidated damages",
    "exclusive remedy",
)


def _now_utc() -> datetime:
    return datetime.now(UTC)


def _parse_timestamp(value: str | datetime | None) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def _load_document(document_id: str, workspace_id: str) -> dict[str, Any] | None:
    result = (
        get_client()
        .table("documents")
        .select("*")
        .eq("id", document_id)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    return (result.data or [None])[0]


def _claim_ingestion_lease(document_id: str, workspace_id: str) -> tuple[dict[str, Any] | None, str | None]:
    document = _load_document(document_id, workspace_id)
    if document is None:
        return None, None

    if document["status"] in {"chunked", "awaiting_embeddings", "embedding", "embedded"} and _document_has_current_chunks(document_id, workspace_id):
        return document, None

    lease_started_at = _parse_timestamp(document.get("ingestion_started_at"))
    lease_deadline = _now_utc() - timedelta(seconds=settings.ingestion_lease_seconds)
    current_run_id = document.get("ingestion_run_id")
    lease_is_stale = bool(current_run_id and lease_started_at and lease_started_at < lease_deadline)

    if current_run_id and not lease_is_stale:
        raise IngestionBusy("Document is already being ingested.")

    run_id = str(uuid4())
    payload = {
        "ingestion_run_id": run_id,
        "ingestion_started_at": _now_utc().isoformat(),
        "ingestion_completed_at": None,
    }

    query = (
        get_client()
        .table("documents")
        .update(payload)
        .eq("id", document_id)
        .eq("workspace_id", workspace_id)
        .eq("status", document["status"])
    )
    if current_run_id and lease_is_stale:
        query = query.eq("ingestion_run_id", current_run_id)
    else:
        query = query.is_("ingestion_run_id", "null")

    result = query.execute()
    if not result.data:
        raise IngestionBusy("Another ingestion attempt acquired the lease first.")

    updated_document = dict(document)
    updated_document.update(payload)
    return updated_document, run_id


def _document_has_current_chunks(document_id: str, workspace_id: str) -> bool:
    result = (
        get_client()
        .table("chunks")
        .select("chunk_version, parser_version")
        .eq("document_id", document_id)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    row = (result.data or [None])[0]
    if row is None:
        return False
    return (
        row.get("chunk_version") == settings.chunk_version
        and row.get("parser_version") == settings.parser_version
    )


def _update_document_for_run(
    document_id: str,
    workspace_id: str,
    run_id: str,
    *,
    status: DocumentStage,
    page_count: int | None = None,
    error: str | None = None,
) -> None:
    payload: dict[str, Any] = {
        "status": status,
        "error": error,
    }
    if page_count is not None:
        payload["page_count"] = page_count

    result = (
        get_client()
        .table("documents")
        .update(payload)
        .eq("id", document_id)
        .eq("workspace_id", workspace_id)
        .eq("ingestion_run_id", run_id)
        .execute()
    )
    if not result.data:
        raise IngestionOwnershipLost("Ingestion lease was lost before document state update.")
    logger.info(
        "document_ingestion_status_updated",
        extra={"document_id": document_id, "workspace_id": workspace_id, "status": status},
    )


def _upsert_artifacts(
    document_id: str,
    workspace_id: str,
    run_id: str,
    *,
    source_sha256: str,
    extraction: ExtractedDocument | None = None,
    normalized: NormalizedDocument | None = None,
    preprocessing: PreprocessingResult | None = None,
) -> None:
    row: dict[str, Any] = {
        "document_id": document_id,
        "workspace_id": workspace_id,
        "ingestion_run_id": run_id,
        "source_sha256": source_sha256,
    }
    if extraction is not None:
        row["extraction_text"] = extraction.full_text
        row["extraction_blocks"] = [block.model_dump(mode="json") for block in extraction.blocks]
    if normalized is not None:
        row["normalized_text"] = normalized.full_text
        row["normalized_blocks"] = [block.model_dump(mode="json") for block in normalized.blocks]
    if preprocessing is not None:
        row["metadata"] = preprocessing.metadata.model_dump(mode="json")
        row["preprocessing_segments"] = [
            segment.model_dump(mode="json") for segment in preprocessing.segments
        ]

    get_client().table("document_ingestion_artifacts").upsert(row).execute()


def _finalize_document(
    document_id: str,
    workspace_id: str,
    run_id: str,
    *,
    status: DocumentStage,
    page_count: int | None = None,
    error: str | None = None,
) -> None:
    payload: dict[str, Any] = {
        "status": status,
        "error": error,
        "ingestion_run_id": None,
        "ingestion_completed_at": _now_utc().isoformat(),
    }
    if page_count is not None:
        payload["page_count"] = page_count

    result = (
        get_client()
        .table("documents")
        .update(payload)
        .eq("id", document_id)
        .eq("workspace_id", workspace_id)
        .eq("ingestion_run_id", run_id)
        .execute()
    )
    if not result.data:
        raise IngestionOwnershipLost("Ingestion lease was lost before finalization.")


def _record_usage_event(workspace_id: str) -> None:
    get_client().table("usage_events").insert(
        {
            "workspace_id": workspace_id,
            "kind": "ingest",
            "input_tokens": 0,
            "output_tokens": 0,
            "latency_ms": None,
        }
    ).execute()


def _classify_clause_type(text: str, section_title: str | None) -> str:
    haystack = f"{section_title or ''}\n{text}".lower()
    for clause_type, markers in _CLAUSE_TYPE_RULES:
        if any(marker in haystack for marker in markers):
            return clause_type
    return "other"


def _classify_risk_flag(text: str, clause_type: str) -> tuple[str, str | None, float]:
    lowered = text.lower()
    if any(marker in lowered for marker in _FLAGGED_RISK_MARKERS):
        return "flagged", "Contains language that often warrants manual review.", 0.9
    if clause_type in {"liability", "termination", "renewal"} or any(
        marker in lowered for marker in _NON_STANDARD_RISK_MARKERS
    ):
        return "non_standard", "Core contract clause with terms that merit verification.", 0.6
    return "normal", None, 0.2


def _queue_document_for_embeddings(document_id: str, workspace_id: str) -> None:
    payload = {
        "status": "awaiting_embeddings",
        "error": None,
        "embedding_queued_at": _now_utc().isoformat(),
    }
    (
        get_client()
        .table("documents")
        .update(payload)
        .eq("id", document_id)
        .eq("workspace_id", workspace_id)
        .eq("status", "chunked")
        .execute()
    )


def _persist_chunks(document_id: str, workspace_id: str, chunks: list[GeneratedChunk]) -> None:
    chunk_rows = [
        {
            "workspace_id": chunk.workspace_id,
            "document_id": chunk.document_id,
            "chunk_id": chunk.chunk_id,
            "chunk_index": chunk.chunk_index,
            "section_title": chunk.section_title,
            "clause_number": chunk.clause_number,
            "page": chunk.page_start,
            "page_start": chunk.page_start,
            "page_end": chunk.page_end,
            "char_start": chunk.source_offsets[0].char_start,
            "char_end": chunk.source_offsets[-1].char_end,
            "source_offsets": [offset.model_dump(mode="json") for offset in chunk.source_offsets],
            "token_count": chunk.token_count,
            "checksum": chunk.checksum,
            "parser_version": chunk.parser_version,
            "chunk_version": chunk.chunk_version,
            "chunk_kind": chunk.chunk_kind,
            "fragment_index": chunk.fragment_index,
            "fragment_count": chunk.fragment_count,
            "cross_references": chunk.cross_references,
            "text": chunk.text,
            "content_hash": chunk.content_hash,
            "bm25_tokens": None,
        }
        for chunk in chunks
    ]

    (
        get_client()
        .table("chunks")
        .delete()
        .eq("document_id", document_id)
        .eq("workspace_id", workspace_id)
        .execute()
    )
    get_client().table("chunks").insert(chunk_rows).execute()


def _persist_clauses(document_id: str, workspace_id: str, chunks: list[GeneratedChunk]) -> None:
    clause_rows = []
    for chunk in chunks:
        if chunk.chunk_kind not in {"clause", "definition"} and not chunk.clause_number:
            continue
        clause_type = _classify_clause_type(chunk.text, chunk.section_title)
        risk_flag, rationale, risk_score = _classify_risk_flag(chunk.text, clause_type)
        clause_rows.append(
            {
                "id": str(uuid4()),
                "workspace_id": workspace_id,
                "document_id": document_id,
                "clause_type": clause_type,
                "text": chunk.text,
                "page": chunk.page_start,
                "risk_flag": risk_flag,
                "rationale": rationale,
                "risk_score": risk_score,
            }
        )

    (
        get_client()
        .table("clauses")
        .delete()
        .eq("document_id", document_id)
        .eq("workspace_id", workspace_id)
        .execute()
    )
    if clause_rows:
        get_client().table("clauses").insert(clause_rows).execute()


def _extract_document(source_type: str, payload: bytes) -> ExtractedDocument:
    if source_type == "pdf":
        return extract_pdf_document(payload)
    if source_type == "docx":
        return extract_docx_document(payload)
    raise IngestionError("unsupported_source_type", f"Unsupported source type '{source_type}'.")


async def run_document_ingestion(document_id: str, workspace_id: str) -> None:
    pipeline_start = time.perf_counter()
    try:
        document, run_id = _claim_ingestion_lease(document_id, workspace_id)
    except IngestionBusy:
        logger.info(
            "ingestion_skipped doc=%s ws=%s reason=busy_lease",
            document_id, workspace_id,
        )
        return

    if document is None:
        logger.warning("ingestion_skipped doc=%s ws=%s reason=not_found", document_id, workspace_id)
        return

    if run_id is None:
        logger.info("ingestion_skipped doc=%s ws=%s reason=already_ready", document_id, workspace_id)
        return

    filename = document.get("filename")
    stage_timings: dict[str, int] = {}
    logger.info("ingestion_started doc=%s ws=%s file=%s", document_id, workspace_id, filename)
    event_bus.publish(make_event(document_id, workspace_id, "uploaded", elapsed_ms=0, filename=filename))

    def _ev(status: str, **kw) -> None:
        event_bus.publish(make_event(
            document_id, workspace_id, status, _ms_since(pipeline_start),
            filename=filename, stage_timings=dict(stage_timings), **kw,
        ))

    try:
        # Stage 1: Fetch from R2
        t0 = time.perf_counter()
        source_bytes = await asyncio.to_thread(fetch_document_source, document["r2_key"])
        source_sha256 = hashlib.sha256(source_bytes).hexdigest()
        stage_timings["fetch_ms"] = _ms_since(t0)
        logger.info("ingestion_stage doc=%s stage=fetch_r2 ms=%d bytes=%d", document_id, stage_timings["fetch_ms"], len(source_bytes))

        # Stage 2: Extract text
        t0 = time.perf_counter()
        extracted = await asyncio.to_thread(_extract_document, document["source_type"], source_bytes)
        stage_timings["extract_ms"] = _ms_since(t0)
        logger.info("ingestion_stage doc=%s stage=extract ms=%d pages=%d", document_id, stage_timings["extract_ms"], extracted.page_count)
        _upsert_artifacts(document_id, workspace_id, run_id, source_sha256=source_sha256, extraction=extracted)
        _update_document_for_run(document_id, workspace_id, run_id, status="extracted", page_count=extracted.page_count, error=None)
        _ev("extracted")

        # Stage 3: Normalize
        t0 = time.perf_counter()
        normalized = await asyncio.to_thread(normalize_extracted_document, extracted)
        stage_timings["normalize_ms"] = _ms_since(t0)
        logger.info("ingestion_stage doc=%s stage=normalize ms=%d", document_id, stage_timings["normalize_ms"])
        _upsert_artifacts(document_id, workspace_id, run_id, source_sha256=source_sha256, normalized=normalized)
        _update_document_for_run(document_id, workspace_id, run_id, status="normalized", page_count=normalized.page_count, error=None)
        _ev("normalized")

        # Stage 4: Preprocess / metadata
        t0 = time.perf_counter()
        preprocessing = await asyncio.to_thread(preprocess_document, normalized, source_sha256)
        stage_timings["preprocess_ms"] = _ms_since(t0)
        logger.info("ingestion_stage doc=%s stage=preprocess ms=%d", document_id, stage_timings["preprocess_ms"])
        _upsert_artifacts(document_id, workspace_id, run_id, source_sha256=source_sha256, preprocessing=preprocessing)
        _update_document_for_run(document_id, workspace_id, run_id, status="metadata_ready", page_count=preprocessing.metadata.page_count, error=None)
        _ev("metadata_ready")

        # Stage 5: Chunk — set chunking status BEFORE generating so UI shows it immediately
        _update_document_for_run(document_id, workspace_id, run_id, status="awaiting_chunking", page_count=preprocessing.metadata.page_count, error=None)
        _update_document_for_run(document_id, workspace_id, run_id, status="chunking", page_count=preprocessing.metadata.page_count, error=None)
        _ev("chunking")
        t0 = time.perf_counter()
        chunks = await asyncio.to_thread(generate_chunks, workspace_id, document_id, normalized, preprocessing)
        stage_timings["chunk_ms"] = _ms_since(t0)
        logger.info("ingestion_stage doc=%s stage=chunk ms=%d chunks=%d", document_id, stage_timings["chunk_ms"], len(chunks))

        # Stage 6: Persist chunks + clauses
        t0 = time.perf_counter()
        await asyncio.to_thread(_persist_chunks, document_id, workspace_id, chunks)
        await asyncio.to_thread(_persist_clauses, document_id, workspace_id, chunks)
        stage_timings["persist_ms"] = _ms_since(t0)
        logger.info("ingestion_stage doc=%s stage=persist_chunks ms=%d", document_id, stage_timings["persist_ms"])

        _finalize_document(document_id, workspace_id, run_id, status="chunked", page_count=preprocessing.metadata.page_count, error=None)
        _record_usage_event(workspace_id)
        _queue_document_for_embeddings(document_id, workspace_id)
        _ev("awaiting_embeddings")

        logger.info("ingestion_complete doc=%s total_ms=%d — starting embedding", document_id, _ms_since(pipeline_start))

        # Chain directly into embedding
        try:
            await run_document_embedding_task(document_id, workspace_id)
        except Exception:
            logger.exception("embedding_task_failed_after_ingestion doc=%s", document_id)

    except IngestionOwnershipLost:
        logger.warning("ingestion_ownership_lost doc=%s ws=%s", document_id, workspace_id)
    except (PdfExtractionError, DocxExtractionError, IngestionError, ValueError) as exc:
        logger.warning("ingestion_failed doc=%s error=%s", document_id, exc)
        try:
            _finalize_document(document_id, workspace_id, run_id, status="failed", error=str(exc))
            _ev("failed", error=str(exc))
        except IngestionOwnershipLost:
            pass
    except Exception as exc:
        logger.exception("ingestion_unexpected_failure doc=%s error=%s", document_id, exc)
        try:
            _finalize_document(document_id, workspace_id, run_id, status="failed", error=f"Unexpected failure: {exc}")
            _ev("failed", error=str(exc))
        except IngestionOwnershipLost:
            pass


async def run_document_ingestion_task(document_id: str, workspace_id: str) -> None:
    await run_document_ingestion(document_id, workspace_id)
