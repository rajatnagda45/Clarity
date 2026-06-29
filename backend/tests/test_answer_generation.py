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


def _query_with_rows(rows: list[dict]):
    query = MagicMock()
    query.select.return_value = query
    query.eq.return_value = query
    query.in_.return_value = query
    query.order.return_value = query
    query.limit.return_value = query
    query.execute.return_value = SimpleNamespace(data=rows)
    return query


def _mutating_table():
    table = MagicMock()
    table.insert.return_value = table
    table.update.return_value = table
    table.eq.return_value = table
    table.execute.return_value = SimpleNamespace(data=[])
    return table


@pytest.mark.asyncio
async def test_chat_stream_returns_sse_events(client, token_a, workspace_id_a):
    from api.routers import chat as chat_router
    from api import deps as deps_module
    from db import client as db_client
    from services.answer_generation.models import PreparedAnswerStream

    client_mock = MagicMock()
    client_mock.table.return_value = _memberships_query("viewer")

    prepared = PreparedAnswerStream(
        conversation_id="conv-1",
        user_message_id="msg-user",
        assistant_message_id="msg-assistant",
        retrieval_run_id="retrieval-1",
        answer_run_id="answer-1",
        events=[
            {
                "type": "meta",
                "conversationId": "conv-1",
                "userMessageId": "msg-user",
                "assistantMessageId": "msg-assistant",
                "retrievalRunId": "retrieval-1",
                "answerRunId": "answer-1",
            },
            {"type": "token", "text": "Hello"},
            {"type": "done"},
        ],
    )

    with patch.object(deps_module, "get_client", return_value=client_mock), patch.object(
        db_client, "get_client", return_value=client_mock
    ), patch.object(chat_router, "build_answer_stream", new=AsyncMock(return_value=prepared)):
        response = await client.post(
            "/api/chat",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
            json={"query": "hello", "requestId": "req-1"},
        )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert '"type": "meta"' in response.text
    assert '"type": "done"' in response.text


@pytest.mark.asyncio
async def test_resume_stream_replays_saved_events(client, token_a, workspace_id_a):
    from api.routers import chat as chat_router
    from api import deps as deps_module
    from db import client as db_client

    client_mock = MagicMock()
    client_mock.table.return_value = _memberships_query("viewer")

    async def fake_replay(*args, **kwargs):
        del args, kwargs
        yield 'id: 2\ndata: {"type":"token","text":"resume"}\n\n'
        yield 'id: 3\ndata: {"type":"done"}\n\n'

    with patch.object(deps_module, "get_client", return_value=client_mock), patch.object(
        db_client, "get_client", return_value=client_mock
    ), patch.object(chat_router, "replay_answer_stream", new=fake_replay):
        response = await client.get(
            "/api/chat/conversations/conv-1/answers/answer-1/stream?after=1",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
        )

    assert response.status_code == 200
    assert '"type":"token"' in response.text
    assert '"type":"done"' in response.text


def test_prompt_builder_preserves_evidence_and_history():
    from services.answer_generation.models import ConversationTurn, EvidenceBlock
    from services.answer_generation.prompt_builder import build_prompt

    prompt = build_prompt(
        query="What is the renewal term?",
        evidence=[
            EvidenceBlock(
                citationKey="E1",
                documentId="doc-1",
                chunkId="chunk-1",
                chunkIndex=0,
                sectionTitle="Renewal",
                clauseNumber="9.2",
                pageStart=4,
                pageEnd=4,
                text="The agreement renews for one year unless cancelled.",
                retrievalReason="Semantic vector match.",
                retrievalSources=["dense"],
            )
        ],
        history=[ConversationTurn(role="user", content="Summarize this contract.")],
        prompt_version="a8.writer.v1",
    )

    assert prompt.prompt_version == "a8.writer.v1"
    assert "Renewal" in prompt.evidence_section
    assert "one year unless cancelled" in prompt.evidence_section
    assert "Summarize this contract." in prompt.conversation_context


@pytest.mark.asyncio
async def test_conversation_detail_returns_messages_and_citations(client, token_a, workspace_id_a):
    from api import deps as deps_module
    from api.routers import conversations as conversations_router
    from db import client as db_client

    client_mock = MagicMock()
    client_mock.table.return_value = _memberships_query("viewer")

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
    claim_rows = _query_with_rows([])
    debate_rows = _query_with_rows([])
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
    assert body["conversation"]["id"] == "conv-1"
    assert body["messages"][1]["citations"][0]["citationKey"] == "E1"


@pytest.mark.asyncio
async def test_claim_extractor_returns_structured_claims():
    from services.answer_generation.claim_extractor import extract_claims
    from services.answer_generation.models import EvidenceBlock

    choice = MagicMock()
    choice.message.content = (
        '{"claims":[{"claimId":"c1","text":"The agreement renews annually.",'
        '"supportingCitationKeys":["E1"],"section":"Renewal"}]}'
    )
    response = MagicMock()
    response.choices = [choice]
    client_mock = AsyncMock()
    client_mock.chat.completions.create = AsyncMock(return_value=response)

    with patch("services.answer_generation.claim_extractor.AsyncOpenAI", return_value=client_mock):
        claims = await extract_claims(
            answer_text="The agreement renews annually.",
            evidence=[
                EvidenceBlock(
                    citationKey="E1",
                    documentId="doc-1",
                    chunkId="chunk-1",
                    chunkIndex=0,
                    sectionTitle="Renewal",
                    clauseNumber="9.2",
                    pageStart=4,
                    pageEnd=4,
                    text="The agreement renews for one year unless cancelled.",
                    retrievalReason="Semantic vector match.",
                    retrievalSources=["dense"],
                )
            ],
            verification_pass=1,
        )

    assert claims[0].citation_keys == ["E1"]
    assert claims[0].span_ids == ["chunk-1"]
    assert claims[0].verification_pass == 1


@pytest.mark.asyncio
async def test_build_answer_stream_persists_trust_and_claims():
    from services.answer_generation import service as answer_service
    from services.answer_generation.models import WriterOutput, WriterResult, WriterUsage

    client_mock = MagicMock()
    messages_table = MagicMock()
    messages_table.insert.return_value = messages_table
    messages_table.execute.return_value = SimpleNamespace(data=[])
    answer_runs_table = MagicMock()
    answer_runs_table.insert.return_value = answer_runs_table
    answer_runs_table.execute.return_value = SimpleNamespace(data=[])
    claims_table = MagicMock()
    claims_table.insert.return_value = claims_table
    claims_table.execute.return_value = SimpleNamespace(data=[])
    debate_turns_table = MagicMock()
    debate_turns_table.insert.return_value = debate_turns_table
    debate_turns_table.execute.return_value = SimpleNamespace(data=[])
    citations_table = MagicMock()
    citations_table.insert.return_value = citations_table
    citations_table.execute.return_value = SimpleNamespace(data=[])
    conversations_table = MagicMock()
    conversations_table.insert.return_value = conversations_table
    conversations_table.update.return_value = conversations_table
    conversations_table.eq.return_value = conversations_table
    conversations_table.execute.return_value = SimpleNamespace(data=[])
    retrieval_runs_table = MagicMock()
    retrieval_runs_table.insert.return_value = retrieval_runs_table
    retrieval_runs_table.execute.return_value = SimpleNamespace(data=[])
    retrieval_evidence_table = MagicMock()
    retrieval_evidence_table.insert.return_value = retrieval_evidence_table
    retrieval_evidence_table.execute.return_value = SimpleNamespace(data=[])
    usage_events_table = MagicMock()
    usage_events_table.insert.return_value = usage_events_table
    usage_events_table.execute.return_value = SimpleNamespace(data=[])
    answer_stream_table = MagicMock()
    answer_stream_table.insert.return_value = answer_stream_table
    answer_stream_table.execute.return_value = SimpleNamespace(data=[])

    client_mock.table.side_effect = lambda name: {
        "conversations": conversations_table,
        "messages": messages_table,
        "retrieval_runs": retrieval_runs_table,
        "retrieval_run_evidence": retrieval_evidence_table,
        "answer_runs": answer_runs_table,
        "claims": claims_table,
        "debate_turns": debate_turns_table,
        "message_citations": citations_table,
        "usage_events": usage_events_table,
        "answer_stream_events": answer_stream_table,
    }[name]

    writer_provider = AsyncMock()
    writer_provider.generate = AsyncMock(
        return_value=WriterResult(
            provider="openai",
            model="gpt-4o-mini",
            output=WriterOutput(
                answerMarkdown="The agreement renews annually.",
                citations=[{"citationKey": "E1"}],
                insufficientEvidence=False,
            ),
            usage=WriterUsage(promptTokens=100, completionTokens=20, totalTokens=120),
        )
    )
    retrieve_response = SimpleNamespace(
        normalized_query=SimpleNamespace(
            normalized_query="renewal term",
            model_dump=lambda mode=None, by_alias=None: {
                "rawQuery": "What is the renewal term?",
                "normalizedQuery": "renewal term",
                "tokens": ["renewal", "term"],
                "clauseRefs": [],
                "quotedPhrases": [],
            },
        ),
        retrieval_mode="hybrid",
        cache_hit=False,
        model_dump=lambda mode=None, by_alias=None: {
            "results": [
                {
                    "documentId": "doc-1",
                    "chunkId": "chunk-1",
                    "chunkIndex": 0,
                    "text": "The agreement renews annually.",
                    "sectionTitle": "Renewal",
                    "clauseNumber": "9.2",
                    "pageStart": 4,
                    "pageEnd": 4,
                    "retrievalReason": "Semantic vector match.",
                    "retrievalSources": ["dense"],
                    "chunkKind": "clause",
                    "crossReferences": [],
                    "vectorScore": 0.8,
                    "bm25Score": 1.2,
                    "rrfScore": 0.05,
                    "rerankScore": 0.91,
                    "finalScore": 0.91,
                    "finalRank": 1,
                    "parserVersion": "a3.v1",
                    "chunkVersion": "a4.v1",
                    "embeddingVersion": "a5.v1",
                }
            ]
        },
    )

    with patch.object(answer_service, "get_client", return_value=client_mock), patch.object(
        answer_service, "tenant_query"
    ) as tenant_query_mock, patch.object(
        answer_service, "get_writer_provider", return_value=writer_provider
    ), patch.object(
        answer_service, "retrieve_evidence", new=AsyncMock(return_value=(retrieve_response, None))
    ), patch.object(
        answer_service, "_load_chunk_offsets", return_value={"chunk-1": [{"page": 4, "char_start": 0, "char_end": 30}]}
    ), patch.object(
        answer_service, "_load_chunk_checksums", return_value={"chunk-1": "abc"}
    ), patch.object(
        answer_service, "extract_claims",
        new=AsyncMock(
            return_value=[
                {
                    "id": "claim-1",
                    "text": "The agreement renews annually.",
                    "span_ids": ["chunk-1"],
                    "citation_keys": ["E1"],
                    "section": "Renewal",
                    "verification_pass": 1,
                }
            ]
        ),
    ), patch.object(
        answer_service, "run_critic_node",
        new=AsyncMock(
            side_effect=lambda state: {
                **state,
                "claims": [
                    {
                        **state["claims"][0],
                        "supported": True,
                        "critic_status": "supported",
                        "entailment_label": "entail",
                        "entailment_score": 0.92,
                        "support_probability": 0.92,
                        "contradiction_probability": 0.03,
                    }
                ],
                "_route": "calibrate",
            }
        ),
    ), patch.object(
        answer_service, "run_calibrate_node",
        side_effect=lambda state: {
            **state,
            "trust": {
                "faithfulness": 1.0,
                "relevance": None,
                "overall": 0.88,
                "confidence": 0.88,
                "calibrated": True,
            },
            "_route": "finalize",
        },
    ):
        tenant_query_mock.side_effect = lambda table, workspace_id: {
            "answer_runs": _query_with_rows([]),
            "conversations": _query_with_rows([]),
            "messages": _query_with_rows([]),
        }[table]
        prepared = await answer_service.build_answer_stream(
            workspace_id="ws-1",
            query="What is the renewal term?",
            conversation_id=None,
            document_ids=[],
            request_id="req-1",
        )

    assert prepared.answer_run_id
    answer_insert = answer_runs_table.insert.call_args.args[0]
    assert answer_insert["trust_confidence"] == 0.88
    assert answer_insert["confidence_band"] == "high"
    assert claims_table.insert.call_args.args[0][0]["critic_status"] == "supported"
    assert any(event["type"] == "trust" for event in prepared.events)
    assert any(event["type"] == "claim" for event in prepared.events)


@pytest.mark.asyncio
async def test_build_answer_stream_abstains_below_threshold():
    from services.answer_generation import service as answer_service
    from services.answer_generation.models import WriterOutput, WriterResult, WriterUsage

    client_mock = MagicMock()
    generic_table = MagicMock()
    generic_table.insert.return_value = generic_table
    generic_table.update.return_value = generic_table
    generic_table.eq.return_value = generic_table
    generic_table.execute.return_value = SimpleNamespace(data=[])
    client_mock.table.return_value = generic_table

    writer_provider = AsyncMock()
    writer_provider.generate = AsyncMock(
        return_value=WriterResult(
            provider="openai",
            model="gpt-4o-mini",
            output=WriterOutput(answerMarkdown="The contract may renew.", citations=[{"citationKey": "E1"}]),
            usage=WriterUsage(promptTokens=100, completionTokens=20, totalTokens=120),
        )
    )
    retrieve_response = SimpleNamespace(
        normalized_query=SimpleNamespace(
            normalized_query="renewal term",
            model_dump=lambda mode=None, by_alias=None: {
                "rawQuery": "What is the renewal term?",
                "normalizedQuery": "renewal term",
                "tokens": ["renewal", "term"],
                "clauseRefs": [],
                "quotedPhrases": [],
            },
        ),
        retrieval_mode="hybrid",
        cache_hit=False,
        model_dump=lambda mode=None, by_alias=None: {
            "results": [
                {
                    "documentId": "doc-1",
                    "chunkId": "chunk-1",
                    "chunkIndex": 0,
                    "text": "The agreement renews annually.",
                    "sectionTitle": "Renewal",
                    "clauseNumber": "9.2",
                    "pageStart": 4,
                    "pageEnd": 4,
                    "retrievalReason": "Semantic vector match.",
                    "retrievalSources": ["dense"],
                    "chunkKind": "clause",
                    "crossReferences": [],
                    "vectorScore": 0.8,
                    "bm25Score": 1.2,
                    "rrfScore": 0.05,
                    "rerankScore": 0.91,
                    "finalScore": 0.91,
                    "finalRank": 1,
                    "parserVersion": "a3.v1",
                    "chunkVersion": "a4.v1",
                    "embeddingVersion": "a5.v1",
                }
            ]
        },
    )

    with patch.object(answer_service, "get_client", return_value=client_mock), patch.object(
        answer_service, "tenant_query"
    ) as tenant_query_mock, patch.object(
        answer_service, "get_writer_provider", return_value=writer_provider
    ), patch.object(
        answer_service, "retrieve_evidence", new=AsyncMock(return_value=(retrieve_response, None))
    ), patch.object(
        answer_service, "_load_chunk_offsets", return_value={"chunk-1": [{"page": 4, "char_start": 0, "char_end": 30}]}
    ), patch.object(
        answer_service, "_load_chunk_checksums", return_value={"chunk-1": "abc"}
    ), patch.object(
        answer_service, "extract_claims",
        new=AsyncMock(
            return_value=[
                {
                    "id": "claim-1",
                    "text": "The contract may renew.",
                    "span_ids": ["chunk-1"],
                    "citation_keys": ["E1"],
                    "section": "Renewal",
                    "verification_pass": 1,
                }
            ]
        ),
    ), patch.object(
        answer_service, "run_critic_node",
        new=AsyncMock(
            side_effect=lambda state: {
                **state,
                "claims": [
                    {
                        **state["claims"][0],
                        "supported": False,
                        "uncertain": True,
                        "critic_status": "unsupported",
                        "entailment_label": "neutral",
                        "entailment_score": 0.4,
                        "support_probability": 0.2,
                        "contradiction_probability": 0.4,
                    }
                ],
                "_route": "calibrate",
            }
        ),
    ), patch.object(
        answer_service, "run_calibrate_node",
        side_effect=lambda state: {
            **state,
            "abstained": True,
            "abstention_reason": "Insufficient evidence.",
            "trust": {
                "faithfulness": 0.0,
                "relevance": None,
                "overall": 0.3,
                "confidence": 0.3,
                "calibrated": True,
            },
            "_route": "abstain",
        },
    ), patch.object(
        answer_service, "run_abstain_node",
        side_effect=lambda state: {
            **state,
            "_abstention_event": {
                "type": "abstention",
                "reason": "Insufficient evidence.",
                "missingEvidenceQuery": "renewal notice period",
                "suggestedFollowUp": "Ask about the renewal section directly.",
                "trust": {
                    "faithfulness": 0.0,
                    "relevance": None,
                    "overall": 0.3,
                    "confidence": 0.3,
                    "calibrated": True,
                },
            },
        },
    ):
        tenant_query_mock.side_effect = lambda table, workspace_id: {
            "answer_runs": _query_with_rows([]),
            "conversations": _query_with_rows([]),
            "messages": _query_with_rows([]),
        }[table]
        prepared = await answer_service.build_answer_stream(
            workspace_id="ws-1",
            query="What is the renewal term?",
            conversation_id=None,
            document_ids=[],
            request_id="req-2",
        )

    assert any(event["type"] == "abstention" for event in prepared.events)


@pytest.mark.asyncio
async def test_build_answer_stream_runs_one_bounded_revision_pass():
    from services.answer_generation import service as answer_service
    from services.answer_generation.models import WriterOutput, WriterResult, WriterUsage

    client_mock = MagicMock()
    conversations_table = _mutating_table()
    messages_table = _mutating_table()
    retrieval_runs_table = _mutating_table()
    retrieval_evidence_table = _mutating_table()
    answer_runs_table = _mutating_table()
    claims_table = _mutating_table()
    debate_turns_table = _mutating_table()
    citations_table = _mutating_table()
    usage_events_table = _mutating_table()
    answer_stream_table = _mutating_table()

    client_mock.table.side_effect = lambda name: {
        "conversations": conversations_table,
        "messages": messages_table,
        "retrieval_runs": retrieval_runs_table,
        "retrieval_run_evidence": retrieval_evidence_table,
        "answer_runs": answer_runs_table,
        "claims": claims_table,
        "debate_turns": debate_turns_table,
        "message_citations": citations_table,
        "usage_events": usage_events_table,
        "answer_stream_events": answer_stream_table,
        "abstentions": _mutating_table(),
    }[name]

    writer_provider = AsyncMock()
    writer_provider.generate = AsyncMock(
        side_effect=[
            WriterResult(
                provider="openai",
                model="gpt-4o-mini",
                output=WriterOutput(answerMarkdown="The contract renews.", citations=[{"citationKey": "E1"}]),
                usage=WriterUsage(promptTokens=80, completionTokens=15, totalTokens=95),
            ),
            WriterResult(
                provider="openai",
                model="gpt-4o-mini",
                output=WriterOutput(
                    answerMarkdown="The contract renews annually unless notice is given.",
                    citations=[{"citationKey": "E2"}],
                ),
                usage=WriterUsage(promptTokens=90, completionTokens=20, totalTokens=110),
            ),
        ]
    )

    def _retrieval_payload(citation_key: str, text: str):
        return SimpleNamespace(
            normalized_query=SimpleNamespace(
                normalized_query="renewal notice",
                model_dump=lambda mode=None, by_alias=None: {
                    "rawQuery": "What is the renewal term?",
                    "normalizedQuery": "renewal notice",
                    "tokens": ["renewal", "notice"],
                    "clauseRefs": [],
                    "quotedPhrases": [],
                },
            ),
            retrieval_mode="hybrid",
            cache_hit=False,
            model_dump=lambda mode=None, by_alias=None: {
                "results": [
                    {
                        "documentId": "doc-1",
                        "chunkId": f"chunk-{citation_key.lower()}",
                        "chunkIndex": 0,
                        "text": text,
                        "sectionTitle": "Renewal",
                        "clauseNumber": "9.2",
                        "pageStart": 4,
                        "pageEnd": 4,
                        "retrievalReason": "Semantic vector match.",
                        "retrievalSources": ["dense"],
                        "chunkKind": "clause",
                        "crossReferences": [],
                        "vectorScore": 0.8,
                        "bm25Score": 1.2,
                        "rrfScore": 0.05,
                        "rerankScore": 0.91,
                        "finalScore": 0.91,
                        "finalRank": 1,
                        "parserVersion": "a3.v1",
                        "chunkVersion": "a4.v1",
                        "embeddingVersion": "a5.v1",
                    }
                ]
            },
        )

    retrieve_evidence = AsyncMock(
        side_effect=[
            (_retrieval_payload("E1", "The contract renews."), None),
            (_retrieval_payload("E2", "The contract renews annually unless notice is given."), None),
        ]
    )

    extract_claims = AsyncMock(
        side_effect=[
            [
                {
                    "id": "claim-1",
                    "text": "The contract renews.",
                    "span_ids": ["chunk-e1"],
                    "citation_keys": ["E1"],
                    "section": "Renewal",
                    "verification_pass": 1,
                }
            ],
            [
                {
                    "id": "claim-1",
                    "text": "The contract renews annually unless notice is given.",
                    "span_ids": ["chunk-e2"],
                    "citation_keys": ["E2"],
                    "section": "Renewal",
                    "verification_pass": 2,
                }
            ],
        ]
    )

    async def critic_side_effect(state):
        if state["critic_loops"] == 0:
            return {
                **state,
                "query": "renewal notice period",
                "debate": [
                    *state["debate"],
                    {
                        "round": 0,
                        "actor": "critic",
                        "action": "flag",
                        "claim_id": state["claims"][0]["id"],
                        "note": "Need explicit notice language.",
                    },
                ],
                "_route": "retriever",
            }
        return {
            **state,
            "claims": [
                {
                    **state["claims"][0],
                    "supported": True,
                    "critic_status": "supported",
                    "entailment_label": "entail",
                    "entailment_score": 0.96,
                    "support_probability": 0.98,
                    "contradiction_probability": 0.01,
                }
            ],
            "debate": [
                *state["debate"],
                {
                    "round": 1,
                    "actor": "critic",
                    "action": "resolve",
                    "claim_id": state["claims"][0]["id"],
                    "note": "The revised claim is supported.",
                },
            ],
            "_route": "calibrate",
        }

    with patch.object(answer_service, "get_client", return_value=client_mock), patch.object(
        answer_service, "tenant_query"
    ) as tenant_query_mock, patch.object(
        answer_service, "get_writer_provider", return_value=writer_provider
    ), patch.object(
        answer_service, "retrieve_evidence", new=retrieve_evidence
    ), patch.object(
        answer_service,
        "_load_chunk_offsets",
        side_effect=[
            {"chunk-e1": [{"page": 4, "char_start": 0, "char_end": 20}]},
            {"chunk-e2": [{"page": 4, "char_start": 0, "char_end": 55}]},
        ],
    ), patch.object(
        answer_service,
        "_load_chunk_checksums",
        side_effect=[{"chunk-e1": "abc"}, {"chunk-e2": "def"}],
    ), patch.object(
        answer_service, "extract_claims", new=extract_claims
    ), patch.object(
        answer_service, "run_critic_node", new=AsyncMock(side_effect=critic_side_effect)
    ), patch.object(
        answer_service, "run_calibrate_node",
        side_effect=lambda state: {
            **state,
            "trust": {
                "faithfulness": 1.0,
                "relevance": None,
                "overall": 0.91,
                "confidence": 0.91,
                "calibrated": True,
            },
            "_route": "finalize",
        },
    ):
        tenant_query_mock.side_effect = lambda table, workspace_id: {
            "answer_runs": _query_with_rows([]),
            "answer_stream_events": _query_with_rows([]),
            "conversations": _query_with_rows([]),
            "messages": _query_with_rows([]),
        }[table]
        prepared = await answer_service.build_answer_stream(
            workspace_id="ws-1",
            query="What is the renewal term?",
            conversation_id=None,
            document_ids=[],
            request_id="req-revise",
        )

    assert retrieve_evidence.await_count == 2
    assert writer_provider.generate.await_count == 2
    assert answer_runs_table.insert.call_args.args[0]["verification_passes"] == 2
    assert any(
        event["type"] == "debate_turn" and event["actor"] == "writer" and event["action"] == "revise"
        for event in prepared.events
    )
    assert any(
        event["type"] == "debate_turn" and event["actor"] == "critic" and event["action"] == "resolve"
        for event in prepared.events
    )


@pytest.mark.asyncio
async def test_build_answer_stream_replays_saved_request_without_rerunning():
    from services.answer_generation import service as answer_service

    existing_answer_run = {
        "id": "answer-1",
        "conversation_id": "conv-1",
        "user_message_id": "msg-user",
        "assistant_message_id": "msg-assistant",
        "retrieval_run_id": "retrieval-1",
    }
    saved_events = [
        {"payload": {"type": "meta", "conversationId": "conv-1"}},
        {"payload": {"type": "trust", "score": {"confidence": 0.88}}},
        {"payload": {"type": "done"}},
    ]

    writer_provider = AsyncMock()

    with patch.object(answer_service, "tenant_query") as tenant_query_mock, patch.object(
        answer_service, "get_writer_provider", return_value=writer_provider
    ):
        tenant_query_mock.side_effect = lambda table, workspace_id: {
            "answer_runs": _query_with_rows([existing_answer_run]),
            "answer_stream_events": _query_with_rows(saved_events),
        }[table]
        prepared = await answer_service.build_answer_stream(
            workspace_id="ws-1",
            query="What is the renewal term?",
            conversation_id=None,
            document_ids=[],
            request_id="req-replay",
        )

    assert prepared.answer_run_id == "answer-1"
    assert prepared.events[1]["type"] == "trust"
    writer_provider.generate.assert_not_called()
