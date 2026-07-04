"""Tests for Phase 13 — Agent API endpoints."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient, ASGITransport

WORKSPACE_ID = "ws-test-001"
USER_ID = "user-test-001"
AGENT_ID = "agent-001"
RUN_ID = "run-001"


def _memberships_query(role: str = "owner") -> MagicMock:
    m = MagicMock()
    m.select.return_value = m
    m.eq.return_value = m
    m.limit.return_value = m
    m.execute.return_value = MagicMock(data=[{"workspace_id": WORKSPACE_ID, "user_id": USER_ID, "role": role}])
    return m


def _make_agent_row(overrides: dict | None = None) -> dict:
    row = {
        "id": AGENT_ID,
        "workspace_id": WORKSPACE_ID,
        "name": "Legal Review Agent",
        "description": "Reviews contracts for risk",
        "avatar": "⚖️",
        "color": "#7C3AED",
        "category": "legal",
        "system_prompt": "You are a legal review expert.",
        "behavior": "precise",
        "temperature": 0.3,
        "model": "gpt-4o",
        "allowed_collections": [],
        "allowed_tools": ["search_documents"],
        "memory_enabled": True,
        "citation_required": True,
        "verification_mode": False,
        "auto_retry": True,
        "confidence_threshold": 0.8,
        "is_pinned": False,
        "is_favorite": False,
        "run_count": 0,
        "success_rate": 0.0,
        "avg_latency_ms": 0,
        "avg_trust_score": 0.0,
        "created_by": USER_ID,
        "archived_at": None,
        "created_at": "2026-07-04T00:00:00+00:00",
    }
    if overrides:
        row.update(overrides)
    return row


def _make_run_row(overrides: dict | None = None) -> dict:
    row = {
        "id": RUN_ID,
        "workspace_id": WORKSPACE_ID,
        "agent_id": AGENT_ID,
        "agent_name": "Legal Review Agent",
        "status": "completed",
        "input": "Review this contract",
        "output": "Contract reviewed successfully.",
        "tokens_used": 500,
        "latency_ms": 1200,
        "trust_score": 0.87,
        "confidence": 0.82,
        "cost_estimate": 0.001,
        "human_review_required": False,
        "reviewed_by": None,
        "review_verdict": None,
        "review_comment": None,
        "pipeline_agents": [],
        "created_by": USER_ID,
        "completed_at": "2026-07-04T00:01:00+00:00",
        "created_at": "2026-07-04T00:00:00+00:00",
    }
    if overrides:
        row.update(overrides)
    return row


@pytest.fixture
def auth_headers() -> dict:
    from tests.conftest import _make_jwt
    token = _make_jwt([WORKSPACE_ID], USER_ID)
    return {"Authorization": f"Bearer {token}", "X-Workspace-Id": WORKSPACE_ID}


class TestListAgents:
    @pytest.mark.asyncio
    async def test_list_agents_returns_empty(self, auth_headers: dict) -> None:
        from main import app

        mock_client = MagicMock()
        mock_client.table.return_value = _memberships_query()
        with patch("api.deps.get_client", return_value=mock_client):
            q = MagicMock()
            q.select.return_value = q
            q.order.return_value = q
            q.is_.return_value = q
            q.execute.return_value = MagicMock(data=[])
            with patch("api.routers.agents.tenant_query", return_value=q):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                    resp = await client.get("/api/agents", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 0
        assert body["agents"] == []

    @pytest.mark.asyncio
    async def test_list_agents_returns_agents(self, auth_headers: dict) -> None:
        from main import app

        mock_client = MagicMock()
        mock_client.table.return_value = _memberships_query()
        with patch("api.deps.get_client", return_value=mock_client):
            q = MagicMock()
            q.select.return_value = q
            q.order.return_value = q
            q.is_.return_value = q
            q.execute.return_value = MagicMock(data=[_make_agent_row()])
            with patch("api.routers.agents.tenant_query", return_value=q):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                    resp = await client.get("/api/agents", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert body["agents"][0]["name"] == "Legal Review Agent"


class TestCreateAgent:
    @pytest.mark.asyncio
    async def test_create_agent_success(self, auth_headers: dict) -> None:
        from main import app

        agent_row = _make_agent_row()
        mock_client = MagicMock()
        mock_client.table.return_value = _memberships_query("owner")

        insert_mock = MagicMock()
        insert_mock.insert.return_value.execute.return_value = MagicMock(data=[agent_row])
        mock_client.table.return_value = insert_mock

        with patch("api.deps.get_client", return_value=MagicMock(table=lambda t: _memberships_query("owner") if t == "memberships" else insert_mock)):
            with patch("api.routers.agents.tenant_query", return_value=_memberships_query("owner")):
                with patch("api.routers.agents.get_client", return_value=mock_client):
                    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                        resp = await client.post("/api/agents", headers=auth_headers, json={
                            "name": "Legal Review Agent",
                            "description": "Reviews contracts",
                            "systemPrompt": "You are a legal expert.",
                            "category": "legal",
                            "model": "gpt-4o",
                            "temperature": 0.3,
                        })
        assert resp.status_code == 201
        assert resp.json()["name"] == "Legal Review Agent"

    @pytest.mark.asyncio
    async def test_create_agent_viewer_forbidden(self, auth_headers: dict) -> None:
        from main import app

        with patch("api.deps.get_client", return_value=MagicMock(table=lambda _: _memberships_query("viewer"))):
            q = MagicMock()
            q.select.return_value = q
            q.eq.return_value = q
            q.execute.return_value = MagicMock(data=[{"workspace_id": WORKSPACE_ID, "user_id": USER_ID, "role": "viewer"}])
            with patch("api.routers.agents.tenant_query", return_value=q):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                    resp = await client.post("/api/agents", headers=auth_headers, json={
                        "name": "Test",
                        "systemPrompt": "...",
                    })
        assert resp.status_code == 403


class TestAgentRuns:
    @pytest.mark.asyncio
    async def test_list_runs_empty(self, auth_headers: dict) -> None:
        from main import app

        with patch("api.deps.get_client", return_value=MagicMock(table=lambda _: _memberships_query())):
            q = MagicMock()
            q.select.return_value = q
            q.eq.return_value = q
            q.order.return_value = q
            q.limit.return_value = q
            q.offset.return_value = q
            q.execute.return_value = MagicMock(data=[])
            with patch("api.routers.agents.tenant_query", return_value=q):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                    resp = await client.get(f"/api/agents/{AGENT_ID}/runs", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    @pytest.mark.asyncio
    async def test_get_run_not_found(self, auth_headers: dict) -> None:
        from main import app

        with patch("api.deps.get_client", return_value=MagicMock(table=lambda _: _memberships_query())):
            q = MagicMock()
            q.select.return_value = q
            q.eq.return_value = q
            q.execute.return_value = MagicMock(data=[])
            with patch("api.routers.agents.tenant_query", return_value=q):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                    resp = await client.get("/api/agents/runs/nonexistent-id", headers=auth_headers)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_analytics_empty(self, auth_headers: dict) -> None:
        from main import app

        with patch("api.deps.get_client", return_value=MagicMock(table=lambda _: _memberships_query())):
            q = MagicMock()
            q.select.return_value = q
            q.eq.return_value = q
            q.execute.return_value = MagicMock(data=[])

            tc_mock = MagicMock()
            tc_mock.select.return_value = tc_mock
            tc_mock.eq.return_value = tc_mock
            tc_mock.execute.return_value = MagicMock(data=[])

            def _tenant_q(table: str, ws_id: str):
                return q

            with patch("api.routers.agents.tenant_query", side_effect=_tenant_q):
                with patch("api.routers.agents.get_client") as gc:
                    gc.return_value.table.return_value = tc_mock
                    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                        resp = await client.get(f"/api/agents/{AGENT_ID}/analytics", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["totalRuns"] == 0
        assert body["successRate"] == 0.0


class TestDeleteAgent:
    @pytest.mark.asyncio
    async def test_delete_agent_not_found(self, auth_headers: dict) -> None:
        from main import app

        with patch("api.deps.get_client", return_value=MagicMock(table=lambda _: _memberships_query("owner"))):
            q = MagicMock()
            q.select.return_value = q
            q.eq.return_value = q
            q.execute.return_value = MagicMock(data=[])
            with patch("api.routers.agents.tenant_query", return_value=q):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                    resp = await client.delete("/api/agents/bad-id", headers=auth_headers)
        assert resp.status_code == 404
