"""
Critic node — runs the production Critic LLM against the Writer's claims.

Reuses `services.verification.critic::run_critic` (the same Critic the
chat endpoint uses). The Critic LLM is constrained to judge claims
*only against retrieved evidence spans*; an injected prompt cannot
manufacture a "supported" verdict.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from services.agent_runtime.nodes import NodeContext, NodeResult, node

logger = logging.getLogger(__name__)


@node("critic", description="Critic LLM evaluates each claim against retrieved evidence")
async def critic_node(state: dict[str, Any], ctx: NodeContext) -> NodeResult:
    from services.verification.critic import run_critic

    claims = [c.get("text", "") if isinstance(c, dict) else str(c) for c in (state.get("claims") or [])]
    evidence_spans = state.get("evidence_spans") or []

    if not claims:
        return NodeResult(
            next_node_type="verifier",
            state_delta={"critic_verdicts": []},
            output={"skipped": True, "reason": "no_claims"},
        )
    if not evidence_spans:
        return NodeResult(
            next_node_type="verifier",
            state_delta={"critic_verdicts": [
                {"claim": c, "verdict": "uncertain", "reasoning": "no_evidence"}
                for c in claims
            ]},
            output={"skipped": True, "reason": "no_evidence"},
        )

    try:
        critic_resp = await asyncio.to_thread(run_critic, claims, evidence_spans, 1)
    except Exception as exc:
        logger.warning("critic_call_failed: %s", exc)
        return NodeResult(
            next_node_type="verifier",
            state_delta={"critic_verdicts": [], "last_error": f"critic_failed:{exc}"},
            error=f"critic_failed:{exc}",
        )

    verdicts = []
    for v in (critic_resp.verdicts or []):
        verdicts.append({
            "claim": v.claim,
            "verdict": v.verdict,
            "evidence_spans": list(v.evidence_spans or []),
            "reasoning": v.reasoning,
            "debate_turn": v.debate_turn,
        })

    return NodeResult(
        state_delta={"critic_verdicts": verdicts},
        next_node_type="verifier",
        output={
            "verdict_count": len(verdicts),
            "supported": sum(1 for v in verdicts if v["verdict"] == "supported"),
            "uncertain": sum(1 for v in verdicts if v["verdict"] == "uncertain"),
            "unsupported": sum(1 for v in verdicts if v["verdict"] == "unsupported"),
        },
    )
