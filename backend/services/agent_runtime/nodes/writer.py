"""
Writer node — real LLM that synthesises the final response.

Reuses `services.answer_generation.prompt_builder::build_prompt` so the
agent's writer output uses the same prompt template the chat endpoint
uses. Claims are extracted via the same `claim_extractor` so the
verification pipeline (critic → ensemble → trust) has the same input
shape as the chat flow.

The Writer can also stream tokens (via the `_stream_writer_tokens` path
the runtime invokes when the run was started with `stream=True`).
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from config import settings
from services.agent_runtime.nodes import NodeContext, NodeResult, node

logger = logging.getLogger(__name__)

_WRITER_MODEL = "gpt-4o-mini"


@node("writer", description="Synthesise a grounded final answer from prior step results")
async def writer_node(state: dict[str, Any], ctx: NodeContext) -> NodeResult:
    from openai import AsyncOpenAI
    from services.answer_generation.prompt_builder import build_prompt, PromptEnvelope

    agent_config = state.get("agent_config", {})
    user_input = state.get("user_input", "")
    evidence_spans = state.get("evidence_spans", [])

    # Build evidence blocks from the latest search_documents result in memory
    evidence_blocks: list[dict[str, Any]] = []
    for entry in reversed(ctx.memory.recall()):
        if entry.get("tool") == "search_documents" or entry.get("tool") == "hybrid_retrieval":
            md = entry.get("metadata", {}) or {}
            for r in md.get("results", [])[:5]:
                evidence_blocks.append({
                    "citation_key": r.get("citation_key") or r.get("chunk_id"),
                    "chunk_id": r.get("chunk_id"),
                    "document_id": r.get("document_id"),
                    "text": r.get("text", ""),
                    "page_start": r.get("page_start"),
                    "page_end": r.get("page_end"),
                    "section_title": r.get("section_title"),
                    "clause_number": r.get("clause_number"),
                })
            break
    if not evidence_blocks and evidence_spans:
        for i, span in enumerate(evidence_spans[:5]):
            evidence_blocks.append({
                "citation_key": f"span_{i + 1}",
                "chunk_id": f"span_{i + 1}",
                "text": span,
            })

    system_prompt = agent_config.get("system_prompt") or (
        "You are a precise AI assistant. Answer based on the provided document context."
    )
    history = []
    for entry in ctx.memory.recall(limit=8):
        history.append({"role": entry.get("role", "user"), "content": entry.get("content", "")})

    prompt: PromptEnvelope = build_prompt(
        system_prompt=system_prompt,
        evidence_blocks=evidence_blocks,
        conversation_history=history,
        user_request=user_input,
        prompt_version="b1.writer.revision.v1",
    )

    # Compose the actual chat prompt (no system field on the envelope; the
    # writer prompt uses the system + user slots directly)
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    if state.get("stream") and ctx.runtime.on_token is not None:
        answer_text, tokens_in, tokens_out = await _stream_writer(
            client=client,
            model=agent_config.get("model") or _WRITER_MODEL,
            system=prompt["system_prompt"],
            user=(
                f"{prompt['evidence_section']}\n\n"
                f"{prompt['conversation_context']}\n\n"
                f"{prompt['user_request']}"
            ),
            on_token=ctx.runtime.on_token,
            cancel_event=ctx.cancel_event,
        )
    else:
        answer_text, tokens_in, tokens_out = await _batch_writer(
            client=client,
            model=agent_config.get("model") or _WRITER_MODEL,
            system=prompt["system_prompt"],
            user=(
                f"{prompt['evidence_section']}\n\n"
                f"{prompt['conversation_context']}\n\n"
                f"{prompt['user_request']}"
            ),
            cancel_event=ctx.cancel_event,
        )

    cost = round(
        (tokens_in + tokens_out) * settings.llm_completion_cost_per_1k_tokens_usd / 1000,
        6,
    )

    # Extract claims using the same path the chat answer generation uses
    claims: list[str] = []
    if answer_text and evidence_blocks:
        try:
            from services.verification.critic import extract_claims
            claims = await asyncio.to_thread(extract_claims, answer_text)
        except Exception as exc:
            logger.warning("writer_claim_extraction_failed: %s", exc)

    ctx.memory.add(
        role="assistant",
        content=answer_text or "(empty)",
        tool=None,
        metadata={"claims_count": len(claims)},
    )

    return NodeResult(
        state_delta={
            "final_output": answer_text,
            "claims": [{"text": c} for c in claims],
            "current_step_index": len(state.get("plan", [])),
        },
        next_node_type="verifier",
        output={
            "answer_text": answer_text,
            "claims": claims,
            "evidence_blocks_used": len(evidence_blocks),
        },
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        cost_usd=cost,
    )


async def _batch_writer(*, client, model: str, system: str, user: str, cancel_event) -> tuple[str, int, int]:
    resp = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.0,
    )
    if cancel_event.is_set():
        raise asyncio.CancelledError("cancelled_after_writer")
    text = (resp.choices[0].message.content or "").strip()
    usage = resp.usage
    return text, int(usage.prompt_tokens) if usage else 0, int(usage.completion_tokens) if usage else 0


async def _stream_writer(*, client, model: str, system: str, user: str, on_token, cancel_event) -> tuple[str, int, int]:
    stream = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.0,
        stream=True,
    )
    chunks: list[str] = []
    async for chunk in stream:
        if cancel_event.is_set():
            raise asyncio.CancelledError("cancelled_during_stream")
        try:
            delta = chunk.choices[0].delta.content
        except (IndexError, AttributeError):
            delta = None
        if delta:
            chunks.append(delta)
            on_token(delta)
    return "".join(chunks), 0, 0
