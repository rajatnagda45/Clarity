from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _memberships_query(role: str | None):
    query = MagicMock()
    query.select.return_value = query
    query.eq.return_value = query
    query.limit.return_value = query
    query.execute.return_value = SimpleNamespace(data=[{"role": role}] if role else [])
    return query


@pytest.mark.asyncio
async def test_retrieval_search_returns_evidence_rows(client, token_a, workspace_id_a):
    from api.routers import retrieval as retrieval_router
    from api import deps as deps_module
    from db import client as db_client
    from services.retrieval.models import RetrievalEvidence, RetrievalResponse

    client_mock = MagicMock()
    client_mock.table.return_value = _memberships_query("viewer")

    fake_response = RetrievalResponse(
        normalizedQuery={
            "rawQuery": "termination notice",
            "normalizedQuery": "termination notice",
            "tokens": ["termination", "notice"],
            "clauseRefs": [],
            "quotedPhrases": [],
        },
        retrievalMode="hybrid",
        cacheHit=False,
        results=[
            RetrievalEvidence(
                workspaceId=workspace_id_a,
                documentId="doc-1",
                chunkId="chk-1",
                chunkIndex=0,
                text="Termination clause text",
                sectionTitle="Termination",
                clauseNumber="1.1",
                pageStart=1,
                pageEnd=1,
                chunkKind="clause",
                crossReferences=[],
                vectorScore=0.9,
                bm25Score=3.2,
                rrfScore=0.03,
                finalScore=0.03,
                finalRank=1,
                retrievalReason="Strong lexical and semantic agreement.",
                retrievalSources=["dense", "sparse"],
                parserVersion="a3.v1",
                chunkVersion="a4.v1",
                embeddingVersion="a5.v1",
            )
        ],
    )

    with patch.object(deps_module, "get_client", return_value=client_mock), patch.object(
        db_client, "get_client", return_value=client_mock
    ), patch.object(
        retrieval_router, "retrieve_evidence", new=AsyncMock(return_value=(fake_response, None))
    ):
        response = await client.post(
            "/api/retrieval/search",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
            json={"query": "termination notice"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["results"][0]["chunkId"] == "chk-1"
    assert body["results"][0]["retrievalSources"] == ["dense", "sparse"]


@pytest.mark.asyncio
async def test_retrieval_search_rejects_invalid_page_range(client, token_a, workspace_id_a):
    from api import deps as deps_module
    from db import client as db_client

    client_mock = MagicMock()
    client_mock.table.return_value = _memberships_query("viewer")

    with patch.object(deps_module, "get_client", return_value=client_mock), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        response = await client.post(
            "/api/retrieval/search",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
            json={"query": "termination", "filters": {"pageStart": 5, "pageEnd": 2}},
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_page_range"
