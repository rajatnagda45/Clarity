from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.indexing.base import IndexProviderRetryableError
from services.indexing.models import IndexBatchResult, IndexingTarget


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
        "status": "awaiting_index",
        "index_run_id": None,
        "index_started_at": None,
        "index_completed_at": None,
        "index_queued_at": "2026-06-28T12:00:00+00:00",
        "current_index_provider": None,
        "current_index_name": None,
        "current_index_namespace": None,
        "current_embedding_provider": "openai",
        "current_embedding_model": "text-embedding-3-small",
        "current_embedding_dimension": 1536,
        "current_embedding_version": "a5.v1",
        "current_embedding_parser_version": "a3.v1",
        "current_embedding_chunk_version": "a4.v1",
    }
    row.update(overrides)
    return row


def _chunks_table(rows: list[dict]) -> MagicMock:
    table = MagicMock()
    table.select.return_value = table
    table.eq.return_value = table
    table.order.return_value = table
    table.execute.return_value = SimpleNamespace(data=rows)
    return table


def _chunk_embeddings_table(rows: list[dict]) -> MagicMock:
    table = MagicMock()
    table.select.return_value = table
    table.eq.return_value = table
    table.order.return_value = table
    table.execute.return_value = SimpleNamespace(data=rows)
    return table


class FakeIndexProvider:
    def __init__(self, *, fail_times: int = 0) -> None:
        self.target = IndexingTarget(
            provider="pinecone",
            index_name="clarity",
            namespace="ws_ws-1",
            embedding_provider="openai",
            embedding_model="text-embedding-3-small",
            embedding_dimension=1536,
            embedding_version="a5.v1",
            parser_version="a3.v1",
            chunk_version="a4.v1",
        )
        self._fail_times = fail_times

    @property
    def provider_name(self) -> str:
        return "pinecone"

    async def upsert(self, target, records):
        if self._fail_times > 0:
            self._fail_times -= 1
            raise IndexProviderRetryableError("rate limited")
        return IndexBatchResult(target=target, vector_ids=[record.vector_id for record in records], batch_latency_ms=9)

    async def delete(self, target, vector_ids):
        return len(vector_ids)


@pytest.mark.asyncio
async def test_run_document_indexing_transitions_document_to_indexed():
    from services.indexing import pipeline as index_pipeline

    documents_table = _build_documents_table(_document_row(), execute_count=4)
    chunks_table = _chunks_table(
        [
            {
                "chunk_id": "chk-1",
                "chunk_index": 0,
                "section_title": "Confidentiality",
                "clause_number": "1",
                "page_start": 1,
                "page_end": 1,
                "checksum": "sum-1",
                "text": "Clause text",
            }
        ]
    )
    embeddings_table = _chunk_embeddings_table(
        [
            {
                "chunk_id": "chk-1",
                "chunk_index": 0,
                "checksum": "sum-1",
                "embedding_provider": "openai",
                "embedding_model": "text-embedding-3-small",
                "embedding_dimension": 1536,
                "embedding_version": "a5.v1",
                "parser_version": "a3.v1",
                "chunk_version": "a4.v1",
                "vector": [0.1, 0.2, 0.3],
            }
        ]
    )
    index_rows_table = MagicMock()
    index_rows_table.select.return_value = index_rows_table
    index_rows_table.eq.return_value = index_rows_table
    index_rows_table.execute.return_value = SimpleNamespace(data=[])
    index_rows_table.upsert.return_value = index_rows_table
    usage_table = MagicMock()
    usage_table.insert.return_value = usage_table
    usage_table.execute.return_value = SimpleNamespace(data=[])

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "documents": documents_table,
        "chunks": chunks_table,
        "chunk_embeddings": embeddings_table,
        "chunk_vector_index_records": index_rows_table,
        "usage_events": usage_table,
    }[name]

    with patch.object(index_pipeline, "get_client", return_value=client_mock), patch.object(
        index_pipeline, "get_index_provider", return_value=FakeIndexProvider()
    ):
        await index_pipeline.run_document_indexing("doc-1", "ws-1")

    statuses = [
        call.args[0]["status"]
        for call in documents_table.update.call_args_list
        if "status" in call.args[0]
    ]
    assert statuses == ["indexing", "indexed"]
    index_rows_table.upsert.assert_called_once()
    usage_table.insert.assert_called_once()
    final_payload = documents_table.update.call_args_list[-1].args[0]
    assert final_payload["current_index_provider"] == "pinecone"
    assert final_payload["current_index_name"] == "clarity"
    assert final_payload["indexed_chunk_count"] == 1


@pytest.mark.asyncio
async def test_run_document_indexing_skips_documents_already_indexed_with_current_rows():
    from services.indexing import pipeline as index_pipeline

    row = _document_row(
        status="indexed",
        current_index_provider="pinecone",
        current_index_name="clarity",
        current_index_namespace="ws_ws-1",
    )
    documents_table = _build_documents_table(row, execute_count=1)
    chunks_table = _chunks_table(
        [
            {
                "chunk_id": "chk-1",
                "chunk_index": 0,
                "section_title": "Confidentiality",
                "clause_number": "1",
                "page_start": 1,
                "page_end": 1,
                "checksum": "sum-1",
                "text": "Clause text",
            }
        ]
    )
    embeddings_table = _chunk_embeddings_table(
        [
            {
                "chunk_id": "chk-1",
                "chunk_index": 0,
                "checksum": "sum-1",
                "embedding_provider": "openai",
                "embedding_model": "text-embedding-3-small",
                "embedding_dimension": 1536,
                "embedding_version": "a5.v1",
                "parser_version": "a3.v1",
                "chunk_version": "a4.v1",
                "vector": [0.1, 0.2, 0.3],
            }
        ]
    )
    index_rows_table = MagicMock()
    index_rows_table.select.return_value = index_rows_table
    index_rows_table.eq.return_value = index_rows_table
    index_rows_table.execute.return_value = SimpleNamespace(
        data=[{"vector_id": "vec_123", "status": "indexed"}]
    )
    usage_table = MagicMock()

    with patch.object(index_pipeline, "_build_vector_id", return_value="vec_123"), patch.object(
        index_pipeline, "get_client"
    ) as get_client_mock, patch.object(
        index_pipeline, "get_index_provider", return_value=FakeIndexProvider()
    ):
        client_mock = MagicMock()
        client_mock.table.side_effect = lambda name: {
            "documents": documents_table,
            "chunks": chunks_table,
            "chunk_embeddings": embeddings_table,
            "chunk_vector_index_records": index_rows_table,
            "usage_events": usage_table,
        }[name]
        get_client_mock.return_value = client_mock

        await index_pipeline.run_document_indexing("doc-1", "ws-1")

    usage_table.insert.assert_not_called()
    index_rows_table.upsert.assert_not_called()


@pytest.mark.asyncio
async def test_run_document_indexing_marks_failed_after_retry_exhaustion():
    from services.indexing import pipeline as index_pipeline

    documents_table = _build_documents_table(_document_row(), execute_count=4)
    chunks_table = _chunks_table(
        [
            {
                "chunk_id": "chk-1",
                "chunk_index": 0,
                "section_title": "Confidentiality",
                "clause_number": "1",
                "page_start": 1,
                "page_end": 1,
                "checksum": "sum-1",
                "text": "Clause text",
            }
        ]
    )
    embeddings_table = _chunk_embeddings_table(
        [
            {
                "chunk_id": "chk-1",
                "chunk_index": 0,
                "checksum": "sum-1",
                "embedding_provider": "openai",
                "embedding_model": "text-embedding-3-small",
                "embedding_dimension": 1536,
                "embedding_version": "a5.v1",
                "parser_version": "a3.v1",
                "chunk_version": "a4.v1",
                "vector": [0.1, 0.2, 0.3],
            }
        ]
    )
    index_rows_table = MagicMock()
    index_rows_table.select.return_value = index_rows_table
    index_rows_table.eq.return_value = index_rows_table
    index_rows_table.execute.return_value = SimpleNamespace(data=[])
    usage_table = MagicMock()

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "documents": documents_table,
        "chunks": chunks_table,
        "chunk_embeddings": embeddings_table,
        "chunk_vector_index_records": index_rows_table,
        "usage_events": usage_table,
    }[name]

    with patch.object(index_pipeline, "get_client", return_value=client_mock), patch.object(
        index_pipeline, "get_index_provider", return_value=FakeIndexProvider(fail_times=4)
    ), patch.object(index_pipeline.settings, "index_max_retries", 1), patch.object(
        index_pipeline, "_sleep_backoff", new=AsyncMock()
    ):
        await index_pipeline.run_document_indexing("doc-1", "ws-1")

    assert documents_table.update.call_args_list[-1].args[0]["status"] == "failed"
    assert documents_table.update.call_args_list[-1].args[0]["index_retry_count"] == 2


def test_queue_document_for_indexing_skips_when_current_index_exists():
    from services.indexing import pipeline as index_pipeline

    row = _document_row(
        status="indexed",
        current_index_provider="pinecone",
        current_index_name="clarity",
        current_index_namespace="ws_ws-1",
    )
    with patch.object(index_pipeline, "_load_document", return_value=row), patch.object(
        index_pipeline, "_document_has_current_index", return_value=True
    ):
        assert index_pipeline.queue_document_for_indexing("doc-1", "ws-1") is False
