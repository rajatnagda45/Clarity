# Clarity — Self-Auditing Contract Intelligence

> **An AI contract auditor that measures, tracks, and continuously improves answer quality — with a two-signal verifier, calibrated trust, a full enterprise platform, and a distributed async worker pipeline.**

[![CI](https://github.com/rajatnagda45/Clarity/actions/workflows/ci.yml/badge.svg)](https://github.com/rajatnagda45/Clarity/actions/workflows/ci.yml)
![Phase](https://img.shields.io/badge/phase-Enterprise%20Platform%20%2B%20Production%20Sprint%20complete-blue)
![Tests](https://img.shields.io/badge/tests-368%20backend%20%7C%206%20frontend-brightgreen)
![Stack](https://img.shields.io/badge/stack-Next.js%2015%20%2B%20FastAPI%20%2B%20Supabase%20%2B%20ARQ%2FRedis-informational)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Current Status

**Phases A through RC2, Enterprise Platform, and all four Performance Sprints are complete.** The repository is in production-grade shape: 35 FastAPI routers, 17 migrations, 368 backend tests across 54 files, ARQ/Redis distributed workers, Kubernetes manifests, optional OpenTelemetry tracing, Prometheus metrics, and a Next.js 15 frontend that loads and navigates at native-desktop speed.

### What was built across all phases

#### Phase A — Core RAG Platform (A1–A8.1)
- Clerk-backed authentication with workspace isolation (three-layer: JWT + Pinecone namespace + Postgres RLS)
- `GET /api/me`, `POST /api/workspaces`, multi-workspace role system (owner/editor/viewer)
- Secure Cloudflare R2 object storage with signed URLs for PDF/DOCX uploads
- Full ingestion pipeline: PyMuPDF extraction → text normalization → clause-aware preprocessing
- Clause-aware chunking with `tiktoken`, definition-section preservation, cross-reference extraction, deterministic chunk IDs
- Provider-agnostic embedding pipeline (OpenAI `text-embedding-3-small`, versioned, batch-retry, cache-by-hash)
- Pinecone vector indexing with workspace namespace isolation (`ws_{workspace_id}`), stale-vector cleanup, version-aware reruns
- Hybrid retrieval engine: dense (Pinecone) + BM25 (rank-bm25) + RRF fusion + Cohere rerank + cross-reference expansion + semantic cache (Upstash)
- Streaming SSE answer generation from retrieval evidence only; versioned prompt builder
- Conversation persistence with replay-safe `request_id` idempotency; `Last-Event-ID` reconnect support
- Structured citation mapping — every answer cites exact chunk evidence
- Upstash Redis sliding-window rate limiting per user ID
- LangSmith tracing wired; Sentry error tracking

#### Phase B — Evaluation, Quality Improvement + RC2 (B1–B4 + RC2)

**B3 — Continuous Evaluation & Self-Improvement Platform**
- LLM-as-judge eval engine (7 dimensions: faithfulness, grounding, completeness, correctness, clarity, citation quality, hallucination risk) on a 0–100 scale
- Benchmark datasets, benchmark cases, benchmark runs — full lifecycle
- Regression detection: 10-eval sliding window, automatic `regression_reports` on score drops
- Auto-judge fires asynchronously after every chat answer (background task)
- REST APIs: `GET/POST /api/evaluations`, `GET/POST /api/benchmarks`, `GET /api/regressions`

**B4 — Autonomous Quality Improvement Platform**
- **Experiment Platform** — structured A/B experiments for prompt versions and model versions; outcome tracking
- **Prompt Version Manager** — create, activate, retire prompt versions for writer/critic/judge keys; activation deactivates siblings atomically
- **Optimization Engine** — LLM analysis of recent eval averages → severity-ranked recommendations (high/medium/low); developer must accept/dismiss; never auto-applies
- **Quality Gates** — configurable threshold rules (judge_overall, trust, hallucination_risk, latency_ms); run against benchmark runs with pass/fail results
- **Release Notes** — LLM-generated 2-3 sentence narrative comparing metric deltas between benchmark runs
- **Model Comparison** — aggregate benchmark results by `model_version`; compare quality and latency across runs
- **Benchmark Growth** — scan answer_runs for weak signals (abstention, low trust, high hallucination) → pending suggestions; developer must approve; never auto-promotes to benchmark cases
- 7 new developer dashboard pages for all quality improvement workflows
- Migration 010: 6 new tables, all workspace-isolated with cascade delete

**RC2 — Verification, Security & Hardening**
- **Two-signal verifier (complete)** — `services/verification/`: Critic LLM (`critic.py`) extracts claims and checks each against evidence spans; NLI cross-checker (`nli.py`) independently classifies each claim as entail/neutral/contradict; a claim is `supported` only when **both** agree (`ensemble.py`)
- **Calibrated trust score** — 4-signal blend: `0.45·frac_supported + 0.25·entailment_margin + 0.20·min_rerank + 0.10·agreement`; isotonic-regression calibrator with passthrough fallback (`confidence.py`, `calibrator.py`)
- **Abstention** — when calibrated trust < `ABSTAIN_THRESHOLD` (default 0.55), system emits an `abstention` SSE event instead of a confident answer
- **Debate loop** — Critic re-evaluates unsupported claims in a second pass (hard cap 2 turns); `debate_turn` events replay the Writer↔Critic exchange
- **Cohere rerank** — live in the retrieval pipeline after RRF fusion; `rerankScore` field added to `RetrievalEvidence` and `EvidenceBlock`; used as 3rd signal in trust computation
- **RS256 JWT fix** — `auth.py` now fetches the RSA public key from Clerk's JWKS endpoint (`/.well-known/jwks.json`) and caches it by `kid`; prior code incorrectly used the `sk_live_...` API key string as an RSA key
- **Rate limiter fail-open** — Upstash Redis outage returns `0` (never blocks users)
- **R2 presigned URLs** — `generate_presigned_url()` + `GET /documents/:id/file` route
- **DELETE /documents/:id** — proper FastAPI 0.115.5 fix (`-> Response`, `return Response(204)`)
- **Migration 011** — RLS policies for all 8 B4 tables; `claims`, `debate_turns`, `abstentions` tables with RLS; `rerank_score` column on `retrieval_run_evidence`
- **Frontend verification UI** — `TrustBadge` (color-coded with score breakdown tooltip), `DebatePanel` (collapsible Critic timeline), `AbstentionCard` (amber warning with threshold); all rendered from SSE stream in chat page
- **22 new verification tests** — NLI, Critic, ensemble, confidence, calibrator all patched; no live API keys required

#### Enterprise Platform (post-RC2)
- **Collections** — multi-document collections with tagging and search; documents can belong to multiple collections; workspace-isolated with full CRUD and RLS
- **Agents** — AI agent definition, configuration, and run tracking; per-workspace agent registry; `agent_runs` with status lifecycle and output persistence
- **Workflows** — structured multi-step workflow definition; `workflow_steps` with ordered execution; `workflow_runs` with per-step status and full output audit
- **API Keys** — programmatic API access with key generation, rotation, and revocation; scoped to workspace; prefix-masked display; tracked last-used timestamps
- **Webhooks** — event-driven webhook delivery with per-event payload signing; `webhook_deliveries` table tracks attempt history, response codes, and retry state
- **Audit Logs** — tamper-evident workspace activity log; every destructive or privileged action writes a structured audit entry with actor, resource type, resource ID, and payload diff
- **Automation** — configurable rule-based automation triggers; fire on platform events; workspace-scoped with enable/disable toggle
- **Prompt Library** — curated shared prompt template library; categorized entries; per-workspace and global scopes; version-tracked
- **Billing** — Dodo Payments integration; `billing_events` table logs all webhook events from the payment provider; production webhook secret enforced at startup via fail-fast config validation
- **Members** — workspace member management with role assignment (owner/editor/viewer); invite, update role, and remove endpoints; enforces minimum-one-owner invariant
- **Review Queue** — structured answer review and approval workflow; items enter the queue from flagged answers; reviewer can approve, reject, or escalate
- **Integrations** — third-party service integration management; per-workspace integration state
- **Contradictions** — cross-document contradiction detection; surfaces conflicting clauses across documents in the same workspace
- **Performance** — backend performance profiling endpoint; request timing and resource breakdowns
- **Metrics** — Prometheus-compatible `/metrics` endpoint via `metrics.py` router; opt-in OpenTelemetry tracing via `OTEL_ENABLED` env var (`backend/telemetry/setup.py`)
- Migration 012–017: verified runtime fields, Stripe→Dodo billing migration, agents platform, enterprise platform, benchmark platform enhancements, Dodo Payments schema

#### Distributed Worker Pipeline
- **ARQ/Redis task queue** — `backend/worker.py` defines 6 async task functions: document ingestion, embedding, vector indexing, eval scoring, benchmark execution, agent run execution
- **Dead-letter queue** — last 1,000 aborted jobs preserved in Redis `dlq:aborted_jobs`; surfaced in developer dashboard
- **`enqueue_or_background()`** — `backend/job_queue/client.py` graceful fallback: enqueues to ARQ when Redis is available, falls back to FastAPI `BackgroundTasks` for local development
- **WorkerSettings** — queue name, `max_jobs`, `job_timeout`, `health_check_interval` all configurable via env vars
- **Docker Compose** — 3 services: `redis`, `api` (2 Uvicorn workers), `worker` (horizontally scalable); independent scale: `docker compose up --scale worker=4`
- **Kubernetes** — 6 manifests in `k8s/`: `namespace.yaml`, `configmap.yaml`, `api-deployment.yaml`, `worker-deployment.yaml`, `redis.yaml`, `ingress.yaml`
- **Pipeline events SSE** — cross-pod Redis pub/sub relay; document pipeline status updates stream to the browser regardless of which pod processed the job

#### Performance Sprints (all shipped)

**Sprint 1 — SSE Reliability**
- Root-cause fix for "Failed to fetch" intermittent SSE disconnect: `except BaseException` in `chat.py` was catching `CancelledError`/`GeneratorExit`, causing Python to raise `RuntimeError` when the generator tried to yield in a closing state — replaced with `except Exception`
- All synchronous Supabase DB calls inside async route handlers wrapped with `asyncio.to_thread` (`retrieval/service.py`, `answer_generation/service.py`): `_load_current_documents`, `_load_current_chunks`, `_record_retrieval_event`, `cohere_rerank`, `_replay_if_request_exists`, `_get_conversation`, `_persist_answer_to_db`

**Sprint 2 — Navigation Lag Elimination**
- Removed `useSearchParams()` from `DarkSidebar.tsx` — bare `useSearchParams` without a Suspense boundary opts the entire layout segment out of streaming, gating every navigation on the slowest pending data
- `AnimatePresence mode="popLayout"` replaces `mode="wait"` in `DarkAppLayout.tsx` — entering and exiting pages animate simultaneously instead of sequentially, cutting perceived transition time in half
- Removed `backdrop-filter: blur()` from page motion variants — GPU repaint on every animation frame was the primary jank source on mid-range hardware
- All 20 Settings tabs → `React.lazy` + `Suspense`; settings route bundle: 4.82 kB (down from ~150 kB)
- `NavItemRow` wrapped with `React.memo`; `toggleCommand` stabilized with `useCallback`
- React Query global defaults: `staleTime: 60_000`, `gcTime: 10*60_000`, `retry: 1`, `refetchOnWindowFocus: false`

**Sprint 3 — Context Re-render Cascade**
- `UIContext` and `WorkspaceContext` context values wrapped with `useMemo` — inline object literals recreated on every render were triggering every consumer to re-render on any provider state change
- `useDeveloperConsole` hook created: 5 parallel `useQueries` for developer dashboard data (dashboard, embedding-metrics, index-metrics, retrieval-metrics, answer-metrics); developer dashboard page migrated from `useState`/`useEffect`/`useSearchParams` to this hook

**Sprint 4 — Production-Grade Navigation (11 phases)**
- Eval dashboard (17.6 kB bundle) split to 7 tab files + 1 shared file; all tabs lazy-loaded via `React.lazy` + `Suspense`; eval route bundle: 4.09 kB
- Workspace settings (25.5 kB) inner tabs (MemberList, AddMemberForm, RolePermissionsMatrix, SecurityTab, ApiKeysTab, AuditLogsTab, IntegrationsTab) all lazy-loaded; bundle: 10.1 kB
- `model-comparisons` page: recharts bundle (131 kB) extracted to lazy `ModelCharts.tsx`; page bundle: 6.11 kB
- Developer dashboard: `SystemHealthPanel` and `LiveMetricsPanel` lazy-loaded with Suspense pulse skeletons
- Onboarding components (OnboardingWelcome, OnboardingWizard, OnboardingChecklist, CompletionCelebration, Spotlight) lazy-loaded in `DarkAppLayout`
- `keepPreviousData` added to `useDocuments`, `useDashboardMetrics`, and `useDeveloperConsole` — eliminates flash of empty state on background refetch
- `@tanstack/react-virtual` `useVirtualizer` in `DocumentList.tsx` — enabled when `viewMode === 'list' && documents.length > 30`; grid stagger delay capped to first 12 cards
- `PerformanceOverlay` dev-only component (Alt+Shift+P): shows FPS, route transition time, React Query cache hit/miss stats, JS heap, render count
- `experimental.optimizePackageImports: ['recharts', 'framer-motion', 'lucide-react']` in `next.config.ts`

#### Developer Dashboard (all phases — 12 pages)
- Document pipeline status, per-document processing timeline, failed jobs and dead-letter queue viewer
- Chunk Inspector, Embedding Explorer, Vector Index Explorer (per-document)
- Retrieval Explorer (normalized query, dense/sparse/fused stage breakdown, score explanations)
- Answer Explorer (full prompt payload, evidence, stream timeline, token usage, latency, cost)
- Embedding metrics, retrieval metrics, answer metrics dashboards
- Experiments, Prompt Versions, Optimization Recommendations, Quality Gates, Release Notes, Model Comparisons, Benchmark Suggestions

### What is NOT yet implemented (future scope)
- LangGraph agent graph — installed dependency, not yet wired
- PDF bounding-box provenance viewer
- `calibrator.pkl` — the isotonic regression calibrator must be trained against a golden dataset; system passes through raw scores with a warning until this is generated

---

## What is Clarity?

Most AI document tools answer questions confidently — even when wrong. In a legal context, a confident wrong answer is the worst possible outcome.

Clarity is built around a different principle: **every claim must prove itself before it reaches you.** A Critic agent checks every assertion against the retrieved source text. An independent NLI entailment model cross-verifies the Critic's verdict. A claim is marked `supported` only when **both signals agree**. When evidence is thin, the system abstains rather than guessing.

The evaluation and quality improvement platform ensures answer quality is a *measurable, CI-gated engineering property*, not a vibe.

---

## The Problem

Teams sign contracts they haven't fully read. Auto-renewal traps, unilateral price-increase rights, lopsided liability caps, non-standard termination windows — they're buried in dense legal language across dozens of documents.

Existing AI tools fail in two specific ways:

1. **They hallucinate confidently.** A generic RAG chatbot asserts "the contract auto-renews for 12 months" with zero indication of whether that's in the document or invented.
2. **They don't prove themselves.** Even when correct, users can't verify the claim without reading the original document.

Clarity solves both. Every answer is verified before it leaves the system, and every claim links back to the exact sentence that supports it.

---

## Key Differentiators

| # | Feature | What it solves |
|---|---------|---------------|
| 1 | **Two-signal verifier** — Critic LLM + independent NLI entailment; a claim passes only if both agree | Eliminates the "Critic hallucinating its own approval" failure mode — no model judges itself |
| 2 | **Calibrated trust score + eval-as-CI** — every answer ships a faithfulness score calibrated against a golden dataset; quality regressions fail the CI build | Turns "it feels accurate" into a measurable, gated guarantee |
| 3 | **Continuous quality improvement** — LLM-as-judge auto-evaluates every answer; optimization engine surfaces actionable recommendations; quality gates block low-quality releases | Active improvement loop, not passive measurement |
| 4 | **Abstention** — when evidence is thin, the system says "I can't verify this from the documents" | Knowing when *not* to answer is the correct behavior in a legal context |
| 5 | **Bounding-box provenance** — clicking any claim draws a pixel-accurate highlight on the rendered PDF | The visual proof moment — users see the exact sentence, not a vague page reference |
| 6 | **Experiment platform** — run head-to-head A/B comparisons of prompt versions and models, measure outcomes, promote winners | Continuous deployment of quality improvements |
| 7 | **Enterprise platform** — Collections, Agents, Workflows, API Keys, Webhooks, Audit Logs — every feature workspace-isolated with RLS | Production-ready multi-tenant SaaS from day one |
| 8 | **Distributed worker pipeline** — ARQ/Redis async workers with dead-letter queue, horizontally scalable, Kubernetes-deployed | Document ingestion and eval scoring are never on the request path |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (Next.js 15, React 19, App Router, TypeScript, Tailwind)   │
│  · Upload UI + clause map                                            │
│  · Chat — streaming answer + citation chips + verification UI        │
│  · Developer Dashboard (12 pages) + Eval Dashboard (7 tabs)         │
│  · Enterprise (Collections, Agents, Workflows, Billing, Audit Logs) │
│  · 37 authenticated pages · 16 hooks · 6 contexts                   │
│  · React Query v5 · Framer Motion · @tanstack/react-virtual         │
└────────────────────────┬────────────────────────────────────────────┘
                         │ HTTPS · REST + SSE · Clerk JWT on every call
┌────────────────────────▼────────────────────────────────────────────┐
│  FastAPI (Python 3.11, async) — 35 routers                          │
│  · Auth middleware — Clerk RS256 JWT → workspace_id (JWKS-cached)   │
│  · Rate limiting — Upstash Redis (sliding window, per user ID)      │
│  · Metrics middleware — Prometheus-compatible /metrics               │
│  · Production fail-fast config validation at startup                │
│  · Ingestion service — extract → chunk → embed → upsert             │
│  · Hybrid retrieval — dense (Pinecone) + BM25 → RRF → Cohere rerank│
│  · Answer generation — retrieval-grounded SSE streaming             │
│  · Two-signal verification — Critic LLM + NLI + calibration         │
│  · Eval service — LLM-as-judge, benchmarks, regression detection    │
│  · Quality platform — experiments, prompts, gates, optimization     │
│  · Enterprise — collections, agents, workflows, API keys, webhooks  │
│  · Semantic cache — (query, document_set) → Upstash Redis           │
└──┬──────┬──────┬───────┬──────────┬────┬──────────┬────────────────┘
   │      │      │       │          │    │          │
   ▼      ▼      ▼       ▼          ▼    ▼          ▼
Pinecone Supabase Cohere OpenAI  Cloudflare Redis  LangSmith
vectors  Postgres Rerank  LLM +   R2 files  ARQ    tracing
per ns   + RLS           embed             queue
                                           │
                         ┌─────────────────▼────────────────────────┐
                         │  ARQ Worker (horizontally scalable)       │
                         │  · Document ingestion task                │
                         │  · Embedding task                         │
                         │  · Vector indexing task                   │
                         │  · Eval scoring task                      │
                         │  · Benchmark execution task               │
                         │  · Agent run task                         │
                         │  · Dead-letter queue (dlq:aborted_jobs)  │
                         └───────────────────────────────────────────┘
```

### Ingestion pipeline

```
Upload → R2 storage → ARQ worker enqueued
→ PyMuPDF text/layout extraction → clause-aware chunking
→ embed (text-embedding-3-small, cache by hash) → Pinecone upsert (ws_{id} namespace)
→ structured clause map → document status: indexed
→ pipeline_event published to Redis → browser receives SSE update
```

### Query pipeline

```
Request → semantic cache check
→ hybrid retrieval (dense Pinecone + BM25 → RRF fusion → Cohere rerank → cross-reference expansion → top-k)
→ Writer drafts answer from evidence
→ Two-signal verification: extract claims → Critic LLM → NLI entailment cross-check → ensemble verdict → trust blend → calibration → abstention if below threshold
→ stream: graph_node events + answer tokens + citations + claim/debate_turn/trust/abstention events
→ async eval judge (non-blocking, persists 7-dimension scores)
→ regression detection (10-eval window baseline)
```

### Multi-tenancy (three layers, all required)

| Layer | Enforcement |
|-------|-------------|
| Pinecone namespace | `ws_{workspace_id}` — cross-workspace vector retrieval is physically impossible |
| Postgres RLS | Policy on every tenant table filters by `workspace_id` from the JWT |
| API middleware | `workspace_id` extracted from the verified JWT, injected into every service call |

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 15 + React 19 + TypeScript + Tailwind | App Router, SSE parsing, `optimizePackageImports` |
| State / data fetching | TanStack Query v5 + `react-virtual` v3 | `keepPreviousData`, parallel `useQueries`, list virtualization |
| Animations | Framer Motion v12 | `AnimatePresence mode="popLayout"`, no GPU-repainting blur |
| Auth (frontend) | Clerk (Next.js SDK v6) | JWT carries workspace claims; JWKS RS256 verification on backend |
| Backend | FastAPI (Python 3.11) | Async, StreamingResponse for SSE, 35 routers |
| Task queue | ARQ + Redis | 6 async task types; dead-letter queue; `enqueue_or_background()` fallback |
| LLM | OpenAI GPT-4o-mini | Budget-first; centralized config, one flag to swap |
| Embeddings | OpenAI text-embedding-3-small (1536d) | Cost-optimized; Pinecone index = 1536d |
| Vector DB | Pinecone | Managed, namespace-per-workspace |
| Reranking | Cohere Rerank | Live after RRF fusion; score used as trust signal |
| Primary DB | Supabase (Postgres + RLS) | Tenancy enforced at the DB layer; 17 migrations |
| Cache / rate limits | Upstash Redis | Semantic cache + per-tier rate limiting + fail-open |
| File storage | Cloudflare R2 | Free egress, S3-compatible, signed URLs |
| Billing | Dodo Payments | Webhook-verified billing events; production secret enforced at startup |
| Observability | LangSmith + Sentry + OpenTelemetry | Step tracing + error tracking + optional OTEL spans |
| Metrics | Prometheus | `/metrics` endpoint via `metrics.py` router |
| CI/CD | GitHub Actions | ruff + pytest + tsc + vitest on every PR |
| Containers | Docker Compose | 3 services: redis, api (2 workers), ARQ worker |
| Orchestration | Kubernetes | 6 manifests: namespace, configmap, api, worker, redis, ingress |

---

## Project Structure

```
clarity-docs/
├── frontend/                              # Next.js 15 app (React 19)
│   ├── next.config.ts                     # optimizePackageImports for recharts/framer-motion/lucide
│   └── src/
│       ├── types/clarity.ts               # All shared TypeScript types
│       ├── lib/
│       │   ├── api.ts                     # Typed API client (60+ functions) + SSE stream
│       │   ├── chatStream.ts              # SSE parser with reconnect
│       │   ├── documentPolling.ts         # Document status polling
│       │   ├── markdown.ts                # Markdown renderer
│       │   └── motion.ts                  # Shared Framer Motion variants (no blur)
│       ├── contexts/                      # 6 contexts (UI, Workspace, Command, Notification,
│       │                                  #   Onboarding, Toast) — all values stabilized with useMemo
│       ├── hooks/                         # 16 hooks (documents, conversations, agents, collections,
│       │                                  #   benchmarks, evaluations, regressions, developer console,
│       │                                  #   metrics, workspace members, system health, enterprise)
│       ├── components/
│       │   ├── documents/                 # DocumentCard, DocumentList (react-virtual for list >30)
│       │   ├── upload/                    # Dropzone
│       │   ├── workspace/                 # WorkspaceDashboard
│       │   ├── chat/                      # TrustBadge, DebatePanel, AbstentionCard
│       │   ├── developer/                 # SystemHealthPanel, LiveMetricsPanel
│       │   ├── layout/                    # DarkAppLayout (AnimatePresence popLayout),
│       │   │                              #   DarkSidebar (no useSearchParams), DarkTopbar
│       │   ├── settings/                  # 20 settings tabs (all React.lazy)
│       │   │   └── members/               # MemberList, AddMemberForm, RolePermissionsMatrix
│       │   ├── onboarding/                # Welcome, Wizard, Checklist, Celebration, Spotlight
│       │   │                              #   (all lazy-loaded in DarkAppLayout)
│       │   └── perf/
│       │       └── PerformanceOverlay.tsx # Dev-only, Alt+Shift+P, FPS + cache stats
│       └── app/
│           ├── layout.tsx                 # Clerk provider + QueryProvider
│           ├── page.tsx                   # Landing page
│           ├── (auth)/                    # 37 authenticated pages total
│           │   ├── dashboard/             # Home dashboard
│           │   ├── chat/                  # Streaming chat with verification UI
│           │   ├── documents/             # Document list + upload
│           │   │   └── [id]/              # Chunk / Embedding / Vector inspectors
│           │   ├── eval/                  # 7-tab eval dashboard (all tabs lazy-loaded)
│           │   │   └── tabs/              # OverviewTab, TrendsTab, BenchmarksTab,
│           │   │                          #   LeaderboardTab, CitationsTab, TrustTab,
│           │   │                          #   ConversationsTab, _shared.tsx
│           │   ├── collections/           # Collection management
│           │   ├── agents/                # Agent registry + run viewer
│           │   ├── workflows/             # Workflow builder + run history
│           │   ├── billing/               # Billing overview + events
│           │   ├── conversations/         # Conversation list + history
│           │   ├── contradictions/        # Cross-document contradiction viewer
│           │   ├── settings/              # Multi-tab settings (all React.lazy)
│           │   ├── workspace/             # Workspace overview
│           │   └── developer/             # 12-page developer console
│           │       ├── dashboard/         # Pipeline monitor (useDeveloperConsole hook)
│           │       ├── answers/           # Answer Explorer
│           │       ├── retrieval/         # Retrieval Explorer
│           │       ├── embeddings/        # Embedding metrics
│           │       ├── experiments/       # A/B Experiment Explorer
│           │       ├── prompts/           # Prompt Version Explorer
│           │       ├── optimization/      # Optimization Recommendations
│           │       ├── quality-gates/     # Quality Gate rules + runs
│           │       ├── release-notes/     # AI Release Notes
│           │       ├── model-comparisons/ # Model Comparison (lazy ModelCharts.tsx)
│           │       ├── regressions/       # Regression report history
│           │       └── benchmark-suggestions/ # Benchmark growth workflow
│           └── api/health/route.ts
│
├── backend/                               # FastAPI application
│   ├── main.py                            # App entry: middleware, 35 routers, lifespan
│   ├── config.py                          # pydantic-settings — 60+ env vars, fail-fast prod check
│   ├── schemas.py                         # 149 Pydantic models
│   ├── worker.py                          # ARQ WorkerSettings + 6 async task functions + DLQ
│   ├── job_queue/
│   │   └── client.py                      # enqueue_or_background() — ARQ or BackgroundTasks fallback
│   ├── telemetry/
│   │   └── setup.py                       # Optional OpenTelemetry init (OTEL_ENABLED env var)
│   ├── db/client.py                       # Supabase singleton + tenant_query guard
│   ├── api/
│   │   ├── middleware/
│   │   │   ├── auth.py                    # Clerk RS256 JWT — JWKS fetch + kid cache
│   │   │   ├── rate_limit.py              # Upstash Redis sliding-window (fail-open)
│   │   │   ├── logging.py                 # Structured request/response logging
│   │   │   └── metrics.py                 # Prometheus request counter + latency
│   │   ├── deps.py                        # Role-aware workspace guards (owner/editor/viewer)
│   │   └── routers/                       # 35 routers:
│   │       ├── health.py                  #   health
│   │       ├── workspaces.py              #   workspaces
│   │       ├── members.py                 #   workspace members
│   │       ├── documents.py               #   document CRUD + pipeline
│   │       ├── events.py                  #   pipeline events SSE (Redis relay)
│   │       ├── retrieval.py               #   retrieval explorer
│   │       ├── chat.py                    #   streaming SSE answer generation
│   │       ├── conversations.py           #   conversation list
│   │       ├── messages.py                #   message history
│   │       ├── claims.py                  #   per-claim verification audit
│   │       ├── contradictions.py          #   cross-document contradiction detection
│   │       ├── developer.py               #   developer dashboard + metrics
│   │       ├── evaluations.py             #   LLM-as-judge eval
│   │       ├── benchmarks.py              #   benchmark lifecycle
│   │       ├── regressions.py             #   regression reports
│   │       ├── experiments.py             #   A/B experiments
│   │       ├── prompts.py                 #   prompt version manager
│   │       ├── optimization.py            #   optimization recommendations
│   │       ├── quality_gates.py           #   quality gate rules + runs
│   │       ├── release_notes.py           #   AI-generated release notes
│   │       ├── model_comparisons.py       #   model benchmark comparison
│   │       ├── benchmark_suggestions.py   #   benchmark growth scanner
│   │       ├── collections.py             #   document collections
│   │       ├── agents.py                  #   agent registry + runs
│   │       ├── workflows.py               #   workflow definitions + runs
│   │       ├── api_keys.py                #   API key management
│   │       ├── webhooks.py                #   webhook endpoints + deliveries
│   │       ├── audit_logs.py              #   workspace audit trail
│   │       ├── automation.py              #   automation rules
│   │       ├── prompt_library.py          #   shared prompt template library
│   │       ├── integrations.py            #   third-party integrations
│   │       ├── review_queue.py            #   answer review workflow
│   │       ├── billing.py                 #   Dodo Payments webhook + events
│   │       ├── metrics.py                 #   Prometheus /metrics endpoint
│   │       └── performance.py             #   backend performance profiler
│   ├── services/
│   │   ├── ingestion/                     # Extract → normalize → chunk pipeline
│   │   ├── embeddings/                    # Provider-agnostic embedding pipeline
│   │   ├── indexing/                      # Pinecone vector sync pipeline
│   │   ├── retrieval/                     # Hybrid dense+BM25+RRF+Cohere rerank+cache
│   │   │   └── rerank.py                  # Cohere rerank (asyncio.to_thread wrapped)
│   │   ├── answer_generation/             # Streaming SSE writer + verification wiring
│   │   ├── events/                        # Pipeline events Redis pub/sub relay
│   │   ├── eval/                          # Judge, benchmarks, regression, experiments
│   │   ├── prompts/                       # Prompt version manager
│   │   ├── optimization/                  # LLM optimization engine
│   │   ├── quality_gates/                 # Configurable pass/fail runner
│   │   ├── release_notes/                 # AI-generated release notes service
│   │   ├── benchmark_growth/              # Weak-answer suggestion scanner
│   │   ├── performance/                   # Request profiling + timing breakdowns
│   │   ├── storage/r2.py                  # Cloudflare R2 + presigned URLs
│   │   └── verification/                  # Two-signal verifier (RC2 — complete)
│   │       ├── critic.py                  # Claim extraction + per-claim LLM verdict
│   │       ├── nli.py                     # Independent NLI entailment cross-check
│   │       ├── ensemble.py                # Both-signal agreement rule
│   │       ├── confidence.py              # 4-signal trust blend + abstention
│   │       └── calibrator.py              # Isotonic regression calibration
│   ├── migrations/
│   │   └── 001_pipeline_events.sql        # Redis relay event schema (backend-only)
│   └── tests/                             # 368 tests across 54 files
│       ├── conftest.py                    # Async client, JWT helpers, mock Supabase
│       ├── test_rls.py                    # Workspace isolation (3-layer)
│       ├── test_documents_api.py          # Document CRUD + pipeline
│       ├── test_developer_api.py          # Developer dashboard endpoints
│       ├── test_embedding_pipeline.py     # Embedding service
│       ├── test_indexing_pipeline.py      # Pinecone sync
│       ├── test_retrieval_service.py      # Hybrid retrieval
│       ├── test_retrieval_api.py          # Retrieval API
│       ├── test_answer_generation.py      # SSE streaming + idempotency
│       ├── test_ai_latency.py             # Async event loop correctness
│       ├── test_eval_engine.py            # Judge eval engine
│       ├── test_eval_api.py               # Eval REST API
│       ├── test_judge.py                  # OpenAI judge provider
│       ├── test_benchmark.py              # Benchmark service
│       ├── test_regression.py             # Regression detection
│       ├── test_experiments_api.py        # A/B experiment API
│       ├── test_prompts.py                # Prompt version manager
│       ├── test_optimization.py           # Optimization engine
│       ├── test_quality_gates.py          # Quality gate runner
│       ├── test_release_notes.py          # Release note generator
│       ├── test_benchmark_suggestions.py  # Benchmark growth scanner
│       ├── test_verification.py           # Two-signal verifier (22 tests)
│       ├── test_abstention.py             # Abstention logic
│       ├── test_calibration.py            # Trust calibrator
│       ├── test_critic.py                 # Critic LLM
│       ├── test_nli.py                    # NLI entailment
│       ├── test_claims_api.py             # Claims audit API
│       ├── test_collections_api.py        # Collections CRUD
│       ├── test_agents_api.py             # Agents + runs
│       ├── test_workflows_api.py          # Workflow execution
│       ├── test_api_keys.py               # API key management
│       ├── test_webhooks.py               # Webhook delivery
│       ├── test_audit_logs.py             # Audit log writes
│       ├── test_automation.py             # Automation rules
│       ├── test_prompt_library.py         # Prompt library
│       ├── test_integrations.py           # Integrations
│       ├── test_review_queue_api.py       # Review queue
│       ├── test_billing.py                # Billing webhook events
│       ├── test_members_api.py            # Member management
│       ├── test_contradictions_api.py     # Contradiction detection
│       ├── test_conversations_api.py      # Conversation history
│       ├── test_auth_jwks.py              # JWKS RS256 key caching
│       ├── test_rate_limit.py             # Rate limiter fail-open
│       ├── test_observability.py          # OTEL + Prometheus
│       ├── test_performance_profiler.py   # Performance service
│       ├── test_migrations.py             # Migration contract verification
│       ├── test_workspaces.py             # Workspace CRUD + roles
│       ├── test_health.py                 # Health check
│       ├── test_chunker.py                # Clause-aware chunker
│       ├── test_ingestion_pipeline.py     # Ingestion pipeline
│       ├── test_ingestion_extractors.py   # PDF/DOCX extractors
│       └── test_ingestion_sprint1.py      # Async event loop ingestion
│
├── migrations/                            # 17 SQL migrations (run in order in Supabase)
│   ├── 001_initial_schema.sql             # 18 tables, RLS policies, FK ordering
│   ├── 002_document_ingestion_pipeline.sql
│   ├── 003_chunking_pipeline.sql
│   ├── 004_embedding_pipeline.sql
│   ├── 005_vector_indexing_pipeline.sql
│   ├── 006_hybrid_retrieval_engine.sql
│   ├── 007_answer_generation_platform.sql
│   ├── 008_verified_runtime_integration.sql
│   ├── 009_eval_platform.sql              # B3: eval, benchmarks, experiments
│   ├── 010_quality_improvement.sql        # B4: prompts, gates, optimization, etc.
│   ├── 011_rls_and_verification.sql       # RC2: RLS for B4 + claims/debate_turns/abstentions
│   ├── 012_add_verification_fields.sql    # Additional verification columns
│   ├── 013_stripe_billing.sql             # Initial billing schema
│   ├── 014_agents_platform.sql            # Agents + agent_runs tables
│   ├── 015_enterprise_platform.sql        # Collections, API keys, webhooks, audit logs,
│   │                                      #   automation, prompt library, review queue
│   ├── 016_benchmark_platform.sql         # Benchmark platform enhancements
│   └── 017_dodo_billing.sql               # Dodo Payments schema (replaces Stripe)
│
├── k8s/                                   # Kubernetes production manifests
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── api-deployment.yaml
│   ├── worker-deployment.yaml
│   ├── redis.yaml
│   └── ingress.yaml
│
├── docker-compose.yml                     # redis + api (2 workers) + ARQ worker
├── .github/workflows/ci.yml              # ruff + pytest + tsc + vitest
├── 00_README.md  →  12_EXECUTION_ROADMAP.md   # Specification documents
└── README.md                             # This file
```

---

## Database Schema (key tables)

```sql
-- 35+ tables total. Highlights:

-- Core tenancy
workspaces, memberships                   -- root tenant structure
documents, chunks, clauses                -- ingestion artifacts
conversations, messages                   -- chat history

-- Retrieval observability
retrieval_runs, retrieval_run_evidence    -- per-query retrieval audit
answer_runs, answer_stream_events         -- answer + SSE replay

-- Verification (RC2 — live)
claims (                                  -- per-claim two-signal verdict
  claim_text text,
  critic_verdict text,                    -- supported | unsupported | uncertain
  nli_label text,                         -- entail | neutral | contradict
  nli_score numeric(4,3),
  ensemble_verdict text,                  -- supported only when BOTH agree
  evidence_spans jsonb,
  debate_turn integer
)
debate_turns (turn_number, claim_text, critic_verdict, reasoning)
abstentions (trust_score, threshold, reason, missing_evidence_query)

-- Evaluation (B3)
answer_evals (                            -- 7-dimension judge scores 0-100
  judge_faithfulness, judge_grounding, judge_completeness,
  judge_correctness, judge_clarity, judge_citation_quality,
  judge_hallucination_risk, judge_overall
)
benchmark_datasets, benchmark_cases, benchmark_runs
regression_reports, quality_rollups

-- Quality Improvement (B4)
experiments, experiment_candidates
prompt_versions (UNIQUE workspace + key + version)
optimization_recommendations
quality_gate_rules, quality_gate_runs
release_notes, benchmark_suggestions

-- Enterprise Platform
collections, collection_documents         -- multi-document collections (M2M)
agents, agent_runs                        -- agent registry + execution history
workflows, workflow_steps, workflow_runs  -- multi-step workflow execution
api_keys                                  -- programmatic API access; prefix-masked
webhooks, webhook_deliveries              -- event webhooks + delivery attempt log
audit_logs                                -- tamper-evident workspace activity trail
automation_rules                          -- rule-based automation triggers
prompt_library_entries                    -- shared curated prompt templates
review_queue_items                        -- answer review + approval workflow
billing_events                            -- Dodo Payments webhook event log

reference_clauses                         -- market-standard library
                                          -- GLOBAL: intentionally no workspace_id
                                          -- Only table without RLS (read-only reference data)
```

---

## API Reference

### Core
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check — no auth required |
| `GET` | `/api/me` | Current user + workspaces |
| `POST` | `/api/workspaces` | Create workspace |
| `GET` | `/metrics` | Prometheus-compatible metrics |

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/documents` | Upload PDF/DOCX; enqueues ARQ ingestion task |
| `GET` | `/api/documents` | List documents in workspace |
| `GET` | `/api/documents/{id}` | Document + clause map |
| `DELETE` | `/api/documents/{id}` | Delete document (Response 204) |
| `GET` | `/api/documents/{id}/file` | Signed R2 URL for download |
| `GET` | `/api/documents/{id}/chunks` | Chunk inspection |
| `GET` | `/api/documents/{id}/embeddings` | Embedding inspection |
| `GET` | `/api/documents/{id}/vectors` | Vector index inspection |
| `GET` | `/api/events` | **SSE** — pipeline status updates (Redis relay) |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | **SSE stream** — grounded answer generation |
| `GET` | `/api/chat/conversations/{id}/answers/{run_id}/stream` | SSE replay |
| `GET` | `/api/conversations` | Conversation list |
| `GET` | `/api/conversations/{id}/messages` | Message history |
| `GET` | `/api/claims` | Per-claim verification audit trail |
| `GET` | `/api/contradictions` | Cross-document contradiction detection |

### Evaluation (B3)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/evaluations` | Recent LLM judge results |
| `POST` | `/api/benchmarks/datasets` | Create benchmark dataset |
| `POST` | `/api/benchmarks/runs` | Run benchmark against dataset |
| `GET` | `/api/benchmarks/runs` | List benchmark runs |
| `GET` | `/api/regressions` | Regression report history |

### Quality Improvement (B4)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET/POST` | `/api/experiments` | A/B experiment management |
| `POST` | `/api/experiments/{id}/candidates` | Add candidate to experiment |
| `POST` | `/api/experiments/{id}/complete` | Close experiment with winner |
| `GET/POST` | `/api/prompts` | Prompt version management |
| `POST` | `/api/prompts/{id}/activate` | Activate (deactivates siblings) |
| `POST` | `/api/prompts/{id}/retire` | Retire a version |
| `GET` | `/api/optimization` | List recommendations |
| `POST` | `/api/optimization/analyze` | Run LLM analysis |
| `PATCH` | `/api/optimization/{id}` | Accept or dismiss recommendation |
| `GET/POST` | `/api/quality-gates/rules` | Manage gate rules |
| `DELETE` | `/api/quality-gates/rules/{id}` | Delete rule |
| `POST` | `/api/quality-gates/run` | Evaluate against benchmark run |
| `GET` | `/api/quality-gates/runs` | Gate run history |
| `GET/POST` | `/api/release-notes` | Release notes management |
| `GET` | `/api/model-comparisons` | Aggregate by model version |
| `GET` | `/api/benchmark-suggestions` | Pending weak-answer suggestions |
| `POST` | `/api/benchmark-suggestions/scan` | Scan for weak answers |
| `POST` | `/api/benchmark-suggestions/{id}/approve` | Promote to benchmark case |
| `POST` | `/api/benchmark-suggestions/{id}/dismiss` | Dismiss suggestion |

### Enterprise
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET/POST` | `/api/collections` | Collection management |
| `POST` | `/api/collections/{id}/documents` | Add document to collection |
| `DELETE` | `/api/collections/{id}/documents/{doc_id}` | Remove document from collection |
| `GET/POST` | `/api/agents` | Agent registry |
| `POST` | `/api/agents/{id}/run` | Execute agent; enqueues ARQ task |
| `GET` | `/api/agents/{id}/runs` | Agent run history |
| `GET/POST` | `/api/workflows` | Workflow definitions |
| `POST` | `/api/workflows/{id}/run` | Execute workflow |
| `GET` | `/api/workflows/{id}/runs` | Workflow run history |
| `GET/POST` | `/api/api-keys` | API key management |
| `DELETE` | `/api/api-keys/{id}` | Revoke API key |
| `GET/POST` | `/api/webhooks` | Webhook endpoint management |
| `GET` | `/api/webhooks/{id}/deliveries` | Webhook delivery history |
| `GET` | `/api/audit-logs` | Workspace audit trail |
| `GET/POST` | `/api/automation` | Automation rules |
| `GET/POST` | `/api/prompt-library` | Shared prompt templates |
| `GET` | `/api/review-queue` | Answer review queue |
| `POST` | `/api/review-queue/{id}/approve` | Approve queued answer |
| `POST` | `/api/review-queue/{id}/reject` | Reject queued answer |
| `GET` | `/api/integrations` | Third-party integration state |
| `POST` | `/api/billing/webhook` | Dodo Payments webhook receiver |

### Members & Developer
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/members` | Workspace member list |
| `POST` | `/api/members/invite` | Invite member |
| `PATCH` | `/api/members/{id}/role` | Update member role |
| `DELETE` | `/api/members/{id}` | Remove member |
| `GET` | `/api/developer/dashboard` | Document pipeline + status counts |
| `GET` | `/api/developer/answers` | Answer Explorer |
| `GET` | `/api/developer/retrieval` | Retrieval Explorer |
| `GET` | `/api/developer/metrics/embeddings` | Embedding metrics |
| `GET` | `/api/developer/metrics/retrieval` | Retrieval metrics |
| `GET` | `/api/developer/metrics/answers` | Answer metrics |
| `GET` | `/api/performance` | Backend performance profile |

---

## SSE Event Stream

```
data: {"type":"meta","conversationId":"uuid","userMessageId":"uuid","answerRunId":"uuid"}

data: {"type":"graph_node","node":"retriever","status":"started"}
data: {"type":"graph_node","node":"retriever","status":"finished","summary":"5 evidence chunks"}
data: {"type":"retrieval","normalizedQuery":{...},"resultCount":5}
data: {"type":"graph_node","node":"writer","status":"started"}
data: {"type":"token","text":"This contract auto-renews "}
data: {"type":"token","text":"for 12 months unless "}
data: {"type":"citation","citation":{"citationKey":"[1]","documentId":"...","pageStart":4,...}}
data: {"type":"message","message":{...,"citations":[...]}}
data: {"type":"done"}

# RC2 — verification events (live):
data: {"type":"claim","claim":"The contract auto-renews for 12 months.","verdict":"supported","criticVerdict":"supported","nliLabel":"entail","nliScore":0.93,"evidenceSpans":["...shall automatically renew..."]}
data: {"type":"debate_turn","turn":1,"claim":"...","verdict":"unsupported","reasoning":"No span mentions a 12-month period."}
data: {"type":"trust","raw":0.812,"calibrated":0.847,"components":{"frac_supported":0.8,"entailment_margin":0.75,"min_rerank":0.82,"agreement":1.0}}
data: {"type":"abstention","reason":"Calibrated trust score below threshold","trustScore":0.41,"threshold":0.55}

# Pipeline events (separate /api/events SSE stream):
data: {"type":"pipeline_event","documentId":"uuid","stage":"embedding","status":"complete","progress":100}
```

---

## Build Phases

| Phase | Goal | Status |
|-------|------|--------|
| **0 — Scaffold** | Monorepo, config, auth, CI, DB schema | ✅ Complete |
| **A1 — Workspace** | Multi-workspace auth, role system | ✅ Complete |
| **A2 — Storage** | Document upload, R2, signed URLs | ✅ Complete |
| **A3 — Ingestion** | PDF/DOCX extraction, normalization | ✅ Complete |
| **A3.1 — Patch** | Parser hardening, file signatures | ✅ Complete |
| **A4 — Chunking** | Clause-aware chunks, tiktoken | ✅ Complete |
| **A5 — Embeddings** | OpenAI embedding pipeline | ✅ Complete |
| **A6 — Indexing** | Pinecone with namespace isolation | ✅ Complete |
| **A7 — Retrieval** | Hybrid dense+BM25+RRF+Cohere rerank+cache | ✅ Complete |
| **A8 — Chat** | Streaming SSE answer generation | ✅ Complete |
| **A8.1 — Patch** | SSE replay, idempotency | ✅ Complete |
| **B3 — Eval Platform** | LLM judge, benchmarks, regression | ✅ Complete |
| **B4 — Quality Platform** | Experiments, gates, optimization | ✅ Complete |
| **RC2 — Verification** | Two-signal Critic + NLI + calibration + abstention + rerank + security fixes | ✅ Complete |
| **Enterprise Platform** | Collections, Agents, Workflows, API Keys, Webhooks, Audit Logs, Billing, Automation, Prompt Library, Review Queue, Members, Metrics, Contradictions | ✅ Complete |
| **ARQ Worker Pipeline** | Distributed async workers, DLQ, Docker Compose, Kubernetes, pipeline events SSE | ✅ Complete |
| **Performance Sprint 1** | SSE reliability: `except Exception` fix, `asyncio.to_thread` for all sync Supabase calls | ✅ Complete |
| **Performance Sprint 2** | Navigation lag: `useSearchParams` removal, `AnimatePresence popLayout`, blur removal, 20 settings tabs lazy-loaded | ✅ Complete |
| **Performance Sprint 3** | Context re-render cascade: `useMemo` on UIContext + WorkspaceContext, `useDeveloperConsole` with `useQueries` | ✅ Complete |
| **Production-Grade Navigation** | Eval tabs split (17.6 kB → 4.09 kB), workspace tabs lazy (25.5 kB → 10.1 kB), recharts split (131 kB → 6.11 kB), `keepPreviousData`, react-virtual, PerformanceOverlay, `optimizePackageImports` | ✅ Complete |
| **Phase C — Eval System** | Golden dataset, RAGAS metrics, CI gate, eval dashboard | 🔲 Post-enterprise |
| **Phase D — Reasoning UI** | Live LangGraph viz, debate panel, contradiction graph | 🔲 Future |
| **Phase E — Provenance** | PDF bounding-box highlights, clause benchmarking | 🔲 Future |

---

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.11+
- Poetry 2.x (`pip install poetry`)
- Redis 7+ (local or managed — required for ARQ worker and rate limiting)
- Accounts: Supabase, Pinecone, Clerk, Cohere, OpenAI, Upstash, Cloudflare R2, Dodo Payments (optional for billing)

### Backend

```bash
cd backend
cp .env.example .env          # fill in your keys
poetry install
poetry run uvicorn main:app --reload --port 8000
```

### ARQ Worker (required for document processing)

```bash
# In a separate terminal:
cd backend
poetry run arq worker.WorkerSettings
```

### Frontend

```bash
cd frontend
cp .env.local.example .env.local   # fill in Clerk + backend URL
npm install
npm run dev
```

### Docker Compose (recommended for local development)

```bash
docker compose up          # starts redis + api (2 workers) + arq worker
docker compose up --scale worker=4   # scale workers independently
```

### Kubernetes (production)

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/api-deployment.yaml
kubectl apply -f k8s/worker-deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

### Run tests

```bash
# Backend (368 tests across 54 files)
cd backend && poetry run pytest --tb=short -q

# Frontend (6 tests)
cd frontend && npm test

# Type check
cd frontend && npm run typecheck
```

### Apply database migrations

Run migrations in order in your Supabase SQL editor:

```
001_initial_schema.sql
002_document_ingestion_pipeline.sql
003_chunking_pipeline.sql
004_embedding_pipeline.sql
005_vector_indexing_pipeline.sql
006_hybrid_retrieval_engine.sql
007_answer_generation_platform.sql
008_verified_runtime_integration.sql
009_eval_platform.sql
010_quality_improvement.sql
011_rls_and_verification.sql
012_add_verification_fields.sql
013_stripe_billing.sql
014_agents_platform.sql
015_enterprise_platform.sql
016_benchmark_platform.sql
017_dodo_billing.sql
```

Also apply `backend/migrations/001_pipeline_events.sql` — this creates the pipeline events schema used by the Redis pub/sub relay for cross-pod document status streaming.

### Environment variables

All required keys are documented in `backend/.env.example` and `frontend/.env.local.example`. The app fails fast on startup if a required variable is missing (`pydantic-settings` raises on import). In production, `DODO_WEBHOOK_SECRET`, `REDIS_URL`, and a non-localhost `ALLOWED_ORIGINS` are additionally enforced at startup before accepting traffic.

---

## Quality Metrics (targets to measure, not fabricate)

| Metric | Target | Status |
|--------|--------|--------|
| Answer faithfulness (golden set) | ≥ 0.90 | Measured post-RC2 |
| Hallucination catch rate (adversarial set) | ≥ 80% | Measured post-RC2 |
| Context precision / recall | ≥ 0.80 | Measured post-RC2 |
| Trust-score calibration (ECE) | ≤ 0.10 | Measured post-RC2 |
| Abstention on unanswerable cases | ≥ 80% | Measured post-RC2 |
| CI quality gate | Build fails on regression | B3 threshold config ready |
| Judge average across benchmark runs | Tracked | Operational via B3/B4 |
| First-token P99 latency | < 1.5s | Tracked in Answer Explorer |
| Route transition time | < 150ms | PerformanceOverlay (Alt+Shift+P) |

> These are real numbers to measure and report — not targets to invent. A real-but-modest number beats a fabricated impressive one.

---

## Security

- **RS256 JWT verification on every request.** `auth.py` fetches the RSA public key from Clerk's JWKS endpoint (`/.well-known/jwks.json`), caches it by `kid`, and verifies every token with the correct algorithm. `workspace_id` is extracted from the verified token — never from the request body.
- **Three-layer tenancy.** Cross-workspace data access is impossible: blocked at the Pinecone namespace, the Postgres RLS policy, and the API middleware independently.
- **Production fail-fast config validation.** `_validate_production_config()` runs at startup and refuses to serve traffic if `DODO_WEBHOOK_SECRET`, `REDIS_URL`, or a production-safe `ALLOWED_ORIGINS` are missing.
- **Prompt-injection guard.** Document text is treated as data, never instructions.
- **Secrets never committed.** `.env` and `.env.local` are in `.gitignore` from the first commit.
- **Signed, short-lived file URLs.** R2 objects are never publicly accessible.
- **Rate limiting per user ID.** Upstash Redis sliding window — immune to IP spoofing; fails open on Redis outage so users are never blocked by infrastructure failure.
- **Role-aware workspace guards.** `deps.py` enforces owner/editor/viewer role boundaries on every mutating endpoint.
- **Webhook signature verification.** All Dodo Payments webhook events are verified against `DODO_WEBHOOK_SECRET` before processing.
- **Dead-letter queue.** Failed ARQ jobs land in `dlq:aborted_jobs` (last 1,000) rather than silently disappearing.
- **"Not legal advice" disclaimer on every output.**

---

## Contributing

This is an actively developed portfolio project. Feedback and issues are welcome.

---

*Not legal advice. Clarity is an AI tool for information and analysis only.*
