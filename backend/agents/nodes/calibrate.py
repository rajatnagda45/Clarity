from __future__ import annotations

from agents.state import AgentState
from config import settings
from services.verification.confidence import blend_confidence


def _build_abstention_reason(state: AgentState) -> str:
    unsupported = [c for c in state["claims"] if not c["supported"]]
    if not unsupported:
        return "Confidence below threshold; evidence may be insufficient."
    topics = ", ".join(c["text"][:60] for c in unsupported[:3])
    return f"Could not verify: {topics}."


def run_calibrate_node(state: AgentState) -> AgentState:
    """
    Calibrate node: blends claim signals into a calibrated confidence score.
    Routes to abstain when confidence < ABSTAIN_THRESHOLD, else to finalize.
    """
    confidence = blend_confidence(state["claims"], state["spans"])

    for claim in state["claims"]:
        claim["confidence"] = confidence

    n = len(state["claims"]) or 1
    frac_supported = sum(1 for c in state["claims"] if c["supported"]) / n

    state["trust"] = {
        "faithfulness": frac_supported,
        "relevance": None,
        "overall": confidence,
        "confidence": confidence,
        "calibrated": True,
    }

    if confidence < settings.abstain_threshold:
        state["abstained"] = True
        state["abstention_reason"] = _build_abstention_reason(state)
        state["_route"] = "abstain"  # type: ignore[typeddict-unknown-key]
    else:
        state["_route"] = "finalize"  # type: ignore[typeddict-unknown-key]

    return state
