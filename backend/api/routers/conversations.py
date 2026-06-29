from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import require_workspace_role
from db.client import tenant_query
from schemas import (
    Abstention,
    ChunkSourceOffset,
    ChatMessage,
    Claim,
    ConversationDetailResponse,
    ConversationListResponse,
    ConversationSummary,
    DebateTurn,
    MessageCitation,
    RetrievalEvidenceResponse,
    TrustScore,
)


router = APIRouter(prefix="/api/conversations", tags=["conversations"])


def _error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


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


def _build_claim(row: dict) -> Claim:
    return Claim(
        id=str(row["id"]),
        text=row["text"],
        span_ids=[str(span_id) for span_id in (row.get("span_ids") or [])],
        citationKeys=row.get("citation_keys") or [],
        section=row.get("section"),
        verificationPass=row.get("verification_pass", 1),
        supported=bool(row.get("supported", False)),
        uncertain=bool(row.get("uncertain", False)),
        criticStatus=row.get("critic_status"),
        criticNote=row.get("critic_note"),
        correctedText=row.get("corrected_text"),
        entailment_label=row.get("entailment_label"),
        entailment_score=row.get("entailment_score"),
        supportProbability=row.get("support_probability"),
        contradictionProbability=row.get("contradiction_probability"),
        confidence=row.get("confidence"),
    )


def _build_trust(row: dict) -> TrustScore | None:
    confidence = row.get("trust_confidence")
    overall = row.get("trust_overall")
    faithfulness = row.get("trust_faithfulness")
    band = row.get("confidence_band")
    if confidence is None and overall is None and faithfulness is None and band is None:
        return None
    return TrustScore(
        faithfulness=float(faithfulness or 0.0),
        relevance=float(row["trust_relevance"]) if row.get("trust_relevance") is not None else None,
        overall=float(overall or confidence or 0.0),
        confidence=float(confidence or 0.0),
        calibrated=bool(row.get("trust_calibrated", True)),
        confidenceBand=row.get("confidence_band") or "low",
    )


def _build_abstention(row: dict | None) -> Abstention | None:
    if row is None:
        return None
    return Abstention(
        reason=row["reason"],
        missing_evidence_query=row.get("missing_evidence_query"),
        suggestedFollowUp=row.get("suggested_follow_up"),
    )


def _build_debate_turn(row: dict) -> DebateTurn:
    return DebateTurn(
        round=row["round_number"],
        actor=row["actor"],
        action=row["action"],
        claim_id=str(row["claim_id"]) if row.get("claim_id") else None,
        created_at=row.get("created_at"),
        note=row.get("note"),
    )


def _build_retrieved_evidence(row: dict) -> RetrievalEvidenceResponse:
    return RetrievalEvidenceResponse(
        workspaceId=str(row["workspace_id"]),
        documentId=str(row["document_id"]),
        chunkId=row["chunk_id"],
        chunkIndex=row["chunk_index"],
        text=row["text"],
        sectionTitle=row.get("section_title"),
        clauseNumber=row.get("clause_number"),
        pageStart=row["page_start"],
        pageEnd=row["page_end"],
        chunkKind=row["chunk_kind"],
        crossReferences=row.get("cross_references") or [],
        vectorScore=row.get("vector_score"),
        bm25Score=row.get("bm25_score"),
        rrfScore=row.get("rrf_score") or 0.0,
        rerankScore=row.get("rerank_score"),
        finalScore=row.get("final_score") or 0.0,
        finalRank=row.get("final_rank") or 0,
        retrievalReason=row["retrieval_reason"],
        retrievalSources=row.get("retrieval_sources") or [],
        parserVersion=row["parser_version"],
        chunkVersion=row["chunk_version"],
        embeddingVersion=row.get("embedding_version"),
    )


@router.get("", response_model=ConversationListResponse)
async def list_conversations(
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> ConversationListResponse:
    workspace_id, _ = membership
    conversations = (
        tenant_query("conversations", workspace_id)
        .order("last_message_at", desc=True)
        .execute()
    )
    message_rows = tenant_query("messages", workspace_id).execute()
    counts: dict[str, int] = {}
    for row in message_rows.data or []:
        key = str(row["conversation_id"])
        counts[key] = counts.get(key, 0) + 1

    items = [
        ConversationSummary(
            id=str(row["id"]),
            workspaceId=workspace_id,
            title=row.get("title"),
            createdAt=row["created_at"],
            lastMessageAt=row.get("last_message_at") or row["created_at"],
            messageCount=counts.get(str(row["id"]), 0),
        )
        for row in conversations.data or []
    ]
    return ConversationListResponse(conversations=items)


@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> ConversationDetailResponse:
    workspace_id, _ = membership
    conversation = tenant_query("conversations", workspace_id).eq("id", conversation_id).limit(1).execute()
    conversation_row = (conversation.data or [None])[0]
    if conversation_row is None:
        raise _error(status.HTTP_404_NOT_FOUND, "conversation_not_found", "Conversation was not found.")

    messages = (
        tenant_query("messages", workspace_id)
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .execute()
    )
    answer_runs = (
        tenant_query("answer_runs", workspace_id)
        .eq("conversation_id", conversation_id)
        .execute()
    )
    answer_by_message = {
        str(row["assistant_message_id"]): row
        for row in answer_runs.data or []
        if row.get("assistant_message_id")
    }
    answer_run_ids = [str(row["id"]) for row in answer_runs.data or []]
    citations = tenant_query("message_citations", workspace_id).execute()
    citations_by_message: dict[str, list[MessageCitation]] = {}
    for row in citations.data or []:
        message_id = str(row["message_id"])
        citations_by_message.setdefault(message_id, []).append(_build_citation(row))

    claims_rows = tenant_query("claims", workspace_id).execute()
    claims_by_run: dict[str, list[Claim]] = {}
    for row in claims_rows.data or []:
        answer_run_id = row.get("answer_run_id")
        if answer_run_id is None or str(answer_run_id) not in answer_run_ids:
            continue
        claims_by_run.setdefault(str(answer_run_id), []).append(_build_claim(row))

    debate_rows = tenant_query("debate_turns", workspace_id).execute()
    debate_by_message: dict[str, list[DebateTurn]] = {}
    for row in debate_rows.data or []:
        message_id = str(row["message_id"])
        debate_by_message.setdefault(message_id, []).append(_build_debate_turn(row))

    abstention_rows = tenant_query("abstentions", workspace_id).execute()
    abstention_by_message = {
        str(row["message_id"]): _build_abstention(row)
        for row in abstention_rows.data or []
        if row.get("message_id")
    }

    evidence_rows = tenant_query("retrieval_run_evidence", workspace_id).execute()
    evidence_by_run: dict[str, list[RetrievalEvidenceResponse]] = {}
    for row in evidence_rows.data or []:
        retrieval_run_id = row.get("retrieval_run_id")
        if retrieval_run_id is None:
            continue
        evidence_by_run.setdefault(str(retrieval_run_id), []).append(_build_retrieved_evidence(row))

    items = [
        ChatMessage(
            id=str(row["id"]),
            workspaceId=workspace_id,
            conversationId=str(row["conversation_id"]),
            role=row["role"],
            content=row["content"],
            createdAt=row["created_at"],
            answerRunId=(
                str(answer_by_message[str(row["id"])]["id"])
                if str(row["id"]) in answer_by_message
                else None
            ),
            retrievalRunId=(
                str(answer_by_message[str(row["id"])]["retrieval_run_id"])
                if str(row["id"]) in answer_by_message
                else None
            ),
            trust=(
                _build_trust(answer_by_message[str(row["id"])])
                if str(row["id"]) in answer_by_message
                else None
            ),
            abstention=abstention_by_message.get(str(row["id"])),
            claims=(
                claims_by_run.get(str(answer_by_message[str(row["id"])]["id"]), [])
                if str(row["id"]) in answer_by_message
                else []
            ),
            debateTurns=debate_by_message.get(str(row["id"]), []),
            retrievedEvidence=(
                evidence_by_run.get(str(answer_by_message[str(row["id"])]["retrieval_run_id"]), [])
                if str(row["id"]) in answer_by_message
                else []
            ),
            citations=citations_by_message.get(str(row["id"]), []),
        )
        for row in messages.data or []
    ]

    return ConversationDetailResponse(
        conversation=ConversationSummary(
            id=str(conversation_row["id"]),
            workspaceId=workspace_id,
            title=conversation_row.get("title"),
            createdAt=conversation_row["created_at"],
            lastMessageAt=conversation_row.get("last_message_at") or conversation_row["created_at"],
            messageCount=len(items),
        ),
        messages=items,
    )
