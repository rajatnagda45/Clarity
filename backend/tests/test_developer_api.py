from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest


def _memberships_query(role: str | None):
    query = MagicMock()
    query.select.return_value = query
    query.eq.return_value = query
    query.limit.return_value = query
    query.execute.return_value = SimpleNamespace(data=[{"role": role}] if role else [])
    return query


@pytest.mark.asyncio
async def test_embedding_metrics_returns_developer_summary(client, token_a, workspace_id_a):
    from api.routers import developer as developer_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    documents_query = MagicMock()
    documents_query.select.return_value = documents_query
    documents_query.eq.return_value = documents_query
    documents_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "id": "doc-1",
                "status": "embedded",
                "embedded_chunk_count": 2,
                "embedding_started_at": "2026-06-28T12:00:00Z",
                "embedding_completed_at": "2026-06-28T12:00:02Z",
                "embedding_queued_at": "2026-06-28T11:59:58Z",
                "current_embedding_provider": "openai",
                "current_embedding_model": "text-embedding-3-small",
                "current_embedding_dimension": 1536,
                "current_embedding_version": "a5.v1",
                "current_embedding_parser_version": "a3.v1",
                "current_embedding_chunk_version": "a4.v1",
            }
        ]
    )
    embeddings_query = MagicMock()
    embeddings_query.select.return_value = embeddings_query
    embeddings_query.eq.return_value = embeddings_query
    embeddings_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "document_id": "doc-1",
                "chunk_id": "chk-1",
                "embedding_provider": "openai",
                "embedding_model": "text-embedding-3-small",
                "embedding_dimension": 1536,
                "embedding_version": "a5.v1",
                "parser_version": "a3.v1",
                "chunk_version": "a4.v1",
                "token_count": 40,
                "latency_ms": 10,
                "retry_count": 1,
                "estimated_cost_usd": 0.00001,
            },
            {
                "document_id": "doc-1",
                "chunk_id": "chk-2",
                "embedding_provider": "openai",
                "embedding_model": "text-embedding-3-small",
                "embedding_dimension": 1536,
                "embedding_version": "a5.v1",
                "parser_version": "a3.v1",
                "chunk_version": "a4.v1",
                "token_count": 60,
                "latency_ms": 20,
                "retry_count": 0,
                "estimated_cost_usd": 0.00002,
            },
        ]
    )

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "documents": documents_query,
        "chunk_embeddings": embeddings_query,
    }[name]

    with patch.object(developer_router, "tenant_query") as tenant_query_mock, patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        tenant_query_mock.side_effect = lambda table, workspace_id: {
            "documents": documents_query,
            "chunk_embeddings": embeddings_query,
        }[table]
        response = await client.get(
            "/api/developer/metrics/embeddings",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["documentsProcessed"] == 1
    assert body["chunksProcessed"] == 2
    assert body["providerUsageCounts"]["openai"] == 2


@pytest.mark.asyncio
async def test_embedding_metrics_is_disabled_in_production(client, token_a, workspace_id_a):
    from api.routers import developer as developer_router
    from api import deps as deps_module
    from db import client as db_client

    client_mock = MagicMock()
    client_mock.table.return_value = _memberships_query("viewer")

    with patch.object(developer_router, "tenant_query"), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ), patch.object(developer_router.settings, "environment", "production"):
        response = await client.get(
            "/api/developer/metrics/embeddings",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
        )

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "not_found"


@pytest.mark.asyncio
async def test_index_metrics_returns_developer_summary(client, token_a, workspace_id_a):
    from api.routers import developer as developer_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    documents_query = MagicMock()
    documents_query.select.return_value = documents_query
    documents_query.eq.return_value = documents_query
    documents_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "id": "doc-1",
                "status": "indexed",
                "embedding_completed_at": "2026-06-28T12:00:01Z",
                "index_started_at": "2026-06-28T12:00:02Z",
                "index_completed_at": "2026-06-28T12:00:03Z",
                "current_embedding_provider": "openai",
                "current_embedding_model": "text-embedding-3-small",
                "current_embedding_dimension": 1536,
                "current_embedding_version": "a5.v1",
                "current_embedding_parser_version": "a3.v1",
                "current_embedding_chunk_version": "a4.v1",
                "current_index_provider": "pinecone",
                "current_index_name": "clarity",
                "current_index_namespace": workspace_id_a.replace(workspace_id_a, f"ws_{workspace_id_a}"),
            }
        ]
    )
    index_rows_query = MagicMock()
    index_rows_query.select.return_value = index_rows_query
    index_rows_query.eq.return_value = index_rows_query
    index_rows_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "document_id": "doc-1",
                "chunk_id": "chk-1",
                "index_provider": "pinecone",
                "index_name": "clarity",
                "namespace": f"ws_{workspace_id_a}",
                "vector_id": "vec-1",
                "embedding_provider": "openai",
                "embedding_model": "text-embedding-3-small",
                "embedding_dimension": 1536,
                "embedding_version": "a5.v1",
                "parser_version": "a3.v1",
                "chunk_version": "a4.v1",
                "status": "indexed",
                "latency_ms": 12,
                "retry_count": 1,
            }
        ]
    )

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "documents": documents_query,
        "chunk_vector_index_records": index_rows_query,
    }[name]

    with patch.object(developer_router, "tenant_query") as tenant_query_mock, patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        tenant_query_mock.side_effect = lambda table, workspace_id: {
            "documents": documents_query,
            "chunk_vector_index_records": index_rows_query,
        }[table]
        response = await client.get(
            "/api/developer/metrics/indexing",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["vectorsIndexed"] == 1
    assert body["namespaceCounts"][f"ws_{workspace_id_a}"] == 1


@pytest.mark.asyncio
async def test_developer_dashboard_returns_documents_and_failed_jobs(client, token_a, workspace_id_a):
    from api.routers import developer as developer_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    documents_query = MagicMock()
    documents_query.select.return_value = documents_query
    documents_query.eq.return_value = documents_query
    documents_query.order.return_value = documents_query
    documents_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "id": "doc-1",
                "filename": "msa.pdf",
                "status": "indexed",
                "source_type": "pdf",
                "created_at": "2026-06-28T12:00:00Z",
                "error": None,
                "embedding_queued_at": None,
                "embedding_started_at": None,
                "embedding_completed_at": None,
                "index_queued_at": "2026-06-28T12:00:01Z",
                "index_started_at": "2026-06-28T12:00:02Z",
                "index_completed_at": "2026-06-28T12:00:03Z",
            },
            {
                "id": "doc-2",
                "filename": "broken.pdf",
                "status": "failed",
                "source_type": "pdf",
                "created_at": "2026-06-28T13:00:00Z",
                "error": "index failed",
                "embedding_queued_at": None,
                "embedding_started_at": None,
                "embedding_completed_at": None,
                "index_queued_at": "2026-06-28T13:00:01Z",
                "index_started_at": "2026-06-28T13:00:02Z",
                "index_completed_at": None,
            },
        ]
    )

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "documents": documents_query,
    }[name]

    with patch.object(developer_router, "tenant_query", return_value=documents_query), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        response = await client.get(
            "/api/developer/dashboard",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["statusCounts"]["indexed"] == 1
    assert body["statusCounts"]["failed"] == 1
    assert len(body["failedJobs"]) == 1
