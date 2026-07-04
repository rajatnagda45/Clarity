from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from api.deps import require_workspace_role
from db.client import tenant_query
from schemas import AuditLogListResponse, AuditLogResponse

router = APIRouter(prefix="/api/enterprise", tags=["enterprise-audit"])


@router.get("/audit-logs", response_model=AuditLogListResponse)
async def list_audit_logs(
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
    action: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    resource_type: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> AuditLogListResponse:
    workspace_id, _ = ctx
    q = (
        tenant_query("audit_logs", workspace_id)
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .offset(offset)
    )
    if action:
        q = q.eq("action", action)
    if user_id:
        q = q.eq("user_id", user_id)
    if resource_type:
        q = q.eq("resource_type", resource_type)
    if severity:
        q = q.eq("severity", severity)

    rows = q.execute().data or []
    logs = [
        AuditLogResponse(
            id=str(r["id"]),
            workspace_id=str(r["workspace_id"]),
            user_id=r.get("user_id"),
            action=r["action"],
            resource_type=r.get("resource_type"),
            resource_id=r.get("resource_id"),
            metadata=r.get("metadata") or {},
            ip_address=r.get("ip_address"),
            severity=r.get("severity", "info"),
            created_at=r["created_at"],
        )
        for r in rows
    ]
    return AuditLogListResponse(logs=logs, total=len(logs))
