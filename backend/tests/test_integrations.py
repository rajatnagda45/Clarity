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


def _make_integrations_query(data: list[dict]):
    q = MagicMock()
    q.select.return_value = q
    q.eq.return_value = q
    q.execute.return_value = SimpleNamespace(data=data)
    return q


@pytest.mark.asyncio
async def test_list_integrations_returns_full_catalog(client, token_a, workspace_id_a):
    from api.routers import integrations as int_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("owner")
    int_query = _make_integrations_query([])

    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(int_router, "tenant_query", return_value=int_query), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock):
        response = await client.get(
            "/api/enterprise/integrations",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 200
    body = response.json()
    assert len(body["integrations"]) == 13
    providers = [i["provider"] for i in body["integrations"]]
    assert "google_drive" in providers
    assert "slack" in providers
    assert "github" in providers


@pytest.mark.asyncio
async def test_list_integrations_shows_not_connected_by_default(client, token_a, workspace_id_a):
    from api.routers import integrations as int_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    int_query = _make_integrations_query([])

    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(int_router, "tenant_query", return_value=int_query), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock):
        response = await client.get(
            "/api/enterprise/integrations",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 200
    body = response.json()
    for integration in body["integrations"]:
        assert integration["status"] == "not_connected"


@pytest.mark.asyncio
async def test_list_integrations_merges_connected_rows(client, token_a, workspace_id_a):
    from api.routers import integrations as int_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("owner")
    connected_row = {
        "id": "int-1",
        "workspace_id": workspace_id_a,
        "provider": "slack",
        "status": "active",
        "last_sync_at": "2026-07-04T09:00:00Z",
        "docs_imported": 0,
        "config": {},
        "created_at": "2026-07-01T00:00:00Z",
    }
    int_query = _make_integrations_query([connected_row])

    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(int_router, "tenant_query", return_value=int_query), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock):
        response = await client.get(
            "/api/enterprise/integrations",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 200
    body = response.json()
    slack = next(i for i in body["integrations"] if i["provider"] == "slack")
    assert slack["status"] == "active"
    assert slack["lastSyncAt"] == "2026-07-04T09:00:00Z"


@pytest.mark.asyncio
async def test_disconnect_unknown_provider_returns_404(client, token_a, workspace_id_a):
    from api.routers import integrations as int_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("owner")
    int_query = _make_integrations_query([])
    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(int_router, "tenant_query", return_value=int_query), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock):
        response = await client.post(
            "/api/enterprise/integrations/unknown_provider/disconnect",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_integrations_require_auth(client, workspace_id_a):
    response = await client.get(
        "/api/enterprise/integrations",
        headers={"X-Workspace-Id": workspace_id_a},
    )
    assert response.status_code == 401
