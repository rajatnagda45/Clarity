"""
Phase 8 observability tests.

Covers:
- Correlation ID roundtrip (X-Request-Id header present on every response)
- /health/live always returns 200 with uptime
- /health/ready returns a valid readiness shape
- /api/metrics returns a valid snapshot shape
"""
from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# DB mock helper — used to let /health/ready's DB probe pass
# ---------------------------------------------------------------------------

def _chain(data):
    q = MagicMock()
    q.table.return_value = q
    q.select.return_value = q
    q.eq.return_value = q
    q.limit.return_value = q
    q.execute.return_value = SimpleNamespace(data=data)
    return q


# ---------------------------------------------------------------------------
# App fixture — import once per module
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def client():
    from main import app
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


# ---------------------------------------------------------------------------
# Correlation ID
# ---------------------------------------------------------------------------

def test_x_request_id_present_on_health(client):
    r = client.get("/health")
    assert "x-request-id" in r.headers
    val = r.headers["x-request-id"]
    # Must be a valid UUID4
    parsed = uuid.UUID(val)
    assert parsed.version == 4


def test_x_request_id_unique_per_request(client):
    ids = {client.get("/health").headers.get("x-request-id") for _ in range(5)}
    assert len(ids) == 5, "Each request must get a unique correlation ID"


# ---------------------------------------------------------------------------
# /health/live
# ---------------------------------------------------------------------------

def test_liveness_returns_200(client):
    r = client.get("/health/live")
    assert r.status_code == 200


def test_liveness_body_shape(client):
    r = client.get("/health/live")
    body = r.json()
    assert body["status"] == "alive"
    assert isinstance(body["uptime_seconds"], (int, float))
    assert body["uptime_seconds"] >= 0


# ---------------------------------------------------------------------------
# /health/ready
# ---------------------------------------------------------------------------

def test_readiness_shape(client):
    mock_db = _chain([{"id": "ws-1"}])
    with patch("db.client.get_client", return_value=mock_db):
        r = client.get("/health/ready")
    # 200 or 503 — both are valid for readiness
    assert r.status_code in (200, 503)
    body = r.json()
    assert "status" in body
    assert body["status"] in ("ready", "degraded", "unavailable")
    assert "checks" in body
    assert isinstance(body["checks"], dict)
    assert "version" in body
    assert "environment" in body


def test_readiness_checks_have_ok_field(client):
    mock_db = _chain([{"id": "ws-1"}])
    with patch("db.client.get_client", return_value=mock_db):
        r = client.get("/health/ready")
    body = r.json()
    for check_name, check_result in body["checks"].items():
        assert "ok" in check_result, f"check {check_name!r} missing 'ok' field"


def test_readiness_503_when_db_down(client):
    with patch("db.client.get_client", side_effect=Exception("connection refused")):
        r = client.get("/health/ready")
    assert r.status_code == 503
    body = r.json()
    assert body["status"] == "unavailable"
    assert body["checks"]["database"]["ok"] is False


# ---------------------------------------------------------------------------
# /api/metrics
# ---------------------------------------------------------------------------

def test_metrics_shape(client):
    r = client.get("/api/metrics")
    assert r.status_code == 200
    body = r.json()
    assert "uptime_seconds" in body
    assert "request_count" in body
    assert "error_count" in body
    assert "avg_latency_ms" in body
    assert "active_requests" in body
    assert "endpoints" in body
    assert isinstance(body["endpoints"], dict)


def test_metrics_request_count_increases(client):
    r1 = client.get("/api/metrics")
    before = r1.json()["request_count"]
    # Make a few more requests
    for _ in range(3):
        client.get("/health")
    r2 = client.get("/api/metrics")
    after = r2.json()["request_count"]
    assert after > before


def test_metrics_uptime_positive(client):
    r = client.get("/api/metrics")
    assert r.json()["uptime_seconds"] >= 0
