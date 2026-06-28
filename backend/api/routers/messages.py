from __future__ import annotations

from fastapi import APIRouter, Depends

from api.deps import require_workspace_role
from db.client import tenant_query
from schemas import ChunkSourceOffset, MessageCitation


router = APIRouter(prefix="/api/messages", tags=["messages"])


def _build_citation(row: dict) -> MessageCitation:
    offsets = [
        ChunkSourceOffset(
            page=offset["page"],
            blockOrder=offset["block_order"] if "block_order" in offset else offset["blockOrder"],
            charStart=offset["char_start"] if "char_start" in offset else offset["charStart"],
            charEnd=offset["char_end"] if "char_end" in offset else offset["charEnd"],
        )
        for offset in (row.get("source_offsets") or [])
    ]
    return MessageCitation(
        citationKey=row["citation_key"],
        documentId=str(row["document_id"]),
        chunkId=row["chunk_id"],
        sectionTitle=row.get("section_title"),
        clauseNumber=row.get("clause_number"),
        pageStart=row["page_start"],
        pageEnd=row["page_end"],
        checksum=row.get("checksum"),
        sourceOffsets=offsets,
    )


@router.get("/{message_id}/citations", response_model=list[MessageCitation])
async def get_message_citations(
    message_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> list[MessageCitation]:
    workspace_id, _ = membership
    rows = tenant_query("message_citations", workspace_id).eq("message_id", message_id).execute()
    return [_build_citation(row) for row in rows.data or []]
