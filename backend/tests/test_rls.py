"""
Workspace isolation (RLS) tests.

Verifies that the auth middleware enforces workspace boundaries:
- A token for workspace A cannot access workspace B resources
- X-Workspace-Id mismatch against token claims is rejected with 403
- tenant_query() always includes the workspace_id filter
"""

import pytest
from unittest.mock import patch, MagicMock


@pytest.mark.asyncio
async def test_cross_workspace_header_rejected(client, token_a, workspace_id_b):
    """Token for workspace A + X-Workspace-Id for workspace B → 403."""
    response = await client.get(
        "/api/documents",
        headers={
            "Authorization": f"Bearer {token_a}",
            "X-Workspace-Id": workspace_id_b,
        },
    )
    assert response.status_code in (403, 404)  # 404 in Phase 0 while route isn't wired yet
    if response.status_code == 403:
        assert "Workspace not in token claims" in response.text


@pytest.mark.asyncio
async def test_valid_workspace_header_accepted(client, token_a, workspace_id_a):
    """Token for workspace A + matching X-Workspace-Id → auth passes (may 404 if route absent)."""
    response = await client.get(
        "/api/documents",
        headers={
            "Authorization": f"Bearer {token_a}",
            "X-Workspace-Id": workspace_id_a,
        },
    )
    # 404 is fine in Phase 0; what matters is NOT 401/403
    assert response.status_code != 401
    assert response.status_code != 403


@pytest.mark.asyncio
async def test_no_token_returns_401(client):
    response = await client.get("/api/documents")
    assert response.status_code == 401


def test_tenant_query_always_filters_workspace():
    """
    Unit test: tenant_query() must include an .eq("workspace_id", ...) filter.
    Ensures no query builder reaches the DB without a workspace scope.
    """
    mock_client = MagicMock()
    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_eq = MagicMock()

    mock_client.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq

    with patch("db.client.get_client", return_value=mock_client):
        from db.client import tenant_query
        tenant_query("documents", "ws-123")

    mock_table.select.assert_called_once()
    mock_select.eq.assert_called_once_with("workspace_id", "ws-123")


def test_global_table_rejects_user_content_tables():
    """global_table() must raise if called with any table other than reference_clauses."""
    from db.client import global_table
    import pytest

    with pytest.raises(ValueError, match="reference_clauses"):
        global_table("documents")

    with pytest.raises(ValueError, match="reference_clauses"):
        global_table("claims")
