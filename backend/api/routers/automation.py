from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, Request, Response, status

from api.deps import require_workspace_role
from api.errors import api_error
from db.client import get_client, tenant_query
from schemas import (
    AutomationRuleListResponse,
    AutomationRuleResponse,
    CreateAutomationRuleRequest,
)

router = APIRouter(prefix="/api/enterprise", tags=["enterprise-automation"])


def _row_to_rule(row: dict) -> AutomationRuleResponse:
    return AutomationRuleResponse(
        id=str(row["id"]),
        workspace_id=str(row["workspace_id"]),
        name=row["name"],
        trigger_type=row["trigger_type"],
        condition=row.get("condition") or {},
        actions=row.get("actions") or [],
        enabled=row.get("enabled", True),
        run_count=row.get("run_count", 0),
        last_run_at=row.get("last_run_at"),
        created_at=row["created_at"],
    )


@router.get("/automation-rules", response_model=AutomationRuleListResponse)
async def list_automation_rules(
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> AutomationRuleListResponse:
    workspace_id, _ = ctx
    rows = (
        tenant_query("automation_rules", workspace_id)
        .select("*")
        .order("created_at", desc=True)
        .execute()
    ).data or []
    return AutomationRuleListResponse(rules=[_row_to_rule(r) for r in rows], total=len(rows))


@router.post("/automation-rules", response_model=AutomationRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_automation_rule(
    payload: CreateAutomationRuleRequest,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> AutomationRuleResponse:
    workspace_id, role = ctx
    if role not in ("owner", "editor"):
        raise api_error(403, "insufficient_role", "Editor or Owner role required.")

    row = get_client().table("automation_rules").insert({
        "id": str(uuid4()),
        "workspace_id": workspace_id,
        "name": payload.name,
        "trigger_type": payload.trigger_type,
        "condition": payload.condition,
        "actions": payload.actions,
        "enabled": True,
        "run_count": 0,
    }).execute().data

    if not row:
        raise api_error(502, "rule_creation_failed", "Failed to create automation rule.")
    return _row_to_rule(row[0])


@router.patch("/automation-rules/{rule_id}", response_model=AutomationRuleResponse)
async def toggle_automation_rule(
    rule_id: str,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> AutomationRuleResponse:
    workspace_id, _ = ctx
    rows = (
        tenant_query("automation_rules", workspace_id)
        .select("*")
        .eq("id", rule_id)
        .execute()
    ).data or []
    if not rows:
        raise api_error(404, "rule_not_found", "Automation rule not found.")

    updated = get_client().table("automation_rules").update({
        "enabled": not rows[0].get("enabled", True),
    }).eq("id", rule_id).eq("workspace_id", workspace_id).execute().data

    if not updated:
        raise api_error(502, "rule_update_failed", "Failed to update rule.")
    return _row_to_rule(updated[0])


@router.delete("/automation-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_automation_rule(
    rule_id: str,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> Response:
    workspace_id, _ = ctx
    rows = (
        tenant_query("automation_rules", workspace_id)
        .select("id")
        .eq("id", rule_id)
        .execute()
    ).data or []
    if not rows:
        raise api_error(404, "rule_not_found", "Automation rule not found.")

    get_client().table("automation_rules").delete().eq("id", rule_id).eq("workspace_id", workspace_id).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
