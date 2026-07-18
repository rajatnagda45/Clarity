"""
search_documents — hybrid retrieval over all indexed documents in the workspace.

Reuses `services.retrieval.service::retrieve_evidence` so every retrieval
goes through the same BM25 + dense + RRF + Cohere rerank pipeline the
chat endpoint uses. No duplicate query logic.
"""
from __future__ import annotations

import logging
from typing import Any

from services.agent_runtime.tools.base import ToolContext, ToolError, tool

logger = logging.getLogger(__name__)


@tool(
    "search_documents",
    timeout_s=30.0,
    max_retries=2,
    backoff_base=0.5,
)
async def search_documents(
    ctx: ToolContext,
    query: str,
    document_ids: list[str] | None = None,
    top_k: int = 8,
) -> dict[str, Any]:
    """Hybrid retrieval. Returns the top-k evidence blocks for `query`."""
    from services.retrieval.models import RetrievalRequest
    from services.retrieval.service import retrieve_evidence

    if not query or not query.strip():
        raise ToolError("query is required", kind="fatal")

    req = RetrievalRequest(
        query=query.strip(),
        document_ids=document_ids or [],
        limit=max(1, min(top_k, 20)),
    )
    response, explorer = await retrieve_evidence(req, ctx.workspace_id)
    dumped = response.model_dump(mode="json", by_alias=True)
    results = dumped.get("results", [])

    # Persist a compact memory entry so subsequent steps in the run
    # can reference the retrieved evidence without re-searching.
    ctx.memory.add(
        role="observation",
        content=(
            f"search_documents returned {len(results)} results for query "
            f"'{query[:120]}'."
        ),
        tool="search_documents",
        metadata={"query": query, "result_count": len(results)},
    )

    return {
        "result_count": len(results),
        "cache_hit": dumped.get("cacheHit", False),
        "results": [
            {
                "citation_key": r.get("citationKey"),
                "chunk_id": r.get("chunkId"),
                "document_id": r.get("documentId"),
                "text": (r.get("text") or "")[:1500],
                "page_start": r.get("pageStart"),
                "page_end": r.get("pageEnd"),
                "section_title": r.get("sectionTitle"),
                "clause_number": r.get("clauseNumber"),
                "rerank_score": r.get("rerankScore"),
                "vector_score": r.get("vectorScore"),
                "bm25_score": r.get("bm25Score"),
                "rrf_score": r.get("rrfScore"),
            }
            for r in results
        ],
        "stage_timings": (
            explorer.model_dump(mode="json", by_alias=True)
            if explorer is not None
            else None
        ),
    }
