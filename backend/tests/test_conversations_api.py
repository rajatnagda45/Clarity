from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest


def _memberships_query(role: str):
    query = MagicMock()
    query.select.return_value = query
    query.eq.return_value = query
    query.limit.return_value = query
    query.execute.return_value = SimpleNamespace(data=[{"role": role}])
    return query


def _query_with_rows(rows: list[dict]):
    query = MagicMock()
    query.select.return_value = query
    query.eq.return_value = query
    query.in_.return_value = query
    query.order.return_value = query
    query.limit.return_value = query
    query.execute.return_value = SimpleNamespace(data=rows)
    return query


@pytest.mark.asyncio
async def test_get_conversation_restores_verification_metadata(client, token_a, workspace_id_a):
    from api import deps as deps_module
    from api.routers import conversations as conversations_router
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    conversation_rows = _query_with_rows(
        [
            {
                "id": "conv-1",
                "workspace_id": workspace_id_a,
                "title": "Renewal question",
                "created_at": "2026-06-29T10:00:00Z",
                "last_message_at": "2026-06-29T10:00:10Z",
            }
        ]
    )
    message_rows = _query_with_rows(
        [
            {
                "id": "msg-user",
                "workspace_id": workspace_id_a,
                "conversation_id": "conv-1",
                "role": "user",
                "content": "What is the renewal term?",
                "created_at": "2026-06-29T10:00:00Z",
            },
            {
                "id": "msg-assistant",
                "workspace_id": workspace_id_a,
                "conversation_id": "conv-1",
                "role": "assistant",
                "content": "It renews annually.",
                "created_at": "2026-06-29T10:00:10Z",
            },
        ]
    )
    answer_rows = _query_with_rows(
        [
            {
                "id": "answer-1",
                "assistant_message_id": "msg-assistant",
                "retrieval_run_id": "retrieval-1",
                "trust_faithfulness": 1.0,
                "trust_relevance": None,
                "trust_overall": 0.88,
                "trust_confidence": 0.88,
                "trust_calibrated": True,
                "confidence_band": "high",
            }
        ]
    )
    citation_rows = _query_with_rows(
        [
            {
                "message_id": "msg-assistant",
                "citation_key": "E1",
                "document_id": "doc-1",
                "chunk_id": "chunk-1",
                "section_title": "Renewal",
                "clause_number": "9.2",
                "page_start": 4,
                "page_end": 4,
                "checksum": "abc",
                "source_offsets": [{"page": 4, "blockOrder": 0, "charStart": 10, "charEnd": 30}],
            }
        ]
    )
    claim_rows = _query_with_rows(
        [
            {
                "id": "claim-1",
                "answer_run_id": "answer-1",
                "claim_text": "It renews annually.",
                "critic_verdict": "supported",
                "nli_label": "entail",
                "nli_score": 0.93,
                "ensemble_verdict": "supported",
                "evidence_spans": ["The agreement renews annually."],
                "debate_turn": 1,
            }
        ]
    )
    debate_rows = _query_with_rows(
        [
            {
                "answer_run_id": "answer-1",
                "turn_number": 1,
                "claim_text": "It renews annually.",
                "critic_verdict": "supported",
                "reasoning": "Critic and NLI agree on annual renewal.",
            }
        ]
    )
    abstention_rows = _query_with_rows([])
    retrieval_evidence_rows = _query_with_rows(
        [
            {
                "workspace_id": workspace_id_a,
                "retrieval_run_id": "retrieval-1",
                "document_id": "doc-1",
                "chunk_id": "chunk-1",
                "chunk_index": 0,
                "text": "The agreement renews annually.",
                "section_title": "Renewal",
                "clause_number": "9.2",
                "page_start": 4,
                "page_end": 4,
                "chunk_kind": "clause",
                "cross_references": [],
                "vector_score": 0.8,
                "bm25_score": 1.2,
                "rrf_score": 0.05,
                "rerank_score": 0.93,
                "final_score": 0.93,
                "final_rank": 1,
                "retrieval_reason": "Strong semantic and sparse agreement.",
                "retrieval_sources": ["dense"],
                "parser_version": "a3.v1",
                "chunk_version": "a4.v1",
                "embedding_version": "a5.v1",
            }
        ]
    )

    with patch.object(conversations_router, "tenant_query") as tenant_query_mock, patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        tenant_query_mock.side_effect = lambda table, workspace_id: {
            "conversations": conversation_rows,
            "messages": message_rows,
            "answer_runs": answer_rows,
            "message_citations": citation_rows,
            "claims": claim_rows,
            "debate_turns": debate_rows,
            "abstentions": abstention_rows,
            "retrieval_run_evidence": retrieval_evidence_rows,
        }[table]
        response = await client.get(
            "/api/conversations/conv-1",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
        )

    assert response.status_code == 200
    body = response.json()
    assistant = body["messages"][1]
    assert assistant["trust"]["confidenceBand"] == "high"
    assert assistant["claims"][0]["criticVerdict"] == "supported"
    assert assistant["debateTurns"][0]["verdict"] == "supported"
    assert assistant["retrievedEvidence"][0]["finalScore"] == 0.93
