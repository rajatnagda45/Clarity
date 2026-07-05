# Clarity AI Docs — Version 1.0 Release Notes

**Release Date**: 2026-07-05

## What Is Clarity?

Clarity AI Docs is a self-auditing enterprise document intelligence platform. It ingests PDF and DOCX documents, chunks and embeds them into a vector store, and answers queries with calibrated trust scores backed by a two-signal verification pipeline (NLI entailment + LLM critic). Every answer cites specific document passages and carries a trust score that reflects retrieval quality, claim coverage, and calibration confidence.

## What's New in 1.0

### Production-Grade Security

- **JWT algorithm hardening**: HS256 tokens rejected in production; RS256 (Clerk) required
- **JWKS key rotation**: Cache refreshes hourly and on unknown-kid events — no restart needed after Clerk rotates keys
- **IDOR protection**: All database mutations now include workspace_id scope even when using the service-role client
- **Async role cache**: `require_workspace_role` converted to async — Redis cache now actually works (was broken by event-loop deadlock in prior releases)
- **HTTP security headers**: CSP, HSTS, X-Frame-Options, Referrer-Policy on all frontend routes
- **Webhook hardened**: Server refuses to start in production without `DODO_WEBHOOK_SECRET`

### Complete Database Schema

Migrations 014–016 bring the database schema in line with the API surface:

- **014**: Agents platform — `agents`, `agent_runs`, `agent_tool_calls`, `review_queue`
- **015**: Enterprise platform — `collections`, `collection_documents`, `workflows`, `api_keys`, `webhooks`, `webhook_deliveries`, `automation_rules`, `prompt_library`, `workspace_integrations`, `audit_logs`
- **016**: Benchmark platform — `benchmark_datasets`, `benchmark_cases`, `benchmark_runs`

All tables: Row Level Security enabled, tenant isolation policy, FK constraints, indexes.

### Reliability

- **Dead Letter Queue**: Aborted ARQ jobs stored in Redis `dlq:aborted_jobs` (capped at 1000), document/run status updated to `failed` for operator visibility
- **Zero-downtime deploys**: Worker `maxUnavailable` set to 0 — at least one worker runs throughout rolling updates
- **Redis probe authentication**: Kubernetes liveness/readiness probes now use `--no-auth-warning` flag when Redis password is set
- **Job deduplication**: Concurrent document uploads cannot create duplicate ingestion jobs
- **Fail-safe CORS**: Ingress `cors-allow-origin` now explicitly set (previously defaulted to `*` with credentials — a browser security violation)

### Frontend Polish

- **Stop generation**: Composer stop button is now active and calls the SSE abort function
- **Dark mode trust badge**: TrustBadge component was rendering light-mode green/amber/red on a dark background — fixed
- **Dynamic Tailwind classes eliminated**: `grid-cols-${cols}` replaced with explicit conditionals — no more purged CSS in production builds
- **Dead buttons fixed**: Topbar avatar navigates to Settings; Paperclip shows accessible "coming soon" tooltip
- **Duplicate ⌘K**: Both UIContext and CommandContext were registering keyboard handlers — reduced to one
- **Page title coverage**: Topbar now shows correct titles for agents, collections, developer, help, provenance, eval/benchmarks

### Infrastructure

- **Dockerfile**: `--no-dev` updated to `--without dev` for Poetry 2.x compatibility
- **Dockerfile.worker**: HEALTHCHECK added via ARQ Redis heartbeat key
- **CI**: ESLint step added; npm cache key corrected to `package-lock.json`

## Breaking Changes

- `require_workspace_role` is now `async` — any custom wrapper functions that call it directly (not via `Depends`) must be updated to `async def` and `await` the result
- HS256 JWTs rejected in production — ensure Clerk is configured to issue RS256 tokens before upgrading

## Known Limitations

1. **Agent execution is simulated**: `_execute_agent_run` in `agents.py` produces deterministic placeholder outputs. Real LLM agent execution (with `system_prompt`, `model`, `temperature`) is not yet wired. Trust scores are hash-derived, not AI-produced.
2. **Unbounded queries**: `list_conversations`, `get_answer_explorer`, `citation_analytics`, and `benchmark_get_dataset` load entire workspace history without pagination. Production workspaces with large histories will see slow responses.
3. **NLI batch parallelism broken**: `_batch_nli` in `agents/nodes/critic.py` passes sync functions to `asyncio.gather` — this path raises `TypeError` at runtime if the agent graph's NLI node is reached.
4. **Redis HA**: The bundled `k8s/redis.yaml` is a single-replica development deployment. Production requires a managed HA Redis service.
5. **Migration conflicts**: Migrations 009 and 016 both create `benchmark_datasets`, `benchmark_cases`, and `benchmark_runs` with different constraints. On a fresh install with 009 applied first, 016's `IF NOT EXISTS` silently skips creation, leaving the 009 constraints in place.

## Upgrade Path from 0.1.x

1. Run migrations 014, 015, 016 against your Supabase project
2. Rotate `REDIS_URL` and `REDIS_PASSWORD` secrets if using the k8s Redis pod
3. Set `DODO_API_KEY`, `DODO_WEBHOOK_SECRET`, `DODO_PRODUCT_ID_PRO`, `DODO_PRODUCT_ID_TEAM` in `clarity-secrets` before redeploying
4. Update any custom code that calls `require_workspace_role` directly to `async def` with `await`
5. Deploy with `kubectl apply -f k8s/`
