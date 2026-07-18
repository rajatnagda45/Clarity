"""
citation_lookup — resolve a citation_key to its full source metadata.

Used by the Writer node after the LLM produces a draft answer to
materialise every cited chunk with the full text, page, section, and
clause metadata. Surfaces the same data the chat's message_citations
table stores.
"""
from __future__ import annotations

import logging
from typing import Any

from db.client import get_client
from services.agent_runtime.tools.base import ToolContext, ToolError, tool

logger = logging.getLogger(__name__)


@tool(
    "citation_lookup",
    timeout_s=15.0,
    max_retries=2,
)
async def citation_lookup(
    ctx: ToolContext,
    citation_keys: list[str],
) -> dict[str, Any]:
    """Look up full metadata for one or more citation_keys (chunk UUIDs)."""
    if not citation_keys:
        raise ToolError("citation_keys is required", kind="fatal")

    if len(citation_keys) > 50:
        citation_keys = citation_keys[:50]

    try:
        # The citations table uses message_citations keyed by (message_id, citation_key);
        # chunks are keyed by id. We resolve via chunks so this tool works for
        # the agent's writer (which has no message_id at draft time).
        rows = (
            get_client()
            .table("chunks")
            .select(
                "id, document_id, page_start, page_end, section_title, "
                "clause_number, text, source_offsets, chunk_kind"
            )
            .eq("workspace_id", ctx.workspace_id)
            .in_("id", citation_keys)
            .execute()
        ).data or []
    except Exception as exc:
        raise ToolError(f"citation_query_failed:{exc}", kind="retryable")

    ctx.memory.add(
        role="observation",
        content=f"citation_lookup resolved {len(rows)}/{len(citation_keys)} citations.",
        tool="citation_lookup",
        metadata={"requested": len(citation_keys), "resolved": len(rows)},
    )

    return {
        "requested": len(citation_keys),
        "resolved": len(rows),
        "missing": [k for k in citation_keys if k not in {r["id"] for r in rows}],
        "citations": [
            {
                "chunk_id": r["id"],
                "document_id": r.get("document_id"),
                "page_start": r.get("page_start"),
                "page_end": r.get("page_end"),
                "section_title": r.get("section_title"),
                "clause_number": r.get("clause_number"),
                "chunk_kind": r.get("chunk_kind"),
                "text": r.get("text", "")[:2000],
                "source_offsets": r.get("source_offsets", []),
            }
            for r in rows
        ],
    }
