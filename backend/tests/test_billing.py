"""
Unit tests for the Stripe billing endpoints.

Uses the conftest async client with real HS256 JWTs.
All Stripe SDK calls and DB calls are mocked — no real network requests.
"""
from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# DB mock helpers
# ---------------------------------------------------------------------------

def _chain_query(execute_data: list) -> MagicMock:
    """Returns a MagicMock that chains select/eq/limit/update/execute calls."""
    q = MagicMock()
    q.select.return_value = q
    q.eq.return_value = q
    q.limit.return_value = q
    q.update.return_value = q
    q.execute.return_value = SimpleNamespace(data=execute_data)
    return q


def _db_client(role: str = "owner", stripe_customer_id: str | None = None) -> MagicMock:
    """DB client mock with memberships and workspaces table behaviour."""
    memberships_q = _chain_query([{"role": role}])
    workspaces_q = _chain_query([{"stripe_customer_id": stripe_customer_id}])
    mock = MagicMock()
    mock.table.side_effect = lambda name: {
        "memberships": memberships_q,
        "workspaces": workspaces_q,
    }.get(name, MagicMock())
    return mock


def _patch_db(db_mock: MagicMock):
    """Context-manager stack that patches DB access in both deps and billing router."""
    from contextlib import ExitStack
    from api import deps as deps_module
    from api.routers import billing as billing_router
    stack = ExitStack()
    stack.enter_context(patch.object(deps_module, "get_client", return_value=db_mock))
    stack.enter_context(patch.object(billing_router, "get_client", return_value=db_mock))
    return stack


# ---------------------------------------------------------------------------
# POST /api/billing/checkout
# ---------------------------------------------------------------------------

class TestCheckout:
    @pytest.mark.asyncio
    async def test_returns_503_when_stripe_not_configured(self, client, token_a, workspace_id_a):
        db = _db_client()
        with _patch_db(db):
            with patch("api.routers.billing.settings") as mock_settings:
                mock_settings.stripe_secret_key = ""
                mock_settings.stripe_webhook_secret = ""
                mock_settings.stripe_price_id_pro = ""
                mock_settings.stripe_price_id_team = ""
                resp = await client.post(
                    "/api/billing/checkout",
                    json={"plan": "pro", "success_url": "https://ok", "cancel_url": "https://cancel"},
                    headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
                )
        assert resp.status_code == 503

    @pytest.mark.asyncio
    async def test_returns_checkout_url(self, client, token_a, workspace_id_a):
        from api.routers import billing as billing_router

        mock_session = MagicMock()
        mock_session.url = "https://checkout.stripe.com/test-session"
        mock_stripe = MagicMock()
        mock_stripe.checkout.Session.create.return_value = mock_session

        db = _db_client()
        with _patch_db(db):
            with patch.object(billing_router, "_get_stripe", return_value=mock_stripe):
                with patch.object(billing_router, "_price_id_for_plan", return_value="price_pro"):
                    resp = await client.post(
                        "/api/billing/checkout",
                        json={"plan": "pro", "success_url": "https://ok", "cancel_url": "https://cancel"},
                        headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
                    )

        assert resp.status_code == 200
        assert resp.json()["url"] == "https://checkout.stripe.com/test-session"

    @pytest.mark.asyncio
    async def test_checkout_passes_workspace_id_as_client_reference(self, client, token_a, workspace_id_a):
        from api.routers import billing as billing_router

        mock_session = MagicMock()
        mock_session.url = "https://checkout.stripe.com/x"
        mock_stripe = MagicMock()
        mock_stripe.checkout.Session.create.return_value = mock_session

        db = _db_client()
        with _patch_db(db):
            with patch.object(billing_router, "_get_stripe", return_value=mock_stripe):
                with patch.object(billing_router, "_price_id_for_plan", return_value="price_pro"):
                    await client.post(
                        "/api/billing/checkout",
                        json={"plan": "pro", "success_url": "https://ok", "cancel_url": "https://cancel"},
                        headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
                    )

        call_kwargs = mock_stripe.checkout.Session.create.call_args.kwargs
        assert call_kwargs["client_reference_id"] == workspace_id_a
        assert call_kwargs["metadata"]["workspace_id"] == workspace_id_a

    @pytest.mark.asyncio
    async def test_returns_422_when_price_not_configured(self, client, token_a, workspace_id_a):
        from api.routers import billing as billing_router

        mock_stripe = MagicMock()
        db = _db_client()
        with _patch_db(db):
            with patch.object(billing_router, "_get_stripe", return_value=mock_stripe):
                with patch("api.routers.billing.settings") as mock_settings:
                    mock_settings.stripe_secret_key = "sk_test_fake"
                    mock_settings.stripe_price_id_pro = ""
                    mock_settings.stripe_price_id_team = ""
                    resp = await client.post(
                        "/api/billing/checkout",
                        json={"plan": "pro", "success_url": "https://ok", "cancel_url": "https://cancel"},
                        headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
                    )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/billing/portal
# ---------------------------------------------------------------------------

class TestPortal:
    @pytest.mark.asyncio
    async def test_returns_422_when_no_stripe_customer(self, client, token_a, workspace_id_a):
        from api.routers import billing as billing_router

        mock_stripe = MagicMock()
        db = _db_client(stripe_customer_id=None)
        with _patch_db(db):
            with patch.object(billing_router, "_get_stripe", return_value=mock_stripe):
                resp = await client.post(
                    "/api/billing/portal",
                    json={"return_url": "https://app.example.com/billing"},
                    headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
                )

        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_returns_portal_url(self, client, token_a, workspace_id_a):
        from api.routers import billing as billing_router

        mock_portal = MagicMock()
        mock_portal.url = "https://billing.stripe.com/portal/test"
        mock_stripe = MagicMock()
        mock_stripe.billing_portal.Session.create.return_value = mock_portal

        db = _db_client(stripe_customer_id="cus_abc123")
        with _patch_db(db):
            with patch.object(billing_router, "_get_stripe", return_value=mock_stripe):
                resp = await client.post(
                    "/api/billing/portal",
                    json={"return_url": "https://app.example.com/billing"},
                    headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
                )

        assert resp.status_code == 200
        assert resp.json()["url"] == "https://billing.stripe.com/portal/test"


# ---------------------------------------------------------------------------
# POST /api/billing/webhook  (public path — no JWT needed)
# ---------------------------------------------------------------------------

class TestWebhook:
    def _payload(self, event_type: str, data: dict) -> bytes:
        return json.dumps({"type": event_type, "data": {"object": data}}).encode()

    @pytest.mark.asyncio
    async def test_returns_400_on_invalid_signature(self, client):
        from api.routers import billing as billing_router

        mock_stripe = MagicMock()
        mock_stripe.Webhook.construct_event.side_effect = Exception("Bad sig")

        with patch.object(billing_router, "_get_stripe", return_value=mock_stripe):
            with patch("api.routers.billing.settings") as mock_settings:
                mock_settings.stripe_secret_key = "sk_test_fake"
                mock_settings.stripe_webhook_secret = "whsec_fake"
                mock_settings.stripe_price_id_pro = ""
                mock_settings.stripe_price_id_team = ""
                resp = await client.post(
                    "/api/billing/webhook",
                    content=b'{"type":"test"}',
                    headers={"stripe-signature": "invalid", "Content-Type": "application/json"},
                )

        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_checkout_completed_saves_customer_id(self, client):
        from api.routers import billing as billing_router

        mock_db = MagicMock()
        mock_stripe = MagicMock()
        payload = self._payload("checkout.session.completed", {
            "client_reference_id": "ws-test",
            "customer": "cus_newcustomer",
            "subscription": "sub_abc",
        })

        with patch.object(billing_router, "_get_stripe", return_value=mock_stripe):
            with patch.object(billing_router, "get_client", return_value=mock_db):
                with patch("api.routers.billing.settings") as mock_settings:
                    mock_settings.stripe_secret_key = "sk_test_fake"
                    mock_settings.stripe_webhook_secret = ""
                    mock_settings.stripe_price_id_pro = ""
                    mock_settings.stripe_price_id_team = ""
                    resp = await client.post(
                        "/api/billing/webhook",
                        content=payload,
                        headers={"Content-Type": "application/json"},
                    )

        assert resp.status_code == 200
        assert resp.json() == {"received": True}
        mock_db.table.return_value.update.assert_called_once()

    @pytest.mark.asyncio
    async def test_subscription_deleted_resets_plan(self, client):
        from api.routers import billing as billing_router

        mock_db = MagicMock()
        mock_stripe = MagicMock()
        payload = self._payload("customer.subscription.deleted", {"customer": "cus_existing"})

        with patch.object(billing_router, "_get_stripe", return_value=mock_stripe):
            with patch.object(billing_router, "get_client", return_value=mock_db):
                with patch("api.routers.billing.settings") as mock_settings:
                    mock_settings.stripe_secret_key = "sk_test_fake"
                    mock_settings.stripe_webhook_secret = ""
                    mock_settings.stripe_price_id_pro = ""
                    mock_settings.stripe_price_id_team = ""
                    resp = await client.post(
                        "/api/billing/webhook",
                        content=payload,
                        headers={"Content-Type": "application/json"},
                    )

        assert resp.status_code == 200
        update_args = mock_db.table.return_value.update.call_args
        updated = update_args.args[0] if update_args.args else {}
        assert updated.get("plan") == "free"

    @pytest.mark.asyncio
    async def test_unknown_event_type_returns_200(self, client):
        from api.routers import billing as billing_router

        mock_stripe = MagicMock()
        payload = json.dumps({"type": "payment_intent.created", "data": {"object": {}}}).encode()

        with patch.object(billing_router, "_get_stripe", return_value=mock_stripe):
            with patch("api.routers.billing.settings") as mock_settings:
                mock_settings.stripe_secret_key = "sk_test_fake"
                mock_settings.stripe_webhook_secret = ""
                resp = await client.post(
                    "/api/billing/webhook",
                    content=payload,
                    headers={"Content-Type": "application/json"},
                )

        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# _plan_from_price_id helper
# ---------------------------------------------------------------------------

class TestPlanFromPriceId:
    def test_maps_pro_price(self):
        from api.routers.billing import _plan_from_price_id
        with patch("api.routers.billing.settings") as mock_settings:
            mock_settings.stripe_price_id_pro = "price_pro_123"
            mock_settings.stripe_price_id_team = "price_team_456"
            assert _plan_from_price_id("price_pro_123") == "pro"

    def test_maps_team_price(self):
        from api.routers.billing import _plan_from_price_id
        with patch("api.routers.billing.settings") as mock_settings:
            mock_settings.stripe_price_id_pro = "price_pro_123"
            mock_settings.stripe_price_id_team = "price_team_456"
            assert _plan_from_price_id("price_team_456") == "team"

    def test_unknown_price_defaults_to_free(self):
        from api.routers.billing import _plan_from_price_id
        with patch("api.routers.billing.settings") as mock_settings:
            mock_settings.stripe_price_id_pro = "price_pro_123"
            mock_settings.stripe_price_id_team = "price_team_456"
            assert _plan_from_price_id("price_unknown") == "free"
