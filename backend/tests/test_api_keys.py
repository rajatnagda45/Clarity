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


def _make_keys_query(data: list[dict]):
    q = MagicMock()
    q.select.return_value = q
    q.eq.return_value = q
    q.is_.return_value = q
    q.order.return_value = q
    q.limit.return_value = q
    q.execute.return_value = SimpleNamespace(data=data)
    return q


def _sample_key(key_id: str = "key-1", workspace_id: str = "00000000-0000-0000-0000-000000000001") -> dict:
    return {
        "id": key_id,
        "workspace_id": workspace_id,
        "name": "CI Key",
        "key_prefix": "clarity_sk_abc",
        "scopes": ["read"],
        "last_used_at": None,
        "expires_at": None,
        "created_at": "2026-07-04T10:00:00Z",
    }


@pytest.mark.asyncio
async def test_list_api_keys_empty(client, token_a, workspace_id_a):
    from api.routers import api_keys as keys_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("owner")
    keys_query = _make_keys_query([])

    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(keys_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock), \
         patch.object(keys_router, "tenant_query", return_value=keys_query):
        response = await client.get(
            "/api/enterprise/api-keys",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["keys"] == []
    assert body["total"] == 0


@pytest.mark.asyncio
async def test_list_api_keys_populated(client, token_a, workspace_id_a):
    from api.routers import api_keys as keys_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("owner")
    keys_query = _make_keys_query([_sample_key()])

    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(keys_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock), \
         patch.object(keys_router, "tenant_query", return_value=keys_query):
        response = await client.get(
            "/api/enterprise/api-keys",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 200
    body = response.json()
    assert len(body["keys"]) == 1
    assert body["keys"][0]["name"] == "CI Key"
    assert body["keys"][0]["keyPrefix"] == "clarity_sk_abc"


@pytest.mark.asyncio
async def test_create_api_key(client, token_a, workspace_id_a):
    from api.routers import api_keys as keys_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("owner")
    insert_table = MagicMock()
    insert_table.insert.return_value = insert_table
    insert_table.execute.return_value = SimpleNamespace(data=[_sample_key()])

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "api_keys": insert_table,
    }[name]

    with patch.object(keys_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock):
        response = await client.post(
            "/api/enterprise/api-keys",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
            json={"name": "CI Key", "scopes": ["read"]},
        )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "CI Key"
    assert "plaintextKey" in body
    assert body["plaintextKey"].startswith("clarity_sk_")


@pytest.mark.asyncio
async def test_create_api_key_missing_name_returns_422(client, token_a, workspace_id_a):
    from api.routers import api_keys as keys_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("owner")
    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(keys_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock):
        response = await client.post(
            "/api/enterprise/api-keys",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
            json={"scopes": ["read"]},
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_revoke_api_key(client, token_a, workspace_id_a):
    from api.routers import api_keys as keys_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("owner")
    keys_query = _make_keys_query([{"id": "key-1"}])
    update_table = MagicMock()
    update_table.update.return_value = update_table
    update_table.eq.return_value = update_table
    update_table.execute.return_value = SimpleNamespace(data=[])

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "api_keys": update_table,
    }[name]

    with patch.object(keys_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock), \
         patch.object(keys_router, "tenant_query", return_value=keys_query):
        response = await client.delete(
            "/api/enterprise/api-keys/key-1",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 204


@pytest.mark.asyncio
async def test_revoke_nonexistent_key_returns_404(client, token_a, workspace_id_a):
    from api.routers import api_keys as keys_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("owner")
    keys_query = _make_keys_query([])

    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(keys_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock), \
         patch.object(keys_router, "tenant_query", return_value=keys_query):
        response = await client.delete(
            "/api/enterprise/api-keys/nonexistent",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "api_key_not_found"


@pytest.mark.asyncio
async def test_api_keys_require_auth(client, workspace_id_a):
    response = await client.get(
        "/api/enterprise/api-keys",
        headers={"X-Workspace-Id": workspace_id_a},
    )
    assert response.status_code == 401
