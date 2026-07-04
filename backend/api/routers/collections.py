from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from api.deps import require_workspace_role
from db.client import get_client, tenant_query
from schemas import (
    AddDocumentToCollectionRequest,
    CollectionDetailResponse,
    CollectionListResponse,
    CollectionSummary,
    CreateCollectionRequest,
    DocumentListResponse,
    DocumentSummary,
    UpdateCollectionRequest,
)

router = APIRouter(prefix="/api/collections", tags=["collections"])


def _error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


def _require_editor(request: Request) -> tuple[str, str]:
    return require_workspace_role(request, "editor")


def _collection_summary_from_row(row: dict, document_count: int = 0) -> CollectionSummary:
    return CollectionSummary(
        id=str(row["id"]),
        workspaceId=str(row["workspace_id"]),
        name=row["name"],
        description=row.get("description"),
        color=row.get("color") or "#6366f1",
        icon=row.get("icon"),
        documentCount=document_count,
        createdAt=row["created_at"],
        updatedAt=row.get("updated_at"),
    )


def _document_summary_from_row(row: dict) -> DocumentSummary:
    return DocumentSummary(
        id=str(row["id"]),
        filename=row["filename"],
        status=row["status"],
        sourceType=row["source_type"],
        pageCount=row.get("page_count"),
        createdAt=row["created_at"],
        error=row.get("error"),
    )


@router.get("", response_model=CollectionListResponse)
async def list_collections(
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> CollectionListResponse:
    workspace_id, _ = membership
    rows = (
        tenant_query("collections", workspace_id)
        .order("created_at", desc=True)
        .execute()
    )
    cd_rows = tenant_query("collection_documents", workspace_id).execute()
    doc_counts: dict[str, int] = {}
    for cd_row in cd_rows.data or []:
        col_id = str(cd_row["collection_id"])
        doc_counts[col_id] = doc_counts.get(col_id, 0) + 1

    collections = [
        _collection_summary_from_row(row, doc_counts.get(str(row["id"]), 0))
        for row in rows.data or []
    ]
    return CollectionListResponse(collections=collections, total=len(collections))


@router.post("", response_model=CollectionSummary, status_code=status.HTTP_201_CREATED)
async def create_collection(
    payload: CreateCollectionRequest,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> CollectionSummary:
    workspace_id, _ = membership
    now = datetime.now(UTC).isoformat()
    row = {
        "id": str(uuid4()),
        "workspace_id": workspace_id,
        "name": payload.name,
        "description": payload.description,
        "color": payload.color or "#6366f1",
        "icon": payload.icon,
        "created_at": now,
        "updated_at": now,
    }
    result = get_client().table("collections").insert(row).execute()
    created_row = (result.data or [row])[0]
    return _collection_summary_from_row(created_row)


@router.get("/{collection_id}/documents", response_model=DocumentListResponse)
async def list_collection_documents(
    collection_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> DocumentListResponse:
    workspace_id, _ = membership
    result = (
        tenant_query("collections", workspace_id)
        .eq("id", collection_id)
        .limit(1)
        .execute()
    )
    if not (result.data or []):
        raise _error(status.HTTP_404_NOT_FOUND, "collection_not_found", "Collection was not found.")

    cd_rows = (
        tenant_query("collection_documents", workspace_id)
        .eq("collection_id", collection_id)
        .execute()
    )
    document_ids = [str(cd["document_id"]) for cd in cd_rows.data or []]

    documents: list[DocumentSummary] = []
    if document_ids:
        doc_rows = (
            tenant_query("documents", workspace_id)
            .in_("id", document_ids)
            .execute()
        )
        documents = [_document_summary_from_row(doc) for doc in doc_rows.data or []]

    return DocumentListResponse(documents=documents)


@router.get("/{collection_id}", response_model=CollectionDetailResponse)
async def get_collection(
    collection_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> CollectionDetailResponse:
    workspace_id, _ = membership
    result = (
        tenant_query("collections", workspace_id)
        .eq("id", collection_id)
        .limit(1)
        .execute()
    )
    row = (result.data or [None])[0]
    if not row:
        raise _error(status.HTTP_404_NOT_FOUND, "collection_not_found", "Collection was not found.")

    cd_rows = (
        tenant_query("collection_documents", workspace_id)
        .eq("collection_id", collection_id)
        .execute()
    )
    document_ids = [str(cd["document_id"]) for cd in cd_rows.data or []]

    documents: list[DocumentSummary] = []
    if document_ids:
        doc_rows = (
            tenant_query("documents", workspace_id)
            .in_("id", document_ids)
            .execute()
        )
        documents = [_document_summary_from_row(doc) for doc in doc_rows.data or []]

    summary = _collection_summary_from_row(row, len(documents))
    return CollectionDetailResponse(**summary.model_dump(), documents=documents)


@router.patch("/{collection_id}", response_model=CollectionSummary)
async def update_collection(
    collection_id: str,
    payload: UpdateCollectionRequest,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> CollectionSummary:
    workspace_id, _ = membership
    result = (
        tenant_query("collections", workspace_id)
        .eq("id", collection_id)
        .limit(1)
        .execute()
    )
    row = (result.data or [None])[0]
    if not row:
        raise _error(status.HTTP_404_NOT_FOUND, "collection_not_found", "Collection was not found.")

    update_data: dict = {"updated_at": datetime.now(UTC).isoformat()}
    if payload.name is not None:
        update_data["name"] = payload.name
    if payload.description is not None:
        update_data["description"] = payload.description
    if payload.color is not None:
        update_data["color"] = payload.color
    if payload.icon is not None:
        update_data["icon"] = payload.icon

    updated = (
        get_client()
        .table("collections")
        .update(update_data)
        .eq("id", collection_id)
        .eq("workspace_id", workspace_id)
        .execute()
    )
    updated_row = (updated.data or [None])[0] or {**row, **update_data}

    cd_rows = (
        tenant_query("collection_documents", workspace_id)
        .eq("collection_id", collection_id)
        .execute()
    )
    doc_count = len(cd_rows.data or [])
    return _collection_summary_from_row(updated_row, doc_count)


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collection(
    collection_id: str,
    membership: tuple[str, str] = Depends(_require_editor),
) -> Response:
    workspace_id, _ = membership
    result = (
        tenant_query("collections", workspace_id)
        .eq("id", collection_id)
        .limit(1)
        .execute()
    )
    if not (result.data or []):
        raise _error(status.HTTP_404_NOT_FOUND, "collection_not_found", "Collection was not found.")

    get_client().table("collections").delete().eq("id", collection_id).eq("workspace_id", workspace_id).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{collection_id}/documents", response_model=CollectionSummary, status_code=status.HTTP_201_CREATED)
async def add_document_to_collection(
    collection_id: str,
    payload: AddDocumentToCollectionRequest,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> CollectionSummary:
    workspace_id, _ = membership
    result = (
        tenant_query("collections", workspace_id)
        .eq("id", collection_id)
        .limit(1)
        .execute()
    )
    row = (result.data or [None])[0]
    if not row:
        raise _error(status.HTTP_404_NOT_FOUND, "collection_not_found", "Collection was not found.")

    doc_result = (
        tenant_query("documents", workspace_id)
        .eq("id", payload.document_id)
        .limit(1)
        .execute()
    )
    if not (doc_result.data or []):
        raise _error(status.HTTP_404_NOT_FOUND, "document_not_found", "Document was not found.")

    existing = (
        tenant_query("collection_documents", workspace_id)
        .eq("collection_id", collection_id)
        .eq("document_id", payload.document_id)
        .limit(1)
        .execute()
    )
    if not (existing.data or []):
        now = datetime.now(UTC).isoformat()
        get_client().table("collection_documents").insert({
            "id": str(uuid4()),
            "collection_id": collection_id,
            "document_id": payload.document_id,
            "workspace_id": workspace_id,
            "added_at": now,
        }).execute()

    cd_rows = (
        tenant_query("collection_documents", workspace_id)
        .eq("collection_id", collection_id)
        .execute()
    )
    doc_count = len(cd_rows.data or [])
    return _collection_summary_from_row(row, doc_count)


@router.delete("/{collection_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_document_from_collection(
    collection_id: str,
    document_id: str,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> Response:
    workspace_id, _ = membership
    result = (
        tenant_query("collections", workspace_id)
        .eq("id", collection_id)
        .limit(1)
        .execute()
    )
    if not (result.data or []):
        raise _error(status.HTTP_404_NOT_FOUND, "collection_not_found", "Collection was not found.")

    get_client().table("collection_documents").delete() \
        .eq("collection_id", collection_id) \
        .eq("document_id", document_id) \
        .eq("workspace_id", workspace_id) \
        .execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
