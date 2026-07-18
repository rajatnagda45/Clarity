# Clarity Docs — Comprehensive Engineering Review

**Repository:** `/Users/rajatnagda/Desktop/clarity-docs`
**Review date:** 2026-07-09
**Branch analyzed:** `phase/0-scaffold`
**Version analyzed:** v1.0.0 (2026-07-05) per `CHANGELOG.md`

---

## 1. Executive Summary

Clarity is a vertical‑focused, multi‑tenant SaaS for **verifiable contract Q&A**. The product's stated differentiators, in order, are: (1) a **two‑signal self‑critique loop** (Critic LLM + NLI entailment), (2) **calibrated trust scoring with abstention** plus an **eval‑as‑CI quality gate**, (3) **pixel‑accurate bounding‑box provenance**, (4) a **persistent contradiction graph**, (5) a **live reasoning graph** with the Writer↔Critic debate, and (6) honest **abstention** when the system cannot verify.

The repository is a **monorepo** (Next.js 15 + FastAPI + 17 SQL migrations + k8s manifests). After this review, I assess it as a **production‑minded v1.0** that has shipped the *core differentiators* it claims, but the **operational, security, and enterprise surface around those differentiators is uneven**: many documented Enterprise features are **definition‑only or simulated** (agent execution, integrations, automations, workflows, prompt library), the **SSE/streaming layer is the most production‑ready part**, and the **testing strategy is strong on security and pipeline logic but weak on the streamed user‑visible UX**.

The product has real substance: the verification pipeline (`backend/services/verification/`, `backend/services/answer_generation/service.py::generate_live_answer_stream`), the ingestion lease‑locked pipeline (`backend/services/{ingestion,embeddings,indexing}/pipeline.py`), the calibrated trust formula, the 30 hand‑authored golden cases (`backend/scripts/generate_golden_cases.py`), the cross‑pod SSE relay (`backend/services/events/bus.py::start_redis_relay`), the in‑process ARQ DLQ (`backend/worker.py::on_job_abort`), the production fail‑fast config check (`backend/main.py::_validate_production_config`), and the explicit RS256‑only / HS256‑blocked verification (`backend/api/middleware/auth.py`).

However, the **documentation is significantly ahead of the implementation in the Enterprise Platform and Developer Console**: the README pitches LangGraph debate panels, PDF bounding‑box provenance viewers, and seven‑tab evaluation dashboards, while the actual `agents/` package is a near‑empty LangGraph stub and the frontend evaluation dashboard exists but is a thin shell.

---

## 2. System Architecture

### High‑level shape (verified)

- **Frontend** — Next.js 15.2 App Router (React 19, TS strict), Clerk for auth, TanStack React Query for server state, fetch‑based SSE (not EventSource, to support `Authorization` headers), `@tanstack/react-virtual` for document list virtualization. (`frontend/src/app/layout.tsx`, `frontend/src/lib/api.ts`, `frontend/src/lib/documentEvents.ts`, `frontend/src/lib/chatStream.ts`)
- **Backend** — FastAPI on Python 3.11, ARQ over Redis for distributed workers, Pydantic v2 with camelCase↔snake_case bridging, 35 routers, `enqueue_or_background` (ARQ with FastAPI `BackgroundTasks` fallback) (`backend/main.py`, `backend/job_queue/client.py`).
- **Data plane** — Supabase Postgres + RLS, Pinecone (namespace `ws_{workspace_id}`), Cloudflare R2 (local fs fallback in dev), Upstash Redis, OpenAI (gpt‑4o‑mini + text‑embedding‑3‑small), Cohere rerank, Dodo Payments (replacing Stripe per `migrations/017_dodo_billing.sql` + `CHANGELOG.md`).
- **Observability** — LangSmith + Sentry + OpenTelemetry (optional) + in‑process `/api/metrics` (developer‑only). (`backend/main.py`, `backend/api/middleware/metrics.py`, `backend/api/routers/metrics.py`, `backend/telemetry/setup.py`)

### Two pipelines (verified)

**Ingestion** — `POST /api/documents` → lease via `ingestion_run_id` (gated by conditional update, `backend/services/ingestion/pipeline.py::_claim_ingestion_lease`) → `_extract_document` (PDF via PyMuPDF, DOCX via stdlib zip+xml) → normalize → preprocess → chunk (`backend/services/ingestion/chunker.py::generate_chunks`, clause‑aware, sentence‑boundary split, fragment_count for overflow) → persist chunks + clauses (parallel via `asyncio.gather`) → chain into embedding → chain into indexing → `documents.status = 'indexed'`. Each stage emits a `PipelineEvent` to `event_bus` which both persists to `pipeline_events` and publishes to Redis (`clarity:pipeline:{ws_id}`) for cross‑pod SSE replay.

**Query** — `POST /api/chat` (SSE) → semantic cache check → `retrieve_evidence` (dense via Pinecone + sparse via BM25 in `asyncio.to_thread` → RRF k=60 → Cohere rerank → cross‑reference expansion cap 2) → `OpenAIWriterProvider.generate_streaming` (with custom `_MarkdownStreamExtractor` state machine for incremental JSON parsing) → after first token reaches the client, fire‑and‑forget `run_eval_for_answer` → after stream end, `_persist_answer_to_db` via `asyncio.to_thread`. Two‑signal verification runs in parallel with streaming: `run_critic` (gpt‑4o‑mini, max 2 iterations) + `check_entailment` (gpt‑4o via the deliberately different `NLI_OPENAI_MODEL` so the signals aren't correlated) → `apply_ensemble` → `compute_trust` (4‑signal weighted formula) → `calibrator.calibrate` (isotonic regression loaded from `services/verification/calibrator.pkl`).

### Three‑layer multi‑tenancy (verified, with one inconsistency)

1. **Pinecone namespace** `ws_{workspace_id}` (in `build_index_namespace`, `backend/services/indexing/inspector.py`)
2. **Postgres RLS** with two distinct patterns:
   - **Pattern A** (migrations 001–008, 013–016): `USING (workspace_id::text = any (select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')))`
   - **Pattern B** (migration 011+): `USING (workspace_id = current_setting('app.workspace_id')::uuid)` — requires the app to `SET LOCAL app.workspace_id = '…'` per request, which **the codebase does not actually do** anywhere I could find. This is a real defect — those tables are either non‑functional or rely on the JWT claim path coincidentally matching.
3. **App‑layer guard** — `tenant_query(table, workspace_id)` in `backend/db/client.py` pre‑filters every read, plus `require_workspace_role` in `backend/api/deps.py` for writes.

The **app‑layer guard is the actual line of defense** in the running code; RLS is belt‑and‑suspenders. This is a defensible choice but the inconsistency between Patterns A and B is not, and should be unified.

---

## 3. Frontend Architecture (verified)

### Stack and patterns

- **Next.js 15.2 App Router, React 19, TS strict** (`frontend/package.json`, `frontend/next.config.ts`, `frontend/tsconfig.json`).
- **Provider tree** in `src/app/layout.tsx`: `ClerkProvider → UIProvider → WorkspaceProvider → QueryProvider → DocumentEventsProvider → ToastProvider`. The order is intentional and correct (Workspace must be inside Clerk so `useUser` works; DocumentEvents must be inside Query so it can `setQueryData`).
- **Route groups** — `(auth)/` is a server‑component layout that calls `auth()` from Clerk and `redirect('/')` if unauthenticated, then renders `<DarkAppLayout>`. Every authenticated page is therefore gated. Public routes (`/`, `/pricing`, `/faq`, `login/`, `signup/`) bypass this.
- **State** — Three tiers: TanStack React Query (server, with `staleTime: 60_000`, `gcTime: 600_000`, `refetchOnWindowFocus: false` because SSE is the live channel), React Context (cross‑cutting UI: workspace, toast, command palette, notifications, onboarding, UI), and `useState` for local form/draft state. **No Redux, no Zustand** — a deliberate, defensible choice.
- **Streaming** — Custom fetch‑based SSE in `lib/api.ts::streamQuery` (returns abort function) + auto‑resume via `lib/chatStream.ts::applyStreamEvent` reducer pattern. If a stream drops after the server has emitted `meta` (which carries `answerRunId`), the chat page calls `resumeAnswerStream` (REST polling of `/api/chat/conversations/{id}/answers/{run}/stream?after=N`) to recover missing events.
- **Performance** — The four documented Performance Sprints are real and verifiable in the code: `experimental.optimizePackageImports` on `recharts/framer-motion/lucide-react` in `next.config.ts`, lazy `Suspense` tabs for settings/eval/help/onboarding, `useCallback`/`useMemo` on context values, `keepPreviousData` on `useDocuments`/`useDashboardMetrics`/`useDeveloperConsole`, virtualization with `@tanstack/react-virtual` for `>30` documents, `useQueries` for the developer dashboard's 5 parallel metrics, and a dev‑only `PerformanceOverlay` (Alt+Shift+P) showing FPS / heap / render counts.
- **Design system** — Dark‑mode‑first in `globals.css` with CSS custom properties (no hardcoded HEX in components), Tailwind tokens in `tailwind.config.ts` (surface, text, border, accent, semantic). The pure primitive library is in `src/components/ds/` (`Button`, `Input`, `Card`, `Dialog`, `DropdownMenu`, `Tabs`, `Tooltip`, `Skeleton`, etc., with full a11y). Motion is GPU‑only (`transform`+`opacity`); a comment in `lib/motion.ts` explicitly notes that `backdrop-filter: blur()` was removed because it triggered expensive repaints.

### What the frontend does well

- **Thin page** pattern: every `page.tsx` is 3–10 lines, just routing into a feature component. Logic lives in `components/<feature>/`. This is the right call.
- **Streaming is robust**: fetch‑based SSE, abort, auto‑resume, sequence replay.
- **Premium feel** at zero cost: `PremiumBackground` (mouse‑parallax grid + glows), `AuthLayout` 7‑layer ambient system, the workspace‑name‑to‑color hash in `WorkspaceTab` (`hash = (hash * 31 + char) | 0; palette[Math.abs(hash) % palette.length]`).
- **Mobile + desktop** in the same shell: `useUI().sidebarCollapsed` drives `md:ml-[80px]` / `md:ml-[288px]` in `LayoutInner`.

### Where the frontend is aspirational

- The **7‑tab Eval Dashboard** is a `Suspense` + lazy boundary shell — the *tabs* lazy‑load fine, but the *content* is the same backend endpoints as `/api/evaluations/*` and `/api/developer/*`; there's no real per‑tab specialization.
- The **12‑page Developer Console** exists, but the most interesting pages (Answer Explorer, Retrieval Explorer) read endpoints that are themselves limited (the Answer Explorer payload is capped at 20 rows in the route and 5 in the `useDeveloperConsole` hook, and it is the same data the user already saw in the chat).
- **No frontend tests beyond 4** (`chatStream.test.ts`, `documentPolling.test.ts`, `verifiedAnswer.test.tsx`, `markdown.test.ts`, total 403 lines) and **no E2E tests anywhere**.

---

## 4. Backend Architecture (verified)

### `backend/main.py` startup order

1. Production config validation (requires `DODO_WEBHOOK_SECRET`, `REDIS_URL`, non‑localhost `ALLOWED_ORIGINS`).
2. Redis pool init (ARQ + cache, no‑op if unconfigured).
3. `start_redis_relay()` for cross‑pod SSE.
4. Optional OpenTelemetry setup (try/except — `imports are inside the function` per `telemetry/setup.py`).
5. Best‑effort Supabase connectivity probe.
6. Shutdown drains pools.

### Middleware stack (verified)

The comment in `main.py` is explicit and the order is correct: **CORS → Logging → Metrics → Auth → RateLimit → handler** (innermost to outermost is the reverse registration order in Starlette).

- `LoggingMiddleware` adds `X-Request-Id` and a single structured log line.
- `MetricsMiddleware` is in‑process thread‑safe counters; integrates with the developer‑only `/api/metrics`.
- `AuthMiddleware` (`api/middleware/auth.py`) does Clerk JWT verification — RS256 (production, with JWKS cached 1h and refresh on unknown kid) or HS256 (test/dev only, *explicitly rejected in production*). It populates `request.state.{user_id, workspace_id, workspace_ids}` and rejects mismatched `X-Workspace-Id` headers with 403.
- `RateLimitMiddleware` is per‑user (not per‑IP), with stricter limits for `/api/documents` POST (10/60s) and `/api/chat` (60/60s) vs the 120/60s default. **Path normalization** collapses UUIDs to `{id}` to prevent Redis keyspace explosion. **Fails open** on Redis outage (intentional tradeoff).

### 35 routers (verified count)

Health, workspaces, members, documents, events, retrieval, chat, conversations, messages, claims, contradictions, developer, evaluations, benchmarks, regressions, experiments, prompts, optimization, quality_gates, release_notes, model_comparisons, benchmark_suggestions, billing, metrics, collections, api_keys, webhooks, audit_logs, integrations, automation, prompt_library, agents, workflows, review_queue, performance.

### Pipeline + workers

- **6 ARQ tasks** (`backend/tasks/`, registered in `backend/worker.py::WorkerSettings.functions`): `run_document_ingestion`, `run_document_embedding`, `run_document_indexing`, `run_eval`, `run_benchmark_job`, `run_agent_execution`.
- **`on_job_abort` DLQ**: writes to `dlq:aborted_jobs` Redis list, ltrim cap 1000, and best‑effort updates the document/agent_run to `failed`.
- **Pipelined I/O**: `_embed_pending_items` and `_upsert_batches` both use a "drain previous batch's persist before dispatching new" pattern to overlap DB writes with the next API call.

### Optimistic lease locking (real and important)

Every pipeline stage (`ingestion`, `embedding`, `indexing`) uses the same pattern: a `run_id` UUID is written to the document row inside a `claim_*_lease` function that uses a **conditional update** (`UPDATE … WHERE current_run_id = old_run_id`) so that two concurrent workers can't both think they own the job. The `verify_live_db_foundation.sql` script documents the contract, and `test_ingestion_pipeline.py` covers the case.

---

## 5. AI Architecture (verified)

### Hybrid retrieval (the actual implementation in `services/retrieval/service.py`)

1. `normalize_query` (regex: tokens, clause refs like "section 1.2(a)", quoted phrases).
2. `query_embedder.embed(query)` (OpenAI `text-embedding-3-small`, 1536d).
3. **Parallel**: `vector_provider.search` (Pinecone with `{"workspace_id": {"$eq": ws}, "document_id": {"$in": ids}}` filter, namespace `ws_{ws_id}`) + `score_sparse_candidates` (BM25 in `asyncio.to_thread`).
4. `fuse_rankings` — RRF with k=60.
5. Cross‑reference expansion (cap 2 per result, score = base × 0.35).
6. `CohereReranker.rerank` (ClientV2 SDK) with a TTL+LRU cache.
7. Re‑sort top‑k by rerank score (preserves cross‑ref tail).
8. Cache for 60s; record `retrieval_events` row.

The retrieval cache is in‑process (`OrderedDict` + `Lock`); the `get_reranker()` shim allows tests to inject a fake — this is the pattern that makes `test_retrieval_service.py` viable.

### Writer + streaming

`OpenAIWriterProvider.generate_streaming` streams JSON tokens; `_MarkdownStreamExtractor` is a hand‑written state machine (SEARCHING → IN_VALUE → DONE) that handles all JSON escapes. This is **the right way to do it** for `response_format={"type": "json_object"}` streaming, and it's tested in `test_answer_generation.py`.

### Two‑signal verifier (the headline feature)

The contract is enforced in **two places**, which is good defense in depth:

1. **DB level (initial schema 001 + 012)** — `CHECK (claims_supported_requires_entailment)`: if `supported = true` then `entailment_label = 'entail'`. Note: this constraint was *dropped* in migration 011 (which destructively recreated `claims`/`debate_turns`/`abstentions` to point at `answer_run_id` instead of `message_id`) and re‑applied in 012 on the new shape. So the invariant lives on the new `claims` table.
2. **App level** — `ensemble._combine`: `supported` iff `Critic.status == "supported" AND NLI.label == "entail"`. (`backend/services/verification/ensemble.py`)
3. **NLI is required to use a different model** than the critic/judge (`config.NLI_OPENAI_MODEL = "gpt-4o"`, `config.LLM_MODEL = "gpt-4o-mini"`) — this is the comment in `config.py` that justifies the design choice and would be the answer to the "how do you know the Critic isn't hallucinating?" interview question.

### Calibrated trust

```
raw = 0.45·frac_supported + 0.25·entailment_margin + 0.20·min_rerank + 0.10·agreement
confidence = IsotonicRegression.predict([[raw]])
abstain if confidence < 0.55
```

The calibrator is a sklearn `IsotonicRegression` pickle loaded at module import. `scripts/fit_calibrator.py` fits it from a 30‑case golden set (70/30 train/test) and reports **ECE** before/after. `scripts/generate_golden_cases.py` produces 30 hand‑labelled JSON cases across four trust tiers (high, medium‑high, medium‑low, low). The **ECE target of 0.10** is in the eval spec, and `test_calibration.py` covers the formula.

**Real gap:** I could not find a CI step that actually runs `fit_calibrator` and verifies the test set's ECE on every PR. The script exists; the gate doesn't.

### Abstention

`backend/agents/nodes/abstain.py::run_abstain_node` produces an `abstention` SSE event with `reason`, `missingEvidenceQuery`, `suggestedFollowUp`, and trust metadata. The live stream path in `answer_generation/service.py::generate_live_answer_stream` emits it after `compute_trust` if the calibrated confidence is below `settings.abstain_threshold`. `test_abstention.py` covers this.

### Evaluation platform (B3)

- **`eval.engine.run_eval_for_answer`** — skipped if `eval_auto_judge` is false or the run was abstained/failed. Calls the `OpenAIJudge` (8 dimensions: faithfulness, grounding, completeness, correctness, clarity, citation_quality, hallucination_risk, overall), persists to `answer_evals`, and fires `detect_regression`.
- **`eval.regression.detect_regression`** — sliding window of last 10 evals, flags if `current_judge_overall - window_avg < -10` or hallucination risk increases.
- **`eval.metrics.compute_quality_rollup`** — daily aggregation into `quality_rollups`.
- **`benchmark.run_benchmark`** — iterates cases sequentially, calls `build_answer_stream` (the batch path, not the live stream), records per‑case results.
- **`benchmark_growth.suggester.scan_for_suggestions`** — scans last 100 answer_runs for low‑trust/high‑hallucination cases and proposes them as benchmark cases (never auto‑promotes).
- **`quality_gates.runner.run_quality_gate`** — evaluates a benchmark run against active rules; the metric set is `{"judge_overall", "hallucination_risk", "trust", "latency_ms"}` and the operators are `{gte, lte, gt, lt}`.

**Gap:** `experiments._update_candidate_metrics` has a TODO comment ("A production implementation would tag each answer_run with the experiment_candidate_id") and currently **approximates by querying the last 50 evals in the workspace**. A/B test results are not rigorously isolated.

### Pipeline events (developer console)

The `event_bus` (in `services/events/bus.py`) is the right design: in‑process queue per workspace + Redis publish on `clarity:pipeline:{ws_id}` + cross‑pod relay that subscribes and forwards (skipping own worker_id by `pid@hostname` identity) + DB persistence. The dev dashboard's `useDocumentEvents` hook consumes it via the frontend's `lib/documentEvents.ts` SSE parser (3 message shapes: `history`, `connected`, `PipelineEvent`).

---

## 6. Database Design (verified)

### 17 numbered migrations + 1 backend migration

- **~50 unique tables**.
- **Hard workspace isolation**: every multi‑tenant table has `workspace_id uuid not null references workspaces(id) on delete cascade`.
- **Three exceptions** to tenant scoping (intentional, documented in `verify_live_db_foundation.sql`):
  - `reference_clauses` (the global clause library, no RLS) — used for clause benchmarking.
  - `eval_runs`, `eval_cases`, `eval_case_results` (CI/admin) — no RLS, no workspace_id.
  - `quality_rollups` (nullable workspace_id; NULL = global admin rollup).
- **Versioned embeddings/chunks**: every chunk/embedding/index row carries `parser_version`, `chunk_version`, `embedding_version` so a re‑index can be a parallel pipeline.
- **Idempotency**: `answer_runs` has a UNIQUE partial index `(workspace_id, request_id) WHERE request_id IS NOT NULL` so duplicate chat requests collapse.
- **SSE replay**: `answer_stream_events(answer_run_id, sequence_number)` is UNIQUE, which is what makes `resume_answer_stream` work.

### Index coverage (verified)

Good identity/uniqueness indexes, good `(workspace_id, created_at desc)` time‑series indexes, and good status indexes. **Three real performance gaps**:

- `chunks` has no `(document_id, chunk_index)` index even though it's hit on the retrieval hot path.
- `chunks` has no tsvector full‑text index — BM25 tokens are stored as `bm25_tokens text`, and the application is responsible for scoring (via `rank_bm25` in `services/retrieval/bm25.py`). This is fine for small corpora but doesn't scale.
- `documents` has no `(workspace_id, status)` index, even though every ingestion worker scan hits that combination.

### Two RLS patterns (a real inconsistency)

- **Pattern A** (JWT claims array, migrations 001–008, 013–016) — functional because PostgREST extracts the JWT and RLS can call `auth.jwt()`.
- **Pattern B** (`current_setting('app.workspace_id')::uuid`, migration 011+) — requires the application to call `SET LOCAL app.workspace_id = '…'` on every transaction. **I could not find any code that does this.** This means: either the Pattern B tables are inaccessible (unlikely, given the eval/optimization/quality_gates/prompts managers are tested and work), or they actually use the same JWT claim path and the migration file is misleading, or PostgREST/the Supabase client silently falls through. **This is a high‑priority investigation item** — see §21.

### Destructive changes / schema drift (verified, real)

- Migration **011 drops `claims`, `debate_turns`, `abstentions` and recreates them** pointing at `answer_run_id` instead of `message_id`. All data from migrations 001/008 is lost. The migration is wrapped in a single transaction, but the loss risk is real.
- Migration **009 vs 016** on `benchmark_*` tables: 009 has `numeric(5,2)`, 016 has `numeric(5,4)`; 009 has `text[]` for `document_ids`, 016 has `jsonb`; 009 doesn't `CASCADE` on `dataset_id`, 016 does; 009's `dataset_type` CHECK is `contract_qa/lease_qa/policy_qa/custom`, 016's is `qa/retrieval/classification/custom`. **016 will fail or alter silently depending on the order of execution.** This is in `CHANGELOG.md` "Known Limitations."
- **017 renames `workspaces.stripe_*` to `dodo_*`** but `subscriptions.stripe_*` (from migration 001) is left alone. Inconsistent.
- `audit_logs.resource_id` is `text` and cannot FK to anything.
- `pipeline_events.workspace_id` is `text` (not uuid) and has no FK — the API must validate separately.

---

## 7. Infrastructure (verified)

- **Docker Compose**: 3 services (`redis:7-alpine` with LRU eviction 256MB, `api` with 2 uvicorn workers on port 8000, `worker` with 2 replicas by default), health checks, named `redis_data` volume. (`docker-compose.yml`)
- **Kubernetes** (6 manifests in `k8s/`): namespace, configmap, redis (dev only), api-deployment, worker-deployment, ingress. `maxUnavailable: 0` and `preStop: sleep 5` for zero‑downtime worker deploys. `terminationGracePeriodSeconds: 3600` for workers (long jobs need to finish).
- **CI** (`.github/workflows/ci.yml`): Python 3.11 + Poetry 2.4.1 → `ruff check .` + `pytest --tb=short -q`. Node 20 + `npm ci` → `next lint --max-warnings 0` + `tsc --noEmit` + `npm test`. Caching is correct (`package-lock.json` for npm, `pyproject.toml` for Poetry).
- **Operational docs** — `DEPLOYMENT_GUIDE.md`, `OPERATIONS_RUNBOOK.md`, `INCIDENT_RESPONSE.md`, `BACKUP_AND_RESTORE.md`, `SECURITY.md`, `CONTRIBUTING.md` all exist and are detailed. P0/P1/P2/P3 severity levels are defined. DLQ inspection commands are provided.
- **Production fail‑fast** in `main.py::_validate_production_config` is the right pattern.

**Gaps:**
- **No Helm chart**, only raw k8s manifests — the deployment guide is manual.
- **No Terraform/IaC** for Supabase, R2, Clerk, Dodo, Pinecone, Upstash — those are configured by hand per environment.
- **No CDN configuration** in the Next.js app; the Vercel adapter is implied but not pinned.
- **No autoscaling policy** beyond `replicas: 2` in the manifest. The runbook says "scale with `kubectl scale`" but there's no HPA.

---

## 8. Authentication & Security (verified)

### Auth

- **Clerk JWT** with RS256 (production) / HS256 (test/dev only, *explicitly blocked in production*). JWKS keys cached 1h with refresh on unknown kid. `aud` and `iss` validated. (`backend/api/middleware/auth.py`)
- **`X-Workspace-Id` header** is required when the JWT's `workspace_ids` claim is empty; otherwise defaults to the first claim. Mismatched header → 403. (`auth.py: dispatch`)
- **Membership DB fallback** when `workspace_ids` claim is missing — robust to the Clerk custom session template not being configured.

### AuthZ

- **Role hierarchy** in `api/deps.py`: viewer(1) < editor(2) < owner(3), cached in Redis for 60s. `require_workspace_role` and `require_developer` are the two guards.
- **Last‑owner guard** in `members.py` blocks demoting or removing the last owner (tested in `test_members_api.py`).
- **`tenant_query(table, ws_id)`** is the universal pre‑filter for reads; the convention is enforced in most enterprise routers but **api_keys.py and webhooks.py use raw `get_client().table(...)` for inserts** (workspace_id is in the payload, but the invariant is not type‑system enforced).

### Security controls

- **Rate limiting** — per‑user (not per‑IP), sliding window in Redis, fail‑open on outage. Per‑route overrides (10/min upload, 60/min chat, 120/min default).
- **File uploads** — server‑side MIME check + extension allowlist (PDF, DOCX), 50MB cap, 1MB `SpooledTemporaryFile` chunks, `Path.resolve().is_relative_to()` path traversal guard.
- **API keys** — `clarity_sk_<32 url‑safe bytes>`, SHA‑256 hashed, plaintext shown once.
- **Webhook secrets** — `secrets.token_hex(32)`, SHA‑256 hashed, shown once.
- **Dodo webhook signature** — `dodo.webhooks.unwrap` in production, raw JSON in dev (gated by `DODO_WEBHOOK_SECRET`); production startup refuses to start if the secret is unset.
- **Pickle RCE fix** — `cache/client.py` is JSON‑only now. (CHANGELOG)
- **HS256 algorithm confusion blocked** in production. (CHANGELOG)
- **CORS** — `allow_credentials=True` with `allow_origins` from env, defaults to `localhost:3000,3001`; production fail‑fast refuses localhost.
- **Security headers** in `frontend/next.config.ts`: X‑Frame‑Options DENY, X‑Content‑Type‑Options nosniff, HSTS 2y preload, full CSP, Permissions‑Policy disables camera/mic/geo.

### Security gaps (verified)

- **`invalidate_role_cache` is never called** on role changes in `members.py` — a PATCH/DELETE leaves the cached role stale for up to 60s. (Real defect; `test_rls.py` does not exercise this.)
- **Webhook URLs are not validated** — no SSRF protection, no HTTPS requirement, no block on `169.254.169.254`/`localhost`/`127.0.0.1`. A viewer can register a webhook that exfiltrates data to an internal service.
- **API keys can be created by any role** (including viewer) — the route only checks workspace membership, not role.
- **Toggle endpoints are not symmetric** — `POST /api/enterprise/webhooks/{id}/toggle` and `PATCH /api/enterprise/automation-rules/{id}` flip state blindly with no request body; surprising and untested.
- **Audit logs return `ip_address` and `metadata` to any role including viewers** — possible PII/IP leak.
- **No PII redaction** in any error log; `exc_info` is logged on exceptions and the dev console could leak.
- **Frontend `middleware.ts` is thin** — `clerkMiddleware()` with no extra rules. The real protection is in `(auth)/layout.tsx`'s server component.
- **No CSP report‑uri** / report‑only mode.
- **No CORS preflight test** reaches protected routes.
- **Role cache invalidation** — covered above.

---

## 9. Data Flow

### Upload document (verified end‑to‑end)

1. **Client** (`frontend/src/app/(auth)/documents/page.tsx`): drag‑drop or file picker. Global window drag handlers (with a `dragCounter` ref to prevent flicker) show a full‑screen purple overlay. Files validated for size ≤50MB and MIME in `{pdf, docx}`. **Sequential** upload queue with "Uploading N of M" text.
2. **API** (`backend/api/routers/documents.py`): `POST /api/documents` checks editor role, validates the file, **double‑schedules** to both `BackgroundTasks` and ARQ — the **lease system** in `ingestion/pipeline.py` prevents double processing.
3. **Storage** (`backend/services/storage/r2.py`): `upload_document_file` writes to R2 in production, to `backend/.local_storage/` in dev. Returns `r2_key`.
4. **Worker** (`backend/tasks/ingestion.py`): ARQ picks up `run_document_ingestion(doc_id, ws_id)`.
5. **Ingestion** (`backend/services/ingestion/pipeline.py::run_document_ingestion`): 6 stages — fetch → extract → normalize → preprocess → chunk → persist. Each stage updates `documents.status` and emits a `PipelineEvent` via `event_bus`.
6. **Chunking** (`backend/services/ingestion/chunker.py`): builds `ChunkUnit`s (clause/heading/paragraph, with `definition_atomic` flag for definition sections), accumulates until `chunk_target_tokens` (400) or `chunk_max_tokens` (700) — long units are split at sentence boundaries with `chunk_overlap_tokens` (60) preserved. Tables are 1 row per chunk with header repeated. Fragments are tracked via `fragment_index`/`fragment_count`.
7. **Clauses** are extracted in parallel (`asyncio.gather`): `_classify_clause_type` (keyword match against 6 types) + `_classify_risk_flag` (3 categories: normal, non_standard, flagged) + `risk_score numeric(3,2)`.
8. **Embedding** is **chained in the same coroutine** for in‑process mode (and enqueued separately for ARQ mode). `embeddings/pipeline.py::run_document_embedding` acquires a lease, calls `_embed_pending_items` (pipelined batcher with exponential backoff, halves batch on retryable error, floors at single item × `max_retries`), then chains into indexing.
9. **Indexing** (`indexing/pipeline.py`): parallel load of current records + index rows, computes `rows_to_upsert` and `stale_vector_ids`, upserts in batches of 200, deletes stale. `vector_id` is a 40‑char SHA‑256 prefix `vec_<hex>` over the workspace/document/chunk/version tuple, so it's deterministic and idempotent.
10. **Events** flow continuously: `event_bus.publish` → in‑process queue → Redis `clarity:pipeline:{ws_id}` → cross‑pod relay → DB insert into `pipeline_events`. The frontend `lib/documentEvents.ts` SSE parser sees the events and `setQueryData(['documents', wsId], …)` patches the UI optimistically. On terminal status (`indexed`/`failed`), it invalidates `dev-dashboard`/`answer-metrics`/`embedding-metrics`/`live-metrics`.

### Chat (verified end‑to‑end)

1. **Client** (`/chat/page.tsx`): submit → `streamQuery` (fetch with `Accept: text/event-stream`, `getToken()` for `Authorization`, `X-Workspace-Id` for tenant).
2. **Server** (`backend/api/routers/chat.py::POST /api/chat`): wraps `generate_live_answer_stream` in `StreamingResponse(media_type="text/event-stream")`. **Idempotency check** via `request_id` (the `answer_runs` UNIQUE partial index) replays prior events.
3. **Answer generation** (`backend/services/answer_generation/service.py::generate_live_answer_stream`):
   - `_emit("meta")` immediately with conversation + answer + retrieval + assistant message IDs (so the client can start showing placeholders and can recover on disconnect).
   - Parallel: history load + `retrieve_evidence` (the only awaited call before generation).
   - `OpenAIWriterProvider.generate_streaming` returns JSON fragments; `_MarkdownStreamExtractor` extracts `answerMarkdown` incrementally.
   - Each fragment → `token` SSE event → `emitted_events` list.
   - **First token latency** is recorded; on parse error → `error` + `done` + return.
   - After stream ends, **verification runs in parallel** with persistence: `extract_claims` → `run_critic` (up to 2 iterations) → `run_ensemble_async` → `compute_trust` → `calibrator.calibrate`. Each emits its own SSE event (`claim`, `debate_turn`, `trust`, `abstention` if applicable).
   - `_persist_answer_to_db` runs in `asyncio.to_thread` — never blocks the event loop. Errors are logged but never fail the user‑facing stream.
   - Final `message` event (full `ChatMessage` envelope) → `done` event.
4. **Client** (`lib/chatStream.ts::applyStreamEvent`): pure reducer over `StreamingAnswerState` covering all 11 event types. The `MessageBody` component renders markdown (naive local parser), `TrustBadge` shows the trust pill, `DebatePanel` shows critic turns, `AbstentionCard` shows the amber "I can't verify this" card.
5. **Eval** is scheduled after the stream (`schedule_eval`) — runs in the background, not visible to the user.
6. **Auto‑resume**: if the fetch errors mid‑stream and `meta` was already received, the chat page calls `resumeAnswerStream` (REST polling) to pick up the missing events from `answer_stream_events`.

### Other flows (verified)

- **Search** — `POST /api/retrieval/search` (not the chat) → `retrieve_evidence` directly, no streaming, no answer generation. Used by the agent's `search_documents` tool.
- **Collections** — full CRUD with `collection_documents` join table. Delete cascades. Used for scoped document sets in agents and searches.
- **Agent run** — `POST /api/agents/{id}/runs` enqueues `run_agent_execution`, which calls `_execute_agent_run` in `api/routers/agents.py`. **The actual execution is largely simulated** — see §22.
- **Eval** — `POST /api/evaluations/quality/rollup?day=…` manually triggers a daily rollup.
- **Benchmark** — `POST /api/benchmarks/datasets/{id}/runs` returns 202 and enqueues `run_benchmark_job`, which iterates cases sequentially and records per‑case `benchmark_run_results` rows.
- **Billing** — Dodo checkout creates a session with `metadata.workspace_id`; webhook updates `workspaces.dodo_customer_id` + `dodo_subscription_id` and syncs plan.
- **Notifications** — derived from real backend data in `NotificationContext` (workspace provisioned, doc indexed/failed/uploaded). Per‑workspace read state in localStorage.

---

## 10. API Flow

### Auth chain (every request)

```
Client → CORS → LoggingMiddleware (X-Request-Id)
     → MetricsMiddleware (counters)
     → AuthMiddleware (verify JWT, populate request.state)
     → RateLimitMiddleware (per-user, fail-open)
     → handler (Depends(require_workspace_role))
```

### Critical contract

Every authenticated endpoint returns `(workspace_id, role)` from `Depends(require_workspace_role)`. Mutations additionally check `role` against the operation's minimum. Read‑only endpoints accept viewer. The single exception is `require_developer` which checks `settings.developer_user_ids` (env‑driven, no DB hit) and gates the 12‑page developer console + `/api/metrics`.

### Three SSE patterns

1. **Live chat** (`POST /api/chat`) — generator over `generate_live_answer_stream`; no built‑in heartbeat; client manages auto‑resume via `Last-Event-ID`‑equivalent (the `after` query param on the REST replay endpoint).
2. **Pipeline events** (`GET /api/events/documents`) — history replay (last 100) on connect, then live bus, then `: ping` heartbeat every 15s. Headers: `Cache-Control: no-cache`, `X-Accel-Buffering: no`. Auth via `X-Workspace-Id` header (not the role dep).
3. **Agent run polling** (`GET /api/agents/runs/{run_id}/stream`) — DB polling every 0.5s, max 20 iterations (10s timeout). Not actually streaming — a **fake stream** for UI affordance.

---

## 11. Complete Upload Pipeline (deep dive)

Already covered in §9. The pipeline is the strongest part of the system. Key files:
- `backend/api/routers/documents.py`
- `backend/services/ingestion/{pipeline,chunker,normalizer,preprocessor,tokenizer,extractors/pdf,extractors/docx}.py`
- `backend/services/embeddings/{pipeline,providers/openai_provider,factory,inspector,metrics}.py`
- `backend/services/indexing/{pipeline,providers/pinecone_provider,factory,inspector,metrics}.py`
- `backend/services/storage/r2.py`
- `backend/services/events/bus.py`
- `backend/tasks/{ingestion,embedding,indexing}.py`
- `backend/job_queue/client.py`

The **lease mechanism** is the most important pattern — without it, the double‑schedule (BackgroundTasks + ARQ) would cause double processing.

---

## 12. Complete Chat Pipeline (deep dive)

Already covered in §9. Key files:
- `backend/api/routers/chat.py`
- `backend/services/answer_generation/{service,models,provider,prompt_builder,claim_extractor}.py`
- `backend/services/verification/{critic,ensemble,nli,calibrator,confidence}.py`
- `backend/services/retrieval/{service,rrf,bm25,rerank,reranker,query_embedder,vector_provider,cache,normalize,metrics,models}.py`
- `frontend/src/lib/{api,chatStream,markdown}.ts`
- `frontend/src/app/(auth)/chat/page.tsx`

The two‑signal verification + calibrated trust + abstention is **the headline feature** and it is **actually implemented and tested** (`test_critic.py`, `test_nli.py`, `test_calibration.py`, `test_abstention.py`, `test_answer_generation.py`).

---

## 13. Developer Console Architecture

- **12 dedicated pages** under `/(auth)/developer/*` (`answers`, `benchmark-suggestions`, `dashboard`, `embeddings`, `experiments`, `model-comparisons`, `optimization`, `prompts`, `quality-gates`, `regressions`, `release-notes`, `retrieval`).
- **7 lazy tabs** under `/(auth)/eval` (Overview, Trends, Benchmarks, Leaderboard, Citations, Trust, Conversations).
- **Shared shell** in `src/components/developer/` and `src/components/eval/tabs/_shared.tsx` (KpiCard, SectionHeader, EvalEmptyState, LoadingGrid).
- **Data flow**: most pages call `useDeveloperConsole` (5 parallel queries with `useQueries`), some call dedicated hooks. **No real‑time updates** on the dev pages — they rely on `staleTime: 60_000` + `keepPreviousData` to avoid flashes.
- **Pipeline visualizer** (in `WorkspaceDashboard.tsx`) is an 8‑stage animated SVG with a shimmer line. Decorative but evocative.
- **`PerformanceOverlay`** (dev only, Alt+Shift+P) shows FPS, transition time, cache stats, heap, render count — useful for development, correctly gated.

**Critical assessment:** the developer console is **useful but not deep**. The Answer Explorer shows the last 20 runs and lets you drill into one — but the prompt payload is the same `prompt_payload jsonb` that the system writes, the stream events are the same `answer_stream_events` rows, and there's no diff view between runs. This is the gap between "looks like a developer console" and "is a developer console that helps you debug." For an "AI systems architect" the missing features are:
- **Cross‑run comparison** (compare two `answer_runs` side‑by‑side)
- **Prompt diff** (writer prompt v1 vs v1+1)
- **Retriever parameter sweep** (compare RRF k=30 vs 60 vs 120)
- **Token/cost breakdowns by model_version**

---

## 14. Enterprise Features

### What is real (verified)

- **Collections** — full CRUD + `collection_documents` join + scoped document sets. Tested in `test_collections_api.py`.
- **Members + RBAC** — viewer/editor/owner hierarchy + last‑owner guard + role cache. Tested in `test_members_api.py`.
- **API Keys** — generate / list / revoke. SHA‑256 hashed, plaintext shown once. Tested in `test_api_keys.py`.
- **Webhooks** — list / create / delete / deliveries. **No SSRF protection.** Tested in `test_webhooks.py`.
- **Audit Logs** — filterable by action/user/resource/severity. Tested in `test_audit_logs.py`.
- **Prompts** (versioned) — list / create / activate / retire. Tested in `test_prompts.py`. **But**: the production code uses hardcoded `SYSTEM_PROMPTS` dict in `prompt_builder.py`; the manager is a forward‑compatible interface.
- **Billing (Dodo)** — checkout, portal, webhook. Tested in `test_billing.py`.

### What is definition‑only / simulated (verified)

- **Agents** — CRUD is real; `run_agent_execution` calls `_execute_agent_run` in `api/routers/agents.py` which:
  - Looks up the agent.
  - Builds a static plan (no LLM planning loop).
  - Calls up to 5 tools via `_dispatch_tool` (some are real: `search_documents`, `hybrid_retrieval`, `collection_search`, `citation_lookup`; some are stubs: `document_summary`, `clause_extraction`, `run_evaluation`, `run_benchmark`, `generate_report`, `search_workspace`).
  - Optionally runs the two‑signal verifier; if `confidence < confidence_threshold`, marks the run as `review_required` and inserts into `review_queue`.
  - **This is deterministic placeholder behavior, not real agentic reasoning.** (CHANGELOG "Known Limitations" confirms: "Agent execution is simulated.")
- **Workflows** — definition only. Nodes (trigger/agent/condition/action/output) + edges stored as JSON. **No execution endpoint.** No `POST /api/workflows/{id}/run`.
- **Integrations** — 13 hardcoded providers in `integrations.py`, but only `disconnect` is wired. No `connect` endpoint (no OAuth flow).
- **Automation Rules** — CRUD with JSON conditions/actions, but **no trigger engine**.
- **Review Queue** — full flow works (list / approve / edit / reject / stats) **but only the agent runs feed it today**.
- **Quality Gates** — full rule definition + evaluation, but no CI integration beyond the manual `POST /api/quality-gates/run`.
- **Release Notes** — generator works (`generate_release_note`) but is manually triggered.

This is the central tension in the codebase: the **Enterprise Platform** is at "schema shipped, surface shipped, behavior mostly not" — and the marketing documents describe it as if it were complete.

---

## 15. Performance Architecture

### Implemented (verified)

- **Backend parallelism** — `asyncio.gather` for parallel DB writes, `asyncio.to_thread` for sync calls (PyMuPDF, BM25, NLI in some paths, Supabase reads), pipelined batch embedding/indexing.
- **Pipelined I/O** — `_embed_pending_items` and `_upsert_batches` overlap DB persist with the next API call (drain‑before‑dispatch).
- **Lease locking** — prevents duplicate work; reclaims stale leases after 120s.
- **Idempotency** — `request_id` on `answer_runs` (UNIQUE partial index) for chat replay; `chunk_id` for chunk re‑runs.
- **Cache layers**:
  - In‑process retrieval cache (OrderedDict + Lock, TTL 60s).
  - In‑process reranker cache (OrderedDict + Lock, TTL configurable, max 128).
  - Redis role cache (60s TTL, gracefully degrades).
  - Redis semantic cache (via `cache.client.cache_set`/`cache_get`).
- **Streaming** — the live answer stream emits `meta` immediately for instant UI affordance and runs verification in parallel with persistence.
- **Auto‑resume** — REST replay of `answer_stream_events` by sequence number.
- **Frontend virtualization** — `useVirtualizer` for `>30` documents.
- **Frontend bundle splitting** — `experimental.optimizePackageImports` on the three heavy libs; lazy `Suspense` tabs.
- **Frontend memoization** — `useMemo` on context values, `useCallback` on event handlers, `React.memo` on `NavItemRow`.
- **GPU‑only animations** — explicit `transform`+`opacity` only, no `backdrop-filter: blur()` (this is in the code).
- **Polling fallback** — when SSE is disconnected, `useDocuments` refetchInterval is 3s; when connected, 60s. Same for `useDocumentInspect` (5s while non‑terminal, then stops).

### Gaps (verified)

- **No CDN** — Vercel implied but not configured in this repo.
- **No query result caching at the API layer** beyond the 60s retrieval cache.
- **No compression** (gzip/brotli) configured in FastAPI middleware.
- **Cohere rerank is synchronous** in the call site (`await co.rerank(...)` in `CohereReranker.rerank`) — if Cohere is slow, retrieval blocks.
- **No connection pool tuning** for Supabase; relies on defaults.
- **No preload of frequently‑accessed metadata** (e.g., workspace + plan + member role).
- **Workers are not autoscaled** — `kubectl scale` is the documented mechanism.
- **No read replicas** — all Supabase reads hit the primary.

---

## 16. Deployment Architecture

- **Frontend** — Vercel (per `07_TECH_DECISIONS.md`); not pinned in `next.config.ts`.
- **Backend** — Kubernetes (raw manifests, not Helm).
- **Database** — Supabase managed Postgres.
- **Workers** — Kubernetes, same image as the API but `Dockerfile.worker` runs `python -m arq backend.worker.WorkerSettings` instead of uvicorn.
- **Cache/Queue** — Upstash Redis.
- **Storage** — Cloudflare R2 (with local FS fallback in dev).
- **Vector DB** — Pinecone (free tier in dev).

**Verdict:** the deployment story is **complete enough for a single‑region v1** but **not for a multi‑region enterprise SaaS**. No read replicas, no cross‑region replication, no disaster recovery documented beyond `BACKUP_AND_RESTORE.md` (which is short). The k8s manifests lack HPA, PDB, NetworkPolicy, and OPA policies.

---

## 17. Testing Strategy

### Backend tests (51 test files, ~11,200 lines)

The test suite is **well‑structured and security‑focused**:

- **Patterns** — `MagicMock` self‑referential chains for Supabase (`_chain(data)` factory), separate `get_client` patches for `api.deps` vs the router module, `tenant_query` patches, `asyncio.to_thread` for sync Supabase calls.
- **Conftest** — env defaults set *before* app import (critical because pydantic‑settings is strict), `_make_jwt` helper, `client` fixture with `ASGITransport`, a probe router at `/api/test/probe` for RLS/auth verification.
- **Coverage areas**:
  - Security: `test_auth_jwks.py`, `test_rls.py` (7 cases including cross‑workspace header rejection, static migration analysis), `test_members_api.py` (last‑owner guard, workspace mismatch), `test_rate_limit.py`.
  - Pipeline: `test_ingestion_pipeline.py`, `test_ingestion_sprint1.py`, `test_ingestion_extractors.py`, `test_chunker.py`, `test_embedding_pipeline.py`, `test_indexing_pipeline.py`.
  - AI: `test_critic.py`, `test_nli.py`, `test_calibration.py`, `test_abstention.py`, `test_judge.py`, `test_answer_generation.py`, `test_retrieval_service.py`.
  - Eval: `test_eval_engine.py`, `test_eval_api.py`, `test_benchmark.py`, `test_quality_gates.py`, `test_release_notes.py`, `test_optimization.py`, `test_experiments_api.py`, `test_benchmark_suggestions.py`, `test_prompts.py`, `test_observability.py`, `test_ai_latency.py`.
  - Enterprise: `test_collections_api.py`, `test_api_keys.py`, `test_webhooks.py`, `test_audit_logs.py`, `test_integrations.py`, `test_automation.py`, `test_prompt_library.py`, `test_workflows_api.py`, `test_agents_api.py`, `test_review_queue.py` (via the `test_agents_api.py` umbrella).
  - Operational: `test_health.py`, `test_billing.py`, `test_migrations.py`, `test_performance_profiler.py`.

### Gaps in test coverage (verified)

- **No frontend integration tests** (only 4 unit tests in `src/lib/`).
- **No E2E tests** (no Playwright/Cypress/Selenium).
- **No load tests in CI** — `locust/locustfile.py` exists but is not wired into any workflow.
- **No test of role cache invalidation** (the real defect).
- **No test of HS256 rejection in production**.
- **No test of the eval drift / regression CI gate** end‑to‑end.
- **No test of the SSE auto‑resume path** (the chat page's resilience story is untested).
- **No test of `global_table("reference_clauses")` success path** (only the failure path).
- **No test of the upload's double‑schedule + lease semantics** end‑to‑end.
- **The `test_rls.py` path** uses `parents[2] / "migrations" / "001_initial_schema.sql"` — from `backend/tests/`, that's the repo root, which has the file; but this is fragile.

---

## 18. Folder Structure

```
clarity-docs/
├── 00_README.md … 13_DEPENDENCY_GRAPH.md  (14 narrative docs, ~250KB)
├── README.md (70KB — the public‑facing README)
├── CHANGELOG.md, RELEASE_NOTES_v1.0.md, SECURITY.md, CONTRIBUTING.md
├── BACKUP_AND_RESTORE.md, DEPLOYMENT_GUIDE.md, OPERATIONS_RUNBOOK.md, INCIDENT_RESPONSE.md
├── docker-compose.yml
├── clarity_full_schema.sql (70KB consolidated)
├── migrations/         (17 numbered + rollback/ folder)
├── docs/frontend/      (frontend documentation)
├── backend/            (FastAPI + ARQ workers)
│   ├── main.py, worker.py, config.py, schemas.py, pyproject.toml
│   ├── api/            (routers/, middleware/, deps.py, errors.py)
│   ├── services/       (16 service packages)
│   ├── agents/         (LangGraph-style node stubs; not used in production)
│   ├── tasks/          (ARQ task wrappers, 6 files)
│   ├── job_queue/      (enqueue_or_background helper)
│   ├── cache/          (Redis JSON cache)
│   ├── telemetry/      (optional OTel)
│   ├── db/             (Supabase client + tenant_query helper)
│   ├── scripts/        (calibrator fitter, golden case generator, migration verifiers)
│   ├── migrations/     (1 file: pipeline_events)
│   └── tests/          (51 test files, ~11K lines)
├── frontend/           (Next.js 15 App Router)
│   ├── next.config.ts, tailwind.config.ts, tsconfig.json
│   ├── src/app/        (route groups: (auth)/, login/, signup/, api/, marketing)
│   ├── src/components/ (agents, auth, chat, collections, dashboard, developer, documents,
│   │                   ds, help, landing, layout, onboarding, perf, provenance, providers,
│   │                   settings, shell, upload, workspace — 18 subdirs)
│   ├── src/contexts/, src/hooks/, src/lib/, src/types/
│   └── src/middleware.ts (Clerk only)
├── k8s/                (6 raw manifests)
├── locust/             (load test, 4 user profiles)
├── .github/workflows/  (1 workflow: ci.yml)
└── .commandcode/, .claude/ (tooling)
```

The structure is **clean and conventional** — no surprises, no dead code folders, no generated cruft. The `agents/` package is the one slightly off note: it contains the documented node abstractions (`abstain`, `calibrate`, `critic`) but the production path is in `services/answer_generation/service.py` and `services/verification/`. The agents package is essentially a backward‑compat shim with backward‑compat aliases at the top of `service.py` (`run_critic_node = run_critic`, `run_calibrate_node = compute_trust`).

---

## 19. Strengths

1. **The two‑signal verifier is real and tested.** The Critic + NLI architecture with a deliberately different NLI model is the answer to the "how do you know the Critic isn't hallucinating" interview question, and it's implemented as advertised.
2. **Calibrated trust with isotonic regression + ECE measurement.** The 30 hand‑authored golden cases (`scripts/generate_golden_cases.py`) and the fitter (`scripts/fit_calibrator.py`) are the right artifacts. AIs that ship a calibrator without a measurement harness are just guessing; Clarity ships the harness.
3. **Honest abstention.** The system says "I can't verify this" instead of guessing. Persisted to `abstentions` table, surfaced in the chat UI, used in `benchmark_growth` to suggest new test cases. This is the right design for a legal/contractual domain.
4. **Lease‑locked async pipeline.** Every stage (ingestion, embedding, indexing) uses the same optimistic‑locking pattern, which is the correct way to do distributed state machines. Tested.
5. **Cross‑pod SSE relay via Redis pub/sub.** The `event_bus` is the right design for a multi‑replica worker deployment. The `pid@hostname` worker identity prevents loops.
6. **Production fail‑fast config validation** in `main.py` — refuses to start with missing critical config.
7. **RS256‑only in production** with JWKS rotation — the right auth story for an enterprise SaaS.
8. **App‑layer tenant guard (`tenant_query`) on top of RLS** — defense in depth.
9. **Idempotency** via `request_id` UNIQUE partial index on `answer_runs`.
10. **Structured access logs with `X-Request-Id` correlation**.
11. **Dodo Payments integration** (post‑Stripe) with proper webhook signature verification in production.
12. **Idempotent migrations** with `IF NOT EXISTS` / `DROP POLICY IF EXISTS` and required rollback files.
13. **A clean, dark‑mode‑first design system** with a primitive library in `ds/`, GPU‑only animations, and a small number of well‑defined motion variants.
14. **Thin‑page frontend** — logic in components, pages just route.
15. **Honest CHANGELOG** — Known Limitations are documented (simulated agent execution, unbounded queries, etc.).
16. **Real operational docs** — runbook, incident response, backup/restore, deployment guide.
17. **The streaming answer pipeline is production‑grade** — `meta` event for instant UI, idempotency check, in‑thread verification, persistence off the event loop, auto‑resume via REST replay.

---

## 20. Weaknesses

1. **Documentation is significantly ahead of implementation in the Enterprise Platform.** The README pitches LangGraph debate panels, PDF bounding‑box provenance viewers, and seven‑tab evaluation dashboards; the actual `agents/` package is a near‑empty LangGraph stub and the bounding‑box viewer schema (`BoundingBox` in `schemas.py`) is defined but not rendered in the UI.
2. **Two RLS patterns coexist and one of them may not be functional.** Pattern B (`current_setting('app.workspace_id')`) in migration 011+ requires per‑request `SET LOCAL` that the codebase does not appear to call. This is a **high‑priority investigation** — either the tables are inaccessible in production, or the path silently works for a different reason.
3. **Agent execution is simulated** (CHANGELOG "Known Limitations"). The tool registry lists 10 tools; only 4 are wired to real implementations.
4. **Workflows have no execution endpoint.** Definition‑only.
5. **Integrations have no connect endpoint.** Listing + disconnect only.
6. **Automation Rules have no trigger engine.** Stored but never executed.
7. **`invalidate_role_cache` is dead code.** Role changes leave the cache stale for up to 60s.
8. **Webhook URLs are not validated.** No SSRF protection. Viewer can register a webhook to `169.254.169.254`.
9. **API keys can be created by any role** (including viewer).
10. **No frontend integration or E2E tests.** Only 4 unit test files (403 lines).
11. **No load tests in CI** — the `locust/locustfile.py` exists but is unused.
12. **Eval drift / regression CI gate is not wired.** The eval infrastructure is real; the CI step that runs it on every PR is not.
13. **Cohere rerank is synchronous** in the call site — if Cohere is slow, retrieval blocks.
14. **The prompts manager is forward‑compatible only** — production code uses hardcoded `SYSTEM_PROMPTS` dict.
15. **Destructive schema changes in 011** drop and recreate `claims`/`debate_turns`/`abstentions`. Migration 009 vs 016 has column type drift.
16. **Some unbounded queries** (`list_conversations`, `get_answer_explorer`, `citation_analytics`, `benchmark_get_dataset` — per CHANGELOG).
17. **`audit_logs.resource_id` is `text`** with no FK; `metadata` and `ip_address` returned to all roles including viewer.
18. **Performance profile endpoint** (`/api/performance/pipeline-profile/{id}`) falls back to an *estimated* model when `pipeline_events` rows are missing — this is documented but could mislead.
19. **HS256 dev mode + no `DODO_WEBHOOK_SECRET` in dev** = a production‑misconfigured instance could be exploited; the fail‑fast guards help but are env‑gated.
20. **The NLI call uses `gpt-4o` while the critic uses `gpt-4o-mini`** — this is the right independence, but it also means NLI is the *more expensive* signal. The "must be cheap" comment in the spec is partially violated.

---

## 21. Technical Debt

Categorized by priority:

### P0 (block production)

- **RLS Pattern B unverified** (`migrations/011+`). Either fix the migration files to use Pattern A consistently or add the `SET LOCAL app.workspace_id = …` plumbing in `db/client.py` and a test that exercises it.
- **`invalidate_role_cache` not called on PATCH/DELETE in `members.py`** — real authz defect. Fix: call `invalidate_role_cache(workspace_id, target_user_id)` in `PATCH /members/{id}` and `DELETE /members/{id}`.
- **Webhook SSRF** — no URL validation in `webhooks.py`. Add an SSRF guard (block private IP ranges, link‑local, loopback, require HTTPS in production).
- **API key creation is role‑permissive** — should require editor or owner. Fix: gate `POST /api/enterprise/api-keys` behind `require_workspace_role(minimum_role="editor")`.
- **`workspace_integrations.disconnect` and `api_keys.revoke`** — same: should be editor/owner.

### P1 (high priority, fix this quarter)

- **Agent execution is simulated** — either implement the LangGraph graph properly (the spec is solid) or remove the agent UI from production routes.
- **Workflows have no execution engine** — same: implement or remove.
- **Integrations have no connect endpoint** — at minimum stub the OAuth callback.
- **Eval CI gate** — wire `run_benchmark` into `.github/workflows/ci.yml` with a frozen golden+adversarial set; fail the build on regression. The infrastructure is there; the gate isn't.
- **Calibrator CI gate** — same: run `fit_calibrator` on the golden set in CI, fail if ECE > 0.10.
- **Role cache invalidation test** — add a test that PATCH/DELETE on a member invalidates the cache.
- **Schema drift between migrations 009 and 016** — collapse to a single canonical definition.
- **Destructive change in 011** — write a one‑shot data migration from the old `claims`/`debate_turns`/`abstentions` shape to the new one.
- **Audit log PII/IP exposure** — redact `ip_address` and limit `metadata` to editor+.
- **Frontend smoke test** — add a Playwright suite covering: signup, upload, watch indexing, ask question, see claim, approve review item.
- **Pagination on unbounded endpoints** — `list_conversations`, `get_answer_explorer`, `citation_analytics`, `benchmark_get_dataset`.

### P2 (medium, fix when convenient)

- **Webhook toggle endpoint flips blindly** — accept an explicit `enabled` boolean.
- **Prompts manager is forward‑compatible only** — wire `get_active_prompt` into `services/answer_generation/prompt_builder.py`.
- **Cohere rerank sync** — make it async (or use the cached `CohereReranker` consistently).
- **Compression middleware** in FastAPI for large response bodies (eval dashboards).
- **Connection pool tuning** for Supabase client.
- **HS256 production‑block test** — `test_auth_jwks.py` should assert that an HS256 token is rejected when `ENVIRONMENT=production`.
- **Pipeline event retention** — `backend/migrations/001_pipeline_events.sql` has a commented‑out pg_cron for 30‑day cleanup; implement it.
- **Worker health check** — Dockerfile.worker has one; verify it actually catches dead workers.
- **Production fail‑fast also validates** `PINECONE_API_KEY` is set (currently checked lazily).

### P3 (low, nice to have)

- **Helm chart** for k8s deployment.
- **HPA + PDB** in k8s manifests.
- **Multi‑region / read replicas** — out of scope for v1 but document the gap.
- **More thorough docstrings** on the agents package (currently nearly empty) — or remove it.
- **NLI model** — switch from `gpt-4o` to a cheaper option to honor the "must be cheap" spec.
- **OpenAPI spec generation** — FastAPI can produce one; expose under `/openapi.json` in dev (already there) and add a CI check for breaking changes.

---

## 22. Bottlenecks

- **Cohere rerank** is synchronous; if it stalls, the entire chat pipeline stalls. The cache helps but the cold path is at the mercy of Cohere's p99.
- **NLI uses `gpt-4o`** — the most expensive signal. If a chat response has 5 claims, that's 5 NLI calls + 1 critic call + 1 writer stream. Cost: ~$0.015 per response. At 10k chats/day = $150/day = $4500/month. The semantic cache mitigates some, but not the cold path.
- **`conversations/{id}` endpoint** is a heavy aggregation (messages + answer_runs + citations + claims + debate_turns + abstentions + retrieved_evidence). On long conversations this will be slow and should be paginated.
- **Document upload** chains ingestion → embedding → indexing **in the same coroutine** (in the in‑process path). For a 100‑chunk document: 1 PDF parse + ~5 embedding batches of 96 + ~1 indexing batch of 200. Total: ~30s minimum. ARQ path enqueues separately which is better.
- **`answer_stream_events`** grows unbounded per `answer_run`. The replay endpoint reads by `after_sequence` with no upper bound — a 10,000‑token answer has 10,000+ token events.
- **`documents.list`** schedules background recovery of stuck docs and refreshes; this is a fanout cost on every list call. Should be debounced or moved to a single refresh job.
- **Audit log writes** are per‑mutation but not async‑batched; for an `agents` workspace with many runs, the audit log can become a hot write path.

---

## 23. Missing Enterprise Features

- **SSO / SCIM / SAML** — the README implies enterprise but the auth story is Clerk‑only with email + OAuth (no SAML, no SCIM provisioning, no JIT user creation from IdP).
- **Audit log export** — no way to ship audit logs to a SIEM (Splunk, Datadog).
- **DLP / redaction of PII in retrieved chunks** — no way to mark a document or workspace as "PII mode" that masks names in retrieved evidence before they reach the writer prompt.
- **Customer‑managed encryption keys (CMEK)** — no BYOK for R2 / Supabase.
- **IP allowlist / VPN enforcement** — no workspace‑level network policy.
- **Workspace data residency** — Supabase is single‑region; no EU/US isolation.
- **Tenant‑level data export** — no `GET /api/admin/export` that returns a workspace's documents + chunks + embeddings in a portable format.
- **Tenant‑level data deletion** — `ON DELETE CASCADE` handles it, but there's no `DELETE /api/workspaces/{id}` endpoint or scheduled hard‑delete job.
- **Tenant‑level metrics** — Prometheus exporter is in‑process only; no per‑workspace metrics for billing back.
- **Quota enforcement** — `usage_events` is written but never read for quota. A "soft limit" exists in the billing plan, but there's no `enforce_plan_quota()`.
- **Org chart** — no hierarchy of workspaces (parent/child, departments).
- **Real LangGraph agent** — see §14, §21.
- **Real workflow execution** — see §14, §21.
- **Real integrations** — see §14, §21.
- **PDF bounding‑box provenance viewer** — the schema is in `schemas.py::BoundingBox`; the UI is not.
- **Reasoning graph UI** — the data is emitted (the `graph_node` event type is in the spec) but not the source code; the production pipeline does not emit it.
- **LangSmith / Langfuse integration** — the dependency is installed, the setup is in `telemetry/setup.py`, but I see no evidence of traces being sent.
- **Self‑serve billing upgrade** — Dodo checkout works, but there's no "your plan is X, you have Y docs, you have Z queries" guidance in the upgrade flow.

---

## 24. Production Readiness Review

| Area | Status | Notes |
|---|---|---|
| **Auth** | 🟢 Production‑grade | RS256, JWKS rotation, HS256 blocked in prod, fail‑fast config. |
| **AuthZ / RBAC** | 🟡 Mostly | Role hierarchy + last‑owner guard, but cache invalidation broken, some endpoints over‑permissive. |
| **Workspace isolation** | 🟡 Mostly | App‑layer guard works; RLS is belt‑and‑suspenders but Pattern B unverified. |
| **Pipeline integrity** | 🟢 Production‑grade | Lease locking, idempotency, pipelined I/O, DLQ. |
| **Streaming** | 🟢 Production‑grade | Two implementations, both fetch‑based, with auto‑resume. |
| **Verification** | 🟢 Production‑grade | Two‑signal ensemble, calibrated, with abstention. |
| **Eval platform** | 🟡 Partial | Code is there, golden set is there, **CI gate is not**. |
| **Observability** | 🟡 Partial | In‑process metrics + Prometheus exporter + structured logs, but no real trace integration verified. |
| **Frontend** | 🟡 Mostly | Beautiful and fast, but thin on the dev/eval dashboards and missing the bounding‑box viewer. |
| **Billing** | 🟢 Production‑grade | Dodo + signature + tenant metadata + fail‑fast. |
| **Enterprise features** | 🔴 Mostly stub | Definitions without behavior (agents, workflows, integrations, automations). |
| **Security headers** | 🟢 Production‑grade | CSP/HSTS/XFO via Next config; CORS fail‑fast. |
| **Rate limiting** | 🟡 Mostly | Per‑user, fail‑open, but no per‑workspace, no per‑cost. |
| **File upload safety** | 🟢 Production‑grade | MIME check, size cap, path traversal guard. |
| **Multi‑region** | 🔴 Missing | Single‑region only. |
| **DR** | 🟡 Partial | Backup/restore doc exists; not tested. |
| **CI/CD** | 🟡 Partial | Lint + unit tests run; load tests, eval tests, and gates don't. |
| **Documentation** | 🟢 Strong | Runbook, incident response, deployment guide, security policy, contributing. |

**Overall production readiness: 65%.** The differentiators and the streaming/verification pipeline are production‑grade; the Enterprise surface and the gating around it are not.

---

## 25. Ratings (0–10)

| Dimension | Score | Justification |
|---|---|---|
| **Frontend** | 7.5 | Beautiful, fast, well‑structured. Lacks depth on dev/eval dashboards and a real bounding‑box viewer. |
| **Backend** | 8.0 | Clean FastAPI, lease‑locked pipeline, real SSE, two‑signal verifier. Some defensive gaps (role cache, SSRF, over‑permissive routes). |
| **AI Pipeline** | 8.5 | The headline feature is implemented and tested. NLI is the right model independence. Calibrator + golden cases + ECE measurement are senior. |
| **RAG** | 8.0 | Hybrid (BM25 + dense + RRF + Cohere rerank) is the right architecture. Cross‑ref expansion, stage timings, retrieval explorer. |
| **Architecture** | 7.5 | Three‑layer tenancy is correct. Pipelined I/O, lease locking, two‑scaler workers. Some inconsistency (two RLS patterns, destructive migration). |
| **Performance** | 7.0 | Caching, virtualization, lazy loading, GPU‑only animations. Cohere sync, NLI on gpt‑4o, no CDN, no compression. |
| **Security** | 7.0 | RS256 + JWKS + RLS + rate limit + DLQ + path traversal + CSP. Gaps: role cache invalidation, SSRF, audit log PII. |
| **Developer Experience** | 7.5 | Premium feel, dark theme, motion discipline, fetch‑based SSE with auto‑resume. Magic mock chains in tests are clean. |
| **Scalability** | 6.5 | Horizontally scalable workers, multi‑pod SSE, R2 + Pinecone. No multi‑region, no HPA, no read replicas, no autoscaling. |
| **Maintainability** | 7.0 | Clear folder structure, no dead code, type‑checked, lint‑clean. Schemas drift between migrations; some backward‑compat shims add noise. |
| **Testing** | 7.0 | Strong security/pipeline/AI coverage (51 files, 11K lines). Weak on E2E, frontend integration, and CI integration. |
| **Infrastructure** | 6.5 | Docker Compose + k8s + OTel + Sentry. No Helm, no IaC, no HPA, no NetworkPolicy. |
| **Observability** | 6.5 | In‑process metrics, structured logs, optional OTel, in‑UI dev console. No trace integration verified, no SLI/SLO targets, no alerting. |
| **Enterprise Readiness** | 5.0 | Definitions exist; behavior is mostly missing. No SSO/SCIM, no CMEK, no DLP, no data export, no quota enforcement. |
| **Overall Product** | 7.0 | A real, working, well‑engineered v1 of a contract Q&A SaaS. Strong on the differentiators it claims; weak on the Enterprise surface that surrounds them. |

---

## 26. Competitor Comparison

| Capability | Clarity | Glean | Harvey | Hebbia | Cursor | OpenAI Platform | NotebookLM | Perplexity Enterprise |
|---|---|---|---|---|---|---|---|---|
| **Multi‑tenant RAG** | ✅ | ✅ | ✅ | ✅ | ❌ (single user) | ✅ (Projects) | ❌ | ✅ |
| **Hybrid retrieval (BM25 + dense + RRF)** | ✅ | ✅ | ✅ | ✅ | ❌ (code only) | ❌ | ❌ | ✅ |
| **Cohere rerank** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Two‑signal verification** | ✅ | ❌ | Partial (citations) | Partial | ❌ | ❌ | ❌ | Partial (citations) |
| **Calibrated trust score** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Abstention as first‑class** | ✅ | ❌ | Partial | Partial | ❌ | ❌ | ❌ | Partial |
| **Eval‑as‑CI** | ✅ (code, no gate) | ❌ | ❌ | ❌ | ❌ | Partial (evals) | ❌ | ❌ |
| **Bounding‑box provenance** | 🔴 schema only | ✅ | ✅ | ✅ | ✅ (code) | ❌ | ✅ | ✅ |
| **Persistent contradiction graph** | ✅ | ❌ | ❌ | Partial | ❌ | ❌ | ❌ | ❌ |
| **Agent system (real)** | 🔴 simulated | ✅ (Glean Apps) | ✅ (workflows) | ✅ (agents) | ✅ (Composer) | ✅ (Assistants) | ❌ | ❌ |
| **SSO / SCIM** | 🔴 | ✅ | ✅ | ✅ | ✅ (org) | ✅ | ❌ | ✅ |
| **CMEK** | 🔴 | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Audit log export** | 🔴 | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Live document pipeline UI** | ✅ | ✅ | Partial | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Developer console** | ✅ (12 pages) | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | Partial |
| **Self‑serve billing** | ✅ (Dodo) | ✅ | 🔶 (sales‑led) | 🔶 | ✅ (Teams) | ✅ | ❌ | ✅ |
| **Slack/Teams integration** | 🔴 stub | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Pricing transparency** | ✅ (4 plans) | 🔶 | ❌ (contact) | ❌ | ✅ | ✅ | ❌ | ✅ |

**Where Clarity differentiates:** calibrated trust, two‑signal verification, eval‑as‑CI, persistent contradiction graph. These are the "senior AI engineer" signals the docs pitch — and they are real.

**Where Clarity falls behind:** enterprise compliance (SSO/SCIM/CMEK/audit export), real agent system, real workflow execution, real integrations, bounding‑box provenance, multi‑region.

---

## 27. Technical Maturity (%)

Estimated by area, then weighted:

| Area | Weight | Score | Weighted |
|---|---|---|---|
| Core RAG | 20% | 85% | 17.0 |
| Verification / trust | 15% | 80% | 12.0 |
| Streaming / UX | 10% | 85% | 8.5 |
| Ingestion pipeline | 10% | 85% | 8.5 |
| Frontend | 10% | 70% | 7.0 |
| Auth / AuthZ | 8% | 75% | 6.0 |
| Multi‑tenancy | 5% | 70% | 3.5 |
| Observability | 5% | 60% | 3.0 |
| CI / CD | 5% | 60% | 3.0 |
| Enterprise surface | 7% | 35% | 2.45 |
| Security (defense in depth) | 5% | 70% | 3.5 |
| **Total** | **100%** | | **~74.5%** |

**Verdict: ~70–75% production‑mature.** The "differentiator core" is 80–85% mature. The "Enterprise SaaS wrapper" is 35–50% mature. To reach 90%+: fix the P0/P1 items in §21, wire the CI gates, implement the agent + workflow + integration execution layers, add SSO/SCIM/CMEK, and ship the bounding‑box viewer.

---

## 28. Roadmap

### Phase 1 — Harden what exists (4–6 weeks)

1. **Fix the P0 defects in §21.**
   - RLS Pattern B unverified → resolve to a single pattern.
   - `invalidate_role_cache` on member changes.
   - Webhook SSRF guard.
   - API key creation role gate.
2. **Wire the CI gates** — eval (frozen golden + adversarial) + calibrator ECE on every PR.
3. **Pagination on unbounded endpoints.**
4. **HS256 production‑block test.**
5. **Audit log PII redaction.**

### Phase 2 — Make the agent system real (6–8 weeks)

1. **Implement the LangGraph debate graph** as documented in `05_AGENT_LOGIC.md` — `StateGraph` with Supervisor → Retriever → Writer → Critic → NLI → Calibrate → Abstain nodes, with the loop control (max 2 critic iterations).
2. **Wire agent tool registry** — actually implement the 6 stub tools (`document_summary`, `clause_extraction`, `run_evaluation`, `run_benchmark`, `generate_report`, `search_workspace`).
3. **Wire the prompts manager** — `get_active_prompt` in `prompt_builder.py` instead of hardcoded `SYSTEM_PROMPTS`.
4. **Replace the agent's "fake stream" with a real SSE** that follows the chat pattern.
5. **Add a Planner node** so agents don't have static plans.

### Phase 3 — Execute the workflow + integration layers (6–8 weeks)

1. **Workflow execution engine** — implement the trigger/agent/condition/action/output nodes. Celery, ARQ, or in‑process — pick one.
2. **Real integrations** — at minimum: Google Drive, OneDrive, Slack, Notion. OAuth flows, webhook ingest for changes, sync into the ingestion pipeline.
3. **Automation Rules trigger engine** — schedule‑based, event‑based, or both.
4. **Bounding‑box provenance viewer** — render the BoundingBox schema in the chat UI; click a claim → see the highlight on the PDF (PDF.js in the browser).

### Phase 4 — Enterprise readiness (8–12 weeks)

1. **SSO / SCIM** — Clerk supports SAML and SCIM natively; wire it.
2. **CMEK** — Cloudflare R2 supports customer keys; Supabase does not natively (would need a Vault pattern). For v1, R2‑only is acceptable.
3. **Audit log export** — to S3 / Datadog / Splunk.
4. **DLP / PII masking** — workspace‑level flag that masks names in retrieved evidence before the writer prompt.
5. **Quota enforcement** — `enforce_plan_quota()` on `usage_events` aggregation.
6. **Data export + workspace deletion** — `GET /api/admin/export`, `DELETE /api/workspaces/{id}` with a 30‑day soft‑delete grace.
7. **Multi‑region** — start with EU + US, document the failover story.

### Phase 5 — Operate and scale (continuous)

1. **Helm chart** + **HPA** + **PDB** + **NetworkPolicy** + **OPA**.
2. **Terraform** for Supabase, R2, Clerk, Dodo, Pinecone, Upstash.
3. **Trace integration** — wire LangSmith (the dep is installed) or Langfuse for end‑to‑end traces.
4. **SLI / SLO targets** in the runbook (TTFT, retrieval latency, two‑signal agreement rate, calibration ECE, abstention rate, catch rate).
5. **Synthetic monitoring** — a black‑box probe that uploads → asks → verifies every 5 minutes.
6. **Disaster recovery drills** — quarterly R2 restore from backup, quarterly Supabase PITR restore.
7. **Adversarial golden set growth** — keep the 40 planted‑false‑claims set fresh; track catch rate over time.

---

## Appendix A — Cited files

- `README.md` (the public readme, 70KB)
- `00_README.md` … `13_DEPENDENCY_GRAPH.md` (14 narrative docs)
- `CHANGELOG.md`, `RELEASE_NOTES_v1.0.md`, `SECURITY.md`, `CONTRIBUTING.md`, `DEPLOYMENT_GUIDE.md`, `OPERATIONS_RUNBOOK.md`, `INCIDENT_RESPONSE.md`, `BACKUP_AND_RESTORE.md`
- `migrations/001_initial_schema.sql` through `migrations/017_dodo_billing.sql` + `migrations/rollback/*`
- `clarity_full_schema.sql` (consolidated)
- `backend/main.py`, `worker.py`, `config.py`, `schemas.py`, `pyproject.toml`
- `backend/api/{deps.py, errors.py, middleware/{auth,logging,metrics,rate_limit}.py, routers/*.py}`
- `backend/services/{answer_generation, retrieval, embeddings, indexing, ingestion, verification, storage, events, eval, optimization, performance, quality_gates, benchmark_growth, release_notes, prompts}/*`
- `backend/agents/{state.py, nodes/{abstain,calibrate,critic}.py, prompts/critic.py}`
- `backend/tasks/{ingestion,embedding,indexing,eval,benchmark,agent}.py`
- `backend/job_queue/client.py`, `backend/cache/client.py`, `backend/telemetry/setup.py`, `backend/db/client.py`
- `backend/scripts/{fit_calibrator.py, generate_golden_cases.py, verify_migration_contract.py, verify_live_db_foundation.sql}`
- `backend/tests/*` (51 test files, conftest.py, `__init__.py`)
- `frontend/package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `postcss.config.js`
- `frontend/src/{app, components, contexts, hooks, lib, types, middleware.ts}/*`
- `frontend/src/lib/{api.ts, chatStream.ts, documentEvents.ts, markdown.ts, format.ts, motion.ts, *}.test.*`
- `k8s/*.yaml` (6 manifests)
- `docker-compose.yml`
- `locust/locustfile.py`
- `.github/workflows/ci.yml`

## Appendix B — What I did NOT verify

- **Production RLS Pattern B behavior** — would need a live Supabase instance.
- **Dodo Payments in production** — the code paths are tested; live integration is not.
- **Clerk JWKS rotation under load** — the cache is in‑process; multi‑replica behavior is undocumented.
- **Pinecone free‑tier limits** — at 100k chunks, the namespace pattern + R2 + Supabase + Cohere all cost something; no real measurement of "free tier" viability at scale.
- **ARQ under sustained load** — the DLQ exists but the actual failure modes of long jobs (>1h) are not tested.
- **Frontend runtime performance on low‑end devices** — the design assumes a recent browser and a fast CPU; the `useVirtualizer` and lazy loading help, but the 288px sidebar + command palette + PremiumBackground parallax are heavy on a phone.
