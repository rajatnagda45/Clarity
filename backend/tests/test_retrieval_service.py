from __future__ import annotations

import asyncio
from unittest.mock import patch

import pytest

from services.retrieval.models import DenseCandidate, RetrievalFilters, RetrievalRequest
from services.retrieval.cache import RetrievalCache


def _document_row(document_id: str = "doc-1") -> dict:
    return {
        "id": document_id,
        "current_embedding_version": "a5.v1",
        "current_index_provider": "pinecone",
        "current_index_name": "clarity",
        "index_completed_at": "2026-06-28T12:00:00Z",
    }


def _chunk_row(
    chunk_id: str,
    *,
    document_id: str = "doc-1",
    chunk_index: int = 0,
    clause_number: str | None = None,
    cross_references: list[str] | None = None,
    text: str | None = None,
) -> dict:
    return {
        "workspace_id": "ws-1",
        "document_id": document_id,
        "chunk_id": chunk_id,
        "chunk_index": chunk_index,
        "text": text or f"Termination notice period clause for {chunk_id}",
        "section_title": "Termination",
        "clause_number": clause_number,
        "page_start": 1,
        "page_end": 1,
        "chunk_kind": "clause",
        "cross_references": cross_references or [],
        "parser_version": "a3.v1",
        "chunk_version": "a4.v1",
    }


class FakeQueryEmbedder:
    async def embed(self, query: str) -> list[float]:
        return [0.1, 0.2, 0.3]


class FakeVectorProvider:
    def __init__(self, *, fail: bool = False) -> None:
        self._fail = fail

    async def search(self, *, workspace_id: str, vector: list[float], top_k: int, document_ids: list[str]):
        if self._fail:
            raise ValueError("dense failed")
        return [
            DenseCandidate(vectorId="vec-1", chunkId="chk-1", documentId="doc-1", score=0.91, rank=1),
            DenseCandidate(vectorId="vec-2", chunkId="chk-2", documentId="doc-1", score=0.75, rank=2),
        ]


class FakeReranker:
    async def rerank(self, query: str, rows: list[dict], *, top_n: int):
        from services.retrieval.reranker import RerankResult

        return [
            RerankResult(chunk_id=rows[1]["chunk_id"], score=0.99),
            RerankResult(chunk_id=rows[0]["chunk_id"], score=0.80),
        ][:top_n]


@pytest.mark.asyncio
async def test_retrieve_evidence_returns_deterministic_hybrid_results():
    from services.retrieval import service as retrieval_service

    chunks = {
        "chk-1": retrieval_service.ChunkRow(row=_chunk_row("chk-1", chunk_index=0, clause_number="1.1"), embedding_version="a5.v1"),
        "chk-2": retrieval_service.ChunkRow(row=_chunk_row("chk-2", chunk_index=1, clause_number="1.2"), embedding_version="a5.v1"),
    }

    with patch.object(retrieval_service, "_load_current_documents", return_value=[_document_row()]), patch.object(
        retrieval_service, "_load_current_chunks", return_value=chunks
    ), patch.object(
        retrieval_service, "get_query_embedding_provider", return_value=FakeQueryEmbedder()
    ), patch.object(
        retrieval_service, "get_vector_search_provider", return_value=FakeVectorProvider()
    ), patch.object(
        retrieval_service, "get_reranker", return_value=FakeReranker()
    ), patch.object(
        retrieval_service, "get_retrieval_cache", return_value=RetrievalCache()
    ), patch.object(
        retrieval_service, "_record_retrieval_event"
    ):
            response, explorer = await retrieval_service.retrieve_evidence(
                RetrievalRequest(query="termination notice", document_ids=["doc-1"]),
                "ws-1",
            )

    assert response.retrieval_mode == "hybrid"
    assert len(response.results) >= 2
    assert response.results[0].chunk_id == "chk-2"
    assert response.results[0].rerank_score == 0.99
    assert response.results[0].retrieval_sources == ["dense", "sparse"]
    assert explorer.dense_candidates[0].chunk_id == "chk-1"
    assert explorer.sparse_candidates[0].chunk_id in {"chk-1", "chk-2"}


@pytest.mark.asyncio
async def test_retrieve_evidence_applies_metadata_filters():
    from services.retrieval import service as retrieval_service

    filtered_chunks = {
        "chk-2": retrieval_service.ChunkRow(
            row=_chunk_row("chk-2", chunk_index=1, clause_number="9.2"),
            embedding_version="a5.v1",
        )
    }

    with patch.object(retrieval_service, "_load_current_documents", return_value=[_document_row()]), patch.object(
        retrieval_service, "_load_current_chunks", return_value=filtered_chunks
    ), patch.object(
        retrieval_service, "get_query_embedding_provider", return_value=FakeQueryEmbedder()
    ), patch.object(
        retrieval_service, "get_vector_search_provider", return_value=FakeVectorProvider()
    ), patch.object(
        retrieval_service, "get_reranker", return_value=FakeReranker()
    ), patch.object(
        retrieval_service, "get_retrieval_cache", return_value=RetrievalCache()
    ), patch.object(
        retrieval_service, "_record_retrieval_event"
    ):
        response, _ = await retrieval_service.retrieve_evidence(
            RetrievalRequest(
                query="section 9.2 termination",
                filters=RetrievalFilters(clauseNumber="9.2"),
            ),
            "ws-1",
        )

    assert [row.chunk_id for row in response.results] == ["chk-2"]


@pytest.mark.asyncio
async def test_retrieve_evidence_expands_cross_references():
    from services.retrieval import service as retrieval_service

    chunks = {
        "chk-1": retrieval_service.ChunkRow(
            row=_chunk_row("chk-1", clause_number="1.1", cross_references=["Section 9.2"], text="Termination rights refer to Section 9.2."),
            embedding_version="a5.v1",
        ),
        "chk-2": retrieval_service.ChunkRow(
            row=_chunk_row("chk-2", chunk_index=1, clause_number="9.2", text="Renewal obligations and notice mechanics."),
            embedding_version="a5.v1",
        ),
    }

    class DenseOnlyVectorProvider(FakeVectorProvider):
        async def search(self, *, workspace_id: str, vector: list[float], top_k: int, document_ids: list[str]):
            return [DenseCandidate(vectorId="vec-1", chunkId="chk-1", documentId="doc-1", score=0.91, rank=1)]

    with patch.object(retrieval_service, "_load_current_documents", return_value=[_document_row()]), patch.object(
        retrieval_service, "_load_current_chunks", return_value=chunks
    ), patch.object(
        retrieval_service, "get_query_embedding_provider", return_value=FakeQueryEmbedder()
    ), patch.object(
        retrieval_service, "get_vector_search_provider", return_value=DenseOnlyVectorProvider()
    ), patch.object(
        retrieval_service, "get_reranker", return_value=FakeReranker()
    ), patch.object(
        retrieval_service, "get_retrieval_cache", return_value=RetrievalCache()
    ), patch.object(
        retrieval_service, "_record_retrieval_event"
    ):
        response, _ = await retrieval_service.retrieve_evidence(
            RetrievalRequest(query="termination"),
            "ws-1",
        )

    assert any(row.chunk_id == "chk-2" for row in response.results)
    expanded = next(row for row in response.results if row.chunk_id == "chk-2")
    assert expanded.retrieval_sources == ["cross_reference"]


@pytest.mark.asyncio
async def test_retrieve_evidence_falls_back_to_sparse_when_dense_fails():
    from services.retrieval import service as retrieval_service

    chunks = {
        "chk-1": retrieval_service.ChunkRow(row=_chunk_row("chk-1"), embedding_version="a5.v1"),
    }

    with patch.object(retrieval_service, "_load_current_documents", return_value=[_document_row()]), patch.object(
        retrieval_service, "_load_current_chunks", return_value=chunks
    ), patch.object(
        retrieval_service, "get_query_embedding_provider", return_value=FakeQueryEmbedder()
    ), patch.object(
        retrieval_service, "get_vector_search_provider", return_value=FakeVectorProvider(fail=True)
    ), patch.object(
        retrieval_service, "get_reranker", return_value=FakeReranker()
    ), patch.object(
        retrieval_service, "get_retrieval_cache", return_value=RetrievalCache()
    ), patch.object(
        retrieval_service, "_record_retrieval_event"
        ):
            response, _ = await retrieval_service.retrieve_evidence(
            RetrievalRequest(query="termination notice period"),
                "ws-1",
            )

    assert response.results
    assert response.results[0].retrieval_sources == ["sparse"]


@pytest.mark.asyncio
async def test_retrieve_evidence_is_concurrency_safe():
    from services.retrieval import service as retrieval_service

    chunks = {
        "chk-1": retrieval_service.ChunkRow(row=_chunk_row("chk-1"), embedding_version="a5.v1"),
        "chk-2": retrieval_service.ChunkRow(row=_chunk_row("chk-2", chunk_index=1), embedding_version="a5.v1"),
    }

    with patch.object(retrieval_service, "_load_current_documents", return_value=[_document_row()]), patch.object(
        retrieval_service, "_load_current_chunks", return_value=chunks
    ), patch.object(
        retrieval_service, "get_query_embedding_provider", return_value=FakeQueryEmbedder()
    ), patch.object(
        retrieval_service, "get_vector_search_provider", return_value=FakeVectorProvider()
    ), patch.object(
        retrieval_service, "get_reranker", return_value=FakeReranker()
    ), patch.object(
        retrieval_service, "get_retrieval_cache", return_value=RetrievalCache()
    ), patch.object(
        retrieval_service, "_record_retrieval_event"
    ):
        results = await asyncio.gather(
            retrieval_service.retrieve_evidence(RetrievalRequest(query="termination notice"), "ws-1"),
            retrieval_service.retrieve_evidence(RetrievalRequest(query="termination notice"), "ws-1"),
        )

    first = results[0][0].results
    second = results[1][0].results
    assert [row.chunk_id for row in first] == [row.chunk_id for row in second]
