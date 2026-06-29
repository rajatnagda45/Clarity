from __future__ import annotations

from fastapi import APIRouter, Depends, status

from api.deps import require_workspace_role
from api.errors import api_error
from db.client import tenant_query
from schemas import ClaimSpanListResponse, ClaimSpanResponse


router = APIRouter(prefix="/api/claims", tags=["claims"])


@router.get("/{claim_id}/spans", response_model=ClaimSpanListResponse)
async def get_claim_spans(
    claim_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> ClaimSpanListResponse:
    workspace_id, _ = membership
    claim_result = tenant_query("claims", workspace_id).eq("id", claim_id).limit(1).execute()
    claim = (claim_result.data or [None])[0]
    chunk_id = claim_id
    if claim is not None:
        span_ids = claim.get("span_ids") or []
        if span_ids:
            chunk_id = span_ids[0]

    chunk_result = tenant_query("chunks", workspace_id).eq("chunk_id", chunk_id).limit(1).execute()
    chunk = (chunk_result.data or [None])[0]
    if chunk is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "claim_not_found", "Claim evidence was not found.")

    evidence_rows = (
        tenant_query("retrieval_run_evidence", workspace_id)
        .eq("chunk_id", chunk_id)
        .order("final_score", desc=True)
        .limit(1)
        .execute()
    )
    rerank_score = 0.0
    if evidence_rows.data:
        rerank_score = float(
            evidence_rows.data[0].get("rerank_score")
            or evidence_rows.data[0].get("final_score")
            or evidence_rows.data[0].get("rrf_score")
            or 0.0
        )

    spans = [
        ClaimSpanResponse(
            chunkId=chunk_id,
            documentId=str(chunk["document_id"]),
            page=offset["page"],
            charStart=offset["char_start"],
            charEnd=offset["char_end"],
            text=chunk["text"][offset["char_start"] : offset["char_end"]] or chunk["text"],
            rerankScore=rerank_score,
        )
        for offset in chunk.get("source_offsets") or []
    ]
    if not spans:
        spans = [
            ClaimSpanResponse(
                chunkId=chunk_id,
                documentId=str(chunk["document_id"]),
                page=chunk["page_start"],
                charStart=chunk.get("char_start", 0),
                charEnd=chunk.get("char_end", len(chunk["text"])),
                text=chunk["text"],
                rerankScore=rerank_score,
            )
        ]
    return ClaimSpanListResponse(spans=spans)
