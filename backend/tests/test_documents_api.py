from __future__ import annotations

from io import BytesIO
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException


def _multipart_file(
    name: str = "msa.pdf",
    content: bytes = b"%PDF-1.4 test payload",
    content_type: str = "application/pdf",
):
    return {"file": (name, BytesIO(content), content_type)}


def _memberships_query(role: str | None):
    query = MagicMock()
    query.select.return_value = query
    query.eq.return_value = query
    query.limit.return_value = query
    query.execute.return_value = SimpleNamespace(data=[{"role": role}] if role else [])
    return query


@pytest.mark.asyncio
async def test_upload_requires_auth(client, workspace_id_a):
    response = await client.post(
        "/api/documents",
        headers={"X-Workspace-Id": workspace_id_a},
        files=_multipart_file(),
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_upload_rejects_viewer_role(client, token_a, workspace_id_a):
    from api.routers import documents as documents_router
    from api import deps as deps_module
    from db import client as db_client

    client_mock = MagicMock()
    client_mock.table.return_value = _memberships_query("viewer")

    with patch.object(documents_router, "get_client", return_value=client_mock), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        response = await client.post(
            "/api/documents",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
            files=_multipart_file(),
        )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_upload_missing_file_returns_400(client, token_a, workspace_id_a):
    from api.routers import documents as documents_router
    from api import deps as deps_module
    from db import client as db_client

    client_mock = MagicMock()
    client_mock.table.return_value = _memberships_query("editor")

    with patch.object(documents_router, "get_client", return_value=client_mock), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        response = await client.post(
            "/api/documents",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
        )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_upload_rejects_unsupported_extension(client, token_a, workspace_id_a):
    from api.routers import documents as documents_router
    from api import deps as deps_module
    from db import client as db_client

    client_mock = MagicMock()
    client_mock.table.return_value = _memberships_query("editor")

    with patch.object(documents_router, "get_client", return_value=client_mock), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        response = await client.post(
            "/api/documents",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
            files=_multipart_file(name="notes.txt", content_type="text/plain"),
        )

    assert response.status_code == 415


@pytest.mark.asyncio
async def test_upload_rejects_oversized_file(client, token_a, workspace_id_a):
    from api.routers import documents as documents_router
    from api import deps as deps_module
    from db import client as db_client

    client_mock = MagicMock()
    client_mock.table.return_value = _memberships_query("editor")

    with patch.object(documents_router, "get_client", return_value=client_mock), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ), patch.object(documents_router.settings, "max_upload_bytes", 4):
        response = await client.post(
            "/api/documents",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
            files=_multipart_file(content=b"12345"),
        )

    assert response.status_code == 413


@pytest.mark.asyncio
async def test_buffer_upload_rejects_oversized_file_without_reading_to_eof():
    from api.routers import documents as documents_router

    class FakeUploadFile:
        def __init__(self) -> None:
            self._chunks = [b"ab", b"cd", b"ef", b"gh", b""]
            self.read_calls = 0

        async def read(self, size: int) -> bytes:
            assert size == 2
            self.read_calls += 1
            return self._chunks.pop(0)

    fake_upload = FakeUploadFile()

    with patch.object(documents_router.settings, "max_upload_bytes", 4), patch.object(
        documents_router, "UPLOAD_CHUNK_BYTES", 2
    ):
        with pytest.raises(HTTPException) as exc_info:
            await documents_router._buffer_upload(fake_upload)

    assert exc_info.value.status_code == 413
    assert exc_info.value.detail["code"] == "file_too_large"
    assert fake_upload.read_calls == 3
    assert fake_upload._chunks == [b"gh", b""]


@pytest.mark.asyncio
async def test_upload_persists_document_metadata(client, token_a, workspace_id_a):
    from api.routers import documents as documents_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("editor")
    documents_table = MagicMock()
    documents_table.insert.return_value = documents_table
    documents_table.execute.return_value = SimpleNamespace(
        data=[
            {
                "id": "doc-1",
                "filename": "msa.pdf",
                "status": "uploaded",
                "source_type": "pdf",
                "page_count": None,
                "created_at": "2026-06-28T12:00:00Z",
                "error": None,
            }
        ]
    )

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "documents": documents_table,
    }[name]

    with patch.object(documents_router, "get_client", return_value=client_mock), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ), patch.object(documents_router, "upload_document_file") as upload_mock, patch.object(
        documents_router, "run_document_ingestion_task"
    ) as ingestion_mock:
        response = await client.post(
            "/api/documents",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
            files=_multipart_file(),
        )

    assert response.status_code == 202
    body = response.json()
    assert body["filename"] == "msa.pdf"
    assert body["status"] == "uploaded"
    assert body["sourceType"] == "pdf"
    upload_mock.assert_called_once()
    ingestion_mock.assert_called_once()
    documents_table.insert.assert_called_once()


@pytest.mark.asyncio
async def test_upload_db_failure_triggers_storage_cleanup(client, token_a, workspace_id_a):
    from api.routers import documents as documents_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("editor")
    documents_table = MagicMock()
    documents_table.insert.return_value = documents_table
    documents_table.execute.side_effect = RuntimeError("insert failed")

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "documents": documents_table,
    }[name]

    with patch.object(documents_router, "get_client", return_value=client_mock), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ), patch.object(documents_router, "upload_document_file"), patch.object(
        documents_router, "delete_document_object"
    ) as delete_mock:
        response = await client.post(
            "/api/documents",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
            files=_multipart_file(),
        )

    assert response.status_code == 500
    delete_mock.assert_called_once()


@pytest.mark.asyncio
async def test_upload_url_stub_returns_501(client, token_a, workspace_id_a):
    from api.routers import documents as documents_router
    from api import deps as deps_module
    from db import client as db_client

    client_mock = MagicMock()
    client_mock.table.return_value = _memberships_query("editor")

    with patch.object(documents_router, "get_client", return_value=client_mock), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        response = await client.post(
            "/api/documents",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
                "Content-Type": "application/json",
            },
            json={"url": "https://example.com/msa.pdf"},
        )

    assert response.status_code == 501
    assert response.json()["error"]["code"] == "url_ingestion_not_implemented"


@pytest.mark.asyncio
async def test_list_documents_is_workspace_scoped(client, token_a, workspace_id_a):
    from api.routers import documents as documents_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    list_query = MagicMock()
    list_query.select.return_value = list_query
    list_query.eq.return_value = list_query
    list_query.order.return_value = list_query
    list_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "id": "doc-1",
                "filename": "msa.pdf",
                "status": "uploaded",
                "source_type": "pdf",
                "page_count": None,
                "created_at": "2026-06-28T12:00:00Z",
                "error": None,
            }
        ]
    )

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "documents": list_query,
    }[name]

    with patch.object(documents_router, "get_client", return_value=client_mock), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        response = await client.get(
            "/api/documents",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
        )

    assert response.status_code == 200
    assert response.json()["documents"][0]["id"] == "doc-1"
    list_query.eq.assert_any_call("workspace_id", workspace_id_a)


@pytest.mark.asyncio
async def test_get_document_not_found_inside_workspace_returns_404(client, token_a, workspace_id_a):
    from api.routers import documents as documents_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    detail_query = MagicMock()
    detail_query.select.return_value = detail_query
    detail_query.eq.return_value = detail_query
    detail_query.limit.return_value = detail_query
    detail_query.execute.return_value = SimpleNamespace(data=[])

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "documents": detail_query,
    }[name]

    with patch.object(documents_router, "get_client", return_value=client_mock), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        response = await client.get(
            "/api/documents/non-existent",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
        )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_document_returns_clause_map(client, token_a, workspace_id_a):
    from api.routers import documents as documents_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    detail_query = MagicMock()
    detail_query.select.return_value = detail_query
    detail_query.eq.return_value = detail_query
    detail_query.limit.return_value = detail_query
    detail_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "id": "doc-1",
                "filename": "msa.pdf",
                "status": "indexed",
                "source_type": "pdf",
                "page_count": 9,
                "created_at": "2026-06-28T12:00:00Z",
                "error": None,
            }
        ]
    )
    clauses_query = MagicMock()
    clauses_query.select.return_value = clauses_query
    clauses_query.eq.return_value = clauses_query
    clauses_query.order.return_value = clauses_query
    clauses_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "id": "clause-1",
                "workspace_id": workspace_id_a,
                "document_id": "doc-1",
                "clause_type": "termination",
                "text": "Either party may terminate for convenience.",
                "page": 4,
                "risk_flag": "non_standard",
                "rationale": "Core contract clause with terms that merit verification.",
                "benchmark_match_id": None,
                "deviation_note": None,
                "risk_score": 0.6,
                "created_at": "2026-06-28T12:00:00Z",
            }
        ]
    )
    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {"memberships": memberships_table}[name]

    with patch.object(documents_router, "get_client", return_value=client_mock), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ), patch.object(
        documents_router, "_schedule_embedding_refresh"
    ), patch.object(
        documents_router, "_schedule_index_refresh"
    ), patch.object(documents_router, "tenant_query") as tenant_query_mock:
        tenant_query_mock.side_effect = lambda table, workspace_id: {
            "documents": detail_query,
            "clauses": clauses_query,
        }[table]
        response = await client.get(
            "/api/documents/doc-1",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 200
    assert response.json()["clauses"][0]["clauseType"] == "termination"


@pytest.mark.asyncio
async def test_get_document_file_returns_signed_url(client, token_a, workspace_id_a):
    from api.routers import documents as documents_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    detail_query = MagicMock()
    detail_query.select.return_value = detail_query
    detail_query.eq.return_value = detail_query
    detail_query.limit.return_value = detail_query
    detail_query.execute.return_value = SimpleNamespace(
        data=[{"id": "doc-1", "filename": "msa.pdf", "r2_key": "workspaces/ws/documents/doc-1/msa.pdf"}]
    )
    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {"memberships": memberships_table}[name]

    with patch.object(documents_router, "get_client", return_value=client_mock), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ), patch.object(documents_router, "tenant_query", return_value=detail_query), patch.object(
        documents_router, "build_signed_document_url", return_value="https://signed.example/doc-1"
    ):
        response = await client.get(
            "/api/documents/doc-1/file",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 200
    assert response.json()["signedUrl"] == "https://signed.example/doc-1"


@pytest.mark.asyncio
async def test_delete_document_removes_storage_and_metadata(client, token_a, workspace_id_a):
    from api.routers import documents as documents_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("editor")
    detail_query = MagicMock()
    detail_query.select.return_value = detail_query
    detail_query.eq.return_value = detail_query
    detail_query.limit.return_value = detail_query
    detail_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "id": "doc-1",
                "workspace_id": workspace_id_a,
                "filename": "msa.pdf",
                "r2_key": "workspaces/ws/documents/doc-1/msa.pdf",
                "current_embedding_provider": "openai",
                "current_embedding_model": "text-embedding-3-small",
                "current_embedding_dimension": 1536,
                "current_embedding_version": "a5.v1",
                "current_embedding_parser_version": "a3.v1",
                "current_embedding_chunk_version": "a4.v1",
            }
        ]
    )
    index_query = MagicMock()
    index_query.select.return_value = index_query
    index_query.eq.return_value = index_query
    index_query.execute.return_value = SimpleNamespace(data=[])
    delete_table = MagicMock()
    delete_table.delete.return_value = delete_table
    delete_table.eq.return_value = delete_table
    delete_table.execute.return_value = SimpleNamespace(data=[{"id": "doc-1"}])

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "documents": delete_table,
    }[name]

    with patch.object(documents_router, "get_client", return_value=client_mock), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ), patch.object(documents_router, "tenant_query") as tenant_query_mock, patch.object(
        documents_router, "delete_document_object"
    ) as delete_object_mock:
        tenant_query_mock.side_effect = lambda table, workspace_id: {
            "documents": detail_query,
            "chunk_vector_index_records": index_query,
        }[table]
        response = await client.delete(
            "/api/documents/doc-1",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 204
    delete_object_mock.assert_called_once()


@pytest.mark.asyncio
async def test_chunk_inspector_returns_workspace_scoped_chunks(client, token_a, workspace_id_a):
    from api.routers import documents as documents_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    documents_query = MagicMock()
    documents_query.select.return_value = documents_query
    documents_query.eq.return_value = documents_query
    documents_query.limit.return_value = documents_query
    documents_query.execute.return_value = SimpleNamespace(data=[{"id": "doc-1"}])

    chunks_query = MagicMock()
    chunks_query.select.return_value = chunks_query
    chunks_query.eq.return_value = chunks_query
    chunks_query.order.return_value = chunks_query
    chunks_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "chunk_id": "chk_1",
                "chunk_index": 0,
                "section_title": "TERMINATION",
                "clause_number": "12.1",
                "page_start": 4,
                "page_end": 5,
                "source_offsets": [
                    {"page": 4, "block_order": 1, "char_start": 0, "char_end": 80},
                ],
                "token_count": 42,
                "checksum": "abc123",
                "parser_version": "a3.v1",
                "chunk_version": "a4.v1",
                "chunk_kind": "clause",
                "fragment_index": 0,
                "fragment_count": 1,
                "cross_references": ["Section 9.2"],
                "text": "12.1 Either party may terminate for convenience.",
            }
        ]
    )

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "documents": documents_query,
        "chunks": chunks_query,
    }[name]

    with patch.object(documents_router, "get_client", return_value=client_mock), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        response = await client.get(
            "/api/documents/doc-1/chunks",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["documentId"] == "doc-1"
    assert body["chunks"][0]["chunkId"] == "chk_1"
    chunks_query.eq.assert_any_call("workspace_id", workspace_id_a)


@pytest.mark.asyncio
async def test_chunk_inspector_requires_developer_access(client, workspace_id_a):
    from api.routers import documents as documents_router
    from api import deps as deps_module
    from db import client as db_client
    from tests.conftest import _make_jwt

    client_mock = MagicMock()
    client_mock.table.return_value = _memberships_query("viewer")
    token = _make_jwt([workspace_id_a], user_id="user_non_developer")

    with patch.object(documents_router, "get_client", return_value=client_mock), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        response = await client.get(
            "/api/documents/doc-1/chunks",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Workspace-Id": workspace_id_a,
            },
        )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "developer_access_required"


@pytest.mark.asyncio
async def test_embedding_explorer_returns_workspace_scoped_embeddings(client, token_a, workspace_id_a):
    from api.routers import documents as documents_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    documents_query = MagicMock()
    documents_query.select.return_value = documents_query
    documents_query.eq.return_value = documents_query
    documents_query.limit.return_value = documents_query
    documents_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "id": "doc-1",
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
    embeddings_query.order.return_value = embeddings_query
    embeddings_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "chunk_id": "chk_1",
                "chunk_index": 0,
                "embedding_provider": "openai",
                "embedding_model": "text-embedding-3-small",
                "embedding_dimension": 1536,
                "embedding_version": "a5.v1",
                "parser_version": "a3.v1",
                "chunk_version": "a4.v1",
                "checksum": "sum-1",
                "token_count": 42,
                "latency_ms": 18,
                "retry_count": 0,
                "estimated_cost_usd": 0.00001,
                "vector_preview": [0.1, 0.2, 0.3],
                "created_at": "2026-06-28T12:00:00Z",
            }
        ]
    )

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "documents": documents_query,
        "chunk_embeddings": embeddings_query,
    }[name]

    with patch.object(documents_router, "get_client", return_value=client_mock), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        response = await client.get(
            "/api/documents/doc-1/embeddings",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["currentEmbeddingProvider"] == "openai"
    assert body["embeddings"][0]["status"] == "current"
    embeddings_query.eq.assert_any_call("workspace_id", workspace_id_a)


@pytest.mark.asyncio
async def test_embedding_explorer_requires_developer_access(client, workspace_id_a):
    from api.routers import documents as documents_router
    from api import deps as deps_module
    from db import client as db_client
    from tests.conftest import _make_jwt

    client_mock = MagicMock()
    client_mock.table.return_value = _memberships_query("viewer")
    token = _make_jwt([workspace_id_a], user_id="user_non_developer")

    with patch.object(documents_router, "get_client", return_value=client_mock), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ):
        response = await client.get(
            "/api/documents/doc-1/embeddings",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Workspace-Id": workspace_id_a,
            },
        )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "developer_access_required"


@pytest.mark.asyncio
async def test_vector_explorer_returns_workspace_scoped_index_rows(client, token_a, workspace_id_a):
    from api.routers import documents as documents_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    documents_query = MagicMock()
    documents_query.select.return_value = documents_query
    documents_query.eq.return_value = documents_query
    documents_query.limit.return_value = documents_query
    documents_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "id": "doc-1",
                "current_index_provider": "pinecone",
                "current_index_name": "clarity",
                "current_index_namespace": f"ws_{workspace_id_a}",
                "current_embedding_provider": "openai",
                "current_embedding_model": "text-embedding-3-small",
                "current_embedding_dimension": 1536,
                "current_embedding_version": "a5.v1",
                "current_embedding_parser_version": "a3.v1",
                "current_embedding_chunk_version": "a4.v1",
            }
        ]
    )

    index_query = MagicMock()
    index_query.select.return_value = index_query
    index_query.eq.return_value = index_query
    index_query.order.return_value = index_query
    index_query.execute.return_value = SimpleNamespace(
        data=[
            {
                "chunk_id": "chk_1",
                "chunk_index": 0,
                "vector_id": "vec-1",
                "namespace": f"ws_{workspace_id_a}",
                "status": "indexed",
                "index_provider": "pinecone",
                "index_name": "clarity",
                "embedding_provider": "openai",
                "embedding_model": "text-embedding-3-small",
                "embedding_dimension": 1536,
                "embedding_version": "a5.v1",
                "parser_version": "a3.v1",
                "chunk_version": "a4.v1",
                "checksum": "sum-1",
                "section_title": "Confidentiality",
                "clause_number": "1",
                "page_start": 1,
                "page_end": 1,
                "retry_count": 0,
                "latency_ms": 14,
                "indexed_at": "2026-06-28T12:00:00Z",
            }
        ]
    )

    chunks_query = MagicMock()
    chunks_query.select.return_value = chunks_query
    chunks_query.eq.return_value = chunks_query
    chunks_query.order.return_value = chunks_query
    chunks_query.execute.return_value = SimpleNamespace(
        data=[{"chunk_id": "chk_1", "text": "Clause text"}]
    )

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
    }[name]

    with patch.object(documents_router, "get_client", return_value=client_mock), patch.object(
        deps_module, "get_client", return_value=client_mock
    ), patch.object(
        db_client, "get_client", return_value=client_mock
    ), patch.object(documents_router, "tenant_query") as tenant_query_mock:
        tenant_query_mock.side_effect = lambda table, workspace_id: {
            "documents": documents_query,
            "chunk_vector_index_records": index_query,
            "chunks": chunks_query,
        }[table]
        response = await client.get(
            "/api/documents/doc-1/vectors",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Workspace-Id": workspace_id_a,
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["currentIndexProvider"] == "pinecone"
    assert body["vectors"][0]["vectorId"] == "vec-1"
    assert body["vectors"][0]["status"] == "current"
