"""
Dodo Payments Billing — checkout, customer portal, and webhook endpoints.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Annotated, Literal

import dodopayments
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from api.deps import WorkspaceRole, require_workspace_role
from config import settings
from db.client import get_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/billing", tags=["billing"])


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class CheckoutRequest(BaseModel):
    plan: Literal["pro", "team"]
    success_url: str
    cancel_url: str
    billing_period: Literal["monthly", "yearly"] = "monthly"


class CheckoutResponse(BaseModel):
    url: str


class PortalRequest(BaseModel):
    return_url: str


class PortalResponse(BaseModel):
    url: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_dodo() -> dodopayments.DodoPayments:
    """Return a configured Dodo Payments SDK client, raising 503 if not ready."""
    if not settings.dodo_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Dodo Payments is not configured for this environment.",
        )
    environment: Literal["live_mode", "test_mode"] = (
        "live_mode" if settings.environment == "production" else "test_mode"
    )
    return dodopayments.DodoPayments(
        bearer_token=settings.dodo_api_key,
        environment=environment,
    )


def _product_id_for_plan(plan: str, billing_period: str = "monthly") -> str:
    yearly = billing_period == "yearly"
    mapping = {
        "pro":  (settings.dodo_product_id_pro_yearly or settings.dodo_product_id_pro) if yearly
                else settings.dodo_product_id_pro,
        "team": (settings.dodo_product_id_team_yearly or settings.dodo_product_id_team) if yearly
                else settings.dodo_product_id_team,
    }
    product_id = mapping.get(plan, "")
    if not product_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"No Dodo product configured for plan '{plan}'.",
        )
    return product_id


def _plan_from_product_id(product_id: str) -> str:
    if product_id and product_id == settings.dodo_product_id_pro:
        return "pro"
    if product_id and product_id == settings.dodo_product_id_team:
        return "team"
    return "free"


def _get_field(obj: object, *keys: str) -> str:
    """Safely traverse nested dict/object attributes, returning '' on any miss."""
    try:
        val: object = obj
        for k in keys:
            if isinstance(val, dict):
                val = val[k]
            else:
                val = getattr(val, k)
        return str(val) if val is not None else ""
    except (KeyError, AttributeError, TypeError):
        return ""


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout_session(
    body: CheckoutRequest,
    ws: Annotated[tuple[str, WorkspaceRole], Depends(require_workspace_role)],
) -> CheckoutResponse:
    workspace_id, _role = ws
    dodo = _get_dodo()
    product_id = _product_id_for_plan(body.plan, body.billing_period)

    session = await asyncio.to_thread(
        lambda: dodo.checkout_sessions.create(
            product_cart=[{"product_id": product_id, "quantity": 1}],
            metadata={"workspace_id": workspace_id},
            return_url=body.success_url,
            cancel_url=body.cancel_url,
        )
    )
    return CheckoutResponse(url=session.checkout_url)


@router.post("/portal", response_model=PortalResponse)
async def create_portal_session(
    body: PortalRequest,
    ws: Annotated[tuple[str, WorkspaceRole], Depends(require_workspace_role)],
) -> PortalResponse:
    workspace_id, _role = ws
    dodo = _get_dodo()

    result = (
        get_client()
        .table("workspaces")
        .select("dodo_customer_id")
        .eq("id", workspace_id)
        .limit(1)
        .execute()
    )
    row = (result.data or [None])[0]
    customer_id = (row or {}).get("dodo_customer_id", "")
    if not customer_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No active subscription found for this workspace.",
        )

    portal = await asyncio.to_thread(
        lambda: dodo.customers.customer_portal.create(
            customer_id,
            return_url=body.return_url,
        )
    )
    return PortalResponse(url=portal.link)


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def dodo_webhook(request: Request) -> dict:
    """
    Public endpoint — Dodo Payments calls this to deliver lifecycle events.
    Syncs subscription state into workspaces after plan changes.
    """
    if not settings.dodo_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Dodo Payments is not configured.",
        )

    payload_bytes = await request.body()
    payload_str = payload_bytes.decode()
    headers_dict = dict(request.headers)
    dodo = _get_dodo()

    if settings.dodo_webhook_secret:
        try:
            event = await asyncio.to_thread(
                lambda: dodo.webhooks.unwrap(
                    payload_str,
                    headers=headers_dict,
                    key=settings.dodo_webhook_secret,
                )
            )
        except Exception as exc:
            logger.warning("Dodo webhook signature verification failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Dodo webhook signature.",
            )
    else:
        # Dev/test: skip signature verification, use raw JSON
        try:
            event = json.loads(payload_str)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON in webhook payload.",
            )

    try:
        _handle_event(event)
    except Exception:
        logger.exception("Unhandled error processing Dodo webhook event")

    return {"received": True}


def _handle_event(event: object) -> None:
    """Dispatch a Dodo webhook event to the appropriate sync handler."""
    if isinstance(event, dict):
        event_type: str = event.get("type", "")
        data: object = event.get("data", {})
    else:
        event_type = getattr(event, "type", "")
        data = getattr(event, "data", None)

    client = get_client()

    if event_type in ("subscription.active", "subscription.renewed", "subscription.plan_changed"):
        _sync_active_subscription(client, data)
    elif event_type == "subscription.updated":
        _sync_active_subscription(client, data)
    elif event_type in ("subscription.cancelled", "subscription.expired", "subscription.failed"):
        _handle_subscription_end(client, data)


def _sync_active_subscription(client: object, data: object) -> None:
    subscription_id = _get_field(data, "subscription_id")
    customer_id = _get_field(data, "customer", "customer_id")
    product_id = _get_field(data, "product_id")
    workspace_id = _get_field(data, "metadata", "workspace_id")
    plan = _plan_from_product_id(product_id)

    update_payload = {
        "dodo_customer_id": customer_id,
        "dodo_subscription_id": subscription_id,
        "plan": plan,
    }

    if workspace_id:
        client.table("workspaces").update(update_payload).eq("id", workspace_id).execute()
    elif customer_id:
        client.table("workspaces").update({
            "dodo_subscription_id": subscription_id,
            "plan": plan,
        }).eq("dodo_customer_id", customer_id).execute()


def _handle_subscription_end(client: object, data: object) -> None:
    customer_id = _get_field(data, "customer", "customer_id")
    workspace_id = _get_field(data, "metadata", "workspace_id")

    end_payload = {"plan": "free", "dodo_subscription_id": None}

    if workspace_id:
        client.table("workspaces").update(end_payload).eq("id", workspace_id).execute()
    elif customer_id:
        client.table("workspaces").update(end_payload).eq("dodo_customer_id", customer_id).execute()
