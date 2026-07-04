"""Tests for Phase 13 — Review Queue API endpoints."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient, ASGITransport

WORKSPACE_ID = "ws-test-001"
USER_ID = "user-test-001"
ITEM_ID = "review-item-001"
RUN_ID = "run-001"
AGENT_ID = "agent-001"


def _memberships_query(role: str = "owner") -> MagicMock:
    m = MagicMock()
    m.select.return_value = m
    m.eq.return_value = m
    m.limit.return_value = m
    m.execute.return_value = MagicMock(data=[{"workspace_id": WORKSPACE_ID, "user_id": USER_ID, "role": role}])
    return m


def _make_review_item() -> dict:
    return {
        "id": ITEM_ID,
        "workspace_id": WORKSPACE_ID,
        "agent_id": AGENT_ID,
        "agent_name": "Legal Agent",
        "run_id": RUN_ID,
        "input": "Review this contract clause",
        "output": "The clause has ambiguous liability terms.",
        "trust_score": 0.55,
        "confidence": 0.48,
        "reason": "Confidence 0.48 below threshold 0.70",
        "priority": "high",
        "status": "pending",
        "reviewed_by": None,
        "review_comment": None,
        "review_verdict": None,
        "reviewed_at": None,
        "created_at": "2026-07-04T00:00:00+00:00",
    }


@pytest.fixture
def auth_headers() -> dict:
    from tests.conftest import _make_jwt
    token = _make_jwt([WORKSPACE_ID], USER_ID)
    return {"Authorization": f"Bearer {token}", "X-Workspace-Id": WORKSPACE_ID}


class TestListReviewQueue:
    @pytest.mark.asyncio
    async def test_list_empty(self, auth_headers: dict) -> None:
        from main import app

        with patch("api.deps.get_client", return_value=MagicMock(table=lambda _: _memberships_query())):
            q = MagicMock()
            q.select.return_value = q
            q.eq.return_value = q
            q.order.return_value = q
            q.limit.return_value = q
            q.offset.return_value = q
            q.execute.return_value = MagicMock(data=[])
            with patch("api.routers.review_queue.tenant_query", return_value=q):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                    resp = await client.get("/api/review-queue", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 0
        assert body["pendingCount"] == 0

    @pytest.mark.asyncio
    async def test_list_with_items(self, auth_headers: dict) -> None:
        from main import app

        item = _make_review_item()
        call_count = 0

        def _tenant_q(table: str, ws_id: str):
            nonlocal call_count
            call_count += 1
            q = MagicMock()
            q.select.return_value = q
            q.eq.return_value = q
            q.order.return_value = q
            q.limit.return_value = q
            q.offset.return_value = q
            if call_count == 1:
                q.execute.return_value = MagicMock(data=[item])
            else:
                q.execute.return_value = MagicMock(data=[item])
            return q

        with patch("api.deps.get_client", return_value=MagicMock(table=lambda _: _memberships_query())):
            with patch("api.routers.review_queue.tenant_query", side_effect=_tenant_q):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                    resp = await client.get("/api/review-queue", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["agentName"] == "Legal Agent"
        assert body["items"][0]["priority"] == "high"


class TestSubmitReview:
    @pytest.mark.asyncio
    async def test_approve_item(self, auth_headers: dict) -> None:
        from main import app

        item = _make_review_item()
        approved_item = {**item, "status": "approved", "review_verdict": "approved", "reviewed_by": USER_ID, "reviewed_at": "2026-07-04T01:00:00+00:00"}

        mock_client = MagicMock()
        update_mock = MagicMock()
        update_mock.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[approved_item])

        with patch("api.deps.get_client", return_value=MagicMock(table=lambda _: _memberships_query())):
            q = MagicMock()
            q.select.return_value = q
            q.eq.return_value = q
            q.execute.return_value = MagicMock(data=[item])
            with patch("api.routers.review_queue.tenant_query", return_value=q):
                with patch("api.routers.review_queue.get_client", return_value=mock_client):
                    mock_client.table.return_value = update_mock
                    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                        resp = await client.post(
                            f"/api/review-queue/{ITEM_ID}/review",
                            headers=auth_headers,
                            json={"verdict": "approved", "comment": "Looks good"},
                        )
        assert resp.status_code == 200
        assert resp.json()["reviewVerdict"] == "approved"

    @pytest.mark.asyncio
    async def test_review_item_not_found(self, auth_headers: dict) -> None:
        from main import app

        with patch("api.deps.get_client", return_value=MagicMock(table=lambda _: _memberships_query())):
            q = MagicMock()
            q.select.return_value = q
            q.eq.return_value = q
            q.execute.return_value = MagicMock(data=[])
            with patch("api.routers.review_queue.tenant_query", return_value=q):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                    resp = await client.post(
                        "/api/review-queue/nonexistent/review",
                        headers=auth_headers,
                        json={"verdict": "rejected"},
                    )
        assert resp.status_code == 404


class TestReviewStats:
    @pytest.mark.asyncio
    async def test_get_stats(self, auth_headers: dict) -> None:
        from main import app

        items = [
            {"status": "pending", "priority": "high"},
            {"status": "pending", "priority": "critical"},
            {"status": "approved", "priority": "low"},
        ]
        with patch("api.deps.get_client", return_value=MagicMock(table=lambda _: _memberships_query())):
            q = MagicMock()
            q.select.return_value = q
            q.execute.return_value = MagicMock(data=items)
            with patch("api.routers.review_queue.tenant_query", return_value=q):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                    resp = await client.get("/api/review-queue/stats", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["pending"] == 2
        assert body["approved"] == 1
        assert body["criticalPending"] == 1
