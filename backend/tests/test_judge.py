from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.eval.judge.base import JudgeParseError, JudgeProviderError
from services.eval.judge.openai_judge import OpenAIJudge, _build_user_message, _parse_scores
from services.eval.models import JudgeInput, JudgeScores


def _valid_payload(**overrides) -> dict:
    base = {
        "faithfulness": 90,
        "grounding": 85,
        "completeness": 80,
        "correctness": 88,
        "clarity": 92,
        "citation_quality": 78,
        "hallucination_risk": 10,
        "overall": 86,
        "reasoning": {
            "faithfulness": "Every claim maps to a source passage.",
            "grounding": "Citations point to the right sections.",
            "completeness": "Core question answered; one minor aspect omitted.",
            "correctness": "All dates and figures are accurate.",
            "clarity": "Plain language, no jargon overload.",
            "citation_quality": "One citation is slightly imprecise.",
            "hallucination_risk": "No fabricated terms detected.",
            "overall": "Strong answer with minor completeness gap.",
        },
    }
    base.update(overrides)
    return base


def _judge_input() -> JudgeInput:
    return JudgeInput(
        question="What is the termination clause?",
        answer="Either party may terminate with 30 days notice [C1].",
        evidence_texts=["Section 12: Termination. Either party may terminate with 30 days notice."],
        claim_texts=["Either party may terminate with 30 days notice."],
        citation_keys=["C1"],
        answer_run_id="run-123",
        workspace_id="ws-123",
    )


# ─── _parse_scores ──────────────────────────────────────────────────────────

def test_parse_scores_valid():
    raw = json.dumps(_valid_payload())
    scores = _parse_scores(raw)
    assert isinstance(scores, JudgeScores)
    assert scores.faithfulness == 90
    assert scores.overall == 86
    assert "faithfulness" in scores.reasoning


def test_parse_scores_missing_dimension():
    payload = _valid_payload()
    del payload["hallucination_risk"]
    with pytest.raises(JudgeParseError, match="missing dimensions"):
        _parse_scores(json.dumps(payload))


def test_parse_scores_out_of_range():
    payload = _valid_payload(clarity=150)
    with pytest.raises(JudgeParseError, match="clarity"):
        _parse_scores(json.dumps(payload))


def test_parse_scores_invalid_json():
    with pytest.raises(JudgeParseError, match="not valid JSON"):
        _parse_scores("not-json")


def test_parse_scores_missing_reasoning_does_not_raise():
    payload = _valid_payload()
    del payload["reasoning"]
    scores = _parse_scores(json.dumps(payload))
    assert scores.reasoning == {}


# ─── _build_user_message ────────────────────────────────────────────────────

def test_build_user_message_includes_question():
    inp = _judge_input()
    msg = _build_user_message(inp)
    assert "termination clause" in msg
    assert "30 days notice" in msg
    assert "C1" in msg


def test_build_user_message_handles_empty_evidence():
    inp = JudgeInput(
        question="Q?",
        answer="A.",
        evidence_texts=[],
        claim_texts=[],
        citation_keys=[],
        answer_run_id="r",
        workspace_id="w",
    )
    msg = _build_user_message(inp)
    assert "no evidence passages" in msg


# ─── OpenAIJudge.judge ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_openai_judge_returns_scores():
    raw_response = json.dumps(_valid_payload())
    mock_choice = MagicMock()
    mock_choice.message.content = raw_response
    mock_completion = MagicMock()
    mock_completion.choices = [mock_choice]

    with patch("services.eval.judge.openai_judge.AsyncOpenAI") as mock_cls:
        instance = mock_cls.return_value
        instance.chat = MagicMock()
        instance.chat.completions = MagicMock()
        instance.chat.completions.create = AsyncMock(return_value=mock_completion)

        judge = OpenAIJudge()
        scores = await judge.judge(_judge_input())

    assert scores.overall == 86
    assert scores.hallucination_risk == 10


@pytest.mark.asyncio
async def test_openai_judge_raises_provider_error_on_api_failure():
    with patch("services.eval.judge.openai_judge.AsyncOpenAI") as mock_cls:
        instance = mock_cls.return_value
        instance.chat = MagicMock()
        instance.chat.completions = MagicMock()
        instance.chat.completions.create = AsyncMock(side_effect=RuntimeError("API down"))

        judge = OpenAIJudge()
        with pytest.raises(JudgeProviderError):
            await judge.judge(_judge_input())
