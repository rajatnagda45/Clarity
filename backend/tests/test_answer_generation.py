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
    query.order.return_value = query
    query.limit.return_value = query
    query.execute.return_value = SimpleNamespace(data=rows)
    return query


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
