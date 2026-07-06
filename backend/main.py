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
import logging
import logging.config
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import sentry_sdk
from api.errors import install_error_handlers
from config import settings
from api.middleware.auth import AuthMiddleware
from api.middleware.rate_limit import RateLimitMiddleware
from api.middleware.logging import LoggingMiddleware
from api.middleware.metrics import MetricsMiddleware
from api.routers import claims
from api.routers import developer
from api.routers import documents
from api.routers import events
from api.routers import health
from api.routers import chat
from api.routers import conversations
from api.routers import contradictions
from api.routers import messages
from api.routers import retrieval
from api.routers import workspaces
from api.routers import evaluations
from api.routers import benchmarks
from api.routers import regressions
from api.routers import experiments
from api.routers import prompts
from api.routers import optimization
from api.routers import quality_gates
from api.routers import release_notes
from api.routers import model_comparisons
from api.routers import benchmark_suggestions
from api.routers import billing
from api.routers import members
from api.routers import metrics as metrics_router
from api.routers import collections
from api.routers import api_keys
from api.routers import webhooks
from api.routers import audit_logs
from api.routers import integrations
from api.routers import automation
from api.routers import prompt_library
from api.routers import agents
from api.routers import workflows
from api.routers import review_queue


def _validate_production_config() -> None:
    """Fail fast on missing production-critical config before accepting traffic."""
    if settings.environment != "production":
        return
    errors: list[str] = []
    if not settings.dodo_webhook_secret:
        errors.append("DODO_WEBHOOK_SECRET must be set in production to prevent webhook spoofing.")
    if not settings.redis_url:
        errors.append("REDIS_URL must be set in production for rate limiting and job queue.")
    allowed = os.getenv("ALLOWED_ORIGINS", "")
    if not allowed or "localhost" in allowed:
        errors.append("ALLOWED_ORIGINS must be set to production domain(s) — localhost is not allowed.")
    if errors:
        raise RuntimeError("Production config validation failed:\n" + "\n".join(f"  - {e}" for e in errors))


@asynccontextmanager
async def lifespan(app: FastAPI):
    _validate_production_config()

    # Distributed queue + cache (gracefully no-ops if Redis not configured)
    from job_queue.client import init_pool, close_pool
    from cache.client import init_redis, close_redis

    if settings.redis_url:
        await init_redis(settings.redis_url)
        await init_pool(settings.redis_url)

    # OpenTelemetry (opt-in via OTEL_ENABLED=true)
    if settings.otel_enabled:
        from telemetry.setup import setup_telemetry
        setup_telemetry(app, settings.otel_service_name, settings.otel_exporter_otlp_endpoint)

    # Best-effort startup connectivity check
    try:
        from db.client import get_client
        get_client().table("workspaces").select("id").limit(1).execute()
    except Exception:
        pass

    yield

    # Graceful shutdown — drain queue pool and Redis connections
    if settings.redis_url:
        await close_pool()
        await close_redis()


def _init_sentry() -> None:
    dsn = os.getenv("SENTRY_DSN", "")
    if dsn:
        sentry_sdk.init(
            dsn=dsn,
            traces_sample_rate=0.1,
            environment=settings.environment,
        )


def _configure_logging() -> None:
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    logging.config.dictConfig({
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "json": {
                "()": "logging.Formatter",
                # Use a single-line format with no embedded quotes in field values
                # to ensure each log line is valid structured text for log aggregators.
                "fmt": "time=%(asctime)s level=%(levelname)s logger=%(name)s msg=%(message)s",
                "datefmt": "%Y-%m-%dT%H:%M:%SZ",
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "json",
                "stream": "ext://sys.stdout",
            },
        },
        "root": {"level": log_level, "handlers": ["console"]},
    })


_init_sentry()
_configure_logging()

app = FastAPI(
    title="Clarity API",
    version="0.1.0",
    description="Self-auditing contract intelligence — two-signal verifier, calibrated trust, eval-as-CI.",
    lifespan=lifespan,
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
)
install_error_handlers(app)

# CORS — tighten origins in production via env
_allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001",
).split(",")

# Starlette runs middleware in reverse registration order (last registered = outermost).
# Correct execution order: CORS (outermost) → Auth → RateLimit → route handler.
#
# Why this order:
#  - CORS must be outermost so its headers are added to ALL responses, including
#    auth errors and rate-limit 429s. The browser sees every error with CORS headers.
#  - Auth must run before RateLimit so request.state.user_id is populated before
#    RateLimitMiddleware reads it. Rate limits are keyed by user_id, not IP.
#  - RateLimit is innermost so it only fires after the JWT is validated.
#
# Execution order: CORS → Logging → Metrics → Auth → RateLimit → handler.
# Registration order is reversed (first registered = innermost).
app.add_middleware(RateLimitMiddleware)
app.add_middleware(AuthMiddleware)
app.add_middleware(MetricsMiddleware)
app.add_middleware(LoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router)
app.include_router(workspaces.router)
app.include_router(documents.router)
app.include_router(events.router)
app.include_router(retrieval.router)
app.include_router(chat.router)
app.include_router(conversations.router)
app.include_router(contradictions.router)
app.include_router(messages.router)
app.include_router(claims.router)
app.include_router(developer.router)
app.include_router(evaluations.router)
app.include_router(benchmarks.router)
app.include_router(regressions.router)
app.include_router(experiments.router)
app.include_router(prompts.router)
app.include_router(optimization.router)
app.include_router(quality_gates.router)
app.include_router(release_notes.router)
app.include_router(model_comparisons.router)
app.include_router(benchmark_suggestions.router)
app.include_router(billing.router)
app.include_router(members.router)
app.include_router(metrics_router.router)
app.include_router(collections.router)
app.include_router(api_keys.router)
app.include_router(webhooks.router)
app.include_router(audit_logs.router)
app.include_router(integrations.router)
app.include_router(automation.router)
app.include_router(prompt_library.router)
app.include_router(agents.router)
app.include_router(workflows.router)
app.include_router(review_queue.router)
