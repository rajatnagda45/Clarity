from __future__ import annotations

import hashlib
import secrets
from uuid import uuid4

from fastapi import APIRouter, Depends, Request, Response, status

from api.deps import require_workspace_role
from api.errors import api_error
from db.client import get_client, tenant_query
from schemas import (
    CreateWebhookRequest,
    WebhookDeliveryListResponse,
    WebhookDeliveryResponse,
    WebhookListResponse,
    WebhookResponse,
)

router = APIRouter(prefix="/api/enterprise", tags=["enterprise-webhooks"])


def _row_to_webhook(row: dict) -> WebhookResponse:
    return WebhookResponse(
        id=str(row["id"]),
        workspace_id=str(row["workspace_id"]),
        url=row["url"],
        events=row.get("events") or [],
        description=row.get("description"),
        enabled=row.get("enabled", True),
        secret_preview=None,
        created_at=row["created_at"],
    )


@router.get("/webhooks", response_model=WebhookListResponse)
async def list_webhooks(
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> WebhookListResponse:
    workspace_id, _ = ctx
    rows = (
        tenant_query("webhooks", workspace_id)
        .select("id, workspace_id, url, events, description, enabled, created_at")
        .order("created_at", desc=True)
        .execute()
    ).data or []
    return WebhookListResponse(webhooks=[_row_to_webhook(r) for r in rows], total=len(rows))


@router.post("/webhooks", response_model=WebhookResponse, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    payload: CreateWebhookRequest,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> WebhookResponse:
    workspace_id, role = ctx
    if role not in ("owner", "editor"):
        raise api_error(403, "insufficient_role", "Editor or Owner role required.")

    secret = secrets.token_hex(32)
    row = get_client().table("webhooks").insert({
        "id": str(uuid4()),
        "workspace_id": workspace_id,
        "url": payload.url,
        "events": payload.events,
        "description": payload.description,
        "secret_hash": hashlib.sha256(secret.encode()).hexdigest(),
        "enabled": True,
    }).execute().data

    if not row:
        raise api_error(502, "webhook_creation_failed", "Failed to create webhook.")

    webhook = _row_to_webhook(row[0])
    webhook.secret_preview = secret
    return webhook


@router.patch("/webhooks/{webhook_id}", response_model=WebhookResponse)
async def toggle_webhook(
    webhook_id: str,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> WebhookResponse:
    workspace_id, _ = ctx
    rows = (
        tenant_query("webhooks", workspace_id)
        .select("*")
        .eq("id", webhook_id)
        .execute()
    ).data or []
    if not rows:
        raise api_error(404, "webhook_not_found", "Webhook not found.")

    updated = get_client().table("webhooks").update({
        "enabled": not rows[0].get("enabled", True),
    }).eq("id", webhook_id).execute().data

    if not updated:
        raise api_error(502, "webhook_update_failed", "Failed to update webhook.")
    return _row_to_webhook(updated[0])


@router.delete("/webhooks/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(
    webhook_id: str,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> Response:
    workspace_id, _ = ctx
    rows = (
        tenant_query("webhooks", workspace_id)
        .select("id")
        .eq("id", webhook_id)
        .execute()
    ).data or []
    if not rows:
        raise api_error(404, "webhook_not_found", "Webhook not found.")

    get_client().table("webhooks").delete().eq("id", webhook_id).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/webhooks/{webhook_id}/deliveries", response_model=WebhookDeliveryListResponse)
async def list_webhook_deliveries(
    webhook_id: str,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> WebhookDeliveryListResponse:
    workspace_id, _ = ctx
    rows = (
        tenant_query("webhook_deliveries", workspace_id)
        .select("*")
        .eq("webhook_id", webhook_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    ).data or []
    deliveries = [
        WebhookDeliveryResponse(
            id=str(r["id"]),
            webhook_id=webhook_id,
            workspace_id=workspace_id,
            event_type=r.get("event_type", ""),
            status=r.get("status", "pending"),
            response_code=r.get("response_code"),
            latency_ms=r.get("latency_ms"),
            error=r.get("error"),
            created_at=r["created_at"],
        )
        for r in rows
    ]
    return WebhookDeliveryListResponse(deliveries=deliveries, total=len(deliveries))
