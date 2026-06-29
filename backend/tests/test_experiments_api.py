from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient, ASGITransport


def _make_test_jwt(workspace_id: str) -> str:
    import jwt
    payload = {"sub": "user-test", "workspace_ids": [workspace_id]}
    return jwt.encode(payload, "test-jwt-secret-at-least-32-chars-long", algorithm="HS256")


@pytest.fixture
async def authed_client():
    from main import app
    from api.deps import require_workspace_role

    def _override():
        return ("ws-1", "owner")

    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[], count=0
    )

    app.dependency_overrides[require_workspace_role] = _override
    with patch("db.client._client", mock_db):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            ac.headers.update({
                "Authorization": f"Bearer {_make_test_jwt('ws-1')}",
                "X-Workspace-Id": "ws-1",
            })
            yield ac
    app.dependency_overrides.pop(require_workspace_role, None)


# ─── Unauthenticated guards ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_experiments_list_unauthenticated(client):
    resp = await client.get("/api/experiments")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_prompts_list_unauthenticated(client):
    resp = await client.get("/api/prompts")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_optimization_list_unauthenticated(client):
    resp = await client.get("/api/optimization")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_quality_gate_rules_unauthenticated(client):
    resp = await client.get("/api/quality-gates/rules")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_release_notes_unauthenticated(client):
    resp = await client.get("/api/release-notes")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_model_comparisons_unauthenticated(client):
    resp = await client.get("/api/model-comparisons")
    assert resp.status_code == 401


# ─── Authenticated routes ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_experiments_returns_200(authed_client):
    from services.eval.models import Experiment

    exp = Experiment(
        id="exp-1", workspace_id="ws-1", name="Test Exp", description=None,
        status="active", winner_candidate_id=None, candidates=[], created_at="2026-01-01",
    )

    with patch("api.routers.experiments.list_experiments", return_value=[exp]):
        resp = await authed_client.get("/api/experiments")

    assert resp.status_code == 200
    body = resp.json()
    assert "experiments" in body
    assert body["experiments"][0]["name"] == "Test Exp"


@pytest.mark.asyncio
async def test_list_prompts_returns_200(authed_client):
    with patch("api.routers.prompts.list_prompt_versions", return_value=[]):
        resp = await authed_client.get("/api/prompts")

    assert resp.status_code == 200
    assert resp.json()["versions"] == []


@pytest.mark.asyncio
async def test_list_optimization_returns_200(authed_client):
    with patch("api.routers.optimization.list_recommendations", return_value=[]):
        resp = await authed_client.get("/api/optimization")

    assert resp.status_code == 200
    assert resp.json()["recommendations"] == []


@pytest.mark.asyncio
async def test_list_quality_gate_rules_returns_200(authed_client):
    with patch("api.routers.quality_gates.list_rules", return_value=[]):
        resp = await authed_client.get("/api/quality-gates/rules")

    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_release_notes_returns_200(authed_client):
    with patch("api.routers.release_notes.list_release_notes", return_value=[]):
        resp = await authed_client.get("/api/release-notes")

    assert resp.status_code == 200
    assert resp.json()["notes"] == []


@pytest.mark.asyncio
async def test_model_comparisons_returns_200(authed_client):
    with patch("api.routers.model_comparisons.tenant_query") as mock_tq:
        chain = MagicMock()
        chain.eq.return_value = chain
        chain.not_ = chain
        chain.is_.return_value = chain
        chain.order.return_value = chain
        chain.limit.return_value = chain
        chain.select.return_value = chain
        chain.execute.return_value = MagicMock(data=[])
        mock_tq.return_value = chain

        resp = await authed_client.get("/api/model-comparisons")

    assert resp.status_code == 200
    assert resp.json()["comparisons"] == []


@pytest.mark.asyncio
async def test_create_experiment_returns_201(authed_client):
    from services.eval.models import Experiment

    new_exp = Experiment(
        id="exp-new", workspace_id="ws-1", name="New Exp", description=None,
        status="active", winner_candidate_id=None, candidates=[], created_at="2026-06-29",
    )

    with (
        patch("api.routers.experiments.create_experiment", return_value="exp-new"),
        patch("api.routers.experiments.get_experiment", return_value=new_exp),
    ):
        resp = await authed_client.post(
            "/api/experiments",
            json={"name": "New Exp"},
        )

    assert resp.status_code == 201
    assert resp.json()["name"] == "New Exp"
