"""
Unit tests for workspace member management endpoints.

GET    /api/workspaces/{id}/members
POST   /api/workspaces/{id}/members
PATCH  /api/workspaces/{id}/members/{userId}
DELETE /api/workspaces/{id}/members/{userId}
"""
from __future__ import annotations

from contextlib import ExitStack
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# DB mock helpers
# ---------------------------------------------------------------------------

def _chain(execute_data: list) -> MagicMock:
    """A supabase query chain mock: every method returns self, execute() returns data."""
    q = MagicMock()
    q.select.return_value = q
    q.insert.return_value = q
    q.update.return_value = q
    q.delete.return_value = q
    q.eq.return_value = q
    q.order.return_value = q
    q.limit.return_value = q
    q.execute.return_value = SimpleNamespace(data=execute_data, count=len(execute_data))
    return q


def _db_with_rows(rows: list) -> MagicMock:
    mock = MagicMock()
    mock.table.return_value = _chain(rows)
    return mock


def _patch_db(auth_rows: list, endpoint_rows: list | None = None):
    """Patches auth dep's get_client and the members router's get_client separately."""
    from api import deps as deps_module
    from api.routers import members as members_router
    stack = ExitStack()
    stack.enter_context(patch.object(deps_module, "get_client", return_value=_db_with_rows(auth_rows)))
    stack.enter_context(
        patch.object(members_router, "get_client", return_value=_db_with_rows(endpoint_rows or []))
    )
    return stack


WORKSPACE_ID = "00000000-0000-0000-0000-000000000001"


def _owner_auth():
    return [{"role": "owner"}]


def _editor_auth():
    return [{"role": "editor"}]


def _headers(token: str, ws_id: str = WORKSPACE_ID) -> dict:
    return {"Authorization": f"Bearer {token}", "X-Workspace-Id": ws_id}


# ---------------------------------------------------------------------------
# GET /api/workspaces/{id}/members
# ---------------------------------------------------------------------------

class TestListMembers:
    @pytest.mark.asyncio
    async def test_returns_member_list(self, client, token_a, workspace_id_a):
        member_rows = [
            {"user_id": "user_a", "role": "owner", "created_at": "2025-01-01T00:00:00Z"},
            {"user_id": "user_b", "role": "viewer", "created_at": "2025-01-02T00:00:00Z"},
        ]
        with _patch_db(auth_rows=_owner_auth(), endpoint_rows=member_rows):
            resp = await client.get(
                f"/api/workspaces/{workspace_id_a}/members",
                headers=_headers(token_a, workspace_id_a),
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 2
        assert body["members"][0]["userId"] == "user_a"
        assert body["members"][0]["role"] == "owner"
        assert body["members"][1]["userId"] == "user_b"

    @pytest.mark.asyncio
    async def test_viewer_can_list_members(self, client, token_a, workspace_id_a):
        with _patch_db(auth_rows=[{"role": "viewer"}], endpoint_rows=[]):
            resp = await client.get(
                f"/api/workspaces/{workspace_id_a}/members",
                headers=_headers(token_a, workspace_id_a),
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_rejects_mismatched_workspace_id(self, client, token_a, workspace_id_a):
        with _patch_db(auth_rows=_owner_auth()):
            resp = await client.get(
                "/api/workspaces/different-ws-id/members",
                headers=_headers(token_a, workspace_id_a),
            )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# POST /api/workspaces/{id}/members
# ---------------------------------------------------------------------------

class TestAddMember:
    @pytest.mark.asyncio
    async def test_owner_can_add_member(self, client, token_a, workspace_id_a):
        from api.routers import members as members_router

        new_row = {"user_id": "user_new", "role": "viewer", "created_at": "2025-06-01T00:00:00Z"}

        # endpoint_db: first call (duplicate check) returns empty, second call (insert) returns new_row
        endpoint_db = MagicMock()
        check_q = _chain([])       # duplicate check → no existing member
        insert_q = _chain([new_row])
        call_n = [0]

        def table_side(name: str):
            call_n[0] += 1
            return check_q if call_n[0] == 1 else insert_q

        endpoint_db.table.side_effect = table_side

        with _patch_db(auth_rows=_owner_auth()):
            with patch.object(members_router, "get_client", return_value=endpoint_db):
                resp = await client.post(
                    f"/api/workspaces/{workspace_id_a}/members",
                    json={"userId": "user_new", "role": "viewer"},
                    headers=_headers(token_a, workspace_id_a),
                )

        assert resp.status_code == 201
        assert resp.json()["userId"] == "user_new"
        assert resp.json()["role"] == "viewer"

    @pytest.mark.asyncio
    async def test_non_owner_cannot_add_member(self, client, token_a, workspace_id_a):
        with _patch_db(auth_rows=_editor_auth()):
            resp = await client.post(
                f"/api/workspaces/{workspace_id_a}/members",
                json={"userId": "user_new", "role": "viewer"},
                headers=_headers(token_a, workspace_id_a),
            )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_rejects_duplicate_member(self, client, token_a, workspace_id_a):
        from api.routers import members as members_router

        endpoint_db = _db_with_rows([{"id": "existing-uuid"}])  # duplicate check hits

        with _patch_db(auth_rows=_owner_auth()):
            with patch.object(members_router, "get_client", return_value=endpoint_db):
                resp = await client.post(
                    f"/api/workspaces/{workspace_id_a}/members",
                    json={"userId": "user_existing", "role": "viewer"},
                    headers=_headers(token_a, workspace_id_a),
                )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_rejects_invalid_role(self, client, token_a, workspace_id_a):
        with _patch_db(auth_rows=_owner_auth()):
            resp = await client.post(
                f"/api/workspaces/{workspace_id_a}/members",
                json={"userId": "user_new", "role": "superadmin"},
                headers=_headers(token_a, workspace_id_a),
            )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# PATCH /api/workspaces/{id}/members/{userId}
# ---------------------------------------------------------------------------

class TestUpdateMemberRole:
    @pytest.mark.asyncio
    async def test_owner_can_change_role(self, client, token_a, workspace_id_a):
        from api.routers import members as members_router

        updated = {"user_id": "user_b", "role": "editor", "created_at": "2025-01-02T00:00:00Z"}
        endpoint_db = _db_with_rows([updated])

        with _patch_db(auth_rows=_owner_auth()):
            with patch.object(members_router, "get_client", return_value=endpoint_db):
                with patch.object(members_router, "_get_member_role", return_value="viewer"):
                    resp = await client.patch(
                        f"/api/workspaces/{workspace_id_a}/members/user_b",
                        json={"role": "editor"},
                        headers=_headers(token_a, workspace_id_a),
                    )

        assert resp.status_code == 200
        assert resp.json()["role"] == "editor"

    @pytest.mark.asyncio
    async def test_blocks_demoting_last_owner(self, client, token_a, workspace_id_a):
        from api.routers import members as members_router

        with _patch_db(auth_rows=_owner_auth()):
            with patch.object(members_router, "_get_member_role", return_value="owner"):
                with patch.object(members_router, "_count_owners", return_value=1):
                    resp = await client.patch(
                        f"/api/workspaces/{workspace_id_a}/members/user_a",
                        json={"role": "editor"},
                        headers=_headers(token_a, workspace_id_a),
                    )

        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_non_owner_cannot_change_role(self, client, token_a, workspace_id_a):
        with _patch_db(auth_rows=_editor_auth()):
            resp = await client.patch(
                f"/api/workspaces/{workspace_id_a}/members/user_b",
                json={"role": "viewer"},
                headers=_headers(token_a, workspace_id_a),
            )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# DELETE /api/workspaces/{id}/members/{userId}
# ---------------------------------------------------------------------------

class TestRemoveMember:
    @pytest.mark.asyncio
    async def test_owner_can_remove_viewer(self, client, token_a, workspace_id_a):
        from api.routers import members as members_router

        with _patch_db(auth_rows=_owner_auth()):
            with patch.object(members_router, "_get_member_role", return_value="viewer"):
                resp = await client.delete(
                    f"/api/workspaces/{workspace_id_a}/members/user_b",
                    headers=_headers(token_a, workspace_id_a),
                )

        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_blocks_removing_last_owner(self, client, token_a, workspace_id_a):
        from api.routers import members as members_router

        with _patch_db(auth_rows=_owner_auth()):
            with patch.object(members_router, "_get_member_role", return_value="owner"):
                with patch.object(members_router, "_count_owners", return_value=1):
                    resp = await client.delete(
                        f"/api/workspaces/{workspace_id_a}/members/user_a",
                        headers=_headers(token_a, workspace_id_a),
                    )

        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_non_owner_cannot_remove(self, client, token_a, workspace_id_a):
        with _patch_db(auth_rows=_editor_auth()):
            resp = await client.delete(
                f"/api/workspaces/{workspace_id_a}/members/user_b",
                headers=_headers(token_a, workspace_id_a),
            )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_returns_404_for_missing_member(self, client, token_a, workspace_id_a):
        from api.routers import members as members_router

        with _patch_db(auth_rows=_owner_auth()):
            with patch.object(members_router, "_get_member_role", return_value=None):
                resp = await client.delete(
                    f"/api/workspaces/{workspace_id_a}/members/nonexistent_user",
                    headers=_headers(token_a, workspace_id_a),
                )

        assert resp.status_code == 404
