"""
Clarity — FastAPI application entry point.

Startup order:
1. Config validation (pydantic-settings raises on missing required vars)
2. Sentry initialization (error tracking)
3. Middleware registration (auth → rate-limit → CORS)
4. Router registration
5. LangSmith tracing enabled via env vars (LANGCHAIN_TRACING_V2)
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import sentry_sdk
from config import settings
from api.middleware.auth import AuthMiddleware
from api.middleware.rate_limit import RateLimitMiddleware
from api.routers import developer
from api.routers import documents
from api.routers import health
from api.routers import retrieval
from api.routers import workspaces


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Validate Supabase connectivity on startup
    from db.client import get_client
    client = get_client()
    # Lightweight ping — list workspaces limit 1
    client.table("workspaces").select("id").limit(1).execute()
    yield
    # Teardown (connections are HTTP-based, nothing to explicitly close)


def _init_sentry() -> None:
    dsn = os.getenv("SENTRY_DSN", "")
    if dsn:
        sentry_sdk.init(
            dsn=dsn,
            traces_sample_rate=0.1,
            environment=settings.environment,
        )


_init_sentry()

app = FastAPI(
    title="Clarity API",
    version="0.1.0",
    description="Self-auditing contract intelligence — two-signal verifier, calibrated trust, eval-as-CI.",
    lifespan=lifespan,
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
)

# CORS — tighten origins in production via env
_allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth must run before rate-limit so user_id is set on request.state
app.add_middleware(AuthMiddleware)
app.add_middleware(RateLimitMiddleware)

# Routers
app.include_router(health.router)
app.include_router(workspaces.router)
app.include_router(documents.router)
app.include_router(retrieval.router)
app.include_router(developer.router)
