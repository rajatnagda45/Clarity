# Clarity — Self-Auditing Contract Intelligence

> **An AI contract auditor that measures, tracks, and continuously improves answer quality — with a two-signal verifier, calibrated trust, and a full quality improvement platform.**

[![CI](https://github.com/rajatnagda45/Clarity/actions/workflows/ci.yml/badge.svg)](https://github.com/rajatnagda45/Clarity/actions/workflows/ci.yml)
![Phase](https://img.shields.io/badge/phase-B4%20quality%20improvement-blue)
![Tests](https://img.shields.io/badge/tests-169%20backend%20%7C%206%20frontend-brightgreen)
![Stack](https://img.shields.io/badge/stack-Next.js%2015%20%2B%20FastAPI%20%2B%20Supabase-informational)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Current Status

**Phases A through B4 are complete.** The repository is undergoing a Principal Engineer architecture review before Phase C begins.

### What was built across all phases

#### Phase A — Core RAG Platform (A1–A8.1)
- Clerk-backed authentication with workspace isolation (three-layer: JWT + Pinecone namespace + Postgres RLS)
- `GET /api/me`, `POST /api/workspaces`, multi-workspace role system (owner/editor/viewer)
- Secure Cloudflare R2 object storage with signed URLs for PDF/DOCX uploads
- Full ingestion pipeline: PyMuPDF extraction → text normalization → clause-aware preprocessing
- Clause-aware chunking with `tiktoken`, definition-section preservation, cross-reference extraction, deterministic chunk IDs
- Provider-agnostic embedding pipeline (OpenAI `text-embedding-3-small`, versioned, batch-retry, cache-by-hash)
- Pinecone vector indexing with workspace namespace isolation (`ws_{workspace_id}`), stale-vector cleanup, version-aware reruns
- Hybrid retrieval engine: dense (Pinecone) + BM25 (rank-bm25) + RRF fusion + cross-reference expansion + semantic cache (Upstash)
- Streaming SSE answer generation from retrieval evidence only; versioned prompt builder
- Conversation persistence with replay-safe `request_id` idempotency; `Last-Event-ID` reconnect support
- Structured citation mapping — every answer cites exact chunk evidence
- Upstash Redis sliding-window rate limiting per user ID
- LangSmith tracing wired; Sentry error tracking

#### Phase B — Evaluation, Quality Improvement (B1–B4)

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

#### Developer Dashboard (all phases)
- Document pipeline status, per-document processing timeline, failed jobs
- Chunk Inspector, Embedding Explorer, Vector Index Explorer (per-document)
- Retrieval Explorer (normalized query, dense/sparse/fused stage breakdown, score explanations)
- Answer Explorer (full prompt payload, evidence, stream timeline, token usage, latency, cost)
- Embedding metrics, retrieval metrics, answer metrics dashboards
- Experiments, Prompt Versions, Optimization Recommendations, Quality Gates, Release Notes, Model Comparisons, Benchmark Suggestions

### What is NOT yet implemented (Phase B RC2 pending)
- Two-signal verifier (Critic + NLI entailment) — `services/verification/` scaffolded but empty
- LangGraph agent graph — installed dependency, not yet wired
- Cohere rerank — configured, not yet called in retrieval pipeline
- Chat UI trust badge, debate panel, claim verification states, abstention card
- PDF bounding-box provenance viewer
- Contradiction graph (cross-document conflict detection)

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

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (Next.js 15, App Router, TypeScript, Tailwind)             │
│  · Upload UI + clause map                                            │
│  · Chat — streaming answer + citation chips                          │
│  · Developer Dashboard (15+ pages)                                   │
│  · Quality Improvement (Experiments, Prompts, Gates, Optimization)  │
└────────────────────────┬────────────────────────────────────────────┘
                         │ HTTPS · REST + SSE · Clerk JWT on every call
┌────────────────────────▼────────────────────────────────────────────┐
│  FastAPI (Python 3.11, async)                                        │
│  · Auth middleware — Clerk JWT → workspace_id (from token, never body)│
│  · Rate limiting — Upstash Redis (sliding window, per user ID)      │
│  · Ingestion service — extract → chunk → embed → upsert             │
│  · Hybrid retrieval — dense (Pinecone) + BM25 → RRF → top-k       │
│  · Answer generation — retrieval-grounded SSE streaming             │
│  · Eval service — LLM-as-judge, benchmarks, regression detection    │
│  · Quality platform — experiments, prompts, gates, optimization      │
│  · Semantic cache — (query, document_set) → Upstash Redis           │
└──┬──────┬──────┬───────┬──────────┬───────────┬────────────────────┘
   │      │      │       │          │           │
   ▼      ▼      ▼       ▼          ▼           ▼
Pinecone Supabase Cohere OpenAI  Cloudflare  LangSmith
vectors  Postgres Rerank  LLM +   R2 files   tracing
per ns   + RLS           embed
```

### Ingestion pipeline

```
Upload → R2 storage → PyMuPDF text/layout extraction → clause-aware chunking
→ embed (text-embedding-3-small, cache by hash) → Pinecone upsert (ws_{id} namespace)
→ structured clause map → document status: indexed
```

### Query pipeline

```
Request → semantic cache check
→ hybrid retrieval (dense Pinecone + BM25 → RRF fusion → cross-reference expansion → top-k)
→ Writer drafts answer from evidence
→ [Two-signal verification: Critic → NLI entailment → calibration → abstention — Phase RC2]
→ stream: graph_node events + answer tokens + citations
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
| Frontend | Next.js 15 + TypeScript + Tailwind | App Router, SSE parsing |
| Backend | FastAPI (Python 3.11) | Async, StreamingResponse for SSE |
| LLM | OpenAI GPT-4o-mini | Budget-first; centralized config, one flag to swap |
| Embeddings | OpenAI text-embedding-3-small (1536d) | Cost-optimized; Pinecone index = 1536d |
| Vector DB | Pinecone | Managed, namespace-per-workspace |
| Reranking | Cohere Rerank | Configured; wiring in RC2 |
| Primary DB | Supabase (Postgres + RLS) | Tenancy enforced at the DB layer |
| Auth | Clerk | JWT carries workspace claims |
| Cache / rate limits | Upstash Redis | Semantic cache + per-tier rate limiting |
| File storage | Cloudflare R2 | Free egress, S3-compatible, signed URLs |
| Observability | LangSmith + Sentry | Agent step tracing + error tracking |
| CI/CD | GitHub Actions | ruff + pytest + tsc + vitest on every PR |

---

## Project Structure

```
clarity-docs/
├── frontend/                              # Next.js 15 app
│   ├── src/
│   │   ├── types/clarity.ts               # All shared TypeScript types
│   │   ├── lib/
│   │   │   ├── api.ts                     # Typed API client (40+ functions) + SSE stream
│   │   │   ├── chatStream.ts              # SSE parser with reconnect
│   │   │   ├── documentPolling.ts         # Document status polling
│   │   │   └── markdown.ts                # Markdown renderer
│   │   ├── components/
│   │   │   ├── documents/                 # DocumentCard, DocumentList
│   │   │   ├── upload/                    # Dropzone
│   │   │   └── workspace/                 # WorkspaceDashboard
│   │   └── app/
│   │       ├── layout.tsx                 # Clerk provider
│   │       ├── page.tsx                   # Landing page
│   │       ├── (auth)/
│   │       │   ├── chat/page.tsx          # Streaming chat with citations
│   │       │   ├── documents/page.tsx     # Document list + upload
│   │       │   ├── documents/[id]/        # Chunk/Embedding/Vector inspectors
│   │       │   └── developer/
│   │       │       ├── dashboard/         # Pipeline monitor
│   │       │       ├── answers/           # Answer Explorer
│   │       │       ├── retrieval/         # Retrieval Explorer
│   │       │       ├── embeddings/        # Embedding metrics
│   │       │       ├── experiments/       # A/B Experiment Explorer
│   │       │       ├── prompts/           # Prompt Version Explorer
│   │       │       ├── optimization/      # Optimization Recommendations
│   │       │       ├── quality-gates/     # Quality Gate rules + runs
│   │       │       ├── release-notes/     # AI Release Notes
│   │       │       ├── model-comparisons/ # Model Comparison table
│   │       │       └── benchmark-suggestions/ # Benchmark growth workflow
│   │       └── api/health/route.ts
│
├── backend/                               # FastAPI application
│   ├── main.py                            # App entry: middleware, 16 routers, lifespan
│   ├── config.py                          # pydantic-settings — all 60+ env vars
│   ├── schemas.py                         # 90+ Pydantic models
│   ├── db/client.py                       # Supabase singleton + tenant_query guard
│   ├── api/
│   │   ├── middleware/auth.py             # Clerk JWT verification
│   │   ├── middleware/rate_limit.py       # Upstash Redis sliding-window
│   │   ├── deps.py                        # Role-aware workspace guards
│   │   └── routers/                       # 16 routers (health, workspaces, documents,
│   │                                      #   retrieval, chat, conversations, messages,
│   │                                      #   developer, evaluations, benchmarks,
│   │                                      #   regressions, experiments, prompts,
│   │                                      #   optimization, quality_gates, release_notes,
│   │                                      #   model_comparisons, benchmark_suggestions)
│   ├── services/
│   │   ├── ingestion/                     # Extract → normalize → chunk pipeline
│   │   ├── embeddings/                    # Provider-agnostic embedding pipeline
│   │   ├── indexing/                      # Pinecone vector sync pipeline
│   │   ├── retrieval/                     # Hybrid dense+BM25+RRF+cache
│   │   ├── answer_generation/             # Streaming SSE answer writer
│   │   ├── eval/                          # Judge, benchmarks, regression, experiments
│   │   ├── prompts/                       # Prompt version manager
│   │   ├── optimization/                  # LLM optimization engine
│   │   ├── quality_gates/                 # Configurable pass/fail runner
│   │   ├── release_notes/                 # AI-generated release notes
│   │   ├── benchmark_growth/              # Weak-answer suggestion scanner
│   │   ├── verification/                  # [Scaffolded — two-signal verifier in RC2]
│   │   └── storage/r2.py                  # Cloudflare R2 integration
│   ├── scripts/
│   │   ├── verify_live_db_foundation.sql
│   │   └── verify_migration_contract.py
│   └── tests/                             # 169 tests across 26 files
│       ├── conftest.py                    # Async client, JWT helpers, mock Supabase
│       ├── test_rls.py                    # Workspace isolation (3-layer)
│       ├── test_documents_api.py          # Document CRUD + pipeline
│       ├── test_developer_api.py          # Developer dashboard endpoints
│       ├── test_embedding_pipeline.py     # Embedding service
│       ├── test_indexing_pipeline.py      # Pinecone sync
│       ├── test_retrieval_service.py      # Hybrid retrieval
│       ├── test_answer_generation.py      # SSE streaming + idempotency
│       ├── test_eval_engine.py            # Judge eval engine
│       ├── test_judge.py                  # OpenAI judge provider
│       ├── test_benchmark.py              # Benchmark service
│       ├── test_regression.py             # Regression detection
│       ├── test_experiments_api.py        # A/B experiment API (13 tests)
│       ├── test_prompts.py                # Prompt version manager
│       ├── test_optimization.py           # Optimization engine
│       ├── test_quality_gates.py          # Quality gate runner
│       ├── test_release_notes.py          # Release note generator
│       └── test_benchmark_suggestions.py  # Benchmark growth scanner
│
├── migrations/
│   ├── 001_initial_schema.sql             # 18 tables, RLS policies, FK ordering
│   ├── 002_document_ingestion_pipeline.sql
│   ├── 003_chunking_pipeline.sql
│   ├── 004_embedding_pipeline.sql
│   ├── 005_vector_indexing_pipeline.sql
│   ├── 006_hybrid_retrieval_engine.sql
│   ├── 007_answer_generation_platform.sql
│   ├── 009_eval_platform.sql              # B3: eval, benchmarks, experiments
│   └── 010_quality_improvement.sql        # B4: prompts, gates, optimization, etc.
│
├── .github/workflows/ci.yml              # ruff + pytest + tsc + vitest
├── 00_README.md  →  12_EXECUTION_ROADMAP.md   # Specification documents
└── README.md                             # This file
```

---

## Database Schema (key tables)

```sql
-- 24+ tables total. Highlights:

-- Core tenancy
workspaces, memberships                   -- root tenant structure
documents, chunks, clauses                -- ingestion artifacts
conversations, messages                   -- chat history

-- Retrieval observability
retrieval_runs, retrieval_run_evidence    -- per-query retrieval audit
answer_runs, answer_stream_events         -- answer + SSE replay

-- Verification (schema ready, service in RC2)
claims (                                  -- verifiable answer units
  supported boolean,
  entailment_label text,                  -- entail | neutral | contradict
  entailment_score numeric(3,2),
  confidence numeric(3,2),                -- calibrated per-claim
  CONSTRAINT claims_supported_requires_entailment
    CHECK (NOT supported OR entailment_label = 'entail')  -- DB-enforced two-signal rule
)
abstentions, debate_turns, contradictions

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

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/documents` | Upload PDF/DOCX; triggers async ingestion |
| `GET` | `/api/documents` | List documents in workspace |
| `GET` | `/api/documents/{id}` | Document + clause map |
| `GET` | `/api/documents/{id}/file` | Signed R2 URL for download |
| `GET` | `/api/documents/{id}/chunks` | Chunk inspection |
| `GET` | `/api/documents/{id}/embeddings` | Embedding inspection |
| `GET` | `/api/documents/{id}/vectors` | Vector index inspection |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | **SSE stream** — grounded answer generation |
| `GET` | `/api/chat/conversations/{id}/answers/{run_id}/stream` | SSE replay |
| `GET` | `/api/conversations` | Conversation list |
| `GET` | `/api/conversations/{id}/messages` | Message history |

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

### Developer
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/developer/dashboard` | Document pipeline + status counts |
| `GET` | `/api/developer/answers` | Answer Explorer |
| `GET` | `/api/developer/retrieval` | Retrieval Explorer |
| `GET` | `/api/developer/metrics/embeddings` | Embedding metrics |
| `GET` | `/api/developer/metrics/retrieval` | Retrieval metrics |
| `GET` | `/api/developer/metrics/answers` | Answer metrics |

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

# Planned for RC2 (two-signal verifier):
data: {"type":"debate_turn","round":0,"actor":"critic","action":"flag","claimId":"c2","note":"Not in cited span"}
data: {"type":"claim","claim":{"id":"c1","supported":true,"entailmentLabel":"entail","confidence":0.91}}
data: {"type":"trust","score":{"faithfulness":0.91,"relevance":0.95,"overall":0.92,"calibrated":true}}
data: {"type":"abstention","abstention":{"reason":"No span states a cancellation window.","missingEvidenceQuery":"termination notice period"}}
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
| **A7 — Retrieval** | Hybrid dense+BM25+RRF+cache | ✅ Complete (Cohere rerank in RC2) |
| **A8 — Chat** | Streaming SSE answer generation | ✅ Complete |
| **A8.1 — Patch** | SSE replay, idempotency | ✅ Complete |
| **B3 — Eval Platform** | LLM judge, benchmarks, regression | ✅ Complete |
| **B4 — Quality Platform** | Experiments, gates, optimization | ✅ Complete |
| **RC2 — Verification** | Two-signal Critic + NLI + calibration + abstention | 🔲 In planning |
| **Phase C — Eval System** | Golden dataset, RAGAS metrics, CI gate, eval dashboard | 🔲 Post-RC2 |
| **Phase D — Reasoning UI** | Live LangGraph viz, debate panel, contradiction graph | 🔲 Future |
| **Phase E — Provenance** | PDF bounding-box highlights, clause benchmarking | 🔲 Future |

---

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.11+
- Poetry 2.x (`pip install poetry`)
- Accounts: Supabase, Pinecone, Clerk, Cohere, OpenAI, Upstash, Cloudflare R2

### Backend

```bash
cd backend
cp .env.example .env          # fill in your keys
poetry install
poetry run uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
cp .env.local.example .env.local   # fill in Clerk + backend URL
npm install
npm run dev
```

### Run tests

```bash
# Backend (169 tests)
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
009_eval_platform.sql
010_quality_improvement.sql
```

### Environment variables

All required keys are documented in `backend/.env.example` and `frontend/.env.local.example`. The app fails fast on startup if a required variable is missing (`pydantic-settings` raises on import).

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

> These are real numbers to measure and report — not targets to invent. A real-but-modest number beats a fabricated impressive one.

---

## Security

- **JWT verification on every request.** `workspace_id` is extracted from the verified token — never from the request body.
- **Three-layer tenancy.** Cross-workspace data access is impossible: blocked at the Pinecone namespace, the Postgres RLS policy, and the API middleware independently.
- **Prompt-injection guard.** Document text is treated as data, never instructions.
- **Secrets never committed.** `.env` and `.env.local` are in `.gitignore` from the first commit.
- **Signed, short-lived file URLs.** R2 objects are never publicly accessible.
- **Rate limiting per user ID.** Upstash Redis sliding window — immune to IP spoofing.
- **"Not legal advice" disclaimer on every output.**

---

## Contributing

This is an actively developed portfolio project. Feedback and issues are welcome.

---

*Not legal advice. Clarity is an AI tool for information and analysis only.*
