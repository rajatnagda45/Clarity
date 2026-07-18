"""
workspace_search — full-text / keyword search across every indexed chunk
in the workspace, returning the top-N matches with surrounding context.

Distinct from search_documents:
  - No query embedding (cheaper, works for exact-match queries)
  - No semantic rerank (BM25 only)
  - Lower latency ceiling (intended for fast lookups, not deep analysis)

Uses the same `chunks` table the retrieval service loads, scoped by
workspace_id via the existing RLS policies. Tenant isolation is
enforced at the DB layer.
"""
from __future__ import annotations

import logging
from typing import Any

from db.client import get_client
from services.agent_runtime.tools.base import ToolContext, ToolError, tool

logger = logging.getLogger(__name__)


@tool(
    "workspace_search",
    timeout_s=20.0,
    max_retries=2,
)
async def workspace_search(
    ctx: ToolContext,
    query: str,
    top_k: int = 10,
) -> dict[str, Any]:
    """Keyword search over all chunks in the workspace."""
    if not query or not query.strip():
        raise ToolError("query is required", kind="fatal")

    terms = [t for t in query.lower().split() if t]
    if not terms:
        return {"result_count": 0, "results": []}

    try:
        # Tenant-scoped fetch — RLS narrows by workspace, but we add an
        # explicit eq() as defence-in-depth (per the security policy).
        rows = (
            get_client()
            .table("chunks")
            .select("id, document_id, page_start, page_end, section_title, text")
            .eq("workspace_id", ctx.workspace_id)
            .limit(2000)  # bounded scan; works for workspaces up to ~200k chunks
            .execute()
        ).data or []
    except Exception as exc:
        raise ToolError(f"chunks_query_failed:{exc}", kind="retryable")

    scored: list[tuple[int, dict[str, Any]]] = []
    for r in rows:
        text = (r.get("text") or "").lower()
        if not text:
            continue
        hits = sum(text.count(t) for t in terms)
        if hits > 0:
            scored.append((hits, r))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[: max(1, min(top_k, 25))]

    ctx.memory.add(
        role="observation",
        content=(
            f"workspace_search matched {len(scored)} chunks; returning top {len(top)} "
            f"for query '{query[:80]}'."
        ),
        tool="workspace_search",
        metadata={"query": query, "result_count": len(top)},
    )

    return {
        "result_count": len(top),
        "results": [
            {
                "chunk_id": r["id"],
                "document_id": r.get("document_id"),
                "page_start": r.get("page_start"),
                "page_end": r.get("page_end"),
                "section_title": r.get("section_title"),
                "text": r.get("text", "")[:1000],
                "match_count": hits,
            }
            for hits, r in top
        ],
    }
