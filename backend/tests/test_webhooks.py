from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest


def _memberships_query(role: str | None):
    q = MagicMock()
    q.select.return_value = q
    q.eq.return_value = q
    q.limit.return_value = q
    q.execute.return_value = SimpleNamespace(data=[{"role": role}] if role else [])
    return q


def _make_webhooks_query(data: list[dict]):
    q = MagicMock()
    q.select.return_value = q
    q.eq.return_value = q
    q.order.return_value = q
    q.limit.return_value = q
    q.execute.return_value = SimpleNamespace(data=data)
    return q


def _sample_webhook(wh_id: str = "wh-1", workspace_id: str = "00000000-0000-0000-0000-000000000001") -> dict:
    return {
        "id": wh_id,
        "workspace_id": workspace_id,
        "url": "https://example.com/hook",
        "events": ["document.indexed", "eval.completed"],
        "description": "Prod webhook",
        "enabled": True,
        "created_at": "2026-07-04T10:00:00Z",
    }


@pytest.mark.asyncio
async def test_list_webhooks_empty(client, token_a, workspace_id_a):
    from api.routers import webhooks as wh_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("owner")
    wh_query = _make_webhooks_query([])

    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(wh_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock), \
         patch.object(wh_router, "tenant_query", return_value=wh_query):
        response = await client.get(
            "/api/enterprise/webhooks",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["webhooks"] == []
    assert body["total"] == 0


@pytest.mark.asyncio
async def test_list_webhooks_populated(client, token_a, workspace_id_a):
    from api.routers import webhooks as wh_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("owner")
    wh_query = _make_webhooks_query([_sample_webhook()])

    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(wh_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock), \
         patch.object(wh_router, "tenant_query", return_value=wh_query):
        response = await client.get(
            "/api/enterprise/webhooks",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 200
    body = response.json()
    assert len(body["webhooks"]) == 1
    assert body["webhooks"][0]["url"] == "https://example.com/hook"
    assert body["webhooks"][0]["enabled"] is True


@pytest.mark.asyncio
async def test_create_webhook_as_editor(client, token_a, workspace_id_a):
    from api.routers import webhooks as wh_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("editor")
    insert_table = MagicMock()
    insert_table.insert.return_value = insert_table
    insert_table.execute.return_value = SimpleNamespace(data=[_sample_webhook()])

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "webhooks": insert_table,
    }[name]

    with patch.object(wh_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock):
        response = await client.post(
            "/api/enterprise/webhooks",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
            json={"url": "https://example.com/hook", "events": ["document.indexed"]},
        )

    assert response.status_code == 201
    body = response.json()
    assert body["url"] == "https://example.com/hook"
    assert "secretPreview" in body


@pytest.mark.asyncio
async def test_create_webhook_viewer_rejected(client, token_a, workspace_id_a):
    from api.routers import webhooks as wh_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(wh_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock):
        response = await client.post(
            "/api/enterprise/webhooks",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
            json={"url": "https://example.com/hook", "events": ["document.indexed"]},
        )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_delete_webhook(client, token_a, workspace_id_a):
    from api.routers import webhooks as wh_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("owner")
    wh_query = _make_webhooks_query([{"id": "wh-1"}])
    delete_table = MagicMock()
    delete_table.delete.return_value = delete_table
    delete_table.eq.return_value = delete_table
    delete_table.execute.return_value = SimpleNamespace(data=[])

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "webhooks": delete_table,
    }[name]

    with patch.object(wh_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock), \
         patch.object(wh_router, "tenant_query", return_value=wh_query):
        response = await client.delete(
            "/api/enterprise/webhooks/wh-1",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 204


@pytest.mark.asyncio
async def test_delete_nonexistent_webhook_returns_404(client, token_a, workspace_id_a):
    from api.routers import webhooks as wh_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("owner")
    wh_query = _make_webhooks_query([])
    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(wh_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock), \
         patch.object(wh_router, "tenant_query", return_value=wh_query):
        response = await client.delete(
            "/api/enterprise/webhooks/nonexistent",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "webhook_not_found"


@pytest.mark.asyncio
async def test_list_webhook_deliveries(client, token_a, workspace_id_a):
    from api.routers import webhooks as wh_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("owner")
    delivery_data = [{
        "id": "del-1",
        "workspace_id": workspace_id_a,
        "webhook_id": "wh-1",
        "event_type": "document.indexed",
        "status": "success",
        "response_code": 200,
        "latency_ms": 42,
        "error": None,
        "created_at": "2026-07-04T10:00:00Z",
    }]
    deliveries_query = _make_webhooks_query(delivery_data)

    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(wh_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock), \
         patch.object(wh_router, "tenant_query", return_value=deliveries_query):
        response = await client.get(
            "/api/enterprise/webhooks/wh-1/deliveries",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 200
    body = response.json()
    assert len(body["deliveries"]) == 1
    assert body["deliveries"][0]["status"] == "success"
    assert body["deliveries"][0]["responseCode"] == 200
