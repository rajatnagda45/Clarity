from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

from services.optimization.engine import (
    _load_recent_eval_averages,
    _parse_recommendations,
    list_recommendations,
    update_recommendation_status,
)


def _eval_rows(n: int = 5) -> list[dict]:
    return [
        {
            "judge_faithfulness": 55,
            "judge_grounding": 72,
            "judge_completeness": 80,
            "judge_correctness": 88,
            "judge_clarity": 90,
            "judge_citation_quality": 58,
            "judge_hallucination_risk": 75,
            "judge_overall": 74,
        }
        for _ in range(n)
    ]


def _tq_chain(data: list) -> MagicMock:
    chain = MagicMock()
    chain.not_ = chain
    chain.is_.return_value = chain
    chain.order.return_value = chain
    chain.limit.return_value = chain
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.execute.return_value = MagicMock(data=data)
    return chain


def test_parse_recommendations_valid_json():
    raw = json.dumps([
        {"dimension": "faithfulness", "severity": "high", "recommendation": "Cite all claims.", "avg_score": 55.0},
    ])
    result = _parse_recommendations(raw)
    assert len(result) == 1
    assert result[0]["dimension"] == "faithfulness"


def test_parse_recommendations_invalid_json_returns_empty():
    assert _parse_recommendations("not-json") == []


def test_parse_recommendations_non_list_returns_empty():
    assert _parse_recommendations('{"key": "value"}') == []


def test_load_recent_eval_averages_returns_empty_on_no_data():
    with patch("services.optimization.engine.tenant_query") as mock_tq:
        mock_tq.return_value = _tq_chain([])
        result = _load_recent_eval_averages("ws-1")
    assert result == {}


def test_load_recent_eval_averages_computes_correctly():
    rows = _eval_rows(3)
    with patch("services.optimization.engine.tenant_query") as mock_tq:
        mock_tq.return_value = _tq_chain(rows)
        result = _load_recent_eval_averages("ws-1")

    assert "faithfulness" in result
    assert result["faithfulness"] == 55.0
    assert result["citation_quality"] == 58.0


def test_list_recommendations_returns_empty_when_no_data():
    with patch("services.optimization.engine.tenant_query") as mock_tq:
        chain = MagicMock()
        chain.order.return_value = chain
        chain.limit.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = MagicMock(data=[])
        mock_tq.return_value = chain
        result = list_recommendations("ws-1")
    assert result == []


def test_update_recommendation_status_rejects_invalid():
    with pytest.raises(ValueError, match="status"):
        update_recommendation_status("ws-1", "rec-1", "invalid_status")
