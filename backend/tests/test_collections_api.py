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


def _make_collections_query(data: list[dict]):
    query = MagicMock()
    query.select.return_value = query
    query.eq.return_value = query
    query.order.return_value = query
    query.limit.return_value = query
    query.in_.return_value = query
    query.execute.return_value = SimpleNamespace(data=data)
    return query


def _sample_collection(col_id: str = "col-1", workspace_id: str = "00000000-0000-0000-0000-000000000001") -> dict:
    return {
        "id": col_id,
        "workspace_id": workspace_id,
        "name": "Legal Contracts",
        "description": "MSA and NDA documents",
        "color": "#6366f1",
        "icon": None,
        "created_at": "2026-07-01T12:00:00Z",
        "updated_at": "2026-07-01T12:00:00Z",
    }


def _sample_document(doc_id: str = "doc-1", workspace_id: str = "00000000-0000-0000-0000-000000000001") -> dict:
    return {
        "id": doc_id,
        "workspace_id": workspace_id,
        "filename": "msa.pdf",
        "status": "indexed",
        "source_type": "pdf",
        "page_count": 10,
        "created_at": "2026-07-01T10:00:00Z",
        "error": None,
    }


# ─── List collections ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_collections_empty(client, token_a, workspace_id_a):
    from api.routers import collections as collections_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    collections_query = _make_collections_query([])
    cd_query = _make_collections_query([])

    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(collections_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock), \
         patch.object(collections_router, "tenant_query") as tq_mock:
        tq_mock.side_effect = lambda table, workspace_id: {
            "collections": collections_query,
            "collection_documents": cd_query,
        }[table]
        response = await client.get(
            "/api/collections",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["collections"] == []
    assert body["total"] == 0


@pytest.mark.asyncio
async def test_list_collections_populated(client, token_a, workspace_id_a):
    from api.routers import collections as collections_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    collections_query = _make_collections_query([_sample_collection()])
    cd_query = _make_collections_query([
        {"collection_id": "col-1", "document_id": "doc-1", "workspace_id": workspace_id_a},
        {"collection_id": "col-1", "document_id": "doc-2", "workspace_id": workspace_id_a},
    ])

    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(collections_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock), \
         patch.object(collections_router, "tenant_query") as tq_mock:
        tq_mock.side_effect = lambda table, workspace_id: {
            "collections": collections_query,
            "collection_documents": cd_query,
        }[table]
        response = await client.get(
            "/api/collections",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 200
    body = response.json()
    assert len(body["collections"]) == 1
    assert body["total"] == 1
    assert body["collections"][0]["name"] == "Legal Contracts"
    assert body["collections"][0]["documentCount"] == 2


# ─── Create collection ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_collection_valid(client, token_a, workspace_id_a):
    from api.routers import collections as collections_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("editor")
    insert_table = MagicMock()
    insert_table.insert.return_value = insert_table
    insert_table.execute.return_value = SimpleNamespace(data=[_sample_collection()])

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "collections": insert_table,
    }[name]

    with patch.object(collections_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock):
        response = await client.post(
            "/api/collections",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
            json={"name": "Legal Contracts", "description": "MSA and NDA documents"},
        )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Legal Contracts"
    assert body["color"] == "#6366f1"
    insert_table.insert.assert_called_once()


@pytest.mark.asyncio
async def test_create_collection_missing_name_returns_422(client, token_a, workspace_id_a):
    from api.routers import collections as collections_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("editor")
    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(collections_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock):
        response = await client.post(
            "/api/collections",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
            json={"description": "No name provided"},
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_collection_name_too_long_returns_422(client, token_a, workspace_id_a):
    from api.routers import collections as collections_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("editor")
    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(collections_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock):
        response = await client.post(
            "/api/collections",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
            json={"name": "x" * 201},
        )

    assert response.status_code == 422


# ─── Get single collection ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_collection_found(client, token_a, workspace_id_a):
    from api.routers import collections as collections_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    col_query = _make_collections_query([_sample_collection()])
    cd_query = _make_collections_query([
        {"collection_id": "col-1", "document_id": "doc-1", "workspace_id": workspace_id_a},
    ])
    doc_query = _make_collections_query([_sample_document()])

    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(collections_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock), \
         patch.object(collections_router, "tenant_query") as tq_mock:
        tq_mock.side_effect = lambda table, workspace_id: {
            "collections": col_query,
            "collection_documents": cd_query,
            "documents": doc_query,
        }[table]
        response = await client.get(
            "/api/collections/col-1",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "col-1"
    assert body["name"] == "Legal Contracts"
    assert len(body["documents"]) == 1
    assert body["documents"][0]["filename"] == "msa.pdf"


@pytest.mark.asyncio
async def test_get_collection_not_found_returns_404(client, token_a, workspace_id_a):
    from api.routers import collections as collections_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    col_query = _make_collections_query([])

    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(collections_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock), \
         patch.object(collections_router, "tenant_query", return_value=col_query):
        response = await client.get(
            "/api/collections/nonexistent",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "collection_not_found"


# ─── Update collection ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_collection(client, token_a, workspace_id_a):
    from api.routers import collections as collections_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("editor")
    updated_row = {**_sample_collection(), "name": "Updated Name", "color": "#ff0000"}
    col_query = _make_collections_query([_sample_collection()])
    cd_query = _make_collections_query([])
    update_table = MagicMock()
    update_table.update.return_value = update_table
    update_table.eq.return_value = update_table
    update_table.execute.return_value = SimpleNamespace(data=[updated_row])

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "collections": update_table,
    }[name]

    with patch.object(collections_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock), \
         patch.object(collections_router, "tenant_query") as tq_mock:
        tq_mock.side_effect = lambda table, workspace_id: {
            "collections": col_query,
            "collection_documents": cd_query,
        }[table]
        response = await client.patch(
            "/api/collections/col-1",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
            json={"name": "Updated Name", "color": "#ff0000"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Updated Name"
    assert body["color"] == "#ff0000"


# ─── Delete collection ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_collection_editor_succeeds(client, token_a, workspace_id_a):
    from api.routers import collections as collections_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("editor")
    col_query = _make_collections_query([_sample_collection()])
    delete_table = MagicMock()
    delete_table.delete.return_value = delete_table
    delete_table.eq.return_value = delete_table
    delete_table.execute.return_value = SimpleNamespace(data=[{"id": "col-1"}])

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "collections": delete_table,
    }[name]

    with patch.object(collections_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock), \
         patch.object(collections_router, "tenant_query", return_value=col_query):
        response = await client.delete(
            "/api/collections/col-1",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 204
    delete_table.delete.assert_called_once()


@pytest.mark.asyncio
async def test_delete_collection_viewer_role_rejected(client, token_a, workspace_id_a):
    from api.routers import collections as collections_router
    from api import deps as deps_module
    from db import client as db_client

    client_mock = MagicMock()
    client_mock.table.return_value = _memberships_query("viewer")

    with patch.object(collections_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock):
        response = await client.delete(
            "/api/collections/col-1",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 403


# ─── Add document to collection ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_add_document_to_collection(client, token_a, workspace_id_a):
    from api.routers import collections as collections_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("editor")
    col_query = _make_collections_query([_sample_collection()])
    doc_query = _make_collections_query([_sample_document()])
    cd_existing_query = _make_collections_query([])
    cd_count_query = _make_collections_query([
        {"collection_id": "col-1", "document_id": "doc-1", "workspace_id": workspace_id_a},
    ])

    insert_table = MagicMock()
    insert_table.insert.return_value = insert_table
    insert_table.execute.return_value = SimpleNamespace(data=[])

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "collection_documents": insert_table,
    }[name]

    call_count = {"n": 0}

    def tq_side_effect(table: str, workspace_id: str):
        if table == "collections":
            return col_query
        if table == "documents":
            return doc_query
        if table == "collection_documents":
            call_count["n"] += 1
            if call_count["n"] <= 1:
                return cd_existing_query
            return cd_count_query
        raise KeyError(table)

    with patch.object(collections_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock), \
         patch.object(collections_router, "tenant_query", side_effect=tq_side_effect):
        response = await client.post(
            "/api/collections/col-1/documents",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
            json={"documentId": "doc-1"},
        )

    assert response.status_code == 201
    body = response.json()
    assert body["documentCount"] == 1
    insert_table.insert.assert_called_once()


# ─── Remove document from collection ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_remove_document_from_collection(client, token_a, workspace_id_a):
    from api.routers import collections as collections_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("editor")
    col_query = _make_collections_query([_sample_collection()])
    delete_table = MagicMock()
    delete_table.delete.return_value = delete_table
    delete_table.eq.return_value = delete_table
    delete_table.execute.return_value = SimpleNamespace(data=[])

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "collection_documents": delete_table,
    }[name]

    with patch.object(collections_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock), \
         patch.object(collections_router, "tenant_query", return_value=col_query):
        response = await client.delete(
            "/api/collections/col-1/documents/doc-1",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 204
    delete_table.delete.assert_called_once()


# ─── List documents in collection ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_collection_documents(client, token_a, workspace_id_a):
    from api.routers import collections as collections_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    col_query = _make_collections_query([_sample_collection()])
    cd_query = _make_collections_query([
        {"collection_id": "col-1", "document_id": "doc-1", "workspace_id": workspace_id_a},
    ])
    doc_query = _make_collections_query([_sample_document()])

    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(collections_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock), \
         patch.object(collections_router, "tenant_query") as tq_mock:
        tq_mock.side_effect = lambda table, workspace_id: {
            "collections": col_query,
            "collection_documents": cd_query,
            "documents": doc_query,
        }[table]
        response = await client.get(
            "/api/collections/col-1/documents",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 200
    body = response.json()
    assert len(body["documents"]) == 1
    assert body["documents"][0]["id"] == "doc-1"
    assert body["documents"][0]["filename"] == "msa.pdf"


@pytest.mark.asyncio
async def test_list_collection_documents_collection_not_found(client, token_a, workspace_id_a):
    from api.routers import collections as collections_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    col_query = _make_collections_query([])

    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(collections_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock), \
         patch.object(collections_router, "tenant_query", return_value=col_query):
        response = await client.get(
            "/api/collections/nonexistent/documents",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "collection_not_found"


@pytest.mark.asyncio
async def test_list_collections_requires_auth(client, workspace_id_a):
    response = await client.get(
        "/api/collections",
        headers={"X-Workspace-Id": workspace_id_a},
    )
    assert response.status_code == 401
