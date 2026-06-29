from __future__ import annotations

from unittest.mock import MagicMock, patch

from services.benchmark_growth.suggester import (
    _already_suggested,
    list_suggestions,
    scan_for_suggestions,
)


def _tq_chain(data: list) -> MagicMock:
    chain = MagicMock()
    chain.eq.return_value = chain
    chain.not_ = chain
    chain.is_.return_value = chain
    chain.order.return_value = chain
    chain.limit.return_value = chain
    chain.select.return_value = chain
    chain.execute.return_value = MagicMock(data=data)
    return chain


# ─── _already_suggested ──────────────────────────────────────────────────────

def test_already_suggested_returns_false_when_no_row():
    with patch("services.benchmark_growth.suggester.tenant_query") as mock_tq:
        mock_tq.return_value = _tq_chain([])
        result = _already_suggested("ws-1", "run-1")
    assert result is False


def test_already_suggested_returns_true_when_row_exists():
    with patch("services.benchmark_growth.suggester.tenant_query") as mock_tq:
        mock_tq.return_value = _tq_chain([{"id": "sug-1"}])
        result = _already_suggested("ws-1", "run-1")
    assert result is True


# ─── scan_for_suggestions ────────────────────────────────────────────────────

def test_scan_creates_suggestion_for_abstained_run():
    runs = [{"id": "run-1", "query": "What is the payment clause?", "abstained": True, "trust_confidence": 0.7}]

    with (
        patch("services.benchmark_growth.suggester.tenant_query") as mock_tq,
        patch("services.benchmark_growth.suggester.get_client") as mock_gc,
        patch("services.benchmark_growth.suggester._already_suggested", return_value=False),
    ):
        call_count = [0]

        def tq_side(table, workspace_id):
            call_count[0] += 1
            if table == "answer_runs":
                return _tq_chain(runs)
            return _tq_chain([])  # no evals

        mock_tq.side_effect = tq_side

        db = MagicMock()
        db.table.return_value = db
        db.insert.return_value = db
        db.execute.return_value = MagicMock(data=[])
        mock_gc.return_value = db

        created = scan_for_suggestions("ws-1", window=10)

    assert len(created) == 1


def test_scan_skips_run_without_question():
    runs = [{"id": "run-1", "query": "", "abstained": False, "trust_confidence": 0.9}]

    with (
        patch("services.benchmark_growth.suggester.tenant_query") as mock_tq,
        patch("services.benchmark_growth.suggester.get_client"),
        patch("services.benchmark_growth.suggester._already_suggested", return_value=False),
    ):
        mock_tq.return_value = _tq_chain(runs)
        created = scan_for_suggestions("ws-1", window=10)

    assert created == []


def test_scan_skips_already_suggested_run():
    runs = [{"id": "run-1", "query": "Q?", "abstained": True, "trust_confidence": 0.3}]

    with (
        patch("services.benchmark_growth.suggester.tenant_query") as mock_tq,
        patch("services.benchmark_growth.suggester.get_client"),
        patch("services.benchmark_growth.suggester._already_suggested", return_value=True),
    ):
        mock_tq.return_value = _tq_chain(runs)
        created = scan_for_suggestions("ws-1", window=10)

    assert created == []


def test_list_suggestions_returns_empty():
    with patch("services.benchmark_growth.suggester.tenant_query") as mock_tq:
        chain = MagicMock()
        chain.order.return_value = chain
        chain.limit.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = MagicMock(data=[])
        mock_tq.return_value = chain
        result = list_suggestions("ws-1")
    assert result == []
