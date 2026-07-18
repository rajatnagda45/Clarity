"""
hybrid_retrieval — explicit hybrid dense+sparse retrieval with stage telemetry.

Same engine as search_documents, but the tool result is tuned for the
Decision node: it returns dense/sparse/fused candidate breakdowns so
the agent can self-diagnose retrieval quality and decide whether to
reformulate the query (loop back to the planner).
"""
from __future__ import annotations

import logging
from typing import Any

from services.agent_runtime.tools.base import ToolContext, ToolError, tool

logger = logging.getLogger(__name__)


@tool(
    "hybrid_retrieval",
    timeout_s=30.0,
    max_retries=2,
)
async def hybrid_retrieval(
    ctx: ToolContext,
    query: str,
    top_k: int = 5,
) -> dict[str, Any]:
    if not query or not query.strip():
        raise ToolError("query is required", kind="fatal")

    from services.retrieval.models import RetrievalRequest
    from services.retrieval.service import retrieve_evidence

    req = RetrievalRequest(query=query.strip(), document_ids=[], limit=max(1, min(top_k, 20)))
    response, explorer = await retrieve_evidence(req, ctx.workspace_id)
    dumped = response.model_dump(mode="json", by_alias=True)
    explorer_dumped = (
        explorer.model_dump(mode="json", by_alias=True) if explorer is not None else {}
    )

    results = dumped.get("results", [])
    dense_candidates = explorer_dumped.get("denseCandidates", [])
    sparse_candidates = explorer_dumped.get("sparseCandidates", [])
    fused = explorer_dumped.get("fusedCandidates", [])

    # Surface quality signal so the Decision node can self-evaluate
    dense_top_score = (dense_candidates[0].get("score", 0.0) if dense_candidates else 0.0)
    sparse_top_score = (sparse_candidates[0].get("score", 0.0) if sparse_candidates else 0.0)
    rerank_top_score = max(
        (r.get("rerankScore", 0.0) or 0.0) for r in results
    ) if results else 0.0

    ctx.memory.add(
        role="observation",
        content=(
            f"hybrid_retrieval: query='{query[:80]}' "
            f"dense={len(dense_candidates)} sparse={len(sparse_candidates)} "
            f"fused={len(fused)} top_rerank={rerank_top_score:.3f}"
        ),
        tool="hybrid_retrieval",
        metadata={"query": query, "dense_top": dense_top_score, "sparse_top": sparse_top_score},
    )

    return {
        "result_count": len(results),
        "results": [
            {
                "chunk_id": r.get("chunkId"),
                "document_id": r.get("documentId"),
                "text": (r.get("text") or "")[:1500],
                "rerank_score": r.get("rerankScore"),
                "retrieval_sources": r.get("retrievalSources", []),
            }
            for r in results
        ],
        "dense_candidates_count": len(dense_candidates),
        "sparse_candidates_count": len(sparse_candidates),
        "fused_candidates_count": len(fused),
        "dense_top_score": dense_top_score,
        "sparse_top_score": sparse_top_score,
        "rerank_top_score": rerank_top_score,
        "latency_ms": explorer_dumped.get("totalLatencyMs"),
    }
