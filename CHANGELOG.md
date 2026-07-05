# Changelog

All notable changes to Clarity AI Docs are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] — 2026-07-05

### Added
- **Agent Platform** (migrations/014): `agents`, `agent_runs`, `agent_tool_calls`, `review_queue` tables with RLS and tenant isolation
- **Enterprise Platform** (migrations/015): `collections`, `collection_documents`, `workflows`, `api_keys`, `webhooks`, `webhook_deliveries`, `automation_rules`, `prompt_library`, `workspace_integrations`, `audit_logs`
- **Benchmark Platform** (migrations/016): `benchmark_datasets`, `benchmark_cases`, `benchmark_runs`
- Rollback scripts for migrations 014–016
- ARQ dead-letter queue (`dlq:aborted_jobs`) with 1000-entry cap in Redis
- Redis role-membership cache (60s TTL) to reduce per-request DB queries
- Rate limit key normalisation: UUID path segments collapsed to `{id}`
- Job deduplication for document ingestion via ARQ `_job_id`
- Worker liveness probe validates ARQ Redis heartbeat keys
- Production startup validator (fails fast if `STRIPE_WEBHOOK_SECRET`, `REDIS_URL`, or `ALLOWED_ORIGINS` missing)
- HTTP security headers: CSP, HSTS, X-Frame-Options, Referrer-Policy
- Pod security context enforcement in Kubernetes manifests
- JWKS cache TTL (1 hour) with automatic key-rotation refresh
- HS256 JWT algorithm blocked in production (algorithm-confusion protection)
- `formatBytes` shared utility extracted to `frontend/src/lib/format.ts`
- `frontend/src/lib/format.ts`: `formatBytes`, `formatNumber`, `formatPercent` utilities
- CI: ESLint step, correct npm cache key (`package-lock.json`), Python dependency caching
- DEPLOYMENT_GUIDE.md, OPERATIONS_RUNBOOK.md, INCIDENT_RESPONSE.md, BACKUP_AND_RESTORE.md, SECURITY.md, CONTRIBUTING.md

### Fixed
- **IDOR (High)**: Missing `workspace_id` filter on UPDATE/DELETE in `agents`, `webhooks`, `automation_rules`, `workflows`, `prompt_library`, `review_queue`, `agent_runs`
- **Broken role cache (High)**: `require_workspace_role` converted from sync to `async def` — eliminates `run_until_complete` deadlock in FastAPI's event loop
- **Algorithm confusion (High)**: `auth.py` rejects HS256 tokens in production; only RS256 accepted
- **JWKS cache (High)**: No-TTL JWKS cache replaced with 1-hour refresh cycle
- **Pickle RCE (High)**: Redis cache replaced `pickle.loads/dumps` with `json.loads/dumps`
- **Path traversal (High)**: Document download uses `Path.resolve().is_relative_to()` guard
- **Stripe webhook open (High)**: Production startup rejects start if webhook secret unset
- **DLQ (High)**: Aborted ARQ jobs now land in `dlq:aborted_jobs` and update document/run status to `failed`
- **Redis probe auth (High)**: k8s liveness/readiness probes use `--no-auth-warning -a` flag
- **Ingress CORS (Medium)**: Added explicit `cors-allow-origin` annotation
- **Worker rolling update (Medium)**: `maxUnavailable` changed from 1 to 0 (zero-downtime deploys)
- **Duplicate `⌘K` handler (Medium)**: Removed conflicting keydown listener from `UIContext`; `CommandContext` is now the single source of truth
- **TrustBadge colors (High)**: Light-mode Tailwind classes replaced with dark-mode equivalents
- **Dynamic Tailwind purge (High)**: `grid-cols-${cols}` replaced with explicit conditional class strings
- **Missing `'use client'` (High)**: Added directive to `Composer.tsx`
- **Stop button wired (Medium)**: Composer stop button calls `onStop` prop (via `stopStreamRef`)
- **Duplicate types (Medium)**: Second `ModelComparison` / `ModelComparisonListResponse` declaration removed
- **Dead avatar button (Medium)**: Topbar avatar now navigates to `/settings`
- **Dead buttons (Medium)**: Paperclip disabled with accessible tooltip
- **`useDocuments` staleTime (Low)**: Added `staleTime: 60_000` to prevent unnecessary refetches
- **`formatBytes` duplication (Low)**: Deduplicated into shared `lib/format.ts`
- **Page title coverage (Low)**: `getPageTitle` now covers agents, collections, workspace, help, developer, eval/benchmarks, provenance, onboarding
- **CI npm cache key (Low)**: Fixed `cache-dependency-path` from `package.json` to `package-lock.json`
- **Poetry `--no-dev` (Low)**: Updated to `--without dev` for Poetry 2.x compatibility
- **Dockerfile.worker HEALTHCHECK (Low)**: Added liveness check via ARQ Redis heartbeat keys
- **`_require_editor` helper (Low)**: Made async to match `require_workspace_role` signature

### Security
- JWT algorithm restricted to RS256 in production (HS256 only permitted in test/dev)
- JWKS keys refreshed on TTL expiry and on unknown-kid events
- All write mutations scoped to verified `workspace_id`
- Stripe webhook rejects unauthenticated POSTs when secret is configured
- CSP/HSTS/X-Frame-Options headers on all Next.js routes

### Performance
- Role cache eliminates one DB round-trip per authenticated request (~20–40ms savings)
- `useDocuments` 60s stale time prevents duplicate sidebar/page fetches
- Rate limit key normalisation prevents Redis key count unbounded growth

---

## [0.1.0] — 2026-06-01

- Initial scaffold: document ingestion, chunking, embedding pipeline
- RAG retrieval engine with Pinecone vector store
- Two-signal AI verification (NLI + critic)
- Calibrated trust scoring
- Eval-as-CI pipeline with benchmark and regression detection
- Enterprise platform: collections, agents, workflows, audit logs
- Billing integration (Stripe)
- Kubernetes deployment manifests
