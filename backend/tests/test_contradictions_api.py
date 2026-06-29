from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest


def _memberships_query(role: str):
    query = MagicMock()
    query.select.return_value = query
    query.eq.return_value = query
    query.limit.return_value = query
    query.execute.return_value = SimpleNamespace(data=[{"role": role}])
    return query


@pytest.mark.asyncio
async def test_list_contradictions_returns_workspace_scoped_conflicts(client, token_a, workspace_id_a):
    from api import deps as deps_module
    from api.routers import contradictions as contradictions_router
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    contradictions_query = MagicMock()
    contradictions_query.order.return_value = contradictions_query
    contradictions_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "id": "contr-1",
                "topic": "termination notice period",
                "doc_a": "doc-1",
                "span_a": "chunk-1",
                "value_a": "30 days",
                "doc_b": "doc-2",
                "span_b": "chunk-2",
                "value_b": "60 days",
                "severity": "major",
                "note": "Conflicting notice windows.",
            }
        ]
    )

    with patch.object(contradictions_router, "tenant_query", return_value=contradictions_query), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        response = await client.get(
            "/api/contradictions",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 200
    body = response.json()
    assert body[0]["docA"] == "doc-1"
    assert body[0]["severity"] == "major"
