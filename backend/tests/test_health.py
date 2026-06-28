"""
Health endpoint smoke tests.
Verifies: status 200, correct JSON shape, no auth required.
"""

import pytest


@pytest.mark.asyncio
async def test_health_returns_200(client):
    response = await client.get("/health")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_health_response_shape(client):
    response = await client.get("/health")
    body = response.json()
    assert body["status"] == "ok"
    assert "version" in body
    assert "environment" in body


@pytest.mark.asyncio
async def test_health_environment_is_test(client):
    response = await client.get("/health")
    assert response.json()["environment"] == "test"


@pytest.mark.asyncio
async def test_health_no_auth_required(client):
    """Health must be reachable without a Bearer token (load balancer / k8s probe)."""
    response = await client.get("/health")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_protected_route_requires_auth(client):
    """Any non-public route must return 401 without a token."""
    response = await client.get("/api/documents")
    assert response.status_code in (401, 404)  # 404 acceptable in Phase 0 (route not yet added)
