"""
Tests for the two-signal verification pipeline.

The pipeline has no I/O by default in tests — all external calls (OpenAI, Cohere)
are patched so the logic is exercised without live API keys.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from services.verification.nli import NLIResult, check_entailment
from services.verification.critic import (
    ClaimVerdict,
    CriticResponse,
    extract_claims,
    run_critic,
)
from services.verification.ensemble import (
    ClaimResult,
    run_ensemble,
    fraction_supported,
    min_nli_score,
    entailment_margin,
)
from services.verification.confidence import TrustScore, compute_trust
from services.verification import calibrator as _calibrator_module
from services.verification.calibrator import calibrate


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_verdict(
    claim: str = "Test claim",
    verdict: str = "supported",
    evidence_spans: list[str] | None = None,
    reasoning: str = "",
    debate_turn: int = 1,
) -> ClaimVerdict:
    return ClaimVerdict(
        claim=claim,
        verdict=verdict,
        evidence_spans=evidence_spans or ["span text"],
        reasoning=reasoning,
        debate_turn=debate_turn,
    )


def _make_claim_result(
    claim: str = "Test claim",
    critic_verdict: str = "supported",
    nli_label: str = "entail",
    nli_score: float = 0.9,
    ensemble_verdict: str = "supported",
) -> ClaimResult:
    return ClaimResult(
        claim=claim,
        critic_verdict=critic_verdict,
        nli_label=nli_label,
        nli_score=nli_score,
        ensemble_verdict=ensemble_verdict,
        evidence_spans=["span"],
        reasoning="",
        debate_turn=1,
    )


# ---------------------------------------------------------------------------
# NLI tests
# ---------------------------------------------------------------------------

class TestNLI:
    def test_returns_nliresult_on_success(self):
        mock_response = MagicMock()
        mock_response.choices[0].message.content = '{"label": "entail", "score": 0.95}'

        with patch("services.verification.nli.OpenAI") as mock_openai:
            mock_openai.return_value.chat.completions.create.return_value = mock_response
            result = check_entailment("The contract expires 2024-01-01.", "The contract ends in 2024.")

        assert isinstance(result, NLIResult)
        assert result.label == "entail"
        assert result.score == pytest.approx(0.95)

    def test_falls_back_to_neutral_on_api_error(self):
        with patch("services.verification.nli.OpenAI") as mock_openai:
            mock_openai.return_value.chat.completions.create.side_effect = RuntimeError("API down")
            result = check_entailment("premise", "hypothesis")

        assert result.label == "neutral"
        assert result.score == pytest.approx(0.5)

    def test_normalises_invalid_label(self):
        mock_response = MagicMock()
        mock_response.choices[0].message.content = '{"label": "unknown_value", "score": 0.8}'

        with patch("services.verification.nli.OpenAI") as mock_openai:
            mock_openai.return_value.chat.completions.create.return_value = mock_response
            result = check_entailment("premise", "hypothesis")

        assert result.label == "neutral"

    def test_score_clamped_to_zero_one(self):
        mock_response = MagicMock()
        mock_response.choices[0].message.content = '{"label": "entail", "score": 1.5}'

        with patch("services.verification.nli.OpenAI") as mock_openai:
            mock_openai.return_value.chat.completions.create.return_value = mock_response
            result = check_entailment("premise", "hypothesis")

        assert result.score == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# Critic tests
# ---------------------------------------------------------------------------

class TestCritic:
    def test_run_critic_returns_verdicts(self):
        mock_response = MagicMock()
        mock_response.choices[0].message.content = (
            '{"verdicts": [{"claim": "c1", "verdict": "supported", '
            '"evidence_spans": ["span"], "reasoning": "ok", "debate_turn": 1}], '
            '"overall_confidence": 0.8}'
        )
        with patch("services.verification.critic.OpenAI") as mock_openai:
            mock_openai.return_value.chat.completions.create.return_value = mock_response
            resp = run_critic(["c1"], ["evidence text"])

        assert isinstance(resp, CriticResponse)
        assert len(resp.verdicts) == 1
        assert resp.verdicts[0].verdict == "supported"
        assert resp.overall_confidence == pytest.approx(0.8)

    def test_critic_falls_back_on_error(self):
        with patch("services.verification.critic.OpenAI") as mock_openai:
            mock_openai.return_value.chat.completions.create.side_effect = RuntimeError("fail")
            resp = run_critic(["c1"], ["evidence"])

        assert len(resp.verdicts) == 1
        assert resp.verdicts[0].verdict == "uncertain"

    def test_extract_claims_returns_list(self):
        mock_response = MagicMock()
        mock_response.choices[0].message.content = '{"claims": ["claim A", "claim B"]}'
        with patch("services.verification.critic.OpenAI") as mock_openai:
            mock_openai.return_value.chat.completions.create.return_value = mock_response
            claims = extract_claims("The contract expires and auto-renews.")

        assert claims == ["claim A", "claim B"]

    def test_extract_claims_fallback_on_error(self):
        with patch("services.verification.critic.OpenAI") as mock_openai:
            mock_openai.return_value.chat.completions.create.side_effect = RuntimeError("fail")
            claims = extract_claims("Some answer text.")

        assert len(claims) == 1  # falls back to full text as one claim

    def test_empty_claims_returns_empty_response(self):
        resp = run_critic([], ["evidence"])
        assert resp.verdicts == []


# ---------------------------------------------------------------------------
# Ensemble tests
# ---------------------------------------------------------------------------

class TestEnsemble:
    def test_supported_when_both_agree(self):
        verdict = _make_verdict(verdict="supported")
        critic_resp = CriticResponse(verdicts=[verdict], overall_confidence=0.9)

        nli_result = NLIResult(label="entail", score=0.92)
        with patch("services.verification.ensemble.check_entailment", return_value=nli_result):
            results = run_ensemble(critic_resp, ["evidence span"])

        assert len(results) == 1
        assert results[0].ensemble_verdict == "supported"

    def test_unsupported_when_nli_contradicts(self):
        verdict = _make_verdict(verdict="supported")
        critic_resp = CriticResponse(verdicts=[verdict], overall_confidence=0.9)

        nli_result = NLIResult(label="contradict", score=0.85)
        with patch("services.verification.ensemble.check_entailment", return_value=nli_result):
            results = run_ensemble(critic_resp, ["evidence span"])

        assert results[0].ensemble_verdict == "unsupported"

    def test_uncertain_when_critic_uncertain(self):
        verdict = _make_verdict(verdict="uncertain")
        critic_resp = CriticResponse(verdicts=[verdict], overall_confidence=0.5)

        nli_result = NLIResult(label="entail", score=0.7)
        with patch("services.verification.ensemble.check_entailment", return_value=nli_result):
            results = run_ensemble(critic_resp, ["evidence span"])

        assert results[0].ensemble_verdict == "uncertain"

    def test_fraction_supported(self):
        results = [
            _make_claim_result(ensemble_verdict="supported"),
            _make_claim_result(ensemble_verdict="supported"),
            _make_claim_result(ensemble_verdict="unsupported"),
        ]
        assert fraction_supported(results) == pytest.approx(2 / 3)

    def test_fraction_supported_empty(self):
        assert fraction_supported([]) == pytest.approx(0.0)

    def test_min_nli_score(self):
        results = [
            _make_claim_result(nli_score=0.9),
            _make_claim_result(nli_score=0.4),
            _make_claim_result(nli_score=0.7),
        ]
        assert min_nli_score(results) == pytest.approx(0.4)

    def test_entailment_margin_positive_for_entail(self):
        results = [_make_claim_result(nli_label="entail", nli_score=0.9)]
        # margin = 0.9 - 0.1 = 0.8 (positive)
        assert entailment_margin(results) == pytest.approx(0.8)

    def test_entailment_margin_negative_for_contradiction(self):
        results = [_make_claim_result(nli_label="contradict", nli_score=0.85)]
        # margin = (1-0.85) - 0.85 = 0.15 - 0.85 = -0.70 (negative)
        assert entailment_margin(results) == pytest.approx(-0.70)

    def test_entailment_margin_zero_for_neutral(self):
        results = [_make_claim_result(nli_label="neutral", nli_score=0.5)]
        # margin = (1-0.5) - 0.5 = 0.0
        assert entailment_margin(results) == pytest.approx(0.0)

    def test_entailment_margin_mixed_signals(self):
        # One strong entailment, one strong contradiction → should nearly cancel
        results = [
            _make_claim_result(nli_label="entail", nli_score=0.9),
            _make_claim_result(nli_label="contradict", nli_score=0.9),
        ]
        # entail margin: 0.9 - 0.1 = 0.8
        # contradict margin: 0.1 - 0.9 = -0.8
        # average = 0.0
        assert entailment_margin(results) == pytest.approx(0.0)

    def test_entailment_margin_empty(self):
        assert entailment_margin([]) == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# Confidence tests
# ---------------------------------------------------------------------------

class TestConfidence:
    def test_high_trust_on_all_supported(self):
        results = [_make_claim_result(ensemble_verdict="supported", nli_score=0.95) for _ in range(3)]
        score = compute_trust(results, rerank_scores=[0.9, 0.85, 0.88])
        assert isinstance(score, TrustScore)
        assert score.calibrated >= 0.0
        assert score.calibrated <= 1.0

    def test_abstain_when_all_unsupported(self):
        results = [
            _make_claim_result(
                ensemble_verdict="unsupported",
                critic_verdict="unsupported",
                nli_label="contradict",
                nli_score=0.1,
            )
            for _ in range(3)
        ]
        score = compute_trust(results, rerank_scores=[0.1, 0.1])
        # With all claims unsupported and low nli scores, raw score should be low
        assert score.raw < 0.5

    def test_empty_claims_uses_default(self):
        score = compute_trust([], rerank_scores=[0.8])
        assert isinstance(score, TrustScore)
        assert 0.0 <= score.calibrated <= 1.0

    def test_components_all_present(self):
        results = [_make_claim_result()]
        score = compute_trust(results, rerank_scores=[0.8])
        assert "frac_supported" in score.components
        assert "entailment_margin" in score.components
        assert "min_rerank" in score.components
        assert "agreement" in score.components

    def test_no_rerank_scores_defaults_to_half(self):
        results = [_make_claim_result()]
        score = compute_trust(results, rerank_scores=[])
        assert score.components["min_rerank"] == pytest.approx(0.5)


# ---------------------------------------------------------------------------
# Calibrator tests
# ---------------------------------------------------------------------------

class TestCalibrator:
    def test_passthrough_when_no_calibrator(self):
        from pathlib import Path
        from unittest.mock import patch

        with patch.object(_calibrator_module, "_PKL_PATH", Path("/nonexistent/calibrator.pkl")):
            _calibrator_module._calibrator = None
            _calibrator_module.load_calibrator()
            score = _calibrator_module.calibrate(0.75)

        assert score == pytest.approx(0.75, abs=0.01)

    def test_clamped_to_unit_interval(self):
        assert calibrate(1.5) == pytest.approx(1.0)
        assert calibrate(-0.3) == pytest.approx(0.0)
