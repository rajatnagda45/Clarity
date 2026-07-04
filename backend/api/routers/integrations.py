from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from api.deps import require_workspace_role
from api.errors import api_error
from db.client import get_client, tenant_query
from schemas import IntegrationListResponse, IntegrationResponse

router = APIRouter(prefix="/api/enterprise", tags=["enterprise-integrations"])

_CATALOG: list[dict] = [
    {
        "provider": "google_drive",
        "display_name": "Google Drive",
        "description": "Sync documents from Google Drive folders.",
        "feature_flag": True,
    },
    {
        "provider": "onedrive",
        "display_name": "OneDrive",
        "description": "Import files from Microsoft OneDrive.",
        "feature_flag": True,
    },
    {
        "provider": "dropbox",
        "display_name": "Dropbox",
        "description": "Connect your Dropbox workspace.",
        "feature_flag": True,
    },
    {
        "provider": "box",
        "display_name": "Box",
        "description": "Enterprise content management via Box.",
        "feature_flag": True,
    },
    {
        "provider": "sharepoint",
        "display_name": "SharePoint",
        "description": "Sync SharePoint document libraries.",
        "feature_flag": True,
    },
    {
        "provider": "slack",
        "display_name": "Slack",
        "description": "Send AI answers and alerts to Slack channels.",
        "feature_flag": False,
    },
    {
        "provider": "teams",
        "display_name": "Microsoft Teams",
        "description": "Deliver notifications to Teams channels.",
        "feature_flag": False,
    },
    {
        "provider": "notion",
        "display_name": "Notion",
        "description": "Import pages and databases from Notion.",
        "feature_flag": False,
    },
    {
        "provider": "github",
        "display_name": "GitHub",
        "description": "Index READMEs and documentation from repositories.",
        "feature_flag": False,
    },
    {
        "provider": "jira",
        "display_name": "Jira",
        "description": "Create Jira issues from automation rules.",
        "feature_flag": False,
    },
    {
        "provider": "confluence",
        "display_name": "Confluence",
        "description": "Ingest Confluence spaces and pages.",
        "feature_flag": False,
    },
    {
        "provider": "gmail",
        "display_name": "Gmail",
        "description": "Index email threads for AI search.",
        "feature_flag": False,
    },
    {
        "provider": "outlook",
        "display_name": "Outlook",
        "description": "Sync Outlook folders and emails.",
        "feature_flag": False,
    },
]


def _build_response(
    catalog_item: dict,
    row: dict | None,
    workspace_id: str,
) -> IntegrationResponse:
    provider = catalog_item["provider"]
    return IntegrationResponse(
        id=str(row["id"]) if row else f"catalog_{provider}",
        workspace_id=workspace_id,
        provider=provider,
        display_name=catalog_item["display_name"],
        description=catalog_item["description"],
        status=row["status"] if row else "not_connected",
        last_sync_at=row.get("last_sync_at") if row else None,
        docs_imported=row.get("docs_imported", 0) if row else 0,
        config=row.get("config") or {} if row else {},
        feature_flag=catalog_item["feature_flag"],
        created_at=row.get("created_at") if row else None,
    )


@router.get("/integrations", response_model=IntegrationListResponse)
async def list_integrations(
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> IntegrationListResponse:
    workspace_id, _ = ctx
    rows = (
        tenant_query("workspace_integrations", workspace_id)
        .select("*")
        .execute()
    ).data or []
    connected = {r["provider"]: r for r in rows}
    integrations = [
        _build_response(item, connected.get(item["provider"]), workspace_id)
        for item in _CATALOG
    ]
    return IntegrationListResponse(integrations=integrations)


@router.post("/integrations/{provider}/disconnect", response_model=IntegrationResponse)
async def disconnect_integration(
    provider: str,
    request: Request,
    ctx: tuple = Depends(require_workspace_role),
) -> IntegrationResponse:
    workspace_id, role = ctx
    if role not in ("owner", "editor"):
        raise api_error(403, "insufficient_role", "Editor or Owner role required.")

    catalog_item = next((c for c in _CATALOG if c["provider"] == provider), None)
    if not catalog_item:
        raise api_error(404, "integration_not_found", "Unknown provider.")

    rows = (
        tenant_query("workspace_integrations", workspace_id)
        .select("*")
        .eq("provider", provider)
        .execute()
    ).data or []
    if not rows:
        raise api_error(404, "integration_not_found", "Integration not connected.")

    get_client().table("workspace_integrations").update(
        {"status": "disconnected"}
    ).eq("id", rows[0]["id"]).execute()

    return _build_response(catalog_item, {**rows[0], "status": "disconnected"}, workspace_id)
