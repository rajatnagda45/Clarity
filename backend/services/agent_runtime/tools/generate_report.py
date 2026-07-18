"""
generate_report — synthesise a multi-section report from prior step results.

Reads the active StepMemory window and produces a structured markdown
report. Used at the end of multi-step agent runs to give the user a
single cohesive deliverable rather than scattered tool outputs.
"""
from __future__ import annotations

import logging
from typing import Any

from config import settings
from services.agent_runtime.tools.base import ToolContext, ToolError, tool

logger = logging.getLogger(__name__)

_OPENAI_MODEL = "gpt-4o-mini"
_MAX_CONTEXT_CHARS = 16000


@tool(
    "generate_report",
    timeout_s=60.0,
    max_retries=2,
)
async def generate_report(
    ctx: ToolContext,
    title: str,
    style: str = "executive",
    include_citations: bool = True,
) -> dict[str, Any]:
    """Synthesise a structured report from the run's memory."""
    if not title or not title.strip():
        raise ToolError("title is required", kind="fatal")

    memory_context = ctx.memory.as_context()
    if not memory_context.strip():
        return {
            "report": "No prior step results available to synthesise.",
            "tokens_in": 0,
            "tokens_out": 0,
            "cost_usd": 0.0,
        }

    style_prompts = {
        "executive": "Audience is senior leadership. Lead with findings and recommendations. Keep it tight.",
        "technical": "Audience is engineering. Include implementation details, data, and trade-offs.",
        "legal": "Audience is legal counsel. Be precise, cite source clauses verbatim, and flag risks.",
    }

    system_prompt = (
        "You are a senior report writer. Synthesise the agent's prior step "
        "results into a coherent, structured markdown report. Every factual "
        "claim must be supported by the provided observations. "
        + style_prompts.get(style, style_prompts["executive"])
    )

    user_prompt = (
        f"REPORT TITLE: {title}\n\n"
        f"PRIOR STEP RESULTS (verbatim from the agent's run):\n"
        f"{memory_context[:_MAX_CONTEXT_CHARS]}"
    )
    if not include_citations:
        user_prompt += "\n\nDo not include inline citations or source references."

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        resp = await client.chat.completions.create(
            model=_OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            max_tokens=1500,
        )
    except Exception as exc:
        raise ToolError(f"openai_call_failed:{exc}", kind="retryable")

    report = (resp.choices[0].message.content or "").strip()
    usage = resp.usage
    tokens_in = int(usage.prompt_tokens) if usage else 0
    tokens_out = int(usage.completion_tokens) if usage else 0
    cost = round(
        (tokens_in + tokens_out) * settings.llm_completion_cost_per_1k_tokens_usd / 1000,
        6,
    )

    ctx.memory.add(
        role="assistant",
        content=f"Final report ({style}): {report[:500]}…",
        tool="generate_report",
        metadata={"title": title, "style": style, "cost_usd": cost},
        global_=True,  # reports are valuable for future runs
    )

    return {
        "report": report,
        "title": title,
        "style": style,
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
        "cost_usd": cost,
    }
