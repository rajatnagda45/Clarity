from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.eval.engine import run_eval_for_answer
from services.eval.models import JudgeScores


def _make_scores(**overrides) -> JudgeScores:
    base = dict(
        faithfulness=85, grounding=80, completeness=75,
        correctness=88, clarity=90, citation_quality=70,
        hallucination_risk=12, overall=82,
        reasoning={"overall": "Good answer."},
    )
    base.update(overrides)
    return JudgeScores(**base)


def _mock_db(answer_run: dict | None, claims: list, spans: list, message_content: str = "Answer text."):
    """Return a context manager that patches all DB calls in engine.py."""
    def _setup(mock_tenant_query, mock_get_client):
        def _tq_side_effect(table, workspace_id):
            chain = MagicMock()
            chain.eq.return_value = chain
            chain.neq.return_value = chain
            chain.not_ = chain
            chain.is_.return_value = chain
            chain.order.return_value = chain
            chain.limit.return_value = chain
            chain.select.return_value = chain
            chain.in_.return_value = chain

            if table == "answer_runs":
                chain.execute.return_value = MagicMock(data=[answer_run] if answer_run else [])
            elif table == "claims":
                chain.execute.return_value = MagicMock(data=claims)
            elif table == "spans":
                chain.execute.return_value = MagicMock(data=spans)
            elif table == "messages":
                chain.execute.return_value = MagicMock(
                    data=[{"content": message_content}] if message_content else []
                )
            else:
                chain.execute.return_value = MagicMock(data=[])
            return chain

        mock_tenant_query.side_effect = _tq_side_effect

        db_chain = MagicMock()
        db_chain.table.return_value = db_chain
        db_chain.insert.return_value = db_chain
        db_chain.execute.return_value = MagicMock(data=[{"id": "eval-001"}])
        mock_get_client.return_value = db_chain

    return _setup


# ─── run_eval_for_answer ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_eval_runs_and_returns_eval_id():
    answer_run = {
        "id": "run-1",
        "query": "What is the termination clause?",
        "assistant_message_id": "msg-1",
        "abstained": False,
    }
    scores = _make_scores()
    scores.__dict__["_latency_ms"] = 450

    with (
        patch("services.eval.engine.tenant_query") as mock_tq,
        patch("services.eval.engine.get_client") as mock_gc,
        patch("services.eval.engine.get_judge_provider") as mock_factory,
        patch("services.eval.engine.detect_regression"),
        patch("services.eval.engine.settings") as mock_settings,
    ):
        mock_settings.eval_auto_judge = True
        mock_settings.judge_model = "gpt-4o-mini"

        _mock_db(answer_run, claims=[], spans=[])(mock_tq, mock_gc)

        mock_provider = AsyncMock()
        mock_provider.provider_name = "openai"
        mock_provider.judge = AsyncMock(return_value=scores)
        mock_factory.return_value = mock_provider

        eval_id = await run_eval_for_answer("run-1", "ws-1")

    assert eval_id is not None


@pytest.mark.asyncio
async def test_eval_skips_abstained_answer():
    answer_run = {"id": "run-1", "query": "Q", "assistant_message_id": "m", "abstained": True}

    with (
        patch("services.eval.engine.tenant_query") as mock_tq,
        patch("services.eval.engine.get_client") as mock_gc,
        patch("services.eval.engine.get_judge_provider") as mock_factory,
        patch("services.eval.engine.settings") as mock_settings,
    ):
        mock_settings.eval_auto_judge = True
        _mock_db(answer_run, [], [])(mock_tq, mock_gc)
        mock_factory.return_value = AsyncMock()

        result = await run_eval_for_answer("run-1", "ws-1")

    assert result is None
    mock_factory.return_value.judge.assert_not_called() if hasattr(mock_factory.return_value.judge, "assert_not_called") else None


@pytest.mark.asyncio
async def test_eval_returns_none_when_disabled():
    with patch("services.eval.engine.settings") as mock_settings:
        mock_settings.eval_auto_judge = False
        result = await run_eval_for_answer("run-x", "ws-x")
    assert result is None


@pytest.mark.asyncio
async def test_eval_returns_none_when_answer_run_missing():
    with (
        patch("services.eval.engine.tenant_query") as mock_tq,
        patch("services.eval.engine.get_client") as mock_gc,
        patch("services.eval.engine.settings") as mock_settings,
    ):
        mock_settings.eval_auto_judge = True
        _mock_db(None, [], [])(mock_tq, mock_gc)
        result = await run_eval_for_answer("missing-run", "ws-1")
    assert result is None


@pytest.mark.asyncio
async def test_eval_handles_judge_error_gracefully():
    from services.eval.judge.base import JudgeProviderError

    answer_run = {"id": "run-1", "query": "Q", "assistant_message_id": "m", "abstained": False}

    with (
        patch("services.eval.engine.tenant_query") as mock_tq,
        patch("services.eval.engine.get_client") as mock_gc,
        patch("services.eval.engine.get_judge_provider") as mock_factory,
        patch("services.eval.engine.settings") as mock_settings,
    ):
        mock_settings.eval_auto_judge = True
        mock_settings.judge_model = "gpt-4o-mini"
        _mock_db(answer_run, [], [])(mock_tq, mock_gc)

        mock_provider = AsyncMock()
        mock_provider.provider_name = "openai"
        mock_provider.judge = AsyncMock(side_effect=JudgeProviderError("API timeout"))
        mock_factory.return_value = mock_provider

        result = await run_eval_for_answer("run-1", "ws-1")

    assert result is None
