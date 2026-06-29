# Clarity — Self-Auditing Contract Intelligence

> **An AI contract auditor that catches its own hallucinations, proves every claim against the exact source text, and shows you a measured trust score for each answer.**

[![CI](https://github.com/rajatnagda45/Clarity/actions/workflows/ci.yml/badge.svg)](https://github.com/rajatnagda45/Clarity/actions/workflows/ci.yml)
![Phase](https://img.shields.io/badge/phase-B1%20verified%20runtime-blue)
![Stack](https://img.shields.io/badge/stack-Next.js%2015%20%2B%20FastAPI%20%2B%20LangGraph-informational)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Current Status

Phase **A** is complete, and **Phase B1** is now live in the backend runtime.

Implemented today:
- Clerk-backed protected app shell for `/dashboard`, `/documents`, and `/chat`
- `GET /api/me` for workspace access hydration
- `POST /api/workspaces` for first-workspace creation
- workspace-aware dashboard flow in the frontend
- `POST /api/documents`, `GET /api/documents`, and `GET /api/documents/{id}`
- secure Cloudflare R2 object storage integration for original uploads
- background ingestion pipeline for PDF and DOCX extraction
- text normalization, metadata extraction, and clause-aware preprocessing
- deterministic clause-aware chunk generation with `tiktoken` as the primary token counter
- definition-section preservation, cross-reference extraction, and deterministic chunk identifiers
- developer-only chunk inspector for validating chunk ordering, metadata, token counts, and checksums
- provider-agnostic embedding pipeline with OpenAI as the first implementation
- adaptive embedding batching with retry handling, resumable per-batch persistence, and version-aware reruns
- developer-only embedding explorer with safe vector previews and current/stale version visibility
- developer-only embedding metrics dashboard for throughput, latency, retry behavior, provider/model usage, and estimated cost
- provider-agnostic vector indexing pipeline with Pinecone as the first implementation
- deterministic vector synchronization with version-aware reruns, stale-vector cleanup, and workspace namespace isolation
- developer-only vector index explorer for namespace, vector id, sync status, and version metadata inspection
- consolidated developer dashboard for documents, pipeline status, chunk inspection, embeddings, vector indexing, metrics, timeline, and failed jobs
- hybrid retrieval engine with deterministic query normalization, dense retrieval, BM25 retrieval, reciprocal-rank fusion, metadata filters, and bounded cross-reference expansion
- developer-only retrieval explorer showing normalized queries, dense/sparse/fused ranks, score explanations, retrieval reasons, and final evidence ordering
- developer retrieval metrics for latency, retrieved chunk counts, dense/sparse contribution, fusion timing, filter usage, cache hits, and failures
- conversation persistence with workspace-scoped history and replay-safe request ids
- grounded answer generation from A7 retrieval evidence only
- versioned prompt builder and writer runtime
- streaming SSE chat responses with persisted stream events for replay
- structured citation mapping with citation chips linked to exact chunk evidence
- signed document access via `GET /api/documents/{id}/file`
- document deletion via `DELETE /api/documents/{id}`
- claim span resolution via `GET /api/claims/{id}/spans`
- Clerk JWKS-based RS256 verification with issuer, audience, key rotation, and cache support
- explicit developer authorization for all internal dashboards, explorers, and debug APIs
- unified backend error contract across JSON and multipart flows
- upload rate limiting applied to the real upload endpoint
- workspace-safe provenance viewer with signed PDF access, page navigation, and exact extracted span text
- Cohere reranking with cached rerank results in the retrieval pipeline
- developer-only Answer Explorer with prompt payloads, evidence, stream timelines, token usage, latency, and cost
- answer-generation metrics for latency, tokens, citations, and evidence coverage
- verification-aware answer runtime orchestrator wired into the live `/api/chat` path
- first-class claim extraction with persisted claim objects, citation keys, sections, and verification passes
- bounded Writer → Critic → revision → Critic verification loop with a maximum of two passes
- runtime NLI enrichment for every claim with entailment, support, and contradiction probabilities
- calibrated trust persistence on `answer_runs` with confidence bands and abstention state
- streamed Phase B runtime events for `claim`, `debate_turn`, `trust`, and `abstention`
- persisted debate turns, abstentions, and verification metadata exposed through developer APIs
- deterministic document lifecycle through `uploaded → extracted → normalized → metadata_ready → awaiting_chunking → chunking → chunked → awaiting_embeddings → embedding → embedded → awaiting_index → indexing → indexed`
- resumable artifact persistence for ingestion stages
- backend and frontend test baseline still green after the milestone

Not implemented yet:
- trust badge / calibrated confidence UI
- debate panel / abstention UI
- offline calibration workflow and Phase B evaluation surfaces

A6 technical debt notes recorded for retrieval-adjacent parsing hardening:
- add file signature validation before parser execution
- add malware scanning before downstream document processing
- harden parser handling for untrusted and malformed documents

## What is Clarity?

Most AI document tools answer questions confidently — even when wrong. In a legal context, a confident wrong answer is the worst possible outcome.

Clarity is built around a different principle: **every claim must prove itself before it reaches you.** Phase A delivers the document pipeline, retrieval system, answer generation, citations, and provenance plumbing. Phase B adds the Critic, independent NLI verification, calibrated confidence, and abstention.

This is not a document-Q&A clone. The self-critique loop, the two-signal verifier, the calibrated trust score, and exact provenance are core requirements — not nice-to-haves.

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
| 3 | **Workspace-safe provenance viewer** — clicking any claim opens the source PDF at the right page with the exact extracted span beside it | The proof moment — users can verify the cited text without leaving the app |
| 4 | **Persistent contradiction graph** — cross-document conflicts are detected on ingest and browsable without asking a question | Reasoning beyond retrieval; finds "Doc A says 30 days, Doc C says 60 days" automatically |
| 5 | **Live reasoning graph + Writer↔Critic debate** — the LangGraph execution animates live; the draft→critique→revision exchange streams in real time | Trust through transparency — users watch the system catch its own errors |
| 6 | **Abstention** — when evidence is thin, the system says "I can't verify this from the documents" and shows what it would need | Knowing when *not* to answer is the correct behavior in a legal context |

---

## Demo Flow

```
1. Upload a PDF contract
2. Ask: "Does this auto-renew and how do I cancel?"
3. Watch the reasoning graph light up: Supervisor → Retriever → Writer → Critic → NLI
4. Receive a streaming, cited answer grounded in retrieved evidence
5. Click any claim → the original PDF opens at the cited page with the exact extracted support span
6. The backend runtime verifies claims, emits debate/trust events, and abstains when confidence is too low
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (Next.js 15, App Router, TypeScript, Tailwind, shadcn/ui)  │
│  · Upload UI + clause map                                            │
│  · Chat — streaming answer + clickable claims                        │
│  · Provenance panel (signed PDF + extracted cited span)              │
│  · Internal developer dashboard and explorers                        │
└────────────────────────┬────────────────────────────────────────────┘
                         │ HTTPS · REST + SSE · Clerk JWT on every call
┌────────────────────────▼────────────────────────────────────────────┐
│  FastAPI (Python, async)                                             │
│  · Auth middleware — Clerk JWKS JWT verification → workspace_id       │
│  · Rate limiting — Upstash Redis (sliding window, per user)         │
│  · Ingestion service — extract → chunk → embed → upsert             │
│  · Hybrid retrieval — semantic + BM25 → RRF → Cohere rerank → top-5 │
│  · Answer generation runtime — retrieval-backed streaming writer     │
│  · Developer-only debug APIs for chunks, embeddings, vectors,       │
│    retrieval, answers, and metrics                                  │
└──┬──────┬──────┬───────┬──────────┬───────────┬────────────────────┘
   │      │      │       │          │           │
   ▼      ▼      ▼       ▼          ▼           ▼
Pinecone Supabase Cohere OpenAI  Cloudflare  LangSmith
vectors  Postgres Rerank  LLM +   R2 files   tracing
per ns   + RLS           embed
```

### Ingestion pipeline

```
Upload → R2 storage → PDF/DOCX extraction → normalization → clause-aware chunking
→ deterministic clause persistence → embed (text-embedding-3-small, cache by hash)
→ Pinecone upsert (ws_{id} namespace) → document status: indexed
```

### Query pipeline (the core loop)

```
Request → hybrid retrieval (semantic + BM25 → RRF → Cohere rerank → top evidence)
→ answer writer drafts from cited chunks only
→ claim extraction turns the draft into atomic, evidence-backed claims
→ Critic checks each claim, optionally refines the query, and runs one bounded revision pass
→ NLI + calibration produce per-claim verdicts, trust, and abstention decisions
→ stream tokens, claims, debate turns, trust, and abstention over SSE
→ persist conversation, answer run, citations, claims, debate turns, abstentions, retrieval evidence, and replay events
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
| Frontend | Next.js 15 + TypeScript + Tailwind + shadcn/ui | App Router, SSE parsing |
| Backend | FastAPI (Python) | Async, StreamingResponse for SSE |
| Agent framework | LangGraph + LangChain | Stateful graph, conditional edges, loop cap |
| LLM | OpenAI GPT-4o-mini | Budget-first; centralized config, one flag to swap |
| Embeddings | OpenAI text-embedding-3-small (1536d) | Cost-optimized; Pinecone index = 1536 |
| Verifier (2nd signal) | NLI entailment model (DeBERTa-MNLI) | Independent of the Critic LLM — cheap, deterministic |
| Vector DB | Pinecone | Managed, namespace-per-workspace |
| Reranking | Cohere Rerank | Free tier; big RAG accuracy gain |
| Primary DB | Supabase (Postgres + RLS) | Tenancy enforced at the DB layer |
| Auth | Clerk | JWKS-based JWT verification with issuer/audience validation |
| Cache / rate limits | Upstash Redis | Semantic cache + per-tier rate limiting |
| File storage | Cloudflare R2 | Free egress, S3-compatible, signed URLs |
| Observability | LangSmith + Sentry | Request, ingestion, retrieval, and answer runtime visibility |
| Billing | Stripe | Test-mode during development |
| Deploy | Vercel (frontend) + Railway (backend) | Public live demo |
| CI/CD | GitHub Actions | pytest + tsc + vitest on every PR |

---

## Project Structure

```
clarity-docs/
├── frontend/                        # Next.js 15 app
│   ├── src/
│   │   ├── types/clarity.ts         # All shared TypeScript types
│   │   ├── lib/api.ts               # Typed API client + SSE stream
│   │   ├── components/workspace/    # Workspace dashboard UI
│   │   ├── components/upload/       # Upload UX for documents
│   │   ├── components/documents/    # Document list + cards
│   │   └── app/
│   │       ├── layout.tsx           # Clerk provider
│   │       ├── page.tsx             # Landing page
│   │       ├── (auth)/              # Protected Phase A shell
│   │       └── api/health/route.ts  # Health edge route
│   ├── package.json
│   └── tsconfig.json
│
├── backend/                         # FastAPI application
│   ├── main.py                      # App entry: middleware, routers, lifespan
│   ├── config.py                    # pydantic-settings — all env vars centralized
│   ├── schemas.py                   # Pydantic models (Claim, TrustScore, Abstention…)
│   ├── db/
│   │   └── client.py                # Supabase singleton + tenant_query guard
│   ├── api/
│   │   ├── middleware/
│   │   │   ├── auth.py              # Clerk JWT verification
│   │   │   └── rate_limit.py        # Upstash Redis sliding-window
│   │   ├── deps.py                  # Role-aware workspace guards
│   │   └── routers/
│   │       ├── health.py
│   │       ├── workspaces.py        # Phase A1 workspace APIs
│   │       └── documents.py         # Phase A2 upload + metadata APIs
│   ├── services/storage/
│   │   └── r2.py                    # Secure object storage integration
│   └── tests/
│       ├── conftest.py
│       ├── test_documents_api.py
│       ├── test_health.py
│       └── test_rls.py              # Workspace isolation tests
│
├── migrations/
│   └── 001_initial_schema.sql       # 18 tables, RLS, FK order, verifier constraint
│
├── .github/
│   └── workflows/
│       └── ci.yml                   # pytest + tsc + vitest
│
├── 00_README.md                     # Documentation reading order
├── 01_PRD.md                        # Full product requirements
├── 02_ARCHITECTURE.md               # System architecture + data flows
├── 04_API_SPEC.md                   # REST + SSE endpoint reference
└── 06_BUILD_PLAN.md                 # Phase-by-phase build order
```

---

## Database Schema (key tables)

```sql
-- 18 tables total. Highlights:

claims (                             -- verifiable answer units
  supported boolean,                 -- TRUE only if Critic AND NLI entailment agree
  entailment_label text,             -- entail | neutral | contradict
  entailment_score numeric(3,2),
  confidence numeric(3,2),           -- calibrated per-claim
  CONSTRAINT claims_supported_requires_entailment
    CHECK (NOT supported OR entailment_label = 'entail')  -- DB-enforced invariant
)

contradictions (                     -- persistent corpus-wide conflict graph
  topic text,
  doc_a uuid, span_a uuid, value_a text,
  doc_b uuid, span_b uuid, value_b text,
  severity text                      -- minor | major
)

eval_runs (                          -- CI quality gate reads these
  suite text,                        -- golden | adversarial
  faithfulness numeric(3,2),
  catch_rate numeric(3,2),           -- adversarial error catch rate
  calibration_ece numeric(3,2),      -- expected calibration error
  commit_sha text                    -- ties quality to a specific code version
)

reference_clauses (                  -- market-standard library (GLOBAL — no workspace_id)
  clause_type text,
  standard_text text,
  notes text                         -- the ONLY intentionally non-tenant table
)
```

---

## SSE Event Stream

Every query response is a typed SSE stream:

```
data: {"type":"meta","conversationId":"uuid","messageId":"uuid"}

data: {"type":"graph_node","node":"supervisor","status":"started"}
data: {"type":"graph_node","node":"retriever","status":"finished","summary":"5 spans, top rerank 0.82"}
data: {"type":"debate_turn","round":0,"actor":"writer","action":"draft","claimId":"c1"}
data: {"type":"token","claimId":"c1","text":"This contract auto-renews..."}
data: {"type":"debate_turn","round":0,"actor":"critic","action":"flag","claimId":"c3","note":"Not supported by cited span"}
data: {"type":"claim","claim":{"id":"c1","supported":true,"criticStatus":"supported","entailmentLabel":"entail","supportProbability":0.97,"contradictionProbability":0.01,"confidence":0.9}}
data: {"type":"trust","score":{"faithfulness":0.91,"relevance":0.95,"overall":0.92,"confidence":0.92,"calibrated":true,"confidenceBand":"high"}}
data: {"type":"done"}

# When evidence is thin — abstention instead of a confident wrong answer:
data: {"type":"abstention","abstention":{"reason":"No span states a cancellation window.","missingEvidenceQuery":"termination notice cancellation","suggestedFollowUp":"Ask specifically about the termination clause."}}
```

---

## API Reference (core endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check — no auth required |
| `POST` | `/api/documents` | Upload PDF/DOCX; triggers async ingestion |
| `GET` | `/api/documents` | List documents in workspace |
| `GET` | `/api/documents/{id}` | Document + clause map + risk grade |
| `GET` | `/api/documents/{id}/file` | Signed R2 URL for PDF viewer |
| `GET` | `/api/documents/{id}/risk-report` | Export risk report (PDF/CSV) |
| `POST` | `/api/chat` | **SSE stream** — the core query loop |
| `GET` | `/api/conversations/{id}` | Message history + claims |
| `GET` | `/api/claims/{id}/spans` | Resolve spans for provenance highlight |
| `GET` | `/api/contradictions` | Persistent corpus-wide contradiction graph |
| `POST` | `/api/eval/run` | Run golden eval suite (admin) |
| `POST` | `/api/eval/adversarial/run` | Run planted-error harness (admin) |
| `GET` | `/api/eval/metrics` | Eval trend data for dashboard |
| `GET` | `/api/analytics/summary` | Query volume, cost, latency, trust trend |
| `POST` | `/api/billing/checkout` | Stripe checkout session |

---

## Build Phases

| Phase | Goal | Milestone |
|-------|------|-----------|
| **0 — Scaffold** ✅ | Monorepo, config, auth, CI, DB schema | Both apps boot; CI green |
| **A — Core RAG** | Ingestion, hybrid retrieval, streaming chat | Stranger gets a cited answer; deployed publicly |
| **B — Verifier** | Two-signal Critic + NLI, calibrated confidence, abstention | Every answer has a calibrated trust score backed by two independent signals |
| **C — Eval system** | Golden dataset, RAGAS metrics, CI gate, drift dashboard | CI fails on a quality regression; public dashboard shows real faithfulness trend |
| **D — Reasoning graph** | Live LangGraph viz, debate panel, contradiction explorer | Viewer watches the agent catch its own error |
| **E — Provenance** | Bounding-box highlights, clause benchmarking, risk export | Click a claim → see the exact box in the PDF |
| **F — SaaS platform** | Multi-tenancy, Stripe billing, team roles, analytics | Two isolated workspaces; billing in test mode |
| **G — Launch** | Polish, public trace, real numbers, demo video | Launch-ready portfolio piece |

> **Depth beats breadth.** A finished **Phase A + B + C** is a far stronger portfolio piece than a half-built A→G. The evaluation system and the provable verifier are what no clone has.

---

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.11+
- Poetry 2.x (`pip install poetry`)
- Accounts: Supabase, Pinecone, Clerk, Cohere, OpenAI, Upstash, Cloudflare R2, LangSmith

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
# Backend
cd backend && poetry run pytest --tb=short -q

# Frontend
cd frontend && npm test
```

### Apply database migrations

Run `migrations/001_initial_schema.sql` in your Supabase SQL editor.

### Environment variables

All required keys are documented in `backend/.env.example` and `frontend/.env.local.example`. No defaults contain real credentials — the app fails fast on startup if a required variable is missing.

---

## Success Metrics (targets to measure, not fabricate)

| Metric | Target |
|--------|--------|
| Answer faithfulness (golden set) | ≥ 0.90 |
| Hallucination catch rate (adversarial set) | ≥ 80% of planted errors caught |
| Context precision / recall | ≥ 0.80 each |
| Trust-score calibration (ECE) | ≤ 0.10 |
| Abstention on unanswerable cases | ≥ 80% correct abstentions |
| CI quality gate | Build fails on any faithfulness regression |
| First-token P99 latency | < 1.5s |

> These are real numbers to measure and report — not targets to invent. A real-but-modest number beats a fabricated impressive one.

---

## Security

- **JWT verification on every request.** `workspace_id` is extracted from the verified token — never from the request body.
- **Three-layer tenancy.** Cross-workspace data access is impossible: blocked at the Pinecone namespace, the Postgres RLS policy, and the API middleware independently.
- **Prompt-injection guard.** Document text is treated as data, never instructions. All contract-derived content is wrapped in delimited blocks before entering any prompt.
- **Secrets never committed.** `.env` and `.env.local` are in `.gitignore` from the first commit.
- **Signed, short-lived file URLs.** R2 objects are never publicly accessible; every file access goes through a signed URL with a short TTL.
- **"Not legal advice" disclaimer on every output.** Clarity flags and explains; it does not advise.

---

## Why this is not another RAG clone

The standard document Q&A project retrieves → generates → presents. Clarity adds three layers that are genuinely hard to build:

1. **A verifier that uses two independent signals**, so no model grades its own output. The Critic can reject or downgrade claims — it cannot introduce new facts.
2. **An evaluation system that gates releases**, so quality is a test, not a vibe. The adversarial catch rate and calibration curve are real, dated numbers.
3. **A provenance view that shows the exact pixel box**, not a vague page citation — because "trust but verify" only works if verification is frictionless.

---

## Contributing

This is an actively developed portfolio project. Feedback and issues are welcome.

---

*Not legal advice. Clarity is an AI tool for information and analysis only.*
