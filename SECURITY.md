# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | Yes       |
| < 1.0   | No        |

## Reporting a Vulnerability

**Do not file a public GitHub issue for security vulnerabilities.**

Email **security@clarity.ai** with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested mitigations

You will receive an acknowledgement within 48 hours and a status update within 7 days.

## Security Architecture

### Authentication
- All API endpoints require a valid Clerk JWT (Bearer token)
- Production enforces RS256 only — HS256 tokens are rejected
- JWKS keys are cached with a 1-hour TTL and refreshed on rotation

### Authorisation
- Row Level Security (RLS) enabled on all tenant tables in Supabase
- Every mutation additionally scoped to `workspace_id` at the application layer
- Role hierarchy: viewer < editor < owner; enforced per-endpoint
- `/api/metrics` and `/api/developer/*` restricted to configured developer user IDs

### Transport
- TLS enforced at the Kubernetes ingress layer (cert-manager)
- HSTS header set with `max-age=31536000; includeSubDomains`
- CORS configured to the specific frontend origin only

### API Keys
- Keys stored as SHA-256 hash with a human-readable prefix for identification
- Keys are never stored or returned in plaintext after creation
- Webhook secrets stored as SHA-256 hash

### Secrets Management
- All credentials stored as Kubernetes Secrets or environment variables
- No secrets in source code or container images
- `STRIPE_WEBHOOK_SECRET` is required in production (startup fails if absent)

### Rate Limiting
- Per-user rate limits enforced via Redis counters with UUID normalisation
- Limits: 60 req/min for general endpoints, 10 req/min for upload/AI routes
- Fail-open when Redis is unavailable (acceptable for availability)

### File Uploads
- Server-side MIME type validation and extension allowlist
- 50 MB per-file size limit enforced at ingress and application layer
- Local storage path traversal prevented via `Path.resolve().is_relative_to()`

### Data Isolation
- Multi-tenant isolation via Supabase RLS using JWT workspace claims
- All application-layer queries additionally filtered by `workspace_id`
- Service-role client used only where explicitly required; never exposed to end users

### Dependency Security
- Python dependencies managed via Poetry with locked versions
- Node dependencies managed via npm with lockfile
- Periodic `npm audit` and `pip-audit` recommended in CI

## Known Limitations

1. **Redis HA**: The bundled k8s Redis manifest is single-replica (development/staging). Production requires Upstash, ElastiCache, or Redis Sentinel.
2. **Calibrator pickle**: `services/verification/calibrator.py` loads a `.pkl` file. Ensure `CALIBRATOR_PATH` points only to a trusted, ops-controlled file location.
3. **LangSmith tracing**: `LANGCHAIN_TRACING_V2` defaults to `true`. Disable in production to prevent query content being sent to LangSmith unless explicitly needed.
