from fastapi import APIRouter, Request
from schemas import HealthResponse

router = APIRouter(tags=["health"])

VERSION = "0.1.0"


@router.get("/health", response_model=HealthResponse, include_in_schema=True)
async def health(request: Request):
    from config import settings
    return HealthResponse(
        status="ok",
        version=VERSION,
        environment=settings.environment,
    )
