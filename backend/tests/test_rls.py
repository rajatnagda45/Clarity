"""
Workspace isolation tests.

Verifies all three isolation layers we can exercise in Phase 0:
- JWT workspace extraction in auth middleware
- tenant_query() app-layer guard
- migration-level RLS contract coverage
"""

import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path


MIGRATION_PATH = Path(__file__).resolve().parents[2] / "migrations" / "001_initial_schema.sql"
TENANT_TABLES = {
    "workspaces",
    "memberships",
    "documents",
    "chunks",
    "clauses",
    "conversations",
    "messages",
    "claims",
    "answer_evals",
    "abstentions",
    "debate_turns",
    "contradictions",
    "quality_rollups",
    "usage_events",
    "subscriptions",
}


@pytest.mark.asyncio
async def test_cross_workspace_header_rejected(client, token_a, workspace_id_b):
    """Token for workspace A + X-Workspace-Id for workspace B → 403."""
    response = await client.get(
        "/api/test/probe",
        headers={
            "Authorization": f"Bearer {token_a}",
            "X-Workspace-Id": workspace_id_b,
        },
    )
    assert response.status_code == 403
    assert "Workspace not in token claims" in response.text


@pytest.mark.asyncio
async def test_valid_workspace_header_accepted(client, token_a, workspace_id_a):
    """Token for workspace A + matching X-Workspace-Id → workspace is extracted cleanly."""
    response = await client.get(
        "/api/test/probe",
        headers={
            "Authorization": f"Bearer {token_a}",
            "X-Workspace-Id": workspace_id_a,
        },
    )
    assert response.status_code == 200
    assert response.json() == {
        "user_id": "user_a",
        "workspace_ids": [workspace_id_a],
        "workspace_id": workspace_id_a,
    }


@pytest.mark.asyncio
async def test_workspace_defaults_to_first_claim_when_header_missing(client, token_a, workspace_id_a):
    response = await client.get(
        "/api/test/probe",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert response.status_code == 200
    assert response.json()["workspace_id"] == workspace_id_a


@pytest.mark.asyncio
async def test_no_token_returns_401(client):
    response = await client.get("/api/test/probe")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_missing_workspace_claims_fail_guard(client, workspace_id_a):
    from tests.conftest import _make_jwt

    token = _make_jwt([], user_id="user_without_workspace")
    response = await client.get(
        "/api/test/probe",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
    assert "X-Workspace-Id header required" in response.text


def test_tenant_query_always_filters_workspace():
    """
    Unit test: tenant_query() must include an .eq("workspace_id", ...) filter.
    Ensures no query builder reaches the DB without a workspace scope.
    """
    from db import client as db_client

    mock_client = MagicMock()
    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_eq = MagicMock()

    mock_client.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq

    with patch.object(db_client, "get_client", return_value=mock_client):
        db_client.tenant_query("documents", "ws-123")

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


def test_migration_enables_rls_for_all_tenant_tables():
    sql = MIGRATION_PATH.read_text()
    missing = [
        table for table in TENANT_TABLES
        if f"alter table {table} enable row level security;" not in sql
    ]
    assert not missing, f"Missing RLS enable statements for: {', '.join(missing)}"


def test_migration_defines_tenant_policies_for_all_tenant_tables():
    sql = MIGRATION_PATH.read_text()
    missing = [
        table for table in TENANT_TABLES
        if f"create policy {table}_tenant_isolation on {table}" not in sql
    ]
    assert not missing, f"Missing tenant isolation policies for: {', '.join(missing)}"


def test_reference_clauses_remains_the_global_table_exception():
    sql = MIGRATION_PATH.read_text()
    assert "create table reference_clauses" in sql
    assert "alter table reference_clauses enable row level security;" not in sql
