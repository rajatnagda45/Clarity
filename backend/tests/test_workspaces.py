from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_get_me_returns_workspace_memberships(client, token_a, workspace_id_a):
    from api.routers import workspaces as workspaces_router

    memberships_query = MagicMock()
    memberships_query.select.return_value = memberships_query
    memberships_query.eq.return_value = memberships_query
    memberships_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "workspace_id": workspace_id_a,
                "role": "owner",
                "workspaces": {
                    "id": workspace_id_a,
                    "name": "Acme",
                    "plan": "free",
                },
            }
        ]
    )

    client_mock = MagicMock()
    client_mock.table.return_value = memberships_query

    with patch.object(workspaces_router, "get_client", return_value=client_mock):
        response = await client.get(
            "/api/me",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
        )

    assert response.status_code == 200
    assert response.json() == {
        "userId": "user_a",
        "workspaces": [
            {
                "id": workspace_id_a,
                "name": "Acme",
                "role": "owner",
                "plan": "free",
            }
        ],
    }


@pytest.mark.asyncio
async def test_create_workspace_persists_workspace_and_membership(client, token_a, workspace_id_a):
    from api.routers import workspaces as workspaces_router

    workspaces_table = MagicMock()
    memberships_table = MagicMock()

    workspaces_table.insert.return_value = workspaces_table
    workspaces_table.execute.return_value = SimpleNamespace(
        data=[{"id": "new-workspace-id", "name": "NewCo", "owner_user_id": "user_a", "plan": "free"}]
    )

    memberships_table.insert.return_value = memberships_table
    memberships_table.execute.return_value = SimpleNamespace(
        data=[{"id": "membership-id", "workspace_id": "new-workspace-id", "user_id": "user_a", "role": "owner"}]
    )

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "workspaces": workspaces_table,
        "memberships": memberships_table,
    }[name]

    with patch.object(workspaces_router, "get_client", return_value=client_mock):
        response = await client.post(
            "/api/workspaces",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
            json={"name": "  NewCo  "},
        )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "NewCo"
    assert body["role"] == "owner"
    assert body["plan"] == "free"

    workspaces_table.insert.assert_called_once()
    memberships_table.insert.assert_called_once()


@pytest.mark.asyncio
async def test_create_workspace_rejects_blank_name(client, token_a, workspace_id_a):
    response = await client.post(
        "/api/workspaces",
        headers={
            "Authorization": f"Bearer {token_a}",
            "X-Workspace-Id": workspace_id_a,
        },
        json={"name": "   "},
    )

    assert response.status_code == 422
