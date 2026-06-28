from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.responses import StreamingResponse

from api.deps import require_workspace_role
from db.client import tenant_query
from schemas import ChatRequest
from services.answer_generation.service import build_answer_stream, replay_answer_stream, stream_events


router = APIRouter(prefix="/api/chat", tags=["chat"])


def _error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


@router.post("")
async def start_chat_stream(
    payload: ChatRequest,
    membership: tuple[str, str] = Depends(require_workspace_role),
):
    workspace_id, _ = membership
    prepared = await build_answer_stream(
        workspace_id=workspace_id,
        query=payload.query,
        conversation_id=payload.conversation_id,
        document_ids=payload.document_ids,
        request_id=payload.request_id,
    )
    return StreamingResponse(stream_events(prepared.events), media_type="text/event-stream")


@router.get("/conversations/{conversation_id}/answers/{answer_run_id}/stream")
async def resume_chat_stream(
    conversation_id: str,
    answer_run_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
    after: int = 0,
):
    workspace_id, _ = membership
    answer_run = (
        tenant_query("answer_runs", workspace_id)
        .eq("id", answer_run_id)
        .eq("conversation_id", conversation_id)
        .limit(1)
        .execute()
    )
    if not answer_run.data:
        raise _error(status.HTTP_404_NOT_FOUND, "answer_run_not_found", "Answer run was not found.")
    if last_event_id and last_event_id.isdigit():
        after = max(after, int(last_event_id))
    return StreamingResponse(
        replay_answer_stream(workspace_id, answer_run_id, after_sequence=after),
        media_type="text/event-stream",
    )
