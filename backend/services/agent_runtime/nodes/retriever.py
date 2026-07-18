"""
Retriever node — explicit hybrid retrieval as a graph node.

Some agent plans call for an LLM-free retrieval step (the Action node
already handles the common `search_documents` case). The Retriever node
exists for plans that want a fully instrumented retrieval *as part of
the graph* (e.g. for the Reasoning Inspector to highlight which chunks
influenced the Writer).

Reuses `services.retrieval.service::retrieve_evidence` (the same path
the chat endpoint uses).
"""
from __future__ import annotations

import logging
from typing import Any

from services.agent_runtime.nodes import NodeContext, NodeResult, node

logger = logging.getLogger(__name__)


@node("retriever", description="Explicit hybrid retrieval node for plans that need it")
async def retriever_node(state: dict[str, Any], ctx: NodeContext) -> NodeResult:
    from services.retrieval.models import RetrievalRequest
    from services.retrieval.service import retrieve_evidence

    user_input = state.get("user_input", "")
    document_ids = state.get("agent_config", {}).get("default_document_ids") or []
    top_k = int(state.get("agent_config", {}).get("retrieval_top_k", 5))

    req = RetrievalRequest(query=user_input, document_ids=document_ids, limit=max(1, min(top_k, 20)))
    response, explorer = await retrieve_evidence(req, ctx.workspace_id)
    dumped = response.model_dump(mode="json", by_alias=True)
    results = dumped.get("results", [])

    evidence_spans = [r.get("text", "") for r in results if r.get("text")]

    ctx.memory.add(
        role="observation",
        content=f"retriever_node: {len(results)} chunks (top rerank="
                f"{max((r.get('rerankScore', 0.0) or 0.0) for r in results) if results else 0.0:.3f})",
        tool="hybrid_retrieval",
        metadata={"result_count": len(results)},
    )

    return NodeResult(
        state_delta={"evidence_spans": evidence_spans},
        next_node_type="decision",
        output={
            "result_count": len(results),
            "evidence_preview": [
                {
                    "chunk_id": r.get("chunkId"),
                    "page_start": r.get("pageStart"),
                    "rerank_score": r.get("rerankScore"),
                }
                for r in results[:5]
            ],
        },
    )
