from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from services.release_notes.generator import (
    _compute_delta,
    _load_benchmark_run,
    list_release_notes,
)


def _run(judge: float = 82.0, trust: float = 0.80, latency: int = 1200) -> dict:
    return {
        "id": "run-1",
        "avg_judge_overall": judge,
        "avg_trust_confidence": trust,
        "avg_latency_ms": latency,
    }


def _tq_chain(data: list) -> MagicMock:
    chain = MagicMock()
    chain.eq.return_value = chain
    chain.order.return_value = chain
    chain.limit.return_value = chain
    chain.execute.return_value = MagicMock(data=data)
    return chain


# ─── _compute_delta ──────────────────────────────────────────────────────────

def test_compute_delta_positive_improvement():
    from_run = _run(judge=70.0, trust=0.70, latency=1500)
    to_run = _run(judge=82.0, trust=0.82, latency=1200)
    delta = _compute_delta(from_run, to_run)

    assert delta["judge_overall"] == pytest.approx(12.0)
    assert delta["trust"] == pytest.approx(0.12)
    assert delta["latency_ms"] == pytest.approx(-300.0)


def test_compute_delta_handles_missing_field():
    from_run = {"avg_judge_overall": 70.0}
    to_run = {"avg_judge_overall": 80.0}
    delta = _compute_delta(from_run, to_run)
    assert "judge_overall" in delta
    assert "trust" not in delta


# ─── _load_benchmark_run ─────────────────────────────────────────────────────

def test_load_benchmark_run_returns_none_when_missing():
    with patch("services.release_notes.generator.tenant_query") as mock_tq:
        mock_tq.return_value = _tq_chain([])
        result = _load_benchmark_run("ws-1", "missing-run")
    assert result is None


def test_load_benchmark_run_returns_row_when_found():
    row = _run()
    with patch("services.release_notes.generator.tenant_query") as mock_tq:
        mock_tq.return_value = _tq_chain([row])
        result = _load_benchmark_run("ws-1", "run-1")
    assert result is not None
    assert result["avg_judge_overall"] == 82.0


# ─── list_release_notes ───────────────────────────────────────────────────────

def test_list_release_notes_returns_empty_when_none():
    with patch("services.release_notes.generator.tenant_query") as mock_tq:
        chain = MagicMock()
        chain.order.return_value = chain
        chain.limit.return_value = chain
        chain.execute.return_value = MagicMock(data=[])
        mock_tq.return_value = chain
        result = list_release_notes("ws-1")
    assert result == []
