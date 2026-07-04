from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest


def _memberships_query(role: str | None):
    q = MagicMock()
    q.select.return_value = q
    q.eq.return_value = q
    q.limit.return_value = q
    q.execute.return_value = SimpleNamespace(data=[{"role": role}] if role else [])
    return q


def _make_prompts_query(data: list[dict]):
    q = MagicMock()
    q.select.return_value = q
    q.eq.return_value = q
    q.order.return_value = q
    q.execute.return_value = SimpleNamespace(data=data)
    return q


def _sample_prompt(prompt_id: str = "p-1", workspace_id: str = "00000000-0000-0000-0000-000000000001") -> dict:
    return {
        "id": prompt_id,
        "workspace_id": workspace_id,
        "title": "Contract Summarizer",
        "content": "Summarize this contract in 3 bullet points: {{document}}",
        "category": "legal",
        "variables": ["document"],
        "is_favorite": False,
        "use_count": 0,
        "created_by": "user_a",
        "created_at": "2026-07-04T10:00:00Z",
    }


@pytest.mark.asyncio
async def test_list_prompt_library_empty(client, token_a, workspace_id_a):
    from api.routers import prompt_library as pl_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    prompts_query = _make_prompts_query([])
    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(pl_router, "tenant_query", return_value=prompts_query), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock):
        response = await client.get(
            "/api/enterprise/prompt-library",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["prompts"] == []
    assert body["total"] == 0


@pytest.mark.asyncio
async def test_list_prompt_library_populated(client, token_a, workspace_id_a):
    from api.routers import prompt_library as pl_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("viewer")
    prompts_query = _make_prompts_query([_sample_prompt()])
    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(pl_router, "tenant_query", return_value=prompts_query), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock):
        response = await client.get(
            "/api/enterprise/prompt-library",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 200
    body = response.json()
    assert len(body["prompts"]) == 1
    assert body["prompts"][0]["title"] == "Contract Summarizer"
    assert body["prompts"][0]["category"] == "legal"
    assert body["prompts"][0]["variables"] == ["document"]


@pytest.mark.asyncio
async def test_create_prompt_entry(client, token_a, workspace_id_a):
    from api.routers import prompt_library as pl_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("editor")
    insert_table = MagicMock()
    insert_table.insert.return_value = insert_table
    insert_table.execute.return_value = SimpleNamespace(data=[_sample_prompt()])

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "prompt_library": insert_table,
    }[name]

    with patch.object(pl_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock):
        response = await client.post(
            "/api/enterprise/prompt-library",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
            json={
                "title": "Contract Summarizer",
                "content": "Summarize this contract: {{document}}",
                "category": "legal",
                "variables": ["document"],
            },
        )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Contract Summarizer"
    assert body["category"] == "legal"
    assert body["isFavorite"] is False


@pytest.mark.asyncio
async def test_create_prompt_missing_content_returns_422(client, token_a, workspace_id_a):
    from api.routers import prompt_library as pl_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("editor")
    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(pl_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock):
        response = await client.post(
            "/api/enterprise/prompt-library",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
            json={"title": "Missing content"},
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_delete_prompt_entry(client, token_a, workspace_id_a):
    from api.routers import prompt_library as pl_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("editor")
    prompts_query = _make_prompts_query([{"id": "p-1"}])
    delete_table = MagicMock()
    delete_table.delete.return_value = delete_table
    delete_table.eq.return_value = delete_table
    delete_table.execute.return_value = SimpleNamespace(data=[])

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "memberships": memberships_table,
        "prompt_library": delete_table,
    }[name]

    with patch.object(pl_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock), \
         patch.object(pl_router, "tenant_query", return_value=prompts_query):
        response = await client.delete(
            "/api/enterprise/prompt-library/p-1",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 204


@pytest.mark.asyncio
async def test_delete_nonexistent_prompt_returns_404(client, token_a, workspace_id_a):
    from api.routers import prompt_library as pl_router
    from api import deps as deps_module
    from db import client as db_client

    memberships_table = _memberships_query("editor")
    prompts_query = _make_prompts_query([])
    client_mock = MagicMock()
    client_mock.table.return_value = memberships_table

    with patch.object(pl_router, "get_client", return_value=client_mock), \
         patch.object(deps_module, "get_client", return_value=client_mock), \
         patch.object(db_client, "get_client", return_value=client_mock), \
         patch.object(pl_router, "tenant_query", return_value=prompts_query):
        response = await client.delete(
            "/api/enterprise/prompt-library/nonexistent",
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_id_a},
        )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "prompt_not_found"


@pytest.mark.asyncio
async def test_prompt_library_requires_auth(client, workspace_id_a):
    response = await client.get(
        "/api/enterprise/prompt-library",
        headers={"X-Workspace-Id": workspace_id_a},
    )
    assert response.status_code == 401
