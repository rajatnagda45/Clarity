from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.embeddings.base import EmbeddingProviderRetryableError
from services.embeddings.models import EmbeddingBatchResult, EmbeddingTarget, GeneratedEmbedding


def _build_documents_table(row: dict, execute_count: int) -> MagicMock:
    table = MagicMock()
    table.select.return_value = table
    table.eq.return_value = table
    table.is_.return_value = table
    table.limit.return_value = table
    table.update.return_value = table
    table.execute.side_effect = [SimpleNamespace(data=[row])] + [
        SimpleNamespace(data=[{"id": row["id"]}]) for _ in range(execute_count - 1)
    ]
    return table


def _document_row(**overrides):
    row = {
        "id": "doc-1",
        "workspace_id": "ws-1",
        "status": "awaiting_embeddings",
        "embedding_run_id": None,
        "embedding_started_at": None,
        "embedding_completed_at": None,
        "embedding_queued_at": "2026-06-28T12:00:00+00:00",
        "current_embedding_provider": None,
        "current_embedding_model": None,
        "current_embedding_dimension": None,
        "current_embedding_version": None,
        "current_embedding_parser_version": None,
        "current_embedding_chunk_version": None,
        "embedded_chunk_count": 0,
    }
    row.update(overrides)
    return row


def _chunks_table(rows: list[dict], execute_count: int = 2) -> MagicMock:
    table = MagicMock()
    table.select.return_value = table
    table.eq.return_value = table
    table.order.return_value = table
    table.execute.side_effect = [SimpleNamespace(data=rows) for _ in range(execute_count)]
    return table


class FakeProvider:
    def __init__(self, *, fail_times: int = 0) -> None:
        self.target = EmbeddingTarget(
            provider="openai",
            model="text-embedding-3-small",
            dimension=1536,
            version="a5.v1",
            parser_version="a3.v1",
            chunk_version="a4.v1",
        )
        self._fail_times = fail_times

    async def embed(self, items):
        if self._fail_times > 0:
            self._fail_times -= 1
            raise EmbeddingProviderRetryableError("rate limited")

        embeddings = [
            GeneratedEmbedding(
                workspace_id=item.workspace_id,
                document_id=item.document_id,
                chunk_id=item.chunk_id,
                chunk_index=item.chunk_index,
                embedding_provider=self.target.provider,
                embedding_model=self.target.model,
                embedding_dimension=self.target.dimension,
                embedding_version=self.target.version,
                parser_version=self.target.parser_version,
                chunk_version=self.target.chunk_version,
                checksum=item.checksum,
                token_count=item.token_count,
                latency_ms=12,
                retry_count=0,
                estimated_cost_usd=0.00001,
                vector_preview=[0.1, 0.2, 0.3],
                vector=[0.1, 0.2, 0.3],
            )
            for item in items
        ]
        return EmbeddingBatchResult(target=self.target, embeddings=embeddings, batch_latency_ms=12)


@pytest.mark.asyncio
async def test_run_document_embedding_transitions_document_to_embedded():
    from services.embeddings import pipeline as embedding_pipeline

    documents_table = _build_documents_table(_document_row(), execute_count=4)
    chunks_table = _chunks_table(
        [
            {
                "chunk_id": "chk-1",
                "chunk_index": 0,
                "checksum": "sum-1",
                "token_count": 18,
                "text": "Clause text",
            }
        ]
    )
    chunk_embeddings_table = MagicMock()
    chunk_embeddings_table.select.return_value = chunk_embeddings_table
    chunk_embeddings_table.eq.return_value = chunk_embeddings_table
    chunk_embeddings_table.execute.side_effect = [SimpleNamespace(data=[]), SimpleNamespace(data=[])]
    chunk_embeddings_table.insert.return_value = chunk_embeddings_table
    usage_table = MagicMock()
    usage_table.insert.return_value = usage_table
    usage_table.execute.return_value = SimpleNamespace(data=[])

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "documents": documents_table,
        "chunks": chunks_table,
        "chunk_embeddings": chunk_embeddings_table,
        "usage_events": usage_table,
    }[name]

    with patch.object(embedding_pipeline, "get_client", return_value=client_mock), patch.object(
        embedding_pipeline, "get_embedding_provider", return_value=FakeProvider()
    ), patch.object(
        embedding_pipeline, "queue_document_for_indexing", return_value=False
    ), patch.object(
        embedding_pipeline, "run_document_indexing_task", new=AsyncMock()
    ):
        await embedding_pipeline.run_document_embedding("doc-1", "ws-1")

    statuses = [
        call.args[0]["status"]
        for call in documents_table.update.call_args_list
        if "status" in call.args[0]
    ]
    assert statuses == ["embedding", "embedded"]
    chunk_embeddings_table.insert.assert_called_once()
    usage_table.insert.assert_called_once()
    final_payload = documents_table.update.call_args_list[-1].args[0]
    assert final_payload["current_embedding_provider"] == "openai"
    assert final_payload["current_embedding_version"] == "a5.v1"
    assert final_payload["embedded_chunk_count"] == 1


@pytest.mark.asyncio
async def test_run_document_embedding_skips_documents_already_embedded_with_current_rows():
    from services.embeddings import pipeline as embedding_pipeline

    row = _document_row(
        status="embedded",
        current_embedding_provider="openai",
        current_embedding_model="text-embedding-3-small",
        current_embedding_dimension=1536,
        current_embedding_version="a5.v1",
        current_embedding_parser_version="a3.v1",
        current_embedding_chunk_version="a4.v1",
    )
    documents_table = _build_documents_table(row, execute_count=1)
    chunks_table = _chunks_table(
        [{"chunk_id": "chk-1", "chunk_index": 0, "checksum": "sum-1", "token_count": 18, "text": "Clause"}],
        execute_count=1,
    )
    chunk_embeddings_table = MagicMock()
    chunk_embeddings_table.select.return_value = chunk_embeddings_table
    chunk_embeddings_table.eq.return_value = chunk_embeddings_table
    chunk_embeddings_table.execute.return_value = SimpleNamespace(
        data=[{"chunk_id": "chk-1", "checksum": "sum-1"}]
    )
    usage_table = MagicMock()

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "documents": documents_table,
        "chunks": chunks_table,
        "chunk_embeddings": chunk_embeddings_table,
        "usage_events": usage_table,
    }[name]

    with patch.object(embedding_pipeline, "get_client", return_value=client_mock), patch.object(
        embedding_pipeline, "get_embedding_provider", return_value=FakeProvider()
    ), patch.object(
        embedding_pipeline, "queue_document_for_indexing", return_value=False
    ), patch.object(
        embedding_pipeline, "run_document_indexing_task", new=AsyncMock()
    ):
        await embedding_pipeline.run_document_embedding("doc-1", "ws-1")

    usage_table.insert.assert_not_called()
    chunk_embeddings_table.insert.assert_not_called()


@pytest.mark.asyncio
async def test_run_document_embedding_marks_failed_after_retry_exhaustion():
    from services.embeddings import pipeline as embedding_pipeline

    documents_table = _build_documents_table(_document_row(), execute_count=4)
    chunks_table = _chunks_table(
        [{"chunk_id": "chk-1", "chunk_index": 0, "checksum": "sum-1", "token_count": 18, "text": "Clause"}],
        execute_count=1,
    )
    chunk_embeddings_table = MagicMock()
    chunk_embeddings_table.select.return_value = chunk_embeddings_table
    chunk_embeddings_table.eq.return_value = chunk_embeddings_table
    chunk_embeddings_table.execute.return_value = SimpleNamespace(data=[])
    usage_table = MagicMock()

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "documents": documents_table,
        "chunks": chunks_table,
        "chunk_embeddings": chunk_embeddings_table,
        "usage_events": usage_table,
    }[name]

    with patch.object(embedding_pipeline, "get_client", return_value=client_mock), patch.object(
        embedding_pipeline, "get_embedding_provider", return_value=FakeProvider(fail_times=4)
    ), patch.object(embedding_pipeline.settings, "embedding_max_retries", 1), patch.object(
        embedding_pipeline, "_sleep_backoff", new=AsyncMock()
    ), patch.object(
        embedding_pipeline, "queue_document_for_indexing", return_value=False
    ), patch.object(
        embedding_pipeline, "run_document_indexing_task", new=AsyncMock()
    ):
        await embedding_pipeline.run_document_embedding("doc-1", "ws-1")

    assert documents_table.update.call_args_list[-1].args[0]["status"] == "failed"
    assert documents_table.update.call_args_list[-1].args[0]["embedding_retry_count"] == 2


@pytest.mark.asyncio
async def test_run_document_embedding_is_idempotent_when_current_rows_exist():
    from services.embeddings import pipeline as embedding_pipeline

    row = _document_row(
        current_embedding_provider="openai",
        current_embedding_model="text-embedding-3-small",
        current_embedding_dimension=1536,
        current_embedding_version="a5.v1",
        current_embedding_parser_version="a3.v1",
        current_embedding_chunk_version="a4.v1",
    )
    documents_table = _build_documents_table(row, execute_count=4)
    chunks_table = _chunks_table(
        [{"chunk_id": "chk-1", "chunk_index": 0, "checksum": "sum-1", "token_count": 18, "text": "Clause"}],
        execute_count=2,
    )
    chunk_embeddings_table = MagicMock()
    chunk_embeddings_table.select.return_value = chunk_embeddings_table
    chunk_embeddings_table.eq.return_value = chunk_embeddings_table
    chunk_embeddings_table.execute.return_value = SimpleNamespace(
        data=[{"chunk_id": "chk-1", "checksum": "sum-1"}]
    )
    usage_table = MagicMock()
    usage_table.insert.return_value = usage_table
    usage_table.execute.return_value = SimpleNamespace(data=[])

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "documents": documents_table,
        "chunks": chunks_table,
        "chunk_embeddings": chunk_embeddings_table,
        "usage_events": usage_table,
    }[name]

    with patch.object(embedding_pipeline, "get_client", return_value=client_mock), patch.object(
        embedding_pipeline, "get_embedding_provider", return_value=FakeProvider()
    ), patch.object(
        embedding_pipeline, "queue_document_for_indexing", return_value=False
    ), patch.object(
        embedding_pipeline, "run_document_indexing_task", new=AsyncMock()
    ):
        await embedding_pipeline.run_document_embedding("doc-1", "ws-1")

    chunk_embeddings_table.insert.assert_not_called()
    assert documents_table.update.call_args_list[-1].args[0]["status"] == "embedded"


def test_claim_embedding_lease_rejects_concurrent_attempts():
    from services.embeddings import pipeline as embedding_pipeline

    active_row = _document_row(
        embedding_run_id="run-active",
        embedding_started_at="2099-06-28T12:00:00+00:00",
    )

    with patch.object(embedding_pipeline, "_load_document", return_value=active_row):
        with pytest.raises(embedding_pipeline.EmbeddingBusy):
            embedding_pipeline._claim_embedding_lease("doc-1", "ws-1", FakeProvider().target)


def test_stale_embedding_failure_cannot_overwrite_completed_document():
    from services.embeddings import pipeline as embedding_pipeline

    documents_table = MagicMock()
    documents_table.update.return_value = documents_table
    documents_table.eq.return_value = documents_table
    documents_table.execute.return_value = SimpleNamespace(data=[])

    client_mock = MagicMock()
    client_mock.table.return_value = documents_table

    with patch.object(embedding_pipeline, "get_client", return_value=client_mock):
        with pytest.raises(embedding_pipeline.EmbeddingOwnershipLost):
            embedding_pipeline._finalize_document(
                "doc-1",
                "ws-1",
                "run-lost",
                status="failed",
                error="late failure",
            )
