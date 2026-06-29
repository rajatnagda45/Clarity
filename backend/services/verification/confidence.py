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
    Blend four signals into a raw score, then pass through the isotonic calibrator.

    raw = 0.45·frac_supported + 0.25·entailment_margin + 0.20·min_rerank + 0.10·agreement
    """
    n = len(claims) or 1
    frac_supported = sum(1 for c in claims if c["supported"]) / n
    ent_scores = [c["entailment_score"] or 0.0 for c in claims]
    entailment_margin = _avg(ent_scores)
    min_rerank_scores: list[float] = []
    for claim in claims:
        claim_min = min(
            (_span_score(spans, sid) for sid in claim["span_ids"]),
            default=0.0,
        )
        min_rerank_scores.append(claim_min)
    min_rerank = _avg(min_rerank_scores)
    agreement = frac_supported

    raw = (
        0.45 * frac_supported
        + 0.25 * entailment_margin
        + 0.20 * min_rerank
        + 0.10 * agreement
    )
    return calibrator_module.calibrate(raw)
