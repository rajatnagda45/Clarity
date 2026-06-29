from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest


def _memberships_query(role: str):
    query = MagicMock()
    query.select.return_value = query
    query.eq.return_value = query
    query.limit.return_value = query
    query.execute.return_value = SimpleNamespace(data=[{"role": role}])
    return query


@pytest.mark.asyncio
async def test_get_claim_spans_returns_workspace_scoped_offsets(client, token_a, workspace_id_a):
    from api import deps as deps_module
    from api.routers import claims as claims_router
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    chunks_query = MagicMock()
    chunks_query.select.return_value = chunks_query
    chunks_query.eq.return_value = chunks_query
    chunks_query.limit.return_value = chunks_query
    chunks_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "chunk_id": "chk-1",
                "document_id": "doc-1",
                "page_start": 4,
                "char_start": 0,
                "char_end": 25,
                "text": "Either party may terminate for convenience.",
                "source_offsets": [{"page": 4, "char_start": 0, "char_end": 25}],
            }
        ]
    )
    evidence_query = MagicMock()
    evidence_query.select.return_value = evidence_query
    evidence_query.eq.return_value = evidence_query
    evidence_query.order.return_value = evidence_query
    evidence_query.limit.return_value = evidence_query
    evidence_query.execute.return_value = SimpleNamespace(data=[{"final_score": 0.82}])

    with patch.object(claims_router, "tenant_query") as tenant_query_mock, patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        tenant_query_mock.side_effect = lambda table, workspace_id: {
            "chunks": chunks_query,
            "retrieval_run_evidence": evidence_query,
        }[table]
        response = await client.get(
            "/api/claims/chk-1/spans",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 200
    assert response.json()["spans"][0]["rerankScore"] == 0.82
