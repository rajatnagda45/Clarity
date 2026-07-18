"""
document_summary — summarise one or more retrieved documents.

The retrieval happens via the existing pipeline; summarisation uses the
centralised LLM call (gpt-4o-mini by default) with a bounded prompt so
it never exceeds the model's context. Cost is tracked on the ToolContext.
"""
from __future__ import annotations

import logging
from typing import Any

from config import settings
from services.agent_runtime.tools.base import ToolContext, ToolError, tool

logger = logging.getLogger(__name__)

_OPENAI_SUMMARY_MODEL = "gpt-4o-mini"
_MAX_INPUT_CHARS = 12000  # leaves room for the system prompt + completion


@tool(
    "document_summary",
    timeout_s=45.0,
    max_retries=2,
)
async def document_summary(
    ctx: ToolContext,
    query: str,
    document_ids: list[str] | None = None,
    max_chunks: int = 8,
    style: str = "concise",
) -> dict[str, Any]:
    """Retrieve top chunks for `query` then summarise them.

    style ∈ {"concise", "detailed", "bullets"}.
    """
    from services.retrieval.models import RetrievalRequest
    from services.retrieval.service import retrieve_evidence

    if not query or not query.strip():
        raise ToolError("query is required", kind="fatal")

    req = RetrievalRequest(
        query=query.strip(),
        document_ids=document_ids or [],
        limit=max(1, min(max_chunks, 15)),
    )
    response, _ = await retrieve_evidence(req, ctx.workspace_id)
    results = response.model_dump(mode="json", by_alias=True).get("results", [])

    if not results:
        return {
            "summary": "No relevant content was found in the workspace.",
            "chunk_count": 0,
            "citations": [],
        }

    style_prompts = {
        "concise": "Write a 2–3 paragraph summary highlighting the most important points.",
        "detailed": "Write a detailed, structured summary with section headings.",
        "bullets": "Return 5–10 bullet points, each capturing a single key finding.",
    }
    system_prompt = (
        "You are a precise summarisation assistant. Ground every claim in the "
        "provided document excerpts. If the excerpts do not support a claim, "
        "omit it. Never invent facts."
    ) + " " + style_prompts.get(style, style_prompts["concise"])

    joined = "\n\n---\n\n".join(
        f"[Source {i + 1} | page {r.get('pageStart', '?')}]\n{r.get('text', '')}"
        for i, r in enumerate(results)
    )
    if len(joined) > _MAX_INPUT_CHARS:
        joined = joined[:_MAX_INPUT_CHARS]

    user_prompt = (
        f"USER REQUEST: {query}\n\nDOCUMENT EXCERPTS:\n{joined}"
    )

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        resp = await client.chat.completions.create(
            model=_OPENAI_SUMMARY_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.0,
            max_tokens=600 if style == "bullets" else 800,
        )
    except Exception as exc:
        raise ToolError(f"openai_call_failed:{exc}", kind="retryable")

    summary = (resp.choices[0].message.content or "").strip()
    usage = resp.usage
    tokens_in = int(usage.prompt_tokens) if usage else 0
    tokens_out = int(usage.completion_tokens) if usage else 0
    cost = round(
        (tokens_in * settings.llm_completion_cost_per_1k_tokens_usd / 1000) +
        (tokens_out * settings.llm_completion_cost_per_1k_tokens_usd / 1000),
        6,
    )

    citations = [
        {
            "citation_key": r.get("citationKey"),
            "chunk_id": r.get("chunkId"),
            "document_id": r.get("documentId"),
            "page_start": r.get("pageStart"),
            "page_end": r.get("pageEnd"),
        }
        for r in results
    ]

    ctx.memory.add(
        role="observation",
        content=f"document_summary (style={style}) over {len(results)} chunks: {summary[:400]}",
        tool="document_summary",
        metadata={"chunk_count": len(results), "style": style, "cost_usd": cost},
    )

    return {
        "summary": summary,
        "chunk_count": len(results),
        "citations": citations,
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
        "cost_usd": cost,
    }
