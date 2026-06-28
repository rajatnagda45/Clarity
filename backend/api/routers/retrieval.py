from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import require_workspace_role
from schemas import RetrievalSearchRequest, RetrievalSearchResponse
from services.retrieval.models import RetrievalRequest
from services.retrieval.service import retrieve_evidence


router = APIRouter(prefix="/api/retrieval", tags=["retrieval"])


def _error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


@router.post("/search", response_model=RetrievalSearchResponse)
async def search_retrieval(
    payload: RetrievalSearchRequest,
    membership: tuple[str, str] = Depends(require_workspace_role),
) -> RetrievalSearchResponse:
    workspace_id, _ = membership

    if payload.filters and payload.filters.page_start and payload.filters.page_end:
        if payload.filters.page_start > payload.filters.page_end:
            raise _error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "invalid_page_range",
                "pageStart cannot be greater than pageEnd.",
            )

    request = RetrievalRequest.model_validate(payload.model_dump())
    response, _ = await retrieve_evidence(request, workspace_id)
    return RetrievalSearchResponse(**response.model_dump(mode="json", by_alias=True))
