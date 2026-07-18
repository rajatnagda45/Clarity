"""
Verifier node — applies the two-signal ensemble + calibrated trust.

Reuses (unchanged) the same `run_ensemble_async` and `compute_trust` the
chat answer generation pipeline uses. The result is the same `TrustScore`
with `should_abstain` flag, surfaced to the Decision node.

If `should_abstain=True`, the Finish node will trigger an abstention
event and route the run to `review_required` (if the agent config has
`auto_retry=False`) or retry the writer once with the critic feedback.
"""
from __future__ import annotations

import logging
from typing import Any

from services.agent_runtime.events import make_event
from services.agent_runtime.nodes import NodeContext, NodeResult, node

logger = logging.getLogger(__name__)


@node("verifier", description="Two-signal ensemble (Critic + NLI) + calibrated trust")
async def verifier_node(state: dict[str, Any], ctx: NodeContext) -> NodeResult:
    from services.verification.ensemble import run_ensemble_async
    from services.verification.confidence import compute_trust

    claims = [c.get("text", "") if isinstance(c, dict) else str(c) for c in (state.get("claims") or [])]
    critic_verdicts = state.get("critic_verdicts") or []
    evidence_spans = state.get("evidence_spans") or []

    if not claims or not critic_verdicts:
        return NodeResult(
            next_node_type="decision",
            state_delta={"trust_score": None, "abstained": False},
            output={"skipped": True},
        )

    # Convert critic_verdicts to the shape ensemble expects
    critic_resp = type("R", (), {})()
    critic_resp.verdicts = [
        type("V", (), {
            "claim": v["claim"],
            "verdict": v["verdict"],
            "evidence_spans": v.get("evidence_spans", []),
            "reasoning": v.get("reasoning", ""),
            "debate_turn": v.get("debate_turn", 1),
        })()
        for v in critic_verdicts
    ]
    # Use the evidence spans the critic actually cited
    used_spans: list[str] = []
    for v in critic_verdicts:
        for span in v.get("evidence_spans", []) or []:
            if span and span not in used_spans:
                used_spans.append(span)
    if not used_spans:
        used_spans = evidence_spans

    try:
        claim_results = await run_ensemble_async(critic_resp, used_spans)
    except Exception as exc:
        logger.warning("ensemble_failed: %s", exc)
        return NodeResult(
            next_node_type="decision",
            state_delta={"trust_score": None, "abstained": False, "last_error": f"ensemble_failed:{exc}"},
            error=f"ensemble_failed:{exc}",
        )

    trust = compute_trust(claim_results, [])
    ctx.memory.add(
        role="observation",
        content=(
            f"verifier: trust={trust.calibrated:.3f} "
            f"should_abstain={trust.should_abstain}"
        ),
        tool=None,
        metadata={
            "trust_raw": trust.raw,
            "trust_calibrated": trust.calibrated,
            "should_abstain": trust.should_abstain,
        },
    )
    ctx.recorder.append(
        make_event(
            "trust_score",
            ctx.run_id,
            ctx.recorder.next(),
            node_id=ctx.runtime.current_node_id or "n_verifier",
            node_type="verifier",
            payload={
                "raw": trust.raw,
                "calibrated": trust.calibrated,
                "should_abstain": trust.should_abstain,
                "components": trust.components,
            },
            elapsed_ms=ctx.recorder.elapsed_ms(),
        )
    )

    delta: dict[str, Any] = {
        "trust_score": trust.calibrated,
        "confidence": trust.calibrated,
        "abstained": trust.should_abstain,
    }
    if trust.should_abstain:
        delta["abstention_reason"] = (
            f"Calibrated trust {trust.calibrated:.3f} below threshold; "
            "evidence insufficient to support claims."
        )
        ctx.recorder.append(
            make_event(
                "abstention",
                ctx.run_id,
                ctx.recorder.next(),
                node_id=ctx.runtime.current_node_id or "n_verifier",
                node_type="verifier",
                payload={"reason": delta["abstention_reason"], "trust": trust.calibrated},
                elapsed_ms=ctx.recorder.elapsed_ms(),
            )
        )

    return NodeResult(
        state_delta=delta,
        next_node_type="decision",
        output={
            "trust_raw": trust.raw,
            "trust_calibrated": trust.calibrated,
            "should_abstain": trust.should_abstain,
            "components": trust.components,
        },
    )
