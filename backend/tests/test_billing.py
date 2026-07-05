"""
Unit tests for Dodo Payments billing endpoints.

All Dodo SDK calls and DB calls are mocked — no real network requests.
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
    q = MagicMock()
    q.select.return_value = q
    q.eq.return_value = q
    q.limit.return_value = q
    q.update.return_value = q
    q.execute.return_value = SimpleNamespace(data=execute_data)
    return q


def _db_client(role: str = "owner", dodo_customer_id: str | None = None) -> MagicMock:
    memberships_q = _chain_query([{"role": role}])
    workspaces_q = _chain_query([{"dodo_customer_id": dodo_customer_id}])
    mock = MagicMock()
    mock.table.side_effect = lambda name: {
        "memberships": memberships_q,
        "workspaces": workspaces_q,
    }.get(name, MagicMock())
    return mock


def _patch_db(db_mock: MagicMock):
    from contextlib import ExitStack
    from api import deps as deps_module
    from api.routers import billing as billing_router
    stack = ExitStack()
    stack.enter_context(patch.object(deps_module, "get_client", return_value=db_mock))
    stack.enter_context(patch.object(billing_router, "get_client", return_value=db_mock))
    return stack


def _mock_dodo_client():
    """Build a MagicMock that mirrors the Dodo SDK's client structure."""
    mock = MagicMock()

    # checkout_sessions.create → response with checkout_url
    mock.checkout_sessions.create.return_value = SimpleNamespace(
        checkout_url="https://checkout.dodopayments.com/test-session"
    )

    # customers.customer_portal.create → response with link
    mock.customers.customer_portal.create.return_value = SimpleNamespace(
        link="https://customer.dodopayments.com/portal/test"
    )

    # webhooks.unwrap raises by default — override per-test
    mock.webhooks.unwrap.side_effect = Exception("Unwrap not mocked")

    return mock


# ---------------------------------------------------------------------------
# POST /api/billing/checkout
# ---------------------------------------------------------------------------

class TestCheckout:
    @pytest.mark.asyncio
    async def test_returns_503_when_dodo_not_configured(self, client, token_a, workspace_id_a):
        db = _db_client()
        with _patch_db(db):
            with patch("api.routers.billing.settings") as mock_settings:
                mock_settings.dodo_api_key = ""
                mock_settings.dodo_webhook_secret = ""
                mock_settings.dodo_product_id_pro = ""
                mock_settings.dodo_product_id_team = ""
                mock_settings.environment = "development"
                resp = await client.post(
                    "/api/billing/checkout",
                    json={"plan": "pro", "success_url": "https://ok", "cancel_url": "https://cancel"},
                    headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
                )
        assert resp.status_code == 503

    @pytest.mark.asyncio
    async def test_returns_checkout_url(self, client, token_a, workspace_id_a):
        from api.routers import billing as billing_router

        mock_dodo = _mock_dodo_client()
        db = _db_client()
        with _patch_db(db):
            with patch.object(billing_router, "_get_dodo", return_value=mock_dodo):
                with patch.object(billing_router, "_product_id_for_plan", return_value="prod_pro"):
                    resp = await client.post(
                        "/api/billing/checkout",
                        json={"plan": "pro", "success_url": "https://ok", "cancel_url": "https://cancel"},
                        headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
                    )

        assert resp.status_code == 200
        assert resp.json()["url"] == "https://checkout.dodopayments.com/test-session"

    @pytest.mark.asyncio
    async def test_checkout_passes_workspace_id_in_metadata(self, client, token_a, workspace_id_a):
        from api.routers import billing as billing_router

        mock_dodo = _mock_dodo_client()
        db = _db_client()
        with _patch_db(db):
            with patch.object(billing_router, "_get_dodo", return_value=mock_dodo):
                with patch.object(billing_router, "_product_id_for_plan", return_value="prod_pro"):
                    await client.post(
                        "/api/billing/checkout",
                        json={"plan": "pro", "success_url": "https://ok", "cancel_url": "https://cancel"},
                        headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
                    )

        call_kwargs = mock_dodo.checkout_sessions.create.call_args.kwargs
        assert call_kwargs["metadata"]["workspace_id"] == workspace_id_a

    @pytest.mark.asyncio
    async def test_returns_422_when_product_not_configured(self, client, token_a, workspace_id_a):
        from api.routers import billing as billing_router

        mock_dodo = _mock_dodo_client()
        db = _db_client()
        with _patch_db(db):
            with patch.object(billing_router, "_get_dodo", return_value=mock_dodo):
                with patch("api.routers.billing.settings") as mock_settings:
                    mock_settings.dodo_api_key = "test_key"
                    mock_settings.dodo_product_id_pro = ""
                    mock_settings.dodo_product_id_team = ""
                    mock_settings.environment = "development"
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
    async def test_returns_422_when_no_dodo_customer(self, client, token_a, workspace_id_a):
        from api.routers import billing as billing_router

        mock_dodo = _mock_dodo_client()
        db = _db_client(dodo_customer_id=None)
        with _patch_db(db):
            with patch.object(billing_router, "_get_dodo", return_value=mock_dodo):
                resp = await client.post(
                    "/api/billing/portal",
                    json={"return_url": "https://app.example.com/billing"},
                    headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
                )

        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_returns_portal_url(self, client, token_a, workspace_id_a):
        from api.routers import billing as billing_router

        mock_dodo = _mock_dodo_client()
        db = _db_client(dodo_customer_id="cus_dodo_abc123")
        with _patch_db(db):
            with patch.object(billing_router, "_get_dodo", return_value=mock_dodo):
                resp = await client.post(
                    "/api/billing/portal",
                    json={"return_url": "https://app.example.com/billing"},
                    headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
                )

        assert resp.status_code == 200
        assert resp.json()["url"] == "https://customer.dodopayments.com/portal/test"


# ---------------------------------------------------------------------------
# POST /api/billing/webhook
# ---------------------------------------------------------------------------

class TestWebhook:
    def _payload(self, event_type: str, data: dict) -> bytes:
        return json.dumps({"type": event_type, "data": data}).encode()

    @pytest.mark.asyncio
    async def test_returns_400_on_invalid_signature(self, client):
        from api.routers import billing as billing_router

        mock_dodo = _mock_dodo_client()
        mock_dodo.webhooks.unwrap.side_effect = Exception("Bad sig")

        with patch.object(billing_router, "_get_dodo", return_value=mock_dodo):
            with patch("api.routers.billing.settings") as mock_settings:
                mock_settings.dodo_api_key = "test_key"
                mock_settings.dodo_webhook_secret = "whsec_fake"
                mock_settings.dodo_product_id_pro = ""
                mock_settings.dodo_product_id_team = ""
                mock_settings.environment = "development"
                resp = await client.post(
                    "/api/billing/webhook",
                    content=b'{"type":"test"}',
                    headers={"webhook-id": "test", "Content-Type": "application/json"},
                )

        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_subscription_active_saves_customer_and_plan(self, client):
        from api.routers import billing as billing_router

        mock_db = MagicMock()
        payload = self._payload("subscription.active", {
            "subscription_id": "sub_dodo_001",
            "customer": {"customer_id": "cus_dodo_new"},
            "product_id": "prod_pro_123",
            "metadata": {"workspace_id": "ws-test"},
        })

        with patch.object(billing_router, "get_client", return_value=mock_db):
            with patch("api.routers.billing.settings") as mock_settings:
                mock_settings.dodo_api_key = "test_key"
                mock_settings.dodo_webhook_secret = ""
                mock_settings.dodo_product_id_pro = "prod_pro_123"
                mock_settings.dodo_product_id_team = "prod_team_456"
                mock_settings.environment = "development"
                resp = await client.post(
                    "/api/billing/webhook",
                    content=payload,
                    headers={"Content-Type": "application/json"},
                )

        assert resp.status_code == 200
        assert resp.json() == {"received": True}
        mock_db.table.return_value.update.assert_called_once()
        update_args = mock_db.table.return_value.update.call_args.args[0]
        assert update_args["dodo_customer_id"] == "cus_dodo_new"
        assert update_args["plan"] == "pro"

    @pytest.mark.asyncio
    async def test_subscription_cancelled_resets_plan(self, client):
        from api.routers import billing as billing_router

        mock_db = MagicMock()
        payload = self._payload("subscription.cancelled", {
            "subscription_id": "sub_dodo_001",
            "customer": {"customer_id": "cus_dodo_existing"},
            "metadata": {"workspace_id": "ws-test"},
        })

        with patch.object(billing_router, "get_client", return_value=mock_db):
            with patch("api.routers.billing.settings") as mock_settings:
                mock_settings.dodo_api_key = "test_key"
                mock_settings.dodo_webhook_secret = ""
                mock_settings.dodo_product_id_pro = ""
                mock_settings.dodo_product_id_team = ""
                mock_settings.environment = "development"
                resp = await client.post(
                    "/api/billing/webhook",
                    content=payload,
                    headers={"Content-Type": "application/json"},
                )

        assert resp.status_code == 200
        update_args = mock_db.table.return_value.update.call_args.args[0]
        assert update_args.get("plan") == "free"

    @pytest.mark.asyncio
    async def test_unknown_event_type_returns_200(self, client):
        payload = json.dumps({"type": "payment.succeeded", "data": {}}).encode()

        with patch("api.routers.billing.settings") as mock_settings:
            mock_settings.dodo_api_key = "test_key"
            mock_settings.dodo_webhook_secret = ""
            mock_settings.environment = "development"
            resp = await client.post(
                "/api/billing/webhook",
                content=payload,
                headers={"Content-Type": "application/json"},
            )

        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# _plan_from_product_id helper
# ---------------------------------------------------------------------------

class TestPlanFromProductId:
    def test_maps_pro_product(self):
        from api.routers.billing import _plan_from_product_id
        with patch("api.routers.billing.settings") as mock_settings:
            mock_settings.dodo_product_id_pro = "prod_pro_123"
            mock_settings.dodo_product_id_team = "prod_team_456"
            assert _plan_from_product_id("prod_pro_123") == "pro"

    def test_maps_team_product(self):
        from api.routers.billing import _plan_from_product_id
        with patch("api.routers.billing.settings") as mock_settings:
            mock_settings.dodo_product_id_pro = "prod_pro_123"
            mock_settings.dodo_product_id_team = "prod_team_456"
            assert _plan_from_product_id("prod_team_456") == "team"

    def test_unknown_product_defaults_to_free(self):
        from api.routers.billing import _plan_from_product_id
        with patch("api.routers.billing.settings") as mock_settings:
            mock_settings.dodo_product_id_pro = "prod_pro_123"
            mock_settings.dodo_product_id_team = "prod_team_456"
            assert _plan_from_product_id("prod_unknown") == "free"
