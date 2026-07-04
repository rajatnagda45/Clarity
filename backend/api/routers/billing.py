"""
Stripe Billing — checkout, portal, and webhook endpoints.
"""
from __future__ import annotations

import json
import logging
from typing import Annotated, Literal

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


class CheckoutResponse(BaseModel):
    url: str


class PortalRequest(BaseModel):
    return_url: str


class PortalResponse(BaseModel):
    url: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_stripe():
    """Import and configure the Stripe SDK, raising 503 if not ready."""
    try:
        import stripe as _stripe  # type: ignore[import]
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe SDK not installed.",
        )
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe is not configured for this environment.",
        )
    _stripe.api_key = settings.stripe_secret_key
    return _stripe


def _price_id_for_plan(plan: str) -> str:
    mapping = {
        "pro": settings.stripe_price_id_pro,
        "team": settings.stripe_price_id_team,
    }
    price_id = mapping.get(plan, "")
    if not price_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"No Stripe price configured for plan '{plan}'.",
        )
    return price_id


def _plan_from_price_id(price_id: str) -> str:
    if price_id and price_id == settings.stripe_price_id_pro:
        return "pro"
    if price_id and price_id == settings.stripe_price_id_team:
        return "team"
    return "free"


def _attr(obj: object, *keys: str) -> str:
    """Safely traverse nested dict/object attributes, returning '' on any miss."""
    try:
        val: object = obj
        for k in keys:
            if isinstance(val, dict):
                val = val[k]
            else:
                val = getattr(val, k)
        return str(val) if val else ""
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
    stripe = _get_stripe()
    price_id = _price_id_for_plan(body.plan)

    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        client_reference_id=workspace_id,
        metadata={"workspace_id": workspace_id},
        success_url=body.success_url,
        cancel_url=body.cancel_url,
    )
    url: str = session["url"] if isinstance(session, dict) else session.url
    return CheckoutResponse(url=url)


@router.post("/portal", response_model=PortalResponse)
async def create_portal_session(
    body: PortalRequest,
    ws: Annotated[tuple[str, WorkspaceRole], Depends(require_workspace_role)],
) -> PortalResponse:
    workspace_id, _role = ws
    stripe = _get_stripe()

    result = (
        get_client()
        .table("workspaces")
        .select("stripe_customer_id")
        .eq("id", workspace_id)
        .limit(1)
        .execute()
    )
    row = (result.data or [None])[0]
    customer_id = (row or {}).get("stripe_customer_id", "")
    if not customer_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No active Stripe subscription found for this workspace.",
        )

    portal = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=body.return_url,
    )
    url: str = portal["url"] if isinstance(portal, dict) else portal.url
    return PortalResponse(url=url)


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook(request: Request) -> dict:
    """
    Public endpoint — Stripe calls this with its own signature header.
    Syncs subscription state into workspaces.plan after plan changes.
    """
    stripe = _get_stripe()
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if settings.stripe_webhook_secret:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.stripe_webhook_secret
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Stripe webhook signature.",
            )
    else:
        # Dev/test: no signature verification, parse raw JSON
        try:
            event = json.loads(payload)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON in webhook payload.",
            )

    event_type = _attr(event, "type")
    try:
        _handle_event(event_type, event)
    except Exception:
        logger.exception("Unhandled error processing Stripe event %s", event_type)

    return {"received": True}


def _handle_event(event_type: str, event: object) -> None:
    data = event["data"]["object"] if isinstance(event, dict) else event.data.object  # type: ignore[union-attr]
    client = get_client()

    if event_type == "checkout.session.completed":
        workspace_id = _attr(data, "client_reference_id")
        customer_id = _attr(data, "customer")
        subscription_id = _attr(data, "subscription")
        if workspace_id and customer_id:
            client.table("workspaces").update({
                "stripe_customer_id": customer_id,
                "stripe_subscription_id": subscription_id,
            }).eq("id", workspace_id).execute()

    elif event_type == "customer.subscription.updated":
        customer_id = _attr(data, "customer")
        # Extract first line item price ID
        try:
            items = data["items"]["data"] if isinstance(data, dict) else list(data.items.data)  # type: ignore[union-attr]
            first = items[0] if items else {}
            price_id = _attr(first, "price", "id")
        except (KeyError, IndexError, AttributeError):
            price_id = ""
        plan = _plan_from_price_id(price_id)
        if customer_id:
            client.table("workspaces").update({"plan": plan}).eq(
                "stripe_customer_id", customer_id
            ).execute()

    elif event_type == "customer.subscription.deleted":
        customer_id = _attr(data, "customer")
        if customer_id:
            client.table("workspaces").update({
                "plan": "free",
                "stripe_subscription_id": None,
            }).eq("stripe_customer_id", customer_id).execute()
