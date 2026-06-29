from __future__ import annotations

from fastapi import APIRouter, Depends

from api.deps import require_workspace_role
from db.client import tenant_query
from schemas import Contradiction


router = APIRouter(prefix="/api/contradictions", tags=["contradictions"])


@router.get("", response_model=list[Contradiction])
async def list_contradictions(
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> list[Contradiction]:
    workspace_id, _ = membership
    rows = tenant_query("contradictions", workspace_id).order("created_at", desc=True).execute()
    return [
        Contradiction(
            id=str(row["id"]),
            topic=row["topic"],
            doc_a=str(row["doc_a"]),
            span_a=str(row["span_a"]) if row.get("span_a") else None,
            value_a=row.get("value_a"),
            doc_b=str(row["doc_b"]),
            span_b=str(row["span_b"]) if row.get("span_b") else None,
            value_b=row.get("value_b"),
            severity=row["severity"],
            note=row.get("note"),
        )
        for row in rows.data or []
    ]
