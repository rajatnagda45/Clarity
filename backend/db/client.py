"""
Supabase client and tenant-scoped query helper.

All reads/writes MUST go through `tenant_query` so workspace isolation
is enforced at the application layer as defense-in-depth alongside RLS.
"""

from typing import Any
from supabase import create_client, Client
from config import settings


def _build_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


# Module-level singleton; FastAPI lifespan re-creates if needed.
_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = _build_client()
    return _client


def tenant_query(table: str, workspace_id: str) -> Any:
    """
    Returns a Supabase query builder pre-filtered by workspace_id.

    Usage:
        rows = tenant_query("documents", workspace_id).select("*").execute()

    Never call supabase.table(table) directly from route handlers —
    always go through this function so the workspace filter is guaranteed.
    """
    return get_client().table(table).select("*", count="exact").eq("workspace_id", workspace_id)


def global_table(table: str) -> Any:
    """
    For the ONE intentionally global (non-tenant) table: reference_clauses.
    Must NEVER be used for tables that hold user content.
    """
    if table != "reference_clauses":
        raise ValueError(
            f"global_table() called with '{table}'. Only 'reference_clauses' is permitted. "
            "All user-content tables must use tenant_query()."
        )
    return get_client().table(table)
