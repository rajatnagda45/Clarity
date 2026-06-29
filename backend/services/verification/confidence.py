"""
Trust score computation — blends 4 signals into a calibrated confidence.

Formula (from spec):
  raw = 0.45 · frac_supported
      + 0.25 · entailment_margin  (normalised to [0,1])
      + 0.20 · min_rerank         (min Cohere rerank score across retrieved chunks)
      + 0.10 · agreement          (1.0 if Critic & NLI fully agree, 0.0 otherwise)

Then runs isotonic-regression calibration (calibrator.pkl).
Abstention fires when calibrated_trust < ABSTAIN_THRESHOLD (default 0.55).
"""
from __future__ import annotations

from dataclasses import dataclass

from .ensemble import ClaimResult, fraction_supported, entailment_margin
from .calibrator import calibrate
from config import settings


@dataclass(frozen=True)
class TrustScore:
    raw: float
    calibrated: float
    should_abstain: bool
    components: dict[str, float]


def compute_trust(
    claim_results: list[ClaimResult],
    rerank_scores: list[float],
) -> TrustScore:
    """
    Blend the 4 signals into a calibrated trust score.

    :param claim_results: output of ensemble.run_ensemble()
    :param rerank_scores: per-chunk rerank scores from the retrieval pipeline
                          (empty list → defaults to 0.5)
    """
    # 1. Fraction of claims that are supported by BOTH signals
    frac = fraction_supported(claim_results)

    # 2. Entailment margin — normalise from [-1,1] to [0,1]
    margin_raw = entailment_margin(claim_results)
    margin_norm = (margin_raw + 1.0) / 2.0

    # 3. Minimum rerank score across retrieved chunks (worst-case relevance)
    min_rerank = min(rerank_scores) if rerank_scores else 0.5
    min_rerank = max(0.0, min(1.0, float(min_rerank)))

    # 4. Agreement: 1.0 if every claim's Critic and NLI agree, 0.0 otherwise
    if not claim_results:
        agreement = 0.5
    else:
        agreeing = sum(
            1
            for r in claim_results
            if (r.critic_verdict == "supported") == (r.nli_label == "entail")
        )
        agreement = agreeing / len(claim_results)

    raw = (
        0.45 * frac
        + 0.25 * margin_norm
        + 0.20 * min_rerank
        + 0.10 * agreement
    )
    raw = max(0.0, min(1.0, raw))
    calibrated = calibrate(raw)

    threshold = float(getattr(settings, "abstain_threshold", 0.55))

    return TrustScore(
        raw=round(raw, 4),
        calibrated=round(calibrated, 4),
        should_abstain=calibrated < threshold,
        components={
            "frac_supported": round(frac, 4),
            "entailment_margin": round(margin_norm, 4),
            "min_rerank": round(min_rerank, 4),
            "agreement": round(agreement, 4),
        },
    )
