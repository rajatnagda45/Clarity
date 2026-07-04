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


def _make_rules_query(data: list[dict]):
    q = MagicMock()
    q.select.return_value = q
    q.eq.return_value = q
    q.order.return_value = q
    q.execute.return_value = SimpleNamespace(data=data)
    return q


def _sample_rule(rule_id: str = "rule-1", workspace_id: str = "00000000-0000-0000-0000-000000000001") -> dict:
    return {
        "id": rule_id,
        "workspace_id": workspace_id,
        "name": "Low trust alert",
        "trigger_type": "trust_score_low",
        "condition": {"threshold": 0.5},
        "actions": [{"type": "notify", "channel": "slack"}],
        "enabled": True,
        "run_count": 0,
        "last_run_at": None,
        "created_at": "2026-07-04T10:00:00Z",
    }


@pytest.mark.asyncio
async def test_list_automation_rules_empty(client, token_a, workspace_id_a):
    from api.routers import automation as auto_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("owner")
    rules_query = _make_rules_query([])
    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(auto_router, "tenant_query", return_value=rules_query), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock):
        response = await client.get(
            "/api/enterprise/automation-rules",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["rules"] == []
    assert body["total"] == 0


@pytest.mark.asyncio
async def test_create_automation_rule(client, token_a, workspace_id_a):
    from api.routers import automation as auto_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("editor")
    insert_table = MagicMock()
    insert_table.insert.return_value = insert_table
    insert_table.execute.return_value = SimpleNamespace(data=[_sample_rule()])

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "automation_rules": insert_table,
    }[name]

    with patch.object(auto_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock):
        response = await client.post(
            "/api/enterprise/automation-rules",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
            json={
                "name": "Low trust alert",
                "trigger_type": "trust_score_low",
                "condition": {"threshold": 0.5},
                "actions": [{"type": "notify"}],
            },
        )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Low trust alert"
    assert body["triggerType"] == "trust_score_low"
    assert body["enabled"] is True


@pytest.mark.asyncio
async def test_create_rule_viewer_rejected(client, token_a, workspace_id_a):
    from api.routers import automation as auto_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(auto_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock):
        response = await client.post(
            "/api/enterprise/automation-rules",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
            json={"name": "Rule", "trigger_type": "trust_score_low"},
        )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_delete_automation_rule(client, token_a, workspace_id_a):
    from api.routers import automation as auto_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("owner")
    rules_query = _make_rules_query([{"id": "rule-1"}])
    delete_table = MagicMock()
    delete_table.delete.return_value = delete_table
    delete_table.eq.return_value = delete_table
    delete_table.execute.return_value = SimpleNamespace(data=[])

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "automation_rules": delete_table,
    }[name]

    with patch.object(auto_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock), \
         patch.object(auto_router, "tenant_query", return_value=rules_query):
        response = await client.delete(
            "/api/enterprise/automation-rules/rule-1",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 204


@pytest.mark.asyncio
async def test_delete_nonexistent_rule_returns_404(client, token_a, workspace_id_a):
    from api.routers import automation as auto_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("owner")
    rules_query = _make_rules_query([])
    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(auto_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock), \
         patch.object(auto_router, "tenant_query", return_value=rules_query):
        response = await client.delete(
            "/api/enterprise/automation-rules/nonexistent",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "rule_not_found"
