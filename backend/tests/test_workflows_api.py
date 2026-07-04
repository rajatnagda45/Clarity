"""Tests for Phase 13 — Workflow API endpoints."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient, ASGITransport

WORKSPACE_ID = "ws-test-001"
USER_ID = "user-test-001"
WF_ID = "wf-001"


def _memberships_query(role: str = "owner") -> MagicMock:
    m = MagicMock()
    m.select.return_value = m
    m.eq.return_value = m
    m.limit.return_value = m
    m.execute.return_value = MagicMock(data=[{"workspace_id": WORKSPACE_ID, "user_id": USER_ID, "role": role}])
    return m


def _make_workflow_row() -> dict:
    return {
        "id": WF_ID,
        "workspace_id": WORKSPACE_ID,
        "name": "Contract Pipeline",
        "description": "Multi-agent contract review",
        "nodes": [
            {"id": "n1", "type": "trigger", "label": "Start", "config": {}, "position_x": 0, "position_y": 0},
            {"id": "n2", "type": "agent", "label": "Legal Agent", "config": {"agent_id": "agent-001"}, "position_x": 200, "position_y": 0},
        ],
        "edges": [{"id": "e1", "source": "n1", "target": "n2", "label": None}],
        "enabled": True,
        "run_count": 0,
        "last_run_at": None,
        "created_by": USER_ID,
        "created_at": "2026-07-04T00:00:00+00:00",
    }


@pytest.fixture
def auth_headers() -> dict:
    from tests.conftest import _make_jwt
    token = _make_jwt([WORKSPACE_ID], USER_ID)
    return {"Authorization": f"Bearer {token}", "X-Workspace-Id": WORKSPACE_ID}


class TestListWorkflows:
    @pytest.mark.asyncio
    async def test_list_returns_empty(self, auth_headers: dict) -> None:
        from main import app

        with patch("api.deps.get_client", return_value=MagicMock(table=lambda _: _memberships_query())):
            q = MagicMock()
            q.select.return_value = q
            q.order.return_value = q
            q.execute.return_value = MagicMock(data=[])
            with patch("api.routers.workflows.tenant_query", return_value=q):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                    resp = await client.get("/api/workflows", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    @pytest.mark.asyncio
    async def test_list_returns_workflows(self, auth_headers: dict) -> None:
        from main import app

        with patch("api.deps.get_client", return_value=MagicMock(table=lambda _: _memberships_query())):
            q = MagicMock()
            q.select.return_value = q
            q.order.return_value = q
            q.execute.return_value = MagicMock(data=[_make_workflow_row()])
            with patch("api.routers.workflows.tenant_query", return_value=q):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                    resp = await client.get("/api/workflows", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert body["workflows"][0]["name"] == "Contract Pipeline"
        assert len(body["workflows"][0]["nodes"]) == 2


class TestCreateWorkflow:
    @pytest.mark.asyncio
    async def test_create_success(self, auth_headers: dict) -> None:
        from main import app

        wf_row = _make_workflow_row()
        mock_client = MagicMock()
        insert_mock = MagicMock()
        insert_mock.insert.return_value.execute.return_value = MagicMock(data=[wf_row])

        with patch("api.deps.get_client", return_value=MagicMock(table=lambda t: _memberships_query() if t == "memberships" else insert_mock)):
            with patch("api.routers.workflows.tenant_query", return_value=_memberships_query()):
                with patch("api.routers.workflows.get_client", return_value=mock_client):
                    mock_client.table.return_value = insert_mock
                    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                        resp = await client.post("/api/workflows", headers=auth_headers, json={
                            "name": "Contract Pipeline",
                            "description": "Multi-agent contract review",
                            "nodes": [],
                            "edges": [],
                        })
        assert resp.status_code == 201

    @pytest.mark.asyncio
    async def test_create_viewer_forbidden(self, auth_headers: dict) -> None:
        from main import app

        with patch("api.deps.get_client", return_value=MagicMock(table=lambda _: _memberships_query("viewer"))):
            q = MagicMock()
            q.select.return_value = q
            q.eq.return_value = q
            q.execute.return_value = MagicMock(data=[{"workspace_id": WORKSPACE_ID, "user_id": USER_ID, "role": "viewer"}])
            with patch("api.routers.workflows.tenant_query", return_value=q):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                    resp = await client.post("/api/workflows", headers=auth_headers, json={"name": "Test", "nodes": [], "edges": []})
        assert resp.status_code == 403


class TestDeleteWorkflow:
    @pytest.mark.asyncio
    async def test_delete_not_found(self, auth_headers: dict) -> None:
        from main import app

        with patch("api.deps.get_client", return_value=MagicMock(table=lambda _: _memberships_query("owner"))):
            q = MagicMock()
            q.select.return_value = q
            q.eq.return_value = q
            q.execute.return_value = MagicMock(data=[])
            with patch("api.routers.workflows.tenant_query", return_value=q):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                    resp = await client.delete("/api/workflows/nonexistent", headers=auth_headers)
        assert resp.status_code == 404
