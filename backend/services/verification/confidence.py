from __future__ import annotations

from agents.state import DraftClaim, Span
from services.verification import calibrator as calibrator_module


def _avg(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _span_score(spans: list[Span], span_id: str) -> float:
    for span in spans:
        if span["chunk_id"] == span_id:
            return span.get("rerank_score", 0.0)
    return 0.0


def blend_confidence(claims: list[DraftClaim], spans: list[Span]) -> float:
    """
    Blend verification signals into a raw score, then pass through the isotonic calibrator.

    raw = 0.25·frac_supported + 0.20·entailment_margin + 0.20·min_rerank
        + 0.15·agreement + 0.10·citation_coverage + 0.10·claim_coverage
    """
    n = len(claims) or 1
    frac_supported = sum(1 for c in claims if c["supported"]) / n
    ent_scores = [c["entailment_score"] or 0.0 for c in claims]
    entailment_margin = _avg(ent_scores)
    min_rerank_scores: list[float] = []
    citation_coverage_scores: list[float] = []
    for claim in claims:
        claim_min = min(
            (_span_score(spans, sid) for sid in claim["span_ids"]),
            default=0.0,
        )
        min_rerank_scores.append(claim_min)
        citation_coverage_scores.append(1.0 if claim.get("citation_keys") else 0.0)
    min_rerank = _avg(min_rerank_scores)
    claim_coverage = sum(1 for claim in claims if claim["span_ids"]) / n
    citation_coverage = _avg(citation_coverage_scores)
    agreement = _avg(
        [
            max(
                0.0,
                (
                    (claim.get("support_probability") or 0.0)
                    - (claim.get("contradiction_probability") or 0.0)
                    + 1.0
                )
                / 2.0,
            )
            for claim in claims
        ]
    )

    raw = (
        0.25 * frac_supported
        + 0.20 * entailment_margin
        + 0.20 * min_rerank
        + 0.15 * agreement
        + 0.10 * citation_coverage
        + 0.10 * claim_coverage
    )
    return calibrator_module.calibrate(raw)
