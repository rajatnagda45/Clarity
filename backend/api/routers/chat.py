from __future__ import annotations

import json

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, status
from fastapi.responses import StreamingResponse

from api.deps import require_workspace_role
from db.client import tenant_query
from schemas import ChatRequest
from services.answer_generation.service import (
    generate_live_answer_stream,
    replay_answer_stream,
)
from services.eval.engine import schedule_eval


router = APIRouter(prefix="/api/chat", tags=["chat"])


def _error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


@router.post("")
async def start_chat_stream(
    payload: ChatRequest,
    background_tasks: BackgroundTasks,
    membership: tuple[str, str] = Depends(require_workspace_role),
):
    workspace_id, _ = membership

    async def _generator():
        answer_run_id: str | None = None
        assistant_message_id: str | None = None
        try:
            async for event_str in generate_live_answer_stream(
                workspace_id=workspace_id,
                query=payload.query,
                conversation_id=payload.conversation_id,
                document_ids=payload.document_ids,
                request_id=payload.request_id,
            ):
                # Intercept the meta event to capture IDs for eval scheduling
                if event_str and answer_run_id is None and '"type": "meta"' in event_str:
                    try:
                        data_part = event_str.split("data: ", 1)[1].strip()
                        meta = json.loads(data_part)
                        answer_run_id = meta.get("answerRunId")
                        assistant_message_id = meta.get("assistantMessageId")
                    except Exception:
                        pass
                yield event_str
        except BaseException as exc:
            cause = exc.exceptions[0] if isinstance(exc, BaseExceptionGroup) else exc
            yield f"id: 0\ndata: {json.dumps({'type': 'error', 'code': 'stream_failed', 'message': str(cause)})}\n\n"
            yield f"id: 1\ndata: {json.dumps({'type': 'done'})}\n\n"
            return

        # Schedule LLM-as-judge eval after the answer is fully streamed
        if assistant_message_id and answer_run_id:
            from job_queue.client import enqueue_or_background
            await enqueue_or_background(
                "run_eval",
                schedule_eval,
                answer_run_id,
                workspace_id,
                background_tasks=background_tasks,
            )

    return StreamingResponse(_generator(), media_type="text/event-stream")


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
