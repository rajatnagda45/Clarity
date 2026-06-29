from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.verification.nli import NLIResult, check_entailment, check_batch


def _make_openai_response(label: str, score: float):
    content = json.dumps({"label": label, "score": score})
    choice = MagicMock()
    choice.message.content = content
    response = MagicMock()
    response.choices = [choice]
    return response


@pytest.mark.asyncio
async def test_check_entailment_returns_entail_when_openai_says_entail():
    mock_response = _make_openai_response("entail", 0.92)
    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch("services.verification.nli.settings") as mock_settings, patch(
        "openai.AsyncOpenAI", return_value=mock_client
    ):
        mock_settings.nli_provider = "openai"
        mock_settings.nli_model = ""
        mock_settings.llm_model = "gpt-4o-mini"
        mock_settings.openai_api_key = "test-key"
        result = await check_entailment("The term is 1 year.", "The agreement renews annually.")

    assert result.label == "entail"
    assert 0.0 <= result.score <= 1.0


@pytest.mark.asyncio
async def test_check_entailment_defaults_neutral_on_parse_failure():
    choice = MagicMock()
    choice.message.content = "not json"
    response = MagicMock()
    response.choices = [choice]
    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=response)

    with patch("services.verification.nli.settings") as mock_settings, patch(
        "openai.AsyncOpenAI", return_value=mock_client
    ):
        mock_settings.nli_provider = "openai"
        mock_settings.nli_model = ""
        mock_settings.llm_model = "gpt-4o-mini"
        mock_settings.openai_api_key = "test-key"
        result = await check_entailment("claim", "span")

    assert result.label == "neutral"
    assert result.score == 0.5


@pytest.mark.asyncio
async def test_check_entailment_maps_contradict():
    mock_response = _make_openai_response("contradict", 0.88)
    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch("services.verification.nli.settings") as mock_settings, patch(
        "openai.AsyncOpenAI", return_value=mock_client
    ):
        mock_settings.nli_provider = "openai"
        mock_settings.nli_model = ""
        mock_settings.llm_model = "gpt-4o-mini"
        mock_settings.openai_api_key = "test-key"
        result = await check_entailment("Term is 2 years.", "The agreement renews annually.")

    assert result.label == "contradict"


@pytest.mark.asyncio
async def test_check_batch_returns_list_of_results():
    mock_response = _make_openai_response("entail", 0.90)
    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    pairs = [("claim A", "span A"), ("claim B", "span B")]

    with patch("services.verification.nli.settings") as mock_settings, patch(
        "openai.AsyncOpenAI", return_value=mock_client
    ):
        mock_settings.nli_provider = "openai"
        mock_settings.nli_model = ""
        mock_settings.llm_model = "gpt-4o-mini"
        mock_settings.openai_api_key = "test-key"
        results = await check_batch(pairs)

    assert len(results) == 2
    assert all(isinstance(r, NLIResult) for r in results)
