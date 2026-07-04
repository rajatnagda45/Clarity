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


def _make_audit_query(data: list[dict]):
    q = MagicMock()
    q.select.return_value = q
    q.eq.return_value = q
    q.is_.return_value = q
    q.order.return_value = q
    q.limit.return_value = q
    q.offset.return_value = q
    q.execute.return_value = SimpleNamespace(data=data)
    return q


def _sample_log(log_id: str = "log-1", workspace_id: str = "00000000-0000-0000-0000-000000000001") -> dict:
    return {
        "id": log_id,
        "workspace_id": workspace_id,
        "user_id": "user_a",
        "action": "document.uploaded",
        "resource_type": "document",
        "resource_id": "doc-1",
        "metadata": {"filename": "contract.pdf"},
        "ip_address": "1.2.3.4",
        "severity": "info",
        "created_at": "2026-07-04T10:00:00Z",
    }


@pytest.mark.asyncio
async def test_list_audit_logs_empty(client, token_a, workspace_id_a):
    from api.routers import audit_logs as al_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("owner")
    al_query = _make_audit_query([])

    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(al_router, "tenant_query", return_value=al_query), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock):
        response = await client.get(
            "/api/enterprise/audit-logs",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["logs"] == []
    assert body["total"] == 0


@pytest.mark.asyncio
async def test_list_audit_logs_populated(client, token_a, workspace_id_a):
    from api.routers import audit_logs as al_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    al_query = _make_audit_query([_sample_log()])

    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(al_router, "tenant_query", return_value=al_query), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock):
        response = await client.get(
            "/api/enterprise/audit-logs",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 200
    body = response.json()
    assert len(body["logs"]) == 1
    assert body["logs"][0]["action"] == "document.uploaded"
    assert body["logs"][0]["severity"] == "info"
    assert body["logs"][0]["userId"] == "user_a"


@pytest.mark.asyncio
async def test_audit_logs_require_auth(client, workspace_id_a):
    response = await client.get(
        "/api/enterprise/audit-logs",
        headers={"X-Workspace-Id": workspace_id_a},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_audit_logs_with_filters(client, token_a, workspace_id_a):
    from api.routers import audit_logs as al_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    al_query = _make_audit_query([_sample_log()])

    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(al_router, "tenant_query", return_value=al_query), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock):
        response = await client.get(
            "/api/enterprise/audit-logs?action=document.uploaded&severity=info&limit=10",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
