"""
collection_search — retrieval scoped to a specific document collection.

Resolves the collection → document set on each call (no cache, the
collection contents may have changed), then delegates to the existing
hybrid retrieval. The collection_id must belong to the workspace
(tenant_query enforces this).
"""
from __future__ import annotations

import logging
from typing import Any

from db.client import get_client
from services.agent_runtime.tools.base import ToolContext, ToolError, tool

logger = logging.getLogger(__name__)


@tool(
    "collection_search",
    timeout_s=30.0,
    max_retries=2,
)
async def collection_search(
    ctx: ToolContext,
    query: str,
    collection_id: str,
    top_k: int = 5,
) -> dict[str, Any]:
    if not query or not query.strip():
        raise ToolError("query is required", kind="fatal")
    if not collection_id:
        raise ToolError("collection_id is required", kind="fatal")

    from services.retrieval.models import RetrievalRequest
    from services.retrieval.service import retrieve_evidence

    # Resolve collection → document_ids, tenant-scoped
    try:
        col = (
            get_client()
            .table("collections")
            .select("id, name")
            .eq("id", collection_id)
            .eq("workspace_id", ctx.workspace_id)
            .execute()
        ).data or []
        if not col:
            return {
                "ok": False,
                "error": "collection_not_found",
                "error_kind": "fatal",
            }
        docs = (
            get_client()
            .table("collection_documents")
            .select("document_id")
            .eq("collection_id", collection_id)
            .eq("workspace_id", ctx.workspace_id)
            .execute()
        ).data or []
        doc_ids = [d["document_id"] for d in docs]
    except Exception as exc:
        raise ToolError(f"collection_resolve_failed:{exc}", kind="retryable")

    if not doc_ids:
        return {
            "result_count": 0,
            "results": [],
            "collection_id": collection_id,
            "collection_name": col[0].get("name"),
        }

    req = RetrievalRequest(
        query=query.strip(),
        document_ids=doc_ids,
        limit=max(1, min(top_k, 20)),
    )
    response, _ = await retrieve_evidence(req, ctx.workspace_id)
    dumped = response.model_dump(mode="json", by_alias=True)
    results = dumped.get("results", [])

    ctx.memory.add(
        role="observation",
        content=(
            f"collection_search in '{col[0].get('name')}' "
            f"({len(doc_ids)} docs) returned {len(results)} results."
        ),
        tool="collection_search",
        metadata={"collection_id": collection_id, "query": query, "result_count": len(results)},
    )

    return {
        "collection_id": collection_id,
        "collection_name": col[0].get("name"),
        "document_count": len(doc_ids),
        "result_count": len(results),
        "results": [
            {
                "chunk_id": r.get("chunkId"),
                "document_id": r.get("documentId"),
                "text": (r.get("text") or "")[:1500],
                "page_start": r.get("pageStart"),
                "page_end": r.get("pageEnd"),
                "rerank_score": r.get("rerankScore"),
            }
            for r in results
        ],
    }
