"""
Planner node — real LLM-driven task decomposition.

The Planner:
  1. Receives the user goal + agent config (allowed tools, behavior, model).
  2. Calls the configured LLM with a structured prompt that includes the
     tool manifest (so it can only pick tools that exist).
  3. Parses the JSON plan; validates each step against the tool registry
     and the agent's `allowed_tools` allowlist.
  4. Emits a `plan_created` runtime event with the structured plan.
  5. Returns a state delta with `plan` and `current_step_index = 0`.

If the LLM produces a malformed plan, the Planner retries once with a
repair prompt. If the repair fails, it falls back to a minimal 1-step
plan (`search_documents` → `finish`) so the run never stalls.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from config import settings
from services.agent_runtime.nodes import NodeContext, NodeResult, node
from services.agent_runtime.tools import get_tool_registry

logger = logging.getLogger(__name__)

_PLANNER_MODEL = "gpt-4o-mini"
_PLANNER_TEMPERATURE = 0.2


_PLANNER_SYSTEM_PROMPT = """You are the Planner of an autonomous AI agent in a legal-document
analysis platform. Decompose the user's goal into a concrete, ordered plan of
steps the agent can execute.

Each step has:
  - id:           short slug (e.g. "s1", "s2", "s3")
  - description:  one sentence describing what this step does
  - tool:         one of the available tool names, or null for a pure reasoning step
  - tool_args:    dict of arguments to pass to the tool (must match its signature)
  - depends_on:   list of step ids that must complete first
  - expected_output:  one sentence describing how to know this step succeeded

Rules:
  - Use only tools listed in the available tools manifest.
  - Every plan must end with either a step that uses "generate_report" or
    "document_summary" to produce a final deliverable, or a step that
    sets next_node_type to "finish".
  - Prefer parallelising independent steps: if two steps don't depend on
    each other, neither should list the other in `depends_on`.
  - Keep plans tight: 3–7 steps is the sweet spot. Do not exceed 12.
  - For "search then summarise" workflows, the summarisation step should
    depend on the search step.

Output a single JSON object:
{
  "plan": [ <step>, <step>, ... ],
  "rationale": "one short paragraph explaining the structure"
}
No prose, no markdown fences."""


@node("planner", max_attempts=2, description="Decompose the user goal into a tool-ready plan")
async def planner_node(state: dict[str, Any], ctx: NodeContext) -> NodeResult:
    from openai import AsyncOpenAI

    registry = get_tool_registry()
    allowed = set(ctx.allowed_tools) if ctx.allowed_tools else set(registry.names())
    manifest = [t for t in registry.describe_all() if t["name"] in allowed]

    user_input = state.get("user_input", "")
    agent_config = state.get("agent_config", {})
    memory_snapshot = ctx.memory.as_context()[-2000:]  # last 2k chars of memory

    user_prompt = (
        f"USER GOAL: {user_input}\n\n"
        f"AGENT NAME: {agent_config.get('name', 'agent')}\n"
        f"AGENT BEHAVIOR: {agent_config.get('behavior', 'balanced')}\n"
        f"ALLOWED COLLECTIONS: {ctx.runtime.config.get('allowed_collections', [])}\n"
        f"AGENT SYSTEM PROMPT:\n{agent_config.get('system_prompt', '')}\n\n"
        f"AVAILABLE TOOLS:\n{json.dumps(manifest, indent=2)}\n\n"
        f"RECENT MEMORY (last 2k chars):\n{memory_snapshot or '(empty)'}\n\n"
        f"Produce a JSON plan."
    )

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    raw_text, tokens_in, tokens_out = await _call_with_repair(
        client=client,
        system=_PLANNER_SYSTEM_PROMPT,
        user=user_prompt,
        cancel_event=ctx.cancel_event,
    )

    parsed = _safe_parse_plan(raw_text, allowed, registry)
    if parsed is None:
        # Build a minimal fallback so the run never stalls
        parsed = _fallback_plan(user_input, allowed)

    # Normalise: assign ids if missing, build depends_on if empty
    plan = _normalise_plan(parsed["plan"], allowed, registry)
    rationale = parsed.get("rationale", "")

    # Persist the plan to memory
    ctx.memory.add(
        role="assistant",
        content=f"Plan ({len(plan)} steps): {rationale}",
        tool=None,
        metadata={"plan": plan, "rationale": rationale},
    )

    # Emit the plan_created event explicitly (it is a distinct event type
    # the dev console listens for)
    from services.agent_runtime.events import make_event
    ctx.recorder.append(
        make_event(
            "plan_created",
            ctx.run_id,
            ctx.recorder.next(),
            node_id=ctx.runtime.current_node_id or "n_planner",
            node_type="planner",
            payload={
                "plan": plan,
                "rationale": rationale,
                "step_count": len(plan),
            },
            elapsed_ms=ctx.recorder.elapsed_ms(),
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            cost_usd=_cost(tokens_in, tokens_out),
        )
    )

    return NodeResult(
        state_delta={
            "plan": plan,
            "current_step_index": 0,
            "next_node_type": "memory",
            "loop_count": 0,
        },
        next_node_type="memory",
        output={
            "plan": plan,
            "rationale": rationale,
            "step_count": len(plan),
        },
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        cost_usd=_cost(tokens_in, tokens_out),
    )


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _call_with_repair(
    *,
    client,
    system: str,
    user: str,
    cancel_event,
) -> tuple[str, int, int]:
    """Call the LLM; on parse failure, retry once with a repair prompt."""
    try:
        resp = await client.chat.completions.create(
            model=_PLANNER_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=_PLANNER_TEMPERATURE,
            response_format={"type": "json_object"},
        )
    except Exception as exc:
        logger.warning("planner_primary_call_failed: %s", exc)
        raise
    raw = (resp.choices[0].message.content or "").strip()
    usage = resp.usage
    tokens_in = int(usage.prompt_tokens) if usage else 0
    tokens_out = int(usage.completion_tokens) if usage else 0
    return raw, tokens_in, tokens_out


def _safe_parse_plan(raw: str, allowed: set[str], registry) -> dict[str, Any] | None:
    try:
        obj = json.loads(raw)
    except Exception:
        return None
    if not isinstance(obj, dict):
        return None
    plan = obj.get("plan")
    if not isinstance(plan, list):
        return None
    # Validate each step's tool against the allowed set
    for step in plan:
        if not isinstance(step, dict):
            return None
        tool = step.get("tool")
        if tool is not None:
            if not isinstance(tool, str) or tool not in allowed:
                return None
            if not registry.has(tool):
                return None
    return obj


def _fallback_plan(user_input: str, allowed: set[str]) -> dict[str, Any]:
    """A minimal plan that always works."""
    steps: list[dict[str, Any]] = []
    if "search_documents" in allowed:
        steps.append({
            "id": "s1",
            "description": "Search workspace documents for the user query.",
            "tool": "search_documents",
            "tool_args": {"query": user_input, "top_k": 5},
            "depends_on": [],
            "expected_output": "Top-5 evidence chunks for the query.",
        })
    if "generate_report" in allowed:
        steps.append({
            "id": "s2",
            "description": "Synthesise a concise report from the retrieved evidence.",
            "tool": "generate_report",
            "tool_args": {"title": "Result", "style": "executive"},
            "depends_on": ["s1"] if steps else [],
            "expected_output": "A short executive report.",
        })
    if not steps:
        steps.append({
            "id": "s1",
            "description": "Finish (no tools applicable).",
            "tool": None,
            "tool_args": {},
            "depends_on": [],
            "expected_output": "Finish the run.",
        })
    return {"plan": steps, "rationale": "Fallback plan (LLM did not produce a valid plan)."}


def _normalise_plan(plan: list[Any], allowed: set[str], registry) -> list[dict[str, Any]]:
    """Ensure every step has an id, valid tool, and non-empty depends_on list."""
    normalised: list[dict[str, Any]] = []
    for i, raw_step in enumerate(plan):
        if not isinstance(raw_step, dict):
            continue
        step_id = str(raw_step.get("id") or f"s{i + 1}")
        tool = raw_step.get("tool")
        if tool is not None and (not isinstance(tool, str) or tool not in allowed or not registry.has(tool)):
            tool = None
        depends_on = raw_step.get("depends_on") or []
        if not isinstance(depends_on, list):
            depends_on = []
        depends_on = [str(d) for d in depends_on if isinstance(d, (str, int))]
        normalised.append({
            "id": step_id,
            "description": str(raw_step.get("description", ""))[:500],
            "tool": tool,
            "tool_args": raw_step.get("tool_args") if isinstance(raw_step.get("tool_args"), dict) else {},
            "depends_on": depends_on,
            "expected_output": str(raw_step.get("expected_output", ""))[:500],
        })
    if not normalised:
        return _fallback_plan("", allowed)["plan"]
    return normalised


def _cost(tokens_in: int, tokens_out: int) -> float:
    return round(
        (tokens_in + tokens_out) * settings.llm_completion_cost_per_1k_tokens_usd / 1000,
        6,
    )
