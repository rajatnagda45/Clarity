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
from services.indexing.base import IndexProviderError, IndexProviderRetryableError
from services.indexing.factory import get_index_provider
from services.indexing.inspector import build_index_namespace
from services.indexing.models import IndexVectorRecord, IndexingTarget


logger = logging.getLogger(__name__)

DocumentStage = Literal[
    "embedded",
    "awaiting_index",
    "indexing",
    "indexed",
    "failed",
]


class IndexingBusy(Exception):
    pass


class IndexingOwnershipLost(Exception):
    pass


def _now_utc() -> datetime:
    return datetime.now(UTC)


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


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


def _build_target(document: dict[str, Any], workspace_id: str) -> IndexingTarget:
    return IndexingTarget(
        provider=settings.index_provider,
        index_name=settings.pinecone_index,
        namespace=build_index_namespace(workspace_id),
        embedding_provider=document["current_embedding_provider"],
        embedding_model=document["current_embedding_model"],
        embedding_dimension=document["current_embedding_dimension"],
        embedding_version=document["current_embedding_version"],
        parser_version=document["current_embedding_parser_version"],
        chunk_version=document["current_embedding_chunk_version"],
    )


def _document_has_current_embeddings(document: dict[str, Any]) -> bool:
    return all(
        document.get(field)
        for field in (
            "current_embedding_provider",
            "current_embedding_model",
            "current_embedding_dimension",
            "current_embedding_version",
            "current_embedding_parser_version",
            "current_embedding_chunk_version",
        )
    )


def _build_vector_id(
    *,
    workspace_id: str,
    document_id: str,
    chunk_id: str,
    chunk_index: int,
    checksum: str,
    target: IndexingTarget,
) -> str:
    identity = ":".join(
        [
            workspace_id,
            document_id,
            chunk_id,
            str(chunk_index),
            checksum,
            target.provider,
            target.index_name,
            target.namespace,
            target.embedding_provider,
            target.embedding_model,
            target.embedding_version,
            target.parser_version,
            target.chunk_version,
        ]
    )
    return f"vec_{hashlib.sha256(identity.encode('utf-8')).hexdigest()[:40]}"


def _load_current_records(
    document_id: str,
    workspace_id: str,
    target: IndexingTarget,
) -> list[IndexVectorRecord]:
    chunk_rows = (
        get_client()
        .table("chunks")
        .select(
            "chunk_id, chunk_index, section_title, clause_number, page_start, page_end, checksum, text"
        )
        .eq("document_id", document_id)
        .eq("workspace_id", workspace_id)
        .order("chunk_index")
        .execute()
    )
    embedding_rows = (
        get_client()
        .table("chunk_embeddings")
        .select(
            "chunk_id, chunk_index, checksum, embedding_provider, embedding_model, "
            "embedding_dimension, embedding_version, parser_version, chunk_version, vector"
        )
        .eq("document_id", document_id)
        .eq("workspace_id", workspace_id)
        .eq("embedding_provider", target.embedding_provider)
        .eq("embedding_model", target.embedding_model)
        .eq("embedding_version", target.embedding_version)
        .eq("parser_version", target.parser_version)
        .eq("chunk_version", target.chunk_version)
        .order("chunk_index")
        .execute()
    )
    chunks_by_id = {row["chunk_id"]: row for row in chunk_rows.data or []}

    records: list[IndexVectorRecord] = []
    for row in embedding_rows.data or []:
        if row.get("vector") is None:
            raise ValueError(
                "Vector indexing requires locally persisted embedding vectors for the current document."
            )
        chunk = chunks_by_id.get(row["chunk_id"])
        if not chunk or chunk.get("checksum") != row.get("checksum"):
            continue
        records.append(
            IndexVectorRecord(
                workspace_id=workspace_id,
                document_id=document_id,
                chunk_id=row["chunk_id"],
                chunk_index=row["chunk_index"],
                section_title=chunk.get("section_title"),
                clause_number=chunk.get("clause_number"),
                page_start=chunk["page_start"],
                page_end=chunk["page_end"],
                checksum=row["checksum"],
                vector_id=_build_vector_id(
                    workspace_id=workspace_id,
                    document_id=document_id,
                    chunk_id=row["chunk_id"],
                    chunk_index=row["chunk_index"],
                    checksum=row["checksum"],
                    target=target,
                ),
                vector=[float(value) for value in row["vector"]],
                embedding_provider=row["embedding_provider"],
                embedding_model=row["embedding_model"],
                embedding_dimension=row["embedding_dimension"],
                embedding_version=row["embedding_version"],
                parser_version=row["parser_version"],
                chunk_version=row["chunk_version"],
            )
        )
    return records


def _load_index_rows(
    document_id: str,
    workspace_id: str,
    target: IndexingTarget,
) -> list[dict[str, Any]]:
    result = (
        get_client()
        .table("chunk_vector_index_records")
        .select("*")
        .eq("document_id", document_id)
        .eq("workspace_id", workspace_id)
        .eq("index_provider", target.provider)
        .eq("index_name", target.index_name)
        .eq("namespace", target.namespace)
        .execute()
    )
    return result.data or []


def _target_matches_document(document: dict[str, Any], target: IndexingTarget) -> bool:
    return (
        document.get("current_index_provider") == target.provider
        and document.get("current_index_name") == target.index_name
        and document.get("current_index_namespace") == target.namespace
    )


def _document_has_current_index(
    document_id: str,
    workspace_id: str,
    document: dict[str, Any],
    target: IndexingTarget,
) -> bool:
    if not _target_matches_document(document, target):
        return False

    desired_records = _load_current_records(document_id, workspace_id, target)
    if not desired_records:
        return False

    indexed_rows = [
        row
        for row in _load_index_rows(document_id, workspace_id, target)
        if row.get("status") == "indexed"
    ]
    desired_ids = {record.vector_id for record in desired_records}
    indexed_ids = {row["vector_id"] for row in indexed_rows}
    return desired_ids == indexed_ids


def _claim_index_lease(
    document_id: str,
    workspace_id: str,
) -> tuple[dict[str, Any] | None, str | None, IndexingTarget | None]:
    document = _load_document(document_id, workspace_id)
    if document is None:
        return None, None, None
    if not _document_has_current_embeddings(document):
        return document, None, None

    target = _build_target(document, workspace_id)
    if document["status"] == "indexed" and _document_has_current_index(
        document_id,
        workspace_id,
        document,
        target,
    ):
        return document, None, target

    lease_started_at = _parse_timestamp(document.get("index_started_at"))
    lease_deadline = _now_utc() - timedelta(seconds=settings.index_lease_seconds)
    current_run_id = document.get("index_run_id")
    lease_is_stale = bool(current_run_id and lease_started_at and lease_started_at < lease_deadline)

    if current_run_id and not lease_is_stale:
        raise IndexingBusy("Document is already being indexed.")

    run_id = str(uuid4())
    payload = {
        "index_run_id": run_id,
        "index_started_at": _now_utc().isoformat(),
        "index_completed_at": None,
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
        query = query.eq("index_run_id", current_run_id)
    else:
        query = query.is_("index_run_id", "null")

    result = query.execute()
    if not result.data:
        raise IndexingBusy("Another indexing attempt acquired the lease first.")

    updated_document = dict(document)
    updated_document.update(payload)
    return updated_document, run_id, target


def _update_document_for_run(
    document_id: str,
    workspace_id: str,
    run_id: str,
    *,
    status: DocumentStage,
    error: str | None = None,
    index_retry_count: int | None = None,
) -> None:
    payload: dict[str, Any] = {
        "status": status,
        "error": error,
    }
    if index_retry_count is not None:
        payload["index_retry_count"] = index_retry_count

    result = (
        get_client()
        .table("documents")
        .update(payload)
        .eq("id", document_id)
        .eq("workspace_id", workspace_id)
        .eq("index_run_id", run_id)
        .execute()
    )
    if not result.data:
        raise IndexingOwnershipLost("Indexing lease was lost before document state update.")


def _finalize_document(
    document_id: str,
    workspace_id: str,
    run_id: str,
    *,
    status: DocumentStage,
    error: str | None = None,
    target: IndexingTarget | None = None,
    indexed_chunk_count: int | None = None,
    index_retry_count: int | None = None,
) -> None:
    payload: dict[str, Any] = {
        "status": status,
        "error": error,
        "index_run_id": None,
        "index_completed_at": _now_utc().isoformat(),
    }
    if target is not None:
        payload["current_index_provider"] = target.provider
        payload["current_index_name"] = target.index_name
        payload["current_index_namespace"] = target.namespace
    if indexed_chunk_count is not None:
        payload["indexed_chunk_count"] = indexed_chunk_count
    if index_retry_count is not None:
        payload["index_retry_count"] = index_retry_count

    result = (
        get_client()
        .table("documents")
        .update(payload)
        .eq("id", document_id)
        .eq("workspace_id", workspace_id)
        .eq("index_run_id", run_id)
        .execute()
    )
    if not result.data:
        raise IndexingOwnershipLost("Indexing lease was lost before finalization.")


def queue_document_for_indexing(document_id: str, workspace_id: str) -> bool:
    document = _load_document(document_id, workspace_id)
    if not document or not _document_has_current_embeddings(document):
        return False
    if document.get("index_run_id"):
        return False

    target = _build_target(document, workspace_id)
    if document["status"] == "indexed" and _document_has_current_index(
        document_id,
        workspace_id,
        document,
        target,
    ):
        return False

    result = (
        get_client()
        .table("documents")
        .update(
            {
                "status": "awaiting_index",
                "error": None,
                "index_queued_at": _now_utc().isoformat(),
            }
        )
        .eq("id", document_id)
        .eq("workspace_id", workspace_id)
        .eq("status", document["status"])
        .is_("index_run_id", "null")
        .execute()
    )
    return bool(result.data)


def _persist_index_rows(
    target: IndexingTarget,
    rows: list[IndexVectorRecord],
    *,
    latency_ms: int,
    retry_count: int,
) -> None:
    if not rows:
        return

    payload = [
        {
            "workspace_id": row.workspace_id,
            "document_id": row.document_id,
            "chunk_id": row.chunk_id,
            "chunk_index": row.chunk_index,
            "index_provider": target.provider,
            "index_name": target.index_name,
            "namespace": target.namespace,
            "vector_id": row.vector_id,
            "embedding_provider": row.embedding_provider,
            "embedding_model": row.embedding_model,
            "embedding_dimension": row.embedding_dimension,
            "embedding_version": row.embedding_version,
            "parser_version": row.parser_version,
            "chunk_version": row.chunk_version,
            "checksum": row.checksum,
            "section_title": row.section_title,
            "clause_number": row.clause_number,
            "page_start": row.page_start,
            "page_end": row.page_end,
            "status": "indexed",
            "latency_ms": latency_ms,
            "retry_count": retry_count,
            "indexed_at": _now_utc().isoformat(),
            "last_error_code": None,
            "last_error_message": None,
            "updated_at": _now_utc().isoformat(),
        }
        for row in rows
    ]
    get_client().table("chunk_vector_index_records").upsert(
        payload,
        on_conflict="index_provider,index_name,namespace,vector_id",
    ).execute()


def _mark_stale_rows(
    document_id: str,
    workspace_id: str,
    target: IndexingTarget,
    stale_vector_ids: list[str],
) -> None:
    if not stale_vector_ids:
        return
    (
        get_client()
        .table("chunk_vector_index_records")
        .update(
            {
                "status": "stale",
                "updated_at": _now_utc().isoformat(),
            }
        )
        .eq("document_id", document_id)
        .eq("workspace_id", workspace_id)
        .eq("index_provider", target.provider)
        .eq("index_name", target.index_name)
        .eq("namespace", target.namespace)
        .in_("vector_id", stale_vector_ids)
        .execute()
    )


def _record_usage_event(
    workspace_id: str,
    *,
    input_tokens: int,
    latency_ms: int,
) -> None:
    get_client().table("usage_events").insert(
        {
            "workspace_id": workspace_id,
            "kind": "ingest",
            "input_tokens": input_tokens,
            "output_tokens": 0,
            "latency_ms": latency_ms,
        }
    ).execute()


async def _sleep_backoff(retry_count: int) -> None:
    await asyncio.sleep(min(0.25 * (2 ** max(retry_count - 1, 0)), 2.0))


async def _upsert_batches(provider, target: IndexingTarget, rows: list[IndexVectorRecord]) -> int:
    retry_count = 0
    cursor = 0
    current_batch_size = max(1, min(settings.index_batch_size, len(rows)))
    while cursor < len(rows):
        batch = rows[cursor: cursor + current_batch_size]
        try:
            result = await provider.upsert(target, batch)
        except IndexProviderRetryableError:
            retry_count += 1
            if retry_count > settings.index_max_retries and len(batch) == 1:
                exc = IndexProviderError("Vector indexing retries exhausted for the current chunk.")
                setattr(exc, "retry_count", retry_count)
                raise exc
            current_batch_size = max(1, len(batch) // 2) if len(batch) > 1 else 1
            await _sleep_backoff(retry_count)
            continue
        except IndexProviderError:
            raise

        await asyncio.to_thread(
            _persist_index_rows,
            target,
            batch,
            latency_ms=result.batch_latency_ms,
            retry_count=retry_count,
        )
        cursor += len(batch)
        current_batch_size = min(settings.index_batch_size, current_batch_size + 1)

    return retry_count


async def _delete_stale_vectors(
    provider,
    target: IndexingTarget,
    stale_vector_ids: list[str],
) -> int:
    if not stale_vector_ids:
        return 0
    retry_count = 0
    cursor = 0
    while cursor < len(stale_vector_ids):
        batch = stale_vector_ids[cursor: cursor + settings.index_batch_size]
        try:
            deleted = await provider.delete(target, batch)
        except IndexProviderRetryableError:
            retry_count += 1
            if retry_count > settings.index_max_retries and len(batch) == 1:
                exc = IndexProviderError("Vector deletion retries exhausted for the current chunk.")
                setattr(exc, "retry_count", retry_count)
                raise exc
            await _sleep_backoff(retry_count)
            continue
        except IndexProviderError:
            raise

        if deleted:
            cursor += len(batch)

    return retry_count


async def run_document_indexing(document_id: str, workspace_id: str) -> None:
    provider = get_index_provider()
    pipeline_start = time.perf_counter()
    started = _now_utc()

    try:
        document, run_id, target = _claim_index_lease(document_id, workspace_id)
    except IndexingBusy:
        logger.info("indexing_skipped doc=%s ws=%s reason=busy_lease", document_id, workspace_id)
        return

    if document is None:
        logger.warning("indexing_skipped doc=%s ws=%s reason=not_found", document_id, workspace_id)
        return

    if run_id is None or target is None:
        logger.info("indexing_skipped doc=%s ws=%s reason=already_indexed_or_no_embeddings", document_id, workspace_id)
        return

    filename = document.get("filename")
    logger.info("indexing_started doc=%s ws=%s index=%s", document_id, workspace_id, target.index_name)

    retry_count = 0
    try:
        t0 = time.perf_counter()
        current_rows = _load_current_records(document_id, workspace_id, target)
        existing_rows = _load_index_rows(document_id, workspace_id, target)
        logger.info("indexing_stage doc=%s stage=load_records ms=%d vectors=%d", document_id, int((time.perf_counter() - t0) * 1000), len(current_rows))

        desired_by_id = {row.vector_id: row for row in current_rows}
        rows_to_upsert = [
            row
            for row in current_rows
            if not any(
                existing["vector_id"] == row.vector_id and existing.get("status") == "indexed"
                for existing in existing_rows
            )
        ]
        stale_vector_ids = [
            row["vector_id"]
            for row in existing_rows
            if row["vector_id"] not in desired_by_id
            and row.get("status") != "stale"
        ]

        _update_document_for_run(document_id, workspace_id, run_id, status="indexing", error=None, index_retry_count=0)
        event_bus.publish(make_event(document_id, workspace_id, "indexing", int((time.perf_counter() - pipeline_start) * 1000), filename=filename))

        if rows_to_upsert:
            t0 = time.perf_counter()
            retry_count = max(retry_count, await _upsert_batches(provider, target, rows_to_upsert))
            logger.info("indexing_stage doc=%s stage=pinecone_upsert ms=%d vectors=%d retries=%d", document_id, int((time.perf_counter() - t0) * 1000), len(rows_to_upsert), retry_count)

        if stale_vector_ids:
            retry_count = max(retry_count, await _delete_stale_vectors(provider, target, stale_vector_ids))
            await asyncio.to_thread(_mark_stale_rows, document_id, workspace_id, target, stale_vector_ids)

        _finalize_document(document_id, workspace_id, run_id, status="indexed", error=None, target=target, indexed_chunk_count=len(current_rows), index_retry_count=retry_count)
        event_bus.publish(make_event(document_id, workspace_id, "indexed", int((time.perf_counter() - pipeline_start) * 1000), retry_count=retry_count, filename=filename))
        latency_ms = int((_now_utc() - started).total_seconds() * 1000)
        _record_usage_event(workspace_id, input_tokens=len(current_rows), latency_ms=latency_ms)

        logger.info("indexing_complete doc=%s total_ms=%d vectors=%d", document_id, int((time.perf_counter() - pipeline_start) * 1000), len(current_rows))
    except IndexingOwnershipLost:
        logger.warning("indexing_ownership_lost doc=%s ws=%s", document_id, workspace_id)
    except (IndexProviderError, ValueError) as exc:
        logger.warning("indexing_failed doc=%s error=%s", document_id, exc)
        try:
            _finalize_document(document_id, workspace_id, run_id, status="failed", error=str(exc), index_retry_count=getattr(exc, "retry_count", retry_count))
            event_bus.publish(make_event(document_id, workspace_id, "failed", int((time.perf_counter() - pipeline_start) * 1000), retry_count=retry_count, filename=filename, error=str(exc)))
        except IndexingOwnershipLost:
            pass
    except Exception as exc:
        logger.exception("indexing_unexpected_failure doc=%s error=%s", document_id, exc)
        try:
            _finalize_document(document_id, workspace_id, run_id, status="failed", error=f"Unexpected failure: {exc}", index_retry_count=retry_count)
            event_bus.publish(make_event(document_id, workspace_id, "failed", int((time.perf_counter() - pipeline_start) * 1000), retry_count=retry_count, filename=filename, error=str(exc)))
        except IndexingOwnershipLost:
            pass


async def run_document_indexing_task(document_id: str, workspace_id: str) -> None:
    await run_document_indexing(document_id, workspace_id)
