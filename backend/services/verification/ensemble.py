"""
Ensemble agreement layer.

A claim is marked `supported` only when BOTH signals agree:
  1. Critic verdict == "supported"
  2. NLI label == "entail"

Any weaker agreement degrades to "uncertain" or "unsupported".
This prevents a single LLM from grading its own output.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .critic import CriticResponse, ClaimVerdict
from .nli import NLIResult, check_entailment


@dataclass(frozen=True)
class ClaimResult:
    claim: str
    critic_verdict: str           # "supported" | "unsupported" | "uncertain"
    nli_label: str                # "entail" | "neutral" | "contradict"
    nli_score: float
    ensemble_verdict: str         # "supported" | "unsupported" | "uncertain"
    evidence_spans: list[str] = field(default_factory=list)
    reasoning: str = ""
    debate_turn: int = 1


def run_ensemble(
    critic_response: CriticResponse,
    evidence_spans: list[str],
) -> list[ClaimResult]:
    """
    Cross-checks each Critic verdict with NLI entailment.
    The premise fed to NLI is the joined evidence spans the Critic cited
    (or all spans if none were cited).
    """
    results: list[ClaimResult] = []
    all_evidence = "\n".join(evidence_spans[:10])

    for verdict in critic_response.verdicts:
        # Use the spans the Critic specifically cited, or fall back to all evidence
        premise = (
            "\n".join(verdict.evidence_spans)
            if verdict.evidence_spans
            else all_evidence
        )
        if not premise.strip():
            premise = "No evidence available."

        nli = check_entailment(premise=premise, hypothesis=verdict.claim)
        ensemble = _combine(verdict, nli)

        results.append(
            ClaimResult(
                claim=verdict.claim,
                critic_verdict=verdict.verdict,
                nli_label=nli.label,
                nli_score=nli.score,
                ensemble_verdict=ensemble,
                evidence_spans=verdict.evidence_spans,
                reasoning=verdict.reasoning,
                debate_turn=verdict.debate_turn,
            )
        )

    return results


def _combine(verdict: ClaimVerdict, nli: NLIResult) -> str:
    """
    Two-signal rule:
    - supported  → Critic says supported AND NLI says entail
    - unsupported → Critic says unsupported OR NLI says contradict
    - uncertain   → everything else
    """
    if verdict.verdict == "supported" and nli.label == "entail":
        return "supported"
    if verdict.verdict == "unsupported" or nli.label == "contradict":
        return "unsupported"
    return "uncertain"


def fraction_supported(results: list[ClaimResult]) -> float:
    if not results:
        return 0.0
    n_supported = sum(1 for r in results if r.ensemble_verdict == "supported")
    return n_supported / len(results)


def min_nli_score(results: list[ClaimResult]) -> float:
    """Minimum NLI entailment score across all claims (worst-case signal)."""
    if not results:
        return 0.0
    return min(r.nli_score for r in results)


def entailment_margin(results: list[ClaimResult]) -> float:
    """
    Average margin between entail-score and the max(neutral, contradict) alternative.
    Positive margin means NLI lean toward entailment overall.
    """
    if not results:
        return 0.0
    margins = []
    for r in results:
        if r.nli_label == "entail":
            margins.append(r.nli_score - (1.0 - r.nli_score))
        else:
            margins.append(r.nli_score - (1.0 - r.nli_score))
    return sum(margins) / len(margins)
