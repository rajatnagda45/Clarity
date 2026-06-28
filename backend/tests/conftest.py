"""
Shared pytest fixtures for Clarity backend tests.

The test client uses environment overrides so no real external services
are required for unit/integration tests that don't exercise the DB directly.
Tests that need Supabase are marked @pytest.mark.integration and skipped
in CI unless SUPABASE_URL is set.
"""

import os
import pytest
from unittest.mock import MagicMock, patch
from httpx import AsyncClient, ASGITransport

# Patch all required env vars before any app import resolves pydantic-settings
_env_defaults = {
    "OPENAI_API_KEY": "sk-test",
    "PINECONE_API_KEY": "pc-test",
    "COHERE_API_KEY": "co-test",
    "SUPABASE_URL": "https://test.supabase.co",
    "SUPABASE_SERVICE_ROLE_KEY": "test-service-key",
    "SUPABASE_JWT_SECRET": "test-jwt-secret-at-least-32-chars-long",
    "CLERK_SECRET_KEY": "sk_test_clerk",
    "UPSTASH_REDIS_REST_URL": "https://test.upstash.io",
    "UPSTASH_REDIS_REST_TOKEN": "test-upstash-token",
    "R2_ACCOUNT_ID": "test-r2-account",
    "R2_ACCESS_KEY_ID": "test-r2-key",
    "R2_SECRET_ACCESS_KEY": "test-r2-secret",
    "ENVIRONMENT": "test",
}

for k, v in _env_defaults.items():
    os.environ.setdefault(k, v)


@pytest.fixture(scope="session")
def mock_supabase():
    """Returns a MagicMock Supabase client for tests that don't need a real DB."""
    mock = MagicMock()
    mock.table.return_value.select.return_value.limit.return_value.execute.return_value = (
        MagicMock(data=[], count=0)
    )
    return mock


@pytest.fixture
async def client(mock_supabase):
    """Async HTTP client pointed at the FastAPI app, with Supabase mocked."""
    with patch("db.client._client", mock_supabase):
        from main import app
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac


@pytest.fixture
def workspace_id_a() -> str:
    return "00000000-0000-0000-0000-000000000001"


@pytest.fixture
def workspace_id_b() -> str:
    return "00000000-0000-0000-0000-000000000002"


def _make_jwt(workspace_ids: list[str], user_id: str = "user_test") -> str:
    """Creates a HS256 JWT signed with the test secret for use in Authorization headers."""
    import jwt
    payload = {"sub": user_id, "workspace_ids": workspace_ids}
    return jwt.encode(payload, _env_defaults["SUPABASE_JWT_SECRET"], algorithm="HS256")


@pytest.fixture
def token_a(workspace_id_a):
    return _make_jwt([workspace_id_a], user_id="user_a")


@pytest.fixture
def token_b(workspace_id_b):
    return _make_jwt([workspace_id_b], user_id="user_b")
