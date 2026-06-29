from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agents.state import AgentState, DraftClaim, Span


def _make_state(
    claims: list[DraftClaim] | None = None,
    spans: list[Span] | None = None,
    critic_loops: int = 0,
) -> AgentState:
    return AgentState(
        workspace_id="ws-1",
        conversation_id="conv-1",
        query="What is the renewal term?",
        document_ids=["doc-1"],
        route="single_doc_qa",
        history=[],
        spans=spans
        or [
            {
                "chunk_id": "chk-1",
                "document_id": "doc-1",
                "page": 1,
                "char_start": 0,
                "char_end": 100,
                "text": "The agreement renews for one year unless cancelled.",
                "rerank_score": 0.85,
            }
        ],
        claims=claims
        or [
            {
                "id": "c1",
                "text": "The agreement renews annually.",
                "span_ids": ["chk-1"],
                "supported": False,
                "uncertain": False,
                "entailment_label": None,
                "entailment_score": None,
                "confidence": None,
            }
        ],
        critic_loops=critic_loops,
        debate=[],
        conflicts=[],
        trust=None,
        abstained=False,
        abstention_reason=None,
    )


def _openai_critic_response(verdicts: list[dict], refined_query: str | None = None):
    payload: dict = {"verdicts": verdicts}
    if refined_query:
        payload["refined_query"] = refined_query
    content = json.dumps(payload)
    choice = MagicMock()
    choice.message.content = content
    resp = MagicMock()
    resp.choices = [choice]
    return resp


def _nli_result(label: str = "entail", score: float = 0.92):
    from services.verification.nli import NLIResult
    return NLIResult(label=label, score=score)


@pytest.mark.asyncio
async def test_critic_marks_supported_when_both_signals_agree():
    from agents.nodes.critic import run_critic_node

    state = _make_state()
    mock_llm_resp = _openai_critic_response([{"claim_id": "c1", "status": "supported"}])
    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_llm_resp)

    with patch("openai.AsyncOpenAI", return_value=mock_client), patch(
        "agents.nodes.critic.check_entailment", new=AsyncMock(return_value=_nli_result("entail", 0.92))
    ):
        result = await run_critic_node(state)

    assert result["claims"][0]["supported"] is True
    assert result["claims"][0]["entailment_label"] == "entail"
    assert result["_route"] == "calibrate"  # type: ignore[typeddict-item]


@pytest.mark.asyncio
async def test_critic_flags_claim_when_nli_contradicts():
    """Critic says supported, but NLI says contradict → claim is NOT supported."""
    from agents.nodes.critic import run_critic_node

    state = _make_state()
    mock_llm_resp = _openai_critic_response([{"claim_id": "c1", "status": "supported"}])
    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_llm_resp)

    with patch("openai.AsyncOpenAI", return_value=mock_client), patch(
        "agents.nodes.critic.check_entailment",
        new=AsyncMock(return_value=_nli_result("contradict", 0.88)),
    ):
        result = await run_critic_node(state)

    assert result["claims"][0]["supported"] is False
    assert result["claims"][0]["entailment_label"] == "contradict"


@pytest.mark.asyncio
async def test_critic_triggers_reretrieve_when_unsupported_and_loops_below_cap():
    from agents.nodes.critic import run_critic_node

    state = _make_state(critic_loops=0)
    mock_llm_resp = _openai_critic_response(
        [{"claim_id": "c1", "status": "unsupported"}],
        refined_query="annual renewal notice period",
    )
    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_llm_resp)

    with patch("openai.AsyncOpenAI", return_value=mock_client), patch(
        "agents.nodes.critic.check_entailment",
        new=AsyncMock(return_value=_nli_result("neutral", 0.5)),
    ), patch("agents.nodes.critic.settings") as mock_settings:
        mock_settings.llm_model = "gpt-4o-mini"
        mock_settings.openai_api_key = "test-key"
        mock_settings.critic_max_iterations = 2
        result = await run_critic_node(state)

    assert result["_route"] == "retriever"  # type: ignore[typeddict-item]
    assert result["critic_loops"] == 1
    assert result["query"] == "annual renewal notice period"


@pytest.mark.asyncio
async def test_critic_routes_to_calibrate_when_loop_cap_reached():
    from agents.nodes.critic import run_critic_node

    state = _make_state(critic_loops=2)
    mock_llm_resp = _openai_critic_response([{"claim_id": "c1", "status": "unsupported"}])
    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_llm_resp)

    with patch("openai.AsyncOpenAI", return_value=mock_client), patch(
        "agents.nodes.critic.check_entailment",
        new=AsyncMock(return_value=_nli_result("neutral", 0.5)),
    ), patch("agents.nodes.critic.settings") as mock_settings:
        mock_settings.llm_model = "gpt-4o-mini"
        mock_settings.openai_api_key = "test-key"
        mock_settings.critic_max_iterations = 2
        result = await run_critic_node(state)

    assert result["_route"] == "calibrate"  # type: ignore[typeddict-item]
    assert result["claims"][0]["uncertain"] is True


@pytest.mark.asyncio
async def test_critic_handles_malformed_json_gracefully():
    from agents.nodes.critic import run_critic_node

    state = _make_state()
    choice = MagicMock()
    choice.message.content = "not json at all"
    resp = MagicMock()
    resp.choices = [choice]
    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=resp)

    with patch("openai.AsyncOpenAI", return_value=mock_client), patch(
        "agents.nodes.critic.check_entailment",
        new=AsyncMock(return_value=_nli_result("neutral", 0.5)),
    ):
        result = await run_critic_node(state)

    assert result["claims"][0]["supported"] is False
    assert result["_route"] in ("retriever", "calibrate")  # type: ignore[typeddict-item]
