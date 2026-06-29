from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_upload_route_uses_ingest_rate_limit(client, token_a, workspace_id_a):
    from api.middleware import rate_limit as rate_limit_module
    from api.routers import documents as documents_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = MagicMock()
    memberships_table.select.return_value = memberships_table
    memberships_table.eq.return_value = memberships_table
    memberships_table.limit.return_value = memberships_table
    memberships_table.execute.return_value.data = [{"role": "viewer"}]

    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(rate_limit_module, "_increment", new=AsyncMock(return_value=11)), patch.object(
        documents_router, "get_client", return_value=client_mock
    ), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        response = await client.post(
            "/api/documents",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
            files={"file": ("msa.pdf", b"%PDF-1.4", "application/pdf")},
        )

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "rate_limit_exceeded"


def test_match_limit_uses_document_upload_prefix():
    from api.middleware.rate_limit import _match_limit

    assert _match_limit("POST", "/api/documents") == (60, 10)
    assert _match_limit("GET", "/api/documents") == (60, 120)
