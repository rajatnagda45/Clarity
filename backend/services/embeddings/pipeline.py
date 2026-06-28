from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from typing import Any, Literal
from uuid import uuid4

from config import settings
from db.client import get_client
from services.embeddings.base import (
    EmbeddingProviderError,
    EmbeddingProviderRetryableError,
)
from services.embeddings.factory import get_embedding_provider
from services.embeddings.models import (
    EmbeddingRequestItem,
    EmbeddingTarget,
    GeneratedEmbedding,
)
from services.indexing.pipeline import (
    queue_document_for_indexing,
    run_document_indexing_task,
)


logger = logging.getLogger(__name__)

DocumentStage = Literal[
    "chunked",
    "awaiting_embeddings",
    "embedding",
    "embedded",
    "failed",
]


class EmbeddingBusy(Exception):
    pass


class EmbeddingOwnershipLost(Exception):
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


def _load_chunks(document_id: str, workspace_id: str) -> list[dict[str, Any]]:
    result = (
        get_client()
        .table("chunks")
        .select("chunk_id, chunk_index, checksum, token_count, text")
        .eq("document_id", document_id)
        .eq("workspace_id", workspace_id)
        .order("chunk_index")
        .execute()
    )
    return result.data or []


def _target_matches_document(document: dict[str, Any], target: EmbeddingTarget) -> bool:
    return (
        document.get("current_embedding_provider") == target.provider
        and document.get("current_embedding_model") == target.model
        and document.get("current_embedding_dimension") == target.dimension
        and document.get("current_embedding_version") == target.version
        and document.get("current_embedding_parser_version") == target.parser_version
        and document.get("current_embedding_chunk_version") == target.chunk_version
    )


def _document_has_current_embeddings(
    document_id: str,
    workspace_id: str,
    document: dict[str, Any],
    target: EmbeddingTarget,
) -> bool:
    if not _target_matches_document(document, target):
        return False

    chunks = _load_chunks(document_id, workspace_id)
    if not chunks:
        return False

    embeddings_result = (
        get_client()
        .table("chunk_embeddings")
        .select("chunk_id, checksum")
        .eq("document_id", document_id)
        .eq("workspace_id", workspace_id)
        .eq("embedding_provider", target.provider)
        .eq("embedding_model", target.model)
        .eq("embedding_version", target.version)
        .eq("parser_version", target.parser_version)
        .eq("chunk_version", target.chunk_version)
        .execute()
    )
    embeddings = {
        row["chunk_id"]: row["checksum"]
        for row in embeddings_result.data or []
    }
    return all(embeddings.get(chunk["chunk_id"]) == chunk["checksum"] for chunk in chunks)


def _claim_embedding_lease(
    document_id: str,
    workspace_id: str,
    target: EmbeddingTarget,
) -> tuple[dict[str, Any] | None, str | None]:
    document = _load_document(document_id, workspace_id)
    if document is None:
        return None, None

    if document["status"] == "embedded" and _document_has_current_embeddings(
        document_id,
        workspace_id,
        document,
        target,
    ):
        return document, None

    lease_started_at = _parse_timestamp(document.get("embedding_started_at"))
    lease_deadline = _now_utc() - timedelta(seconds=settings.embedding_lease_seconds)
    current_run_id = document.get("embedding_run_id")
    lease_is_stale = bool(current_run_id and lease_started_at and lease_started_at < lease_deadline)

    if current_run_id and not lease_is_stale:
        raise EmbeddingBusy("Document is already being embedded.")

    run_id = str(uuid4())
    payload = {
        "embedding_run_id": run_id,
        "embedding_started_at": _now_utc().isoformat(),
        "embedding_completed_at": None,
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
        query = query.eq("embedding_run_id", current_run_id)
    else:
        query = query.is_("embedding_run_id", "null")

    result = query.execute()
    if not result.data:
        raise EmbeddingBusy("Another embedding attempt acquired the lease first.")

    updated_document = dict(document)
    updated_document.update(payload)
    return updated_document, run_id


def _update_document_for_run(
    document_id: str,
    workspace_id: str,
    run_id: str,
    *,
    status: DocumentStage,
    error: str | None = None,
    embedding_retry_count: int | None = None,
) -> None:
    payload: dict[str, Any] = {
        "status": status,
        "error": error,
    }
    if embedding_retry_count is not None:
        payload["embedding_retry_count"] = embedding_retry_count

    result = (
        get_client()
        .table("documents")
        .update(payload)
        .eq("id", document_id)
        .eq("workspace_id", workspace_id)
        .eq("embedding_run_id", run_id)
        .execute()
    )
    if not result.data:
        raise EmbeddingOwnershipLost("Embedding lease was lost before document state update.")


def _finalize_document(
    document_id: str,
    workspace_id: str,
    run_id: str,
    *,
    status: DocumentStage,
    error: str | None = None,
    target: EmbeddingTarget | None = None,
    embedded_chunk_count: int | None = None,
    embedding_retry_count: int | None = None,
) -> None:
    payload: dict[str, Any] = {
        "status": status,
        "error": error,
        "embedding_run_id": None,
        "embedding_completed_at": _now_utc().isoformat(),
    }
    if embedding_retry_count is not None:
        payload["embedding_retry_count"] = embedding_retry_count
    if target is not None:
        payload["current_embedding_provider"] = target.provider
        payload["current_embedding_model"] = target.model
        payload["current_embedding_dimension"] = target.dimension
        payload["current_embedding_version"] = target.version
        payload["current_embedding_parser_version"] = target.parser_version
        payload["current_embedding_chunk_version"] = target.chunk_version
    if embedded_chunk_count is not None:
        payload["embedded_chunk_count"] = embedded_chunk_count

    result = (
        get_client()
        .table("documents")
        .update(payload)
        .eq("id", document_id)
        .eq("workspace_id", workspace_id)
        .eq("embedding_run_id", run_id)
        .execute()
    )
    if not result.data:
        raise EmbeddingOwnershipLost("Embedding lease was lost before finalization.")


def _load_current_embeddings(
    document_id: str,
    workspace_id: str,
    target: EmbeddingTarget,
) -> dict[str, str]:
    result = (
        get_client()
        .table("chunk_embeddings")
        .select("chunk_id, checksum")
        .eq("document_id", document_id)
        .eq("workspace_id", workspace_id)
        .eq("embedding_provider", target.provider)
        .eq("embedding_model", target.model)
        .eq("embedding_version", target.version)
        .eq("parser_version", target.parser_version)
        .eq("chunk_version", target.chunk_version)
        .execute()
    )
    return {row["chunk_id"]: row["checksum"] for row in result.data or []}


def _persist_embeddings(embeddings: list[GeneratedEmbedding]) -> None:
    if not embeddings:
        return

    rows = [
        {
            "workspace_id": embedding.workspace_id,
            "document_id": embedding.document_id,
            "chunk_id": embedding.chunk_id,
            "chunk_index": embedding.chunk_index,
            "embedding_provider": embedding.embedding_provider,
            "embedding_model": embedding.embedding_model,
            "embedding_dimension": embedding.embedding_dimension,
            "embedding_version": embedding.embedding_version,
            "parser_version": embedding.parser_version,
            "chunk_version": embedding.chunk_version,
            "checksum": embedding.checksum,
            "token_count": embedding.token_count,
            "latency_ms": embedding.latency_ms,
            "retry_count": embedding.retry_count,
            "estimated_cost_usd": embedding.estimated_cost_usd,
            "vector_preview": embedding.vector_preview,
            "vector": embedding.vector,
        }
        for embedding in embeddings
    ]
    get_client().table("chunk_embeddings").insert(rows).execute()


def _record_usage_event(
    workspace_id: str,
    *,
    input_tokens: int,
    latency_ms: int,
) -> None:
    get_client().table("usage_events").insert(
        {
            "workspace_id": workspace_id,
            "kind": "embed",
            "input_tokens": input_tokens,
            "output_tokens": 0,
            "latency_ms": latency_ms,
        }
    ).execute()


async def _sleep_backoff(retry_count: int) -> None:
    await asyncio.sleep(min(0.25 * (2 ** max(retry_count - 1, 0)), 2.0))


async def _embed_pending_items(
    provider,
    items: list[EmbeddingRequestItem],
) -> int:
    current_batch_size = max(1, min(settings.embedding_batch_size, len(items)))
    retry_count = 0
    cursor = 0

    while cursor < len(items):
        batch = items[cursor: cursor + current_batch_size]
        try:
            result = await provider.embed(batch)
        except EmbeddingProviderRetryableError:
            retry_count += 1
            if retry_count > settings.embedding_max_retries and len(batch) == 1:
                exc = EmbeddingProviderError("Embedding retries exhausted for the current chunk.")
                setattr(exc, "retry_count", retry_count)
                raise exc
            current_batch_size = max(1, len(batch) // 2) if len(batch) > 1 else 1
            await _sleep_backoff(retry_count)
            continue
        except EmbeddingProviderError:
            raise

        for embedding in result.embeddings:
            embedding.retry_count = retry_count
        await asyncio.to_thread(_persist_embeddings, result.embeddings)
        cursor += len(batch)
        current_batch_size = min(settings.embedding_batch_size, current_batch_size + 1)

    return retry_count


def _build_pending_items(
    document_id: str,
    workspace_id: str,
    target: EmbeddingTarget,
) -> list[EmbeddingRequestItem]:
    chunks = _load_chunks(document_id, workspace_id)
    current_embeddings = _load_current_embeddings(document_id, workspace_id, target)
    return [
        EmbeddingRequestItem(
            workspace_id=workspace_id,
            document_id=document_id,
            chunk_id=chunk["chunk_id"],
            chunk_index=chunk["chunk_index"],
            checksum=chunk["checksum"],
            token_count=chunk["token_count"],
            text=chunk["text"],
        )
        for chunk in chunks
        if current_embeddings.get(chunk["chunk_id"]) != chunk["checksum"]
    ]


async def run_document_embedding(document_id: str, workspace_id: str) -> None:
    provider = get_embedding_provider()
    started = _now_utc()

    try:
        document, run_id = _claim_embedding_lease(document_id, workspace_id, provider.target)
    except EmbeddingBusy:
        logger.info(
            "document_embedding_skipped_busy_document",
            extra={"document_id": document_id, "workspace_id": workspace_id},
        )
        return

    if document is None:
        logger.warning(
            "document_embedding_missing_document",
            extra={"document_id": document_id, "workspace_id": workspace_id},
        )
        return

    if run_id is None:
        logger.info(
            "document_embedding_skipped_current_document",
            extra={"document_id": document_id, "workspace_id": workspace_id},
        )
        return

    retry_count = 0
    try:
        pending = _build_pending_items(document_id, workspace_id, provider.target)
        _update_document_for_run(
            document_id,
            workspace_id,
            run_id,
            status="embedding",
            error=None,
            embedding_retry_count=0,
        )

        if pending:
            retry_count = await _embed_pending_items(provider, pending)

        chunks = _load_chunks(document_id, workspace_id)
        _finalize_document(
            document_id,
            workspace_id,
            run_id,
            status="embedded",
            error=None,
            target=provider.target,
            embedded_chunk_count=len(chunks),
            embedding_retry_count=retry_count,
        )
        latency_ms = int((_now_utc() - started).total_seconds() * 1000)
        _record_usage_event(
            workspace_id,
            input_tokens=sum(chunk["token_count"] for chunk in chunks),
            latency_ms=latency_ms,
        )
        if queue_document_for_indexing(document_id, workspace_id):
            await run_document_indexing_task(document_id, workspace_id)
    except EmbeddingOwnershipLost:
        logger.info(
            "document_embedding_stopped_after_lease_loss",
            extra={"document_id": document_id, "workspace_id": workspace_id},
        )
    except (EmbeddingProviderError, ValueError) as exc:
        logger.warning(
            "document_embedding_failed",
            extra={
                "document_id": document_id,
                "workspace_id": workspace_id,
                "error": str(exc),
            },
        )
        try:
            _finalize_document(
                document_id,
                workspace_id,
                run_id,
                status="failed",
                error=str(exc),
                embedding_retry_count=getattr(exc, "retry_count", retry_count),
            )
        except EmbeddingOwnershipLost:
            logger.info(
                "document_embedding_failure_ignored_after_lease_loss",
                extra={"document_id": document_id, "workspace_id": workspace_id},
            )
    except Exception:
        logger.exception(
            "document_embedding_unexpected_failure",
            extra={"document_id": document_id, "workspace_id": workspace_id},
        )
        try:
            _finalize_document(
                document_id,
                workspace_id,
                run_id,
                status="failed",
                error="Document embedding failed unexpectedly.",
                embedding_retry_count=retry_count,
            )
        except EmbeddingOwnershipLost:
            logger.info(
                "document_embedding_unexpected_failure_ignored_after_lease_loss",
                extra={"document_id": document_id, "workspace_id": workspace_id},
            )


async def run_document_embedding_task(document_id: str, workspace_id: str) -> None:
    await run_document_embedding(document_id, workspace_id)
