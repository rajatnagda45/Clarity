from __future__ import annotations

from dataclasses import dataclass

from services.verification.nli import NLIResult


@dataclass
class EnsembleVerdict:
    claim_id: str
    supported: bool
    entailment_label: str
    entailment_score: float
    support_probability: float
    contradiction_probability: float
    critic_ok: bool
    nli_label: str
    nli_score: float


def apply_ensemble(
    *,
    claim_id: str,
    critic_status: str,
    nli_result: NLIResult,
) -> EnsembleVerdict:
    """
    A claim is supported only if the Critic LLM and the NLI entailment check agree.

    critic_status: "supported" | "partial" | "unsupported"
    nli_result:    NLIResult from services.verification.nli
    """
    critic_ok = critic_status in ("supported", "partial")
    nli_ok = nli_result.label == "entail"
    supported = critic_ok and nli_ok
    return EnsembleVerdict(
        claim_id=claim_id,
        supported=supported,
        entailment_label=nli_result.label,
        entailment_score=nli_result.score,
        support_probability=nli_result.support_probability,
        contradiction_probability=nli_result.contradiction_probability,
        critic_ok=critic_ok,
        nli_label=nli_result.label,
        nli_score=nli_result.score,
    )
