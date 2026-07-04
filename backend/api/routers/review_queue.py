from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request

from api.deps import require_workspace_role
from api.errors import api_error
from db.client import get_client, tenant_query
from schemas import (
    ReviewDecisionRequest,
    ReviewQueueItemResponse,
    ReviewQueueListResponse,
)

router = APIRouter(prefix="/api/review-queue", tags=["review-queue"])


def _row_to_item(row: dict) -> ReviewQueueItemResponse:
    return ReviewQueueItemResponse(
        id=str(row["id"]),
        workspace_id=str(row["workspace_id"]),
        agent_id=str(row["agent_id"]),
        agent_name=row.get("agent_name") or "",
        run_id=str(row["run_id"]),
        input=row["input"],
        output=row["output"],
        trust_score=row.get("trust_score"),
        confidence=row.get("confidence"),
        reason=row.get("reason") or "",
        priority=row.get("priority") or "medium",
        status=row.get("status") or "pending",
        reviewed_by=row.get("reviewed_by"),
        review_comment=row.get("review_comment"),
        review_verdict=row.get("review_verdict"),
        reviewed_at=row.get("reviewed_at"),
        created_at=row["created_at"],
    )


@router.get("", response_model=ReviewQueueListResponse)
async def list_review_queue(
    request: Request,
    status_filter: str | None = None,
    priority: str | None = None,
    limit: int = 50,
    offset: int = 0,
    ctx: tuple = Depends(require_workspace_role),
) -> ReviewQueueListResponse:
    workspace_id, _ = ctx
    q = tenant_query("review_queue", workspace_id).select("*").order("created_at", desc=True)
    if status_filter:
        q = q.eq("status", status_filter)
    if priority:
        q = q.eq("priority", priority)

    rows = (q.limit(min(limit, 500)).offset(offset).execute()).data or []

    pending_rows = (
        tenant_query("review_queue", workspace_id)
        .select("id")
        .eq("status", "pending")
        .execute()
    ).data or []

    return ReviewQueueListResponse(
        items=[_row_to_item(r) for r in rows],
        total=len(rows),
        pending_count=len(pending_rows),
    )


@router.post("/{item_id}/review", response_model=ReviewQueueItemResponse)
async def submit_review_decision(
    item_id: str,
    payload: ReviewDecisionRequest,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> ReviewQueueItemResponse:
    workspace_id, _ = ctx
    user_id = request.state.user_id

    rows = (
        tenant_query("review_queue", workspace_id).select("*").eq("id", item_id).execute()
    ).data or []
    if not rows:
        raise api_error(404, "review_item_not_found", "Review queue item not found.")

    now_iso = datetime.now(UTC).isoformat()
    updates: dict = {
        "status": payload.verdict,
        "reviewed_by": user_id,
        "review_verdict": payload.verdict,
        "review_comment": payload.comment,
        "reviewed_at": now_iso,
    }

    if payload.verdict == "edited" and payload.edited_output:
        get_client().table("agent_runs").update({
            "output": payload.edited_output,
            "review_verdict": payload.verdict,
            "reviewed_by": user_id,
            "review_comment": payload.comment,
        }).eq("id", str(rows[0]["run_id"])).execute()

    result = get_client().table("review_queue").update(updates).eq("id", item_id).execute().data
    if not result:
        raise api_error(502, "review_failed", "Failed to submit review decision.")
    return _row_to_item(result[0])


@router.get("/stats", response_model=dict)
async def get_review_stats(
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> dict:
    workspace_id, _ = ctx
    all_items = (
        tenant_query("review_queue", workspace_id).select("status,priority").execute()
    ).data or []

    pending = sum(1 for i in all_items if i.get("status") == "pending")
    approved = sum(1 for i in all_items if i.get("status") == "approved")
    rejected = sum(1 for i in all_items if i.get("status") == "rejected")
    edited = sum(1 for i in all_items if i.get("status") == "edited")
    critical = sum(1 for i in all_items if i.get("priority") == "critical" and i.get("status") == "pending")
    high = sum(1 for i in all_items if i.get("priority") == "high" and i.get("status") == "pending")

    return {
        "total": len(all_items),
        "pending": pending,
        "approved": approved,
        "rejected": rejected,
        "edited": edited,
        "criticalPending": critical,
        "highPending": high,
    }
