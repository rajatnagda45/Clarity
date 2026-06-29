from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient, ASGITransport


def _eval_row(eval_id: str = "eval-1", overall: int = 82) -> dict:
    return {
        "id": eval_id,
        "workspace_id": "ws-1",
        "answer_run_id": "run-1",
        "judge_provider": "openai",
        "judge_model": "gpt-4o-mini",
        "judge_prompt_version": "b3.judge.v1",
        "judge_latency_ms": 320,
        "judge_faithfulness": 88,
        "judge_grounding": 80,
        "judge_completeness": 75,
        "judge_correctness": 85,
        "judge_clarity": 90,
        "judge_citation_quality": 70,
        "judge_hallucination_risk": 15,
        "judge_overall": overall,
        "judge_reasoning": {"overall": "Good answer."},
        "created_at": "2026-06-28T10:00:00+00:00",
    }


def _regression_row(report_id: str = "rep-1", has_regression: bool = False) -> dict:
    return {
        "id": report_id,
        "workspace_id": "ws-1",
        "current_eval_id": "eval-1",
        "window_size": 5,
        "baseline_avg_judge_overall": 85.0,
        "current_judge_overall": 60,
        "judge_overall_delta": -25.0,
        "has_regression": has_regression,
        "regression_flags": ["judge_overall dropped 25.0 pts"] if has_regression else [],
        "created_at": "2026-06-28T10:00:00+00:00",
    }


def _benchmark_run_row() -> dict:
    return {
        "id": "brun-1",
        "workspace_id": "ws-1",
        "dataset_id": "ds-1",
        "status": "completed",
        "total_cases": 5,
        "completed_cases": 5,
        "failed_cases": 0,
        "avg_judge_overall": 82.5,
        "avg_trust_confidence": None,
        "avg_latency_ms": 1200,
        "created_at": "2026-06-28T09:00:00+00:00",
    }


def _chain(data: list) -> MagicMock:
    chain = MagicMock()
    chain.eq.return_value = chain
    chain.neq.return_value = chain
    chain.not_ = chain
    chain.is_.return_value = chain
    chain.order.return_value = chain
    chain.limit.return_value = chain
    chain.range.return_value = chain
    chain.select.return_value = chain
    chain.execute.return_value = MagicMock(data=data)
    return chain


def _make_test_jwt(workspace_id: str) -> str:
    import jwt
    payload = {"sub": "user-test", "workspace_ids": [workspace_id]}
    return jwt.encode(payload, "test-jwt-secret-at-least-32-chars-long", algorithm="HS256")


@pytest.fixture
async def authed_client():
    """Client that passes a valid JWT and mocks the membership DB lookup."""
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


# ─── Unauthenticated 401 guards ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_evals_unauthenticated_returns_401(client):
    resp = await client.get("/api/evaluations")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_eval_unauthenticated_returns_401(client):
    resp = await client.get("/api/evaluations/eval-1")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_regressions_unauthenticated_returns_401(client):
    resp = await client.get("/api/regressions")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_benchmark_datasets_unauthenticated_returns_401(client):
    resp = await client.get("/api/benchmarks/datasets")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_benchmark_runs_unauthenticated_returns_401(client):
    resp = await client.get("/api/benchmarks/runs")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_quality_dashboard_unauthenticated_returns_401(client):
    resp = await client.get("/api/evaluations/quality/dashboard")
    assert resp.status_code == 401


# ─── Authenticated routes ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_evals_returns_200(authed_client):
    row = _eval_row()
    with patch("api.routers.evaluations.tenant_query") as mock_tq:
        tq_chain = MagicMock()
        tq_chain.not_ = tq_chain
        tq_chain.is_.return_value = tq_chain
        tq_chain.order.return_value = tq_chain
        tq_chain.range.return_value = tq_chain
        tq_chain.select.return_value = tq_chain
        tq_chain.execute.return_value = MagicMock(data=[row])
        mock_tq.return_value = tq_chain

        resp = await authed_client.get("/api/evaluations")

    assert resp.status_code == 200
    body = resp.json()
    assert "evaluations" in body
    assert body["evaluations"][0]["id"] == "eval-1"
    assert body["evaluations"][0]["scores"]["overall"] == 82


@pytest.mark.asyncio
async def test_get_eval_returns_200(authed_client):
    row = _eval_row("eval-99", overall=91)
    with patch("api.routers.evaluations.tenant_query") as mock_tq:
        mock_tq.return_value = _chain([row])
        resp = await authed_client.get("/api/evaluations/eval-99")

    assert resp.status_code == 200
    assert resp.json()["scores"]["overall"] == 91


@pytest.mark.asyncio
async def test_get_eval_not_found_returns_404(authed_client):
    with patch("api.routers.evaluations.tenant_query") as mock_tq:
        mock_tq.return_value = _chain([])
        resp = await authed_client.get("/api/evaluations/no-such-eval")

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_regressions_returns_200(authed_client):
    row = _regression_row("rep-1", has_regression=True)
    with patch("api.routers.regressions.tenant_query") as mock_tq:
        chain = MagicMock()
        chain.order.return_value = chain
        chain.limit.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = MagicMock(data=[row])
        mock_tq.return_value = chain

        resp = await authed_client.get("/api/regressions")

    assert resp.status_code == 200
    body = resp.json()
    assert body["reports"][0]["hasRegression"] is True
    assert "25.0" in body["reports"][0]["regressionFlags"][0]


@pytest.mark.asyncio
async def test_list_benchmark_runs_returns_200(authed_client):
    with patch("api.routers.benchmarks.tenant_query") as mock_tq:
        chain = MagicMock()
        chain.order.return_value = chain
        chain.limit.return_value = chain
        chain.execute.return_value = MagicMock(data=[_benchmark_run_row()])
        mock_tq.return_value = chain

        resp = await authed_client.get("/api/benchmarks/runs")

    assert resp.status_code == 200
    assert resp.json()[0]["status"] == "completed"
    assert resp.json()[0]["avgJudgeOverall"] == 82.5


@pytest.mark.asyncio
async def test_get_regression_not_found_returns_404(authed_client):
    with patch("api.routers.regressions.tenant_query") as mock_tq:
        mock_tq.return_value = _chain([])
        resp = await authed_client.get("/api/regressions/no-such-report")

    assert resp.status_code == 404
