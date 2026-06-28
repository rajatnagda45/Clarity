from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import require_workspace_role
from db.client import tenant_query
from schemas import (
    ChunkSourceOffset,
    ChatMessage,
    ConversationDetailResponse,
    ConversationListResponse,
    ConversationSummary,
    MessageCitation,
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
    citations = tenant_query("message_citations", workspace_id).execute()
    citations_by_message: dict[str, list[MessageCitation]] = {}
    for row in citations.data or []:
        message_id = str(row["message_id"])
        citations_by_message.setdefault(message_id, []).append(_build_citation(row))

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
