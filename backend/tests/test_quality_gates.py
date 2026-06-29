from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from services.quality_gates.runner import (
    _evaluate_rule,
    create_rule,
    run_quality_gate,
)


def _rule(metric: str = "judge_overall", op: str = "gte", threshold: float = 70.0) -> dict:
    return {
        "id": "rule-1",
        "name": "Min Judge Score",
        "workspace_id": "ws-1",
        "metric": metric,
        "operator": op,
        "threshold": threshold,
        "active": True,
        "created_at": "2026-01-01",
    }


def _benchmark_run(judge_overall: float = 82.5, trust: float = 0.78, latency: int = 1200) -> dict:
    return {
        "id": "brun-1",
        "avg_judge_overall": judge_overall,
        "avg_trust_confidence": trust,
        "avg_latency_ms": latency,
    }


# ─── _evaluate_rule ───────────────────────────────────────────────────────────

def test_evaluate_rule_gte_passes():
    passed, note = _evaluate_rule(_rule("judge_overall", "gte", 70.0), 82.5)
    assert passed is True
    assert "PASS" in note


def test_evaluate_rule_gte_fails():
    passed, note = _evaluate_rule(_rule("judge_overall", "gte", 90.0), 82.5)
    assert passed is False
    assert "FAIL" in note


def test_evaluate_rule_lte_passes_for_latency():
    rule = _rule("latency_ms", "lte", 2000.0)
    passed, note = _evaluate_rule(rule, 1200.0)
    assert passed is True


def test_evaluate_rule_absent_metric_fails():
    passed, note = _evaluate_rule(_rule(), None)
    assert passed is False
    assert "no value available" in note


# ─── create_rule ──────────────────────────────────────────────────────────────

def test_create_rule_rejects_invalid_metric():
    with pytest.raises(ValueError, match="metric"):
        create_rule("ws-1", "Bad Rule", "invalid_metric", "gte", 70.0)


def test_create_rule_rejects_invalid_operator():
    with pytest.raises(ValueError, match="operator"):
        create_rule("ws-1", "Bad Rule", "judge_overall", "equals", 70.0)


def test_create_rule_succeeds():
    with patch("services.quality_gates.runner.get_client") as mock_gc:
        db = MagicMock()
        db.table.return_value = db
        db.insert.return_value = db
        db.execute.return_value = MagicMock(data=[])
        mock_gc.return_value = db

        rule_id = create_rule("ws-1", "Min Score", "judge_overall", "gte", 70.0)

    assert isinstance(rule_id, str)


# ─── run_quality_gate ─────────────────────────────────────────────────────────

def test_run_quality_gate_all_pass():
    run = _benchmark_run(judge_overall=85.0, trust=0.8, latency=900)

    with (
        patch("services.quality_gates.runner.list_rules") as mock_rules,
        patch("services.quality_gates.runner.tenant_query") as mock_tq,
        patch("services.quality_gates.runner.get_client") as mock_gc,
    ):
        mock_rules.return_value = [_rule("judge_overall", "gte", 70.0)]

        tq_chain = MagicMock()
        tq_chain.eq.return_value = tq_chain
        tq_chain.limit.return_value = tq_chain
        tq_chain.execute.return_value = MagicMock(data=[run])
        mock_tq.return_value = tq_chain

        db = MagicMock()
        db.table.return_value = db
        db.insert.return_value = db
        db.execute.return_value = MagicMock(data=[])
        mock_gc.return_value = db

        result = run_quality_gate("ws-1", benchmark_run_id="brun-1")

    assert result["passed"] is True
    assert result["rules_passed"] == 1
    assert result["rules_failed"] == 0


def test_run_quality_gate_fails_when_score_low():
    run = _benchmark_run(judge_overall=55.0)

    with (
        patch("services.quality_gates.runner.list_rules") as mock_rules,
        patch("services.quality_gates.runner.tenant_query") as mock_tq,
        patch("services.quality_gates.runner.get_client") as mock_gc,
    ):
        mock_rules.return_value = [_rule("judge_overall", "gte", 70.0)]

        tq_chain = MagicMock()
        tq_chain.eq.return_value = tq_chain
        tq_chain.limit.return_value = tq_chain
        tq_chain.execute.return_value = MagicMock(data=[run])
        mock_tq.return_value = tq_chain

        db = MagicMock()
        db.table.return_value = db
        db.insert.return_value = db
        db.execute.return_value = MagicMock(data=[])
        mock_gc.return_value = db

        result = run_quality_gate("ws-1", benchmark_run_id="brun-1")

    assert result["passed"] is False
    assert result["rules_failed"] == 1
