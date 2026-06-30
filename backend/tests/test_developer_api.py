from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _memberships_query(role: str | None):
    query = MagicMock()
    query.select.return_value = query
    query.eq.return_value = query
    query.limit.return_value = query
    query.execute.return_value = SimpleNamespace(data=[{"role": role}] if role else [])
    return query


@pytest.mark.asyncio
async def test_embedding_metrics_returns_developer_summary(client, token_a, workspace_id_a):
    from api.routers import developer as developer_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    documents_query = MagicMock()
    documents_query.select.return_value = documents_query
    documents_query.eq.return_value = documents_query
    documents_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "id": "doc-1",
                "status": "embedded",
                "embedded_chunk_count": 2,
                "embedding_started_at": "2026-06-28T12:00:00Z",
                "embedding_completed_at": "2026-06-28T12:00:02Z",
                "embedding_queued_at": "2026-06-28T11:59:58Z",
                "current_embedding_provider": "openai",
                "current_embedding_model": "text-embedding-3-small",
                "current_embedding_dimension": 1536,
                "current_embedding_version": "a5.v1",
                "current_embedding_parser_version": "a3.v1",
                "current_embedding_chunk_version": "a4.v1",
            }
        ]
    )
    embeddings_query = MagicMock()
    embeddings_query.select.return_value = embeddings_query
    embeddings_query.eq.return_value = embeddings_query
    embeddings_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "document_id": "doc-1",
                "chunk_id": "chk-1",
                "embedding_provider": "openai",
                "embedding_model": "text-embedding-3-small",
                "embedding_dimension": 1536,
                "embedding_version": "a5.v1",
                "parser_version": "a3.v1",
                "chunk_version": "a4.v1",
                "token_count": 40,
                "latency_ms": 10,
                "retry_count": 1,
                "estimated_cost_usd": 0.00001,
            },
            {
                "document_id": "doc-1",
                "chunk_id": "chk-2",
                "embedding_provider": "openai",
                "embedding_model": "text-embedding-3-small",
                "embedding_dimension": 1536,
                "embedding_version": "a5.v1",
                "parser_version": "a3.v1",
                "chunk_version": "a4.v1",
                "token_count": 60,
                "latency_ms": 20,
                "retry_count": 0,
                "estimated_cost_usd": 0.00002,
            },
        ]
    )

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "documents": documents_query,
        "chunk_embeddings": embeddings_query,
    }[name]

    with patch.object(developer_router, "tenant_query") as tenant_query_mock, patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        tenant_query_mock.side_effect = lambda table, workspace_id: {
            "documents": documents_query,
            "chunk_embeddings": embeddings_query,
        }[table]
        response = await client.get(
            "/api/developer/metrics/embeddings",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["documentsProcessed"] == 1
    assert body["chunksProcessed"] == 2
    assert body["providerUsageCounts"]["openai"] == 2


@pytest.mark.asyncio
async def test_embedding_metrics_requires_developer_access(client, workspace_id_a):
    from api.routers import developer as developer_router
    from api import deps as deps_module
    from db import client as db_client
    from tests.conftest import _make_jwt

    client_mock = MagicMock()
    client_mock.table.return_value = _memberships_query("viewer")
    token = _make_jwt([workspace_id_a], user_id="user_non_developer")

    with patch.object(developer_router, "tenant_query"), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        response = await client.get(
            "/api/developer/metrics/embeddings",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Workspace-Id": workspace_id_a,
            },
        )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "developer_access_required"


@pytest.mark.asyncio
async def test_index_metrics_returns_developer_summary(client, token_a, workspace_id_a):
    from api.routers import developer as developer_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    documents_query = MagicMock()
    documents_query.select.return_value = documents_query
    documents_query.eq.return_value = documents_query
    documents_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "id": "doc-1",
                "status": "indexed",
                "embedding_completed_at": "2026-06-28T12:00:01Z",
                "index_started_at": "2026-06-28T12:00:02Z",
                "index_completed_at": "2026-06-28T12:00:03Z",
                "current_embedding_provider": "openai",
                "current_embedding_model": "text-embedding-3-small",
                "current_embedding_dimension": 1536,
                "current_embedding_version": "a5.v1",
                "current_embedding_parser_version": "a3.v1",
                "current_embedding_chunk_version": "a4.v1",
                "current_index_provider": "pinecone",
                "current_index_name": "clarity",
                "current_index_namespace": workspace_id_a.replace(workspace_id_a, f"ws_{workspace_id_a}"),
            }
        ]
    )
    index_rows_query = MagicMock()
    index_rows_query.select.return_value = index_rows_query
    index_rows_query.eq.return_value = index_rows_query
    index_rows_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "document_id": "doc-1",
                "chunk_id": "chk-1",
                "index_provider": "pinecone",
                "index_name": "clarity",
                "namespace": f"ws_{workspace_id_a}",
                "vector_id": "vec-1",
                "embedding_provider": "openai",
                "embedding_model": "text-embedding-3-small",
                "embedding_dimension": 1536,
                "embedding_version": "a5.v1",
                "parser_version": "a3.v1",
                "chunk_version": "a4.v1",
                "status": "indexed",
                "latency_ms": 12,
                "retry_count": 1,
            }
        ]
    )

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "documents": documents_query,
        "chunk_vector_index_records": index_rows_query,
    }[name]

    with patch.object(developer_router, "tenant_query") as tenant_query_mock, patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        tenant_query_mock.side_effect = lambda table, workspace_id: {
            "documents": documents_query,
            "chunk_vector_index_records": index_rows_query,
        }[table]
        response = await client.get(
            "/api/developer/metrics/indexing",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["vectorsIndexed"] == 1
    assert body["namespaceCounts"][f"ws_{workspace_id_a}"] == 1


@pytest.mark.asyncio
async def test_developer_dashboard_returns_documents_and_failed_jobs(client, token_a, workspace_id_a):
    from api.routers import developer as developer_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    documents_query = MagicMock()
    documents_query.select.return_value = documents_query
    documents_query.eq.return_value = documents_query
    documents_query.order.return_value = documents_query
    documents_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "id": "doc-1",
                "filename": "msa.pdf",
                "status": "indexed",
                "source_type": "pdf",
                "created_at": "2026-06-28T12:00:00Z",
                "error": None,
                "embedding_queued_at": None,
                "embedding_started_at": None,
                "embedding_completed_at": None,
                "index_queued_at": "2026-06-28T12:00:01Z",
                "index_started_at": "2026-06-28T12:00:02Z",
                "index_completed_at": "2026-06-28T12:00:03Z",
            },
            {
                "id": "doc-2",
                "filename": "broken.pdf",
                "status": "failed",
                "source_type": "pdf",
                "created_at": "2026-06-28T13:00:00Z",
                "error": "index failed",
                "embedding_queued_at": None,
                "embedding_started_at": None,
                "embedding_completed_at": None,
                "index_queued_at": "2026-06-28T13:00:01Z",
                "index_started_at": "2026-06-28T13:00:02Z",
                "index_completed_at": None,
            },
        ]
    )

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "documents": documents_query,
    }[name]

    with patch.object(developer_router, "tenant_query", return_value=documents_query), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        response = await client.get(
            "/api/developer/dashboard",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["statusCounts"]["indexed"] == 1
    assert body["statusCounts"]["failed"] == 1
    assert len(body["failedJobs"]) == 1


@pytest.mark.asyncio
async def test_retrieval_metrics_returns_developer_summary(client, token_a, workspace_id_a):
    from api.routers import developer as developer_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    retrieval_query = MagicMock()
    retrieval_query.select.return_value = retrieval_query
    retrieval_query.eq.return_value = retrieval_query
    retrieval_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "total_latency_ms": 120,
                "final_result_count": 5,
                "dense_candidate_count": 10,
                "sparse_candidate_count": 10,
                "dense_contributed_count": 4,
                "sparse_contributed_count": 3,
                "fusion_latency_ms": 8,
                "filter_count": 1,
                "cache_hit": True,
                "failed": False,
            }
        ]
    )

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "retrieval_events": retrieval_query,
    }[name]

    with patch.object(developer_router, "tenant_query", return_value=retrieval_query), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        response = await client.get(
            "/api/developer/metrics/retrieval",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["queryVolume"] == 1
    assert body["retrievalCacheHits"] == 1


@pytest.mark.asyncio
async def test_retrieval_explorer_returns_debug_payload(client, token_a, workspace_id_a):
    from api.routers import developer as developer_router
    from api import deps as deps_module
    from db import client as db_client
    from services.retrieval.models import RetrievalEvidence, RetrievalExplorerResponse

    memberships_table = _memberships_query("viewer")
    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
    }[name]

    explorer_response = RetrievalExplorerResponse(
        normalizedQuery={
            "rawQuery": "termination notice",
            "normalizedQuery": "termination notice",
            "tokens": ["termination", "notice"],
            "clauseRefs": [],
            "quotedPhrases": [],
        },
        cacheHit=False,
        denseCandidates=[{"chunkId": "chk-1", "documentId": "doc-1", "rank": 1, "score": 0.9, "reason": "dense"}],
        sparseCandidates=[{"chunkId": "chk-1", "documentId": "doc-1", "rank": 1, "score": 3.2, "reason": "sparse"}],
        fusedCandidates=[{"chunkId": "chk-1", "documentId": "doc-1", "rank": 1, "score": 0.03, "reason": "hybrid"}],
        results=[
            RetrievalEvidence(
                workspaceId=workspace_id_a,
                documentId="doc-1",
                chunkId="chk-1",
                chunkIndex=0,
                text="Termination clause text",
                sectionTitle="Termination",
                clauseNumber="1.1",
                pageStart=1,
                pageEnd=1,
                chunkKind="clause",
                crossReferences=[],
                vectorScore=0.9,
                bm25Score=3.2,
                rrfScore=0.03,
                finalScore=0.03,
                finalRank=1,
                retrievalReason="Strong lexical and semantic agreement.",
                retrievalSources=["dense", "sparse"],
                parserVersion="a3.v1",
                chunkVersion="a4.v1",
                embeddingVersion="a5.v1",
            )
        ],
        denseLatencyMs=10,
        sparseLatencyMs=11,
        fusionLatencyMs=4,
        totalLatencyMs=25,
    )

    with patch.object(deps_module, "get_client", return_value=client_mock), patch.object(
        db_client, "get_client", return_value=client_mock
    ), patch.object(
        developer_router, "retrieve_evidence", new=AsyncMock(return_value=(None, explorer_response))
    ):
        response = await client.post(
            "/api/developer/retrieval/explore",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
            json={"query": "termination notice"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["denseCandidates"][0]["chunkId"] == "chk-1"
    assert body["results"][0]["finalRank"] == 1


@pytest.mark.asyncio
async def test_answer_metrics_and_explorer_return_developer_summary(client, token_a, workspace_id_a):
    from api.routers import developer as developer_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    conversations_query = MagicMock()
    conversations_query.select.return_value = conversations_query
    conversations_query.eq.return_value = conversations_query
    conversations_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "id": "conv-1",
                "workspace_id": workspace_id_a,
                "title": "Renewal",
                "created_at": "2026-06-29T10:00:00Z",
                "last_message_at": "2026-06-29T10:00:10Z",
            }
        ]
    )
    messages_query = MagicMock()
    messages_query.select.return_value = messages_query
    messages_query.eq.return_value = messages_query
    messages_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "id": "msg-user",
                "conversation_id": "conv-1",
                "role": "user",
                "content": "What is the renewal term?",
                "created_at": "2026-06-29T10:00:00Z",
            },
            {
                "id": "msg-assistant",
                "conversation_id": "conv-1",
                "role": "assistant",
                "content": "It renews annually.",
                "created_at": "2026-06-29T10:00:10Z",
            },
        ]
    )
    answer_runs_query = MagicMock()
    answer_runs_query.select.return_value = answer_runs_query
    answer_runs_query.eq.return_value = answer_runs_query
    answer_runs_query.order.return_value = answer_runs_query
    answer_runs_query.limit.return_value = answer_runs_query
    answer_runs_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "id": "answer-1",
                "conversation_id": "conv-1",
                "retrieval_run_id": "retrieval-1",
                "user_message_id": "msg-user",
                "assistant_message_id": "msg-assistant",
                "provider": "openai",
                "model": "gpt-4o-mini",
                "prompt_version": "a8.writer.v1",
                "writer_version": "a8.writer.v1",
                "status": "completed",
                "prompt_tokens": 100,
                "completion_tokens": 50,
                "total_tokens": 150,
                "estimated_cost_usd": 0.0003,
                "latency_ms": 200,
                "first_token_latency_ms": 200,
                "citation_count": 1,
                "evidence_chunk_count": 2,
                "retry_count": 0,
                "created_at": "2026-06-29T10:00:00Z",
                "completed_at": "2026-06-29T10:00:01Z",
                "prompt_payload": {"systemPrompt": "prompt"},
                "answer_markdown": "It renews annually.",
                "trust_faithfulness": 1.0,
                "trust_relevance": None,
                "trust_overall": 0.88,
                "trust_confidence": 0.88,
                "trust_calibrated": True,
                "confidence_band": "high",
            }
        ]
    )
    retrieval_runs_query = MagicMock()
    retrieval_runs_query.select.return_value = retrieval_runs_query
    retrieval_runs_query.eq.return_value = retrieval_runs_query
    retrieval_runs_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "id": "retrieval-1",
                "query": "What is the renewal term?",
                "normalized_query": "what is the renewal term",
            }
        ]
    )
    evidence_query = MagicMock()
    evidence_query.select.return_value = evidence_query
    evidence_query.eq.return_value = evidence_query
    evidence_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "retrieval_run_id": "retrieval-1",
                "document_id": "doc-1",
                "chunk_id": "chunk-1",
                "chunk_index": 0,
                "text": "Renews annually.",
                "section_title": "Renewal",
                "clause_number": "9.2",
                "page_start": 4,
                "page_end": 4,
                "retrieval_reason": "Semantic vector match.",
                "retrieval_sources": ["dense"],
                "vector_score": 0.8,
                "bm25_score": 1.2,
                "rrf_score": 0.05,
                "final_score": 0.05,
                "final_rank": 1,
                "parser_version": "a3.v1",
                "chunk_version": "a4.v1",
                "embedding_version": "a5.v1",
            }
        ]
    )
    citations_query = MagicMock()
    citations_query.select.return_value = citations_query
    citations_query.eq.return_value = citations_query
    citations_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "answer_run_id": "answer-1",
                "citation_key": "E1",
                "document_id": "doc-1",
                "chunk_id": "chunk-1",
                "section_title": "Renewal",
                "clause_number": "9.2",
                "page_start": 4,
                "page_end": 4,
                "checksum": "abc",
                "source_offsets": [],
            }
        ]
    )
    events_query = MagicMock()
    events_query.select.return_value = events_query
    events_query.eq.return_value = events_query
    events_query.execute.return_value = SimpleNamespace(
        data=[
            {"answer_run_id": "answer-1", "sequence_number": 1, "payload": {"type": "meta"}},
            {"answer_run_id": "answer-1", "sequence_number": 2, "payload": {"type": "done"}},
        ]
    )
    claims_query = MagicMock()
    claims_query.select.return_value = claims_query
    claims_query.eq.return_value = claims_query
    claims_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "id": "claim-1",
                "answer_run_id": "answer-1",
                "claim_text": "It renews annually.",
                "critic_verdict": "supported",
                "nli_label": "entail",
                "nli_score": 0.92,
                "ensemble_verdict": "supported",
                "evidence_spans": ["Renews annually."],
                "debate_turn": 1,
                "claim_index": 0,
            }
        ]
    )
    debate_query = MagicMock()
    debate_query.select.return_value = debate_query
    debate_query.eq.return_value = debate_query
    debate_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "answer_run_id": "answer-1",
                "turn_number": 1,
                "claim_text": "It renews annually.",
                "critic_verdict": "supported",
                "reasoning": "Critic and NLI agree.",
            }
        ]
    )
    abstentions_query = MagicMock()
    abstentions_query.select.return_value = abstentions_query
    abstentions_query.eq.return_value = abstentions_query
    abstentions_query.execute.return_value = SimpleNamespace(data=[])

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {"memberships": memberships_table}[name]

    with patch.object(developer_router, "tenant_query") as tenant_query_mock, patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        tenant_query_mock.side_effect = lambda table, workspace_id: {
            "answer_runs": answer_runs_query,
            "messages": messages_query,
            "conversations": conversations_query,
            "retrieval_runs": retrieval_runs_query,
            "retrieval_run_evidence": evidence_query,
            "message_citations": citations_query,
            "answer_stream_events": events_query,
            "claims": claims_query,
            "debate_turns": debate_query,
            "abstentions": abstentions_query,
        }[table]

        metrics_response = await client.get(
            "/api/developer/metrics/answers",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
        )
        explorer_response = await client.get(
            "/api/developer/answers",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
        )

    assert metrics_response.status_code == 200
    assert metrics_response.json()["totalTokens"] == 150

    assert explorer_response.status_code == 200
    explorer_body = explorer_response.json()
    assert explorer_body["runs"][0]["answerRunId"] == "answer-1"
    assert explorer_body["runs"][0]["citations"][0]["citationKey"] == "E1"
    assert explorer_body["runs"][0]["claims"][0]["criticVerdict"] == "supported"
    assert explorer_body["runs"][0]["trust"]["confidenceBand"] == "high"
