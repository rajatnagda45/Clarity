"""
clause_extraction — extract structured clauses from retrieved contract text.

Combines hybrid retrieval with the ingestion layer's clause classification
logic. The tool returns typed clause objects (title, type, page, risk
flag, risk score, rationale) suitable for the agent to act on.
"""
from __future__ import annotations

import logging
from typing import Any

from config import settings
from services.agent_runtime.tools.base import ToolContext, ToolError, tool

logger = logging.getLogger(__name__)

_OPENAI_MODEL = "gpt-4o-mini"
_MAX_CHARS = 12000


_SYSTEM_PROMPT = """You are a legal contract clause extractor. For each excerpt, output a JSON
array where every element has these fields:

  title:           short clause title (e.g. "Indemnification")
  clause_type:     one of: termination, renewal, liability, payment, ip, confidentiality, other
  risk_flag:       "normal" | "non_standard" | "flagged"
  risk_score:      float in [0, 1] (1 = extreme risk)
  rationale:       1-2 sentence justification for the risk assessment
  verbatim:        the most relevant sentence(s) from the excerpt (max 300 chars)

Output ONLY a JSON array — no prose, no markdown fences."""


@tool(
    "clause_extraction",
    timeout_s=45.0,
    max_retries=2,
)
async def clause_extraction(
    ctx: ToolContext,
    query: str,
    document_ids: list[str] | None = None,
    max_chunks: int = 6,
) -> dict[str, Any]:
    from services.retrieval.models import RetrievalRequest
    from services.retrieval.service import retrieve_evidence

    if not query or not query.strip():
        raise ToolError("query is required", kind="fatal")

    req = RetrievalRequest(
        query=query.strip(),
        document_ids=document_ids or [],
        limit=max(1, min(max_chunks, 12)),
    )
    response, _ = await retrieve_evidence(req, ctx.workspace_id)
    results = response.model_dump(mode="json", by_alias=True).get("results", [])
    if not results:
        return {"clauses": [], "chunk_count": 0}

    joined = "\n\n---\n\n".join(
        f"[Source {i + 1} | page {r.get('pageStart', '?')}]\n{r.get('text', '')}"
        for i, r in enumerate(results)
    )[:_MAX_CHARS]

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        resp = await client.chat.completions.create(
            model=_OPENAI_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": f"Query: {query}\n\nExcerpts:\n{joined}"},
            ],
            temperature=0.0,
            response_format={"type": "json_object"},
        )
    except Exception as exc:
        raise ToolError(f"openai_call_failed:{exc}", kind="retryable")

    raw = (resp.choices[0].message.content or "").strip()
    parsed = _safe_parse_json_array(raw)
    usage = resp.usage
    tokens_in = int(usage.prompt_tokens) if usage else 0
    tokens_out = int(usage.completion_tokens) if usage else 0
    cost = round(
        (tokens_in + tokens_out) * settings.llm_completion_cost_per_1k_tokens_usd / 1000,
        6,
    )

    clauses = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        clauses.append({
            "title": str(item.get("title", ""))[:200],
            "clause_type": _coerce_clause_type(item.get("clause_type")),
            "risk_flag": _coerce_risk_flag(item.get("risk_flag")),
            "risk_score": _coerce_risk_score(item.get("risk_score")),
            "rationale": str(item.get("rationale", ""))[:500],
            "verbatim": str(item.get("verbatim", ""))[:600],
            "source_chunk_id": item.get("source_chunk_id"),
        })
        # attach the best-matching source chunk
        for r in results:
            if r.get("chunkId") == item.get("source_chunk_id"):
                clauses[-1]["source_page"] = r.get("pageStart")
                break

    ctx.memory.add(
        role="observation",
        content=f"clause_extraction found {len(clauses)} clauses (highest risk: "
                f"{max((c['risk_score'] for c in clauses), default=0.0):.2f})",
        tool="clause_extraction",
        metadata={"clause_count": len(clauses), "cost_usd": cost},
    )

    return {
        "clauses": clauses,
        "chunk_count": len(results),
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
        "cost_usd": cost,
    }


def _safe_parse_json_array(raw: str) -> list[Any]:
    import json
    try:
        obj = json.loads(raw)
    except Exception:
        return []
    if isinstance(obj, list):
        return obj
    if isinstance(obj, dict):
        # Some models wrap the array in {"clauses": [...]}
        for v in obj.values():
            if isinstance(v, list):
                return v
    return []


def _coerce_clause_type(value: Any) -> str:
    allowed = {"termination", "renewal", "liability", "payment", "ip", "confidentiality", "other"}
    v = str(value or "").strip().lower()
    return v if v in allowed else "other"


def _coerce_risk_flag(value: Any) -> str:
    allowed = {"normal", "non_standard", "flagged"}
    v = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")
    return v if v in allowed else "normal"


def _coerce_risk_score(value: Any) -> float:
    try:
        f = float(value)
    except Exception:
        return 0.0
    return max(0.0, min(1.0, f))
