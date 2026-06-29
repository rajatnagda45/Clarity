from __future__ import annotations

from agents.state import AgentState


def _missing_evidence_query(state: AgentState) -> str | None:
    unsupported = [c for c in state["claims"] if not c["supported"]]
    if not unsupported:
        return None
    topics = " OR ".join(c["text"][:40] for c in unsupported[:2])
    return f"Evidence for: {topics}"


def _suggested_follow_up(state: AgentState) -> str | None:
    unsupported = [c for c in state["claims"] if not c["supported"]]
    if not unsupported:
        return None
    return unsupported[0]["text"][:120]


def run_abstain_node(state: AgentState) -> AgentState:
    """
    Abstain node: emits the abstention SSE event payload into state["_abstention_event"]
    and marks state["abstained"] = True. The caller persists the DB row.
    """
    state["abstained"] = True
    state["_abstention_event"] = {  # type: ignore[typeddict-unknown-key]
        "type": "abstention",
        "reason": state.get("abstention_reason") or "Insufficient evidence to answer confidently.",
        "missingEvidenceQuery": _missing_evidence_query(state),
        "suggestedFollowUp": _suggested_follow_up(state),
        "trust": state.get("trust") or {},
    }
    return state
