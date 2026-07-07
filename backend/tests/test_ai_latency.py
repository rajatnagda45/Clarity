from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# _MarkdownStreamExtractor unit tests
# ---------------------------------------------------------------------------

def test_extractor_simple_json():
    from services.answer_generation.provider import _MarkdownStreamExtractor

    ext = _MarkdownStreamExtractor()
    result = ext.feed('{"answerMarkdown": "Hello world", "citations": []}')
    assert result == "Hello world"


def test_extractor_incremental_chunks():
    from services.answer_generation.provider import _MarkdownStreamExtractor

    ext = _MarkdownStreamExtractor()
    chunks = ['{"answer', 'Markdown": "The ', "contract renews", '.", "citations": []}']
    extracted = "".join(ext.feed(c) for c in chunks)
    assert extracted == "The contract renews."


def test_extractor_key_split_across_chunks():
    from services.answer_generation.provider import _MarkdownStreamExtractor

    ext = _MarkdownStreamExtractor()
    # Key split between "answer" and "Markdown"
    out = ""
    out += ext.feed('{"answer')
    out += ext.feed('Markdown": "Split key test."}')
    assert out == "Split key test."


def test_extractor_escape_sequences():
    from services.answer_generation.provider import _MarkdownStreamExtractor

    ext = _MarkdownStreamExtractor()
    raw = r'{"answerMarkdown": "Line1\nLine2\tTabbed\\"}'
    result = ext.feed(raw)
    assert result == "Line1\nLine2\tTabbed\\"


def test_extractor_escaped_quote():
    from services.answer_generation.provider import _MarkdownStreamExtractor

    ext = _MarkdownStreamExtractor()
    raw = r'{"answerMarkdown": "He said \"hello\"."}'
    result = ext.feed(raw)
    assert result == 'He said "hello".'


def test_extractor_unicode_escape():
    from services.answer_generation.provider import _MarkdownStreamExtractor

    ext = _MarkdownStreamExtractor()
    raw = r'{"answerMarkdown": "élève"}'
    result = ext.feed(raw)
    assert result == "élève"


def test_extractor_done_state_ignores_further_input():
    from services.answer_generation.provider import _MarkdownStreamExtractor

    ext = _MarkdownStreamExtractor()
    ext.feed('{"answerMarkdown": "First."}')
    # After DONE, feed should return empty string
    assert ext.feed(' extra junk') == ""


def test_extractor_empty_answer_markdown():
    from services.answer_generation.provider import _MarkdownStreamExtractor

    ext = _MarkdownStreamExtractor()
    result = ext.feed('{"answerMarkdown": "", "citations": []}')
    assert result == ""


# ---------------------------------------------------------------------------
# generate_live_answer_stream integration tests
# ---------------------------------------------------------------------------

def _mutating_table():
    table = MagicMock()
    table.insert.return_value = table
    table.update.return_value = table
    table.eq.return_value = table
    table.execute.return_value = SimpleNamespace(data=[])
    return table


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
async def test_live_stream_yields_token_before_done():
    """Token events must arrive before the done event in the live stream."""
    from services.answer_generation import service as answer_service

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "conversations": _mutating_table(),
        "messages": _mutating_table(),
        "retrieval_runs": _mutating_table(),
        "retrieval_run_evidence": _mutating_table(),
        "answer_runs": _mutating_table(),
        "claims": _mutating_table(),
        "debate_turns": _mutating_table(),
        "message_citations": _mutating_table(),
        "usage_events": _mutating_table(),
        "answer_stream_events": _mutating_table(),
        "abstentions": _mutating_table(),
    }[name]

    # Provider with generate_streaming support
    class FakeStreamingProvider:
        async def generate_streaming(self, prompt):
            full = '{"answerMarkdown": "The contract renews annually.", "citations": [{"citationKey": "E1"}], "insufficientEvidence": false}'
            for ch in full:
                yield ch

        async def generate(self, prompt):
            raise AssertionError("generate should not be called in streaming path")

    retrieve_response = SimpleNamespace(
        normalized_query=SimpleNamespace(
            normalized_query="renewal term",
            model_dump=lambda mode=None, by_alias=None: {
                "rawQuery": "renewal?",
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
                    "text": "The contract renews annually.",
                    "sectionTitle": "Renewal",
                    "clauseNumber": "9.1",
                    "pageStart": 4,
                    "pageEnd": 4,
                    "retrievalReason": "Semantic match.",
                    "retrievalSources": ["dense"],
                    "chunkKind": "clause",
                    "crossReferences": [],
                    "vectorScore": 0.9,
                    "bm25Score": 1.1,
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

    collected: list[str] = []
    with patch.object(answer_service, "get_client", return_value=client_mock), patch.object(
        answer_service, "tenant_query"
    ) as tenant_query_mock, patch.object(
        answer_service, "get_writer_provider", return_value=FakeStreamingProvider()
    ), patch.object(
        answer_service, "retrieve_evidence", new=AsyncMock(return_value=(retrieve_response, None))
    ), patch.object(
        answer_service, "_load_chunk_offsets", return_value={"chunk-1": []}
    ), patch.object(
        answer_service, "_load_chunk_checksums", return_value={"chunk-1": "abc"}
    ), patch.object(
        answer_service, "extract_claims", return_value=[]
    ):
        tenant_query_mock.side_effect = lambda table, workspace_id: {
            "answer_runs": _query_with_rows([]),
            "answer_stream_events": _query_with_rows([]),
            "conversations": _query_with_rows([]),
            "messages": _query_with_rows([]),
        }[table]

        async for event_str in answer_service.generate_live_answer_stream(
            workspace_id="ws-1",
            query="renewal?",
            conversation_id=None,
            document_ids=[],
            request_id="req-live-1",
        ):
            collected.append(event_str)

    types = []
    for event_str in collected:
        if "data: " in event_str:
            import json as _json
            try:
                data = _json.loads(event_str.split("data: ", 1)[1].strip())
                types.append(data.get("type"))
            except Exception:
                pass

    assert "meta" in types
    assert "token" in types
    assert "done" in types

    # Token must come before done
    token_idx = next(i for i, t in enumerate(types) if t == "token")
    done_idx = next(i for i, t in enumerate(types) if t == "done")
    assert token_idx < done_idx


@pytest.mark.asyncio
async def test_live_stream_falls_back_to_non_streaming_provider():
    """Providers without generate_streaming still work via the generate() fallback."""
    from services.answer_generation import service as answer_service
    from services.answer_generation.models import WriterOutput, WriterResult, WriterUsage

    client_mock = MagicMock()
    client_mock.table.return_value = _mutating_table()

    class NonStreamingProvider:
        async def generate(self, prompt):
            return WriterResult(
                provider="openai",
                model="gpt-4o-mini",
                output=WriterOutput(
                    answerMarkdown="The contract renews.",
                    citations=[{"citationKey": "E1"}],
                    insufficientEvidence=False,
                ),
                usage=WriterUsage(promptTokens=50, completionTokens=10, totalTokens=60),
            )

    retrieve_response = SimpleNamespace(
        normalized_query=SimpleNamespace(
            normalized_query="renewal",
            model_dump=lambda mode=None, by_alias=None: {
                "rawQuery": "renew?",
                "normalizedQuery": "renewal",
                "tokens": ["renewal"],
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
                    "text": "The contract renews.",
                    "sectionTitle": None,
                    "clauseNumber": None,
                    "pageStart": 1,
                    "pageEnd": 1,
                    "retrievalReason": "Match.",
                    "retrievalSources": ["dense"],
                    "chunkKind": "paragraph",
                    "crossReferences": [],
                    "vectorScore": 0.8,
                    "bm25Score": 1.0,
                    "rrfScore": 0.05,
                    "rerankScore": None,
                    "finalScore": 0.8,
                    "finalRank": 1,
                    "parserVersion": "a3.v1",
                    "chunkVersion": "a4.v1",
                    "embeddingVersion": "a5.v1",
                }
            ]
        },
    )

    collected: list[str] = []
    with patch.object(answer_service, "get_client", return_value=client_mock), patch.object(
        answer_service, "tenant_query"
    ) as tenant_query_mock, patch.object(
        answer_service, "get_writer_provider", return_value=NonStreamingProvider()
    ), patch.object(
        answer_service, "retrieve_evidence", new=AsyncMock(return_value=(retrieve_response, None))
    ), patch.object(
        answer_service, "_load_chunk_offsets", return_value={"chunk-1": []}
    ), patch.object(
        answer_service, "_load_chunk_checksums", return_value={"chunk-1": None}
    ), patch.object(
        answer_service, "extract_claims", return_value=[]
    ):
        tenant_query_mock.side_effect = lambda table, workspace_id: {
            "answer_runs": _query_with_rows([]),
            "answer_stream_events": _query_with_rows([]),
            "conversations": _query_with_rows([]),
            "messages": _query_with_rows([]),
        }[table]

        async for event_str in answer_service.generate_live_answer_stream(
            workspace_id="ws-1",
            query="renew?",
            conversation_id=None,
            document_ids=[],
            request_id="req-fallback",
        ):
            collected.append(event_str)

    text = "".join(collected)
    assert '"type": "token"' in text
    assert '"type": "done"' in text


@pytest.mark.asyncio
async def test_live_stream_parallel_chunk_queries_called():
    """_load_chunk_offsets and _load_chunk_checksums are both called (parallel)."""
    from services.answer_generation import service as answer_service

    client_mock = MagicMock()
    client_mock.table.return_value = _mutating_table()

    offsets_mock = MagicMock(return_value={"chunk-1": []})
    checksums_mock = MagicMock(return_value={"chunk-1": "abc"})

    class FakeProvider:
        async def generate_streaming(self, prompt):
            yield '{"answerMarkdown": "Ok.", "citations": [], "insufficientEvidence": false}'

    retrieve_response = SimpleNamespace(
        normalized_query=SimpleNamespace(
            normalized_query="q",
            model_dump=lambda mode=None, by_alias=None: {
                "rawQuery": "q",
                "normalizedQuery": "q",
                "tokens": ["q"],
                "clauseRefs": [],
                "quotedPhrases": [],
            },
        ),
        retrieval_mode="hybrid",
        cache_hit=False,
        model_dump=lambda mode=None, by_alias=None: {
            "results": [
                {
                    "documentId": "d",
                    "chunkId": "chunk-1",
                    "chunkIndex": 0,
                    "text": "Ok.",
                    "sectionTitle": None,
                    "clauseNumber": None,
                    "pageStart": 1,
                    "pageEnd": 1,
                    "retrievalReason": "m",
                    "retrievalSources": ["dense"],
                    "chunkKind": "paragraph",
                    "crossReferences": [],
                    "vectorScore": 0.8,
                    "bm25Score": 1.0,
                    "rrfScore": 0.05,
                    "rerankScore": None,
                    "finalScore": 0.8,
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
        answer_service, "get_writer_provider", return_value=FakeProvider()
    ), patch.object(
        answer_service, "retrieve_evidence", new=AsyncMock(return_value=(retrieve_response, None))
    ), patch.object(
        answer_service, "_load_chunk_offsets", new=offsets_mock
    ), patch.object(
        answer_service, "_load_chunk_checksums", new=checksums_mock
    ), patch.object(
        answer_service, "extract_claims", return_value=[]
    ):
        tenant_query_mock.side_effect = lambda table, workspace_id: {
            "answer_runs": _query_with_rows([]),
            "answer_stream_events": _query_with_rows([]),
            "conversations": _query_with_rows([]),
            "messages": _query_with_rows([]),
        }[table]

        async for _ in answer_service.generate_live_answer_stream(
            workspace_id="ws-1",
            query="q",
            conversation_id=None,
            document_ids=[],
            request_id="req-parallel",
        ):
            pass

    assert offsets_mock.called
    assert checksums_mock.called


@pytest.mark.asyncio
async def test_live_stream_emits_stage_timings():
    """stage_timings event must be present and include retrieval_ms + generation_ms."""
    from services.answer_generation import service as answer_service
    import json as _json

    client_mock = MagicMock()
    client_mock.table.return_value = _mutating_table()

    class FakeProvider:
        async def generate_streaming(self, prompt):
            yield '{"answerMarkdown": "Ok.", "citations": [], "insufficientEvidence": false}'

    retrieve_response = SimpleNamespace(
        normalized_query=SimpleNamespace(
            normalized_query="q",
            model_dump=lambda mode=None, by_alias=None: {
                "rawQuery": "q",
                "normalizedQuery": "q",
                "tokens": ["q"],
                "clauseRefs": [],
                "quotedPhrases": [],
            },
        ),
        retrieval_mode="hybrid",
        cache_hit=False,
        model_dump=lambda mode=None, by_alias=None: {
            "results": [
                {
                    "documentId": "d",
                    "chunkId": "c1",
                    "chunkIndex": 0,
                    "text": "Ok.",
                    "sectionTitle": None,
                    "clauseNumber": None,
                    "pageStart": 1,
                    "pageEnd": 1,
                    "retrievalReason": "m",
                    "retrievalSources": ["dense"],
                    "chunkKind": "paragraph",
                    "crossReferences": [],
                    "vectorScore": 0.8,
                    "bm25Score": 1.0,
                    "rrfScore": 0.05,
                    "rerankScore": None,
                    "finalScore": 0.8,
                    "finalRank": 1,
                    "parserVersion": "a3.v1",
                    "chunkVersion": "a4.v1",
                    "embeddingVersion": "a5.v1",
                }
            ]
        },
    )

    events = []
    with patch.object(answer_service, "get_client", return_value=client_mock), patch.object(
        answer_service, "tenant_query"
    ) as tenant_query_mock, patch.object(
        answer_service, "get_writer_provider", return_value=FakeProvider()
    ), patch.object(
        answer_service, "retrieve_evidence", new=AsyncMock(return_value=(retrieve_response, None))
    ), patch.object(
        answer_service, "_load_chunk_offsets", return_value={"c1": []}
    ), patch.object(
        answer_service, "_load_chunk_checksums", return_value={"c1": None}
    ), patch.object(
        answer_service, "extract_claims", return_value=[]
    ):
        tenant_query_mock.side_effect = lambda table, workspace_id: {
            "answer_runs": _query_with_rows([]),
            "answer_stream_events": _query_with_rows([]),
            "conversations": _query_with_rows([]),
            "messages": _query_with_rows([]),
        }[table]

        async for event_str in answer_service.generate_live_answer_stream(
            workspace_id="ws-1",
            query="q",
            conversation_id=None,
            document_ids=[],
            request_id="req-timing",
        ):
            if "data: " in event_str:
                try:
                    data = _json.loads(event_str.split("data: ", 1)[1].strip())
                    events.append(data)
                except Exception:
                    pass

    timing_events = [e for e in events if e.get("type") == "stage_timings"]
    assert len(timing_events) == 1
    timings = timing_events[0]["timings"]
    assert "retrieval_ms" in timings
    assert "generation_ms" in timings
    assert "total_ms" in timings
    assert timings["total_ms"] >= 0
