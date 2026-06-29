from __future__ import annotations

from agents.nodes.abstain import run_abstain_node
from agents.nodes.calibrate import run_calibrate_node
from agents.state import AgentState, DraftClaim, Span


def _claim(supported: bool = False, uncertain: bool = False) -> DraftClaim:
    return {
        "id": "c1",
        "text": "The penalty clause exceeds 20%.",
        "span_ids": ["chk-1"],
        "supported": supported,
        "uncertain": uncertain,
        "entailment_label": "neutral" if not supported else "entail",
        "entailment_score": 0.5 if not supported else 0.91,
        "confidence": None,
    }


def _span() -> Span:
    return {
        "chunk_id": "chk-1",
        "document_id": "doc-1",
        "page": 1,
        "char_start": 0,
        "char_end": 50,
        "text": "The liability cap is 10%.",
        "rerank_score": 0.60,
    }


def _state(claims: list[DraftClaim], abstain_threshold: float = 0.55) -> AgentState:
    return AgentState(
        workspace_id="ws-1",
        conversation_id="conv-1",
        query="What is the penalty?",
        document_ids=["doc-1"],
        route="single_doc_qa",
        history=[],
        spans=[_span()],
        claims=claims,
        critic_loops=0,
        debate=[],
        conflicts=[],
        trust=None,
        abstained=False,
        abstention_reason=None,
    )


def test_abstain_node_sets_abstained_flag():
    state = _state([_claim(supported=False)])
    state["abstained"] = True
    state["abstention_reason"] = "Cannot verify: The penalty clause exceeds 20%."
    state["trust"] = {"confidence": 0.30, "calibrated": True}
    result = run_abstain_node(state)

    assert result["abstained"] is True
    event = result["_abstention_event"]  # type: ignore[typeddict-item]
    assert event["type"] == "abstention"
    assert "reason" in event
    assert "missingEvidenceQuery" in event


def test_abstain_node_includes_missing_evidence_query():
    state = _state([_claim(supported=False)])
    state["abstained"] = True
    state["abstention_reason"] = "Cannot verify."
    result = run_abstain_node(state)

    event = result["_abstention_event"]  # type: ignore[typeddict-item]
    assert event["missingEvidenceQuery"] is not None
    assert "penalty" in event["missingEvidenceQuery"].lower()


def test_calibrate_routes_to_abstain_when_confidence_below_threshold():
    from unittest.mock import patch

    claims = [_claim(supported=False)]
    state = _state(claims)

    with patch("agents.nodes.calibrate.blend_confidence", return_value=0.30), patch(
        "agents.nodes.calibrate.settings"
    ) as mock_settings:
        mock_settings.abstain_threshold = 0.55
        result = run_calibrate_node(state)

    assert result["abstained"] is True
    assert result["_route"] == "abstain"  # type: ignore[typeddict-item]
    assert result["trust"] is not None
    assert result["trust"]["confidence"] == 0.30


def test_calibrate_routes_to_finalize_when_confidence_above_threshold():
    from unittest.mock import patch

    claims = [_claim(supported=True)]
    state = _state(claims)

    with patch("agents.nodes.calibrate.blend_confidence", return_value=0.88), patch(
        "agents.nodes.calibrate.settings"
    ) as mock_settings:
        mock_settings.abstain_threshold = 0.55
        result = run_calibrate_node(state)

    assert result["abstained"] is False
    assert result["_route"] == "finalize"  # type: ignore[typeddict-item]
    assert result["trust"]["confidence"] == 0.88


def test_calibrate_sets_confidence_on_all_claims():
    from unittest.mock import patch

    claims = [_claim(supported=True), _claim(supported=False)]
    state = _state(claims)

    with patch("agents.nodes.calibrate.blend_confidence", return_value=0.70), patch(
        "agents.nodes.calibrate.settings"
    ) as mock_settings:
        mock_settings.abstain_threshold = 0.55
        result = run_calibrate_node(state)

    assert all(c["confidence"] == 0.70 for c in result["claims"])
