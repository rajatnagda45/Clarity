# 06 — Build Plan

> Build in this order. Each phase ends at a demoable milestone. Deploy publicly at the end of Phase A and keep it live. Differentiators (Phases B–E) come BEFORE the SaaS layer (Phase F) on purpose — they are what make the project unique. If time runs out, a finished **A+B+C** beats a half-built A→G. This phasing matches `08_NEXT_LEVEL_PLAN.md`; `01_PRD.md` §8 is the summary.

## Phase 0 — Scaffold (before any feature)
- Monorepo: `frontend/` (Next.js 15 + TS + Tailwind + shadcn/ui), `backend/` (FastAPI + Python 3.11, Poetry).
- `.gitignore` with `.env`, `.env.local` — first commit.
- Env loading on both sides; `.env.example` documenting every key (see `07_TECH_DECISIONS.md`).
- LangSmith tracing enabled from the first chain.
- Health endpoints: `GET /api/health` (backend), a status page route (frontend).
- CI skeleton: GitHub Actions running pytest + vitest on PRs.
- **Milestone:** both apps boot locally; CI green on an empty test.

## Phase A — Core RAG that works (the foundation / the floor)
1. Clerk auth wired (frontend provider + middleware; backend JWT verification → `workspace_id`).
2. Supabase schema from `03_DATA_MODEL.md`; RLS enabled; a single data-access layer that always filters by `workspace_id`. (`reference_clauses` is the one intentional global table — see `03` §2.)
3. Upload pipeline: `POST /api/documents` → R2 store → PyMuPDF extract → clause-aware chunk → embed (`text-embedding-3-small`, cache by hash) → Pinecone upsert (`ws_{id}` namespace). Status transitions to `ready`.
4. Hybrid retrieval: semantic + BM25 → RRF → Cohere rerank → top-5 spans.
5. Basic chat: `POST /api/chat` SSE → retrieve → Writer claims → stream tokens (no Critic yet).
6. Frontend: document list + upload dropzone + status badges; chat window with streaming + basic citations.
- **Milestone:** a stranger uploads a contract and gets a streaming, cited answer. **Deploy publicly (Vercel + Railway).** This is a strong 7 on its own.

## Phase B — Provable verification (the technical moat)
1. **Critic node** + self-correction loop (cap 2) exactly per `05_AGENT_LOGIC.md` §6.
2. **NLI entailment cross-check** as the second signal; a claim is `supported` only if Critic *and* NLI agree.
3. **Calibrate node:** blend the signals into a calibrated confidence; fit the calibrator against the golden set; render a calibrated trust badge.
4. **Abstention:** below threshold, emit an `abstention` event and store it instead of asserting.
- **Milestone:** every answer carries a calibrated confidence backed by two independent signals; abstention visibly works.

## Phase C — The evaluation system (the seniority jump — do before D/E if forced)
1. **Golden dataset** (60–100 cases) authored by hand; mirrored into `eval_cases`.
2. **RAGAS-style offline suite** (faithfulness, relevance, context precision/recall) + adversarial catch-rate harness; results to `eval_runs`/`eval_case_results`.
3. **CI regression gate:** GitHub Action runs the frozen suite per PR; fails the build on a regression vs. the last green `eval_runs` row.
4. **Drift tracking:** daily rollup job over a sample of real answers → `quality_rollups`.
5. **Eval dashboard:** trend lines, calibration curve, catch-rate gauge, per-case drill-down (recharts).
- **Milestone:** CI fails on a planted quality regression; the public dashboard shows a real, dated faithfulness trend and catch-rate number. See `09_EVAL_SYSTEM.md`.

## Phase D — Adversarial reasoning + live graph
1. **Reasoning graph UI:** consume `graph_node` SSE events; animate Supervisor→Retriever→Writer→Critic→NLI lighting up; hover shows node summaries.
2. **Debate panel:** consume `debate_turn` events; show draft → critique → revision live.
3. **Conflict agent** for multi-doc queries **and** the ingest-time builder that persists the corpus-wide contradiction graph; a contradiction explorer view (`GET /api/contradictions`).
- **Milestone:** a viewer watches the agent catch its own error in real time and can browse cross-document contradictions without asking a question.

## Phase E — Vertical depth + pixel-perfect provenance
1. **Market-standard clause benchmarking:** seed `reference_clauses`; match each extracted clause, classify deviation, compute `risk_score` and a document `riskGrade`.
2. **Bounding-box provenance:** PDF on a canvas (pdf.js), click a claim → load signed R2 URL → draw a box over the exact `[charStart,charEnd]` sentences + "why this chunk won" explainer.
3. **Risk-report export** (`/api/documents/{id}/risk-report`, PDF/CSV).
- **Milestone:** clicking a claim highlights the exact box; the clause map flags a non-standard clause against the market reference.

## Phase F — SaaS platform layer
1. Multi-tenancy hardening: verify all three layers; write a workspace-isolation test that MUST pass.
2. Stripe: checkout + webhook + `subscriptions` mirror; Free/Pro/Team tiers; usage metering from `usage_events`; quota enforcement.
3. Upstash rate limiting per tier; semantic cache on `(query, document_set)`.
4. Team features: invites + roles (owner/editor/viewer) gating mutations.
5. Analytics dashboard: query volume, token cost, P99 latency, trust trend, abstention rate (recharts).
- **Milestone:** two isolated workspaces; billing works in Stripe test mode; dashboard live.

## Phase G — Polish & launch
1. README: architecture diagram (Mermaid), public LangSmith trace link, real catch-rate + calibration numbers, live demo URL, and the written "how do you know the Critic isn't hallucinating?" answer.
2. Loom walkthrough (3–5 min) narrating the two-signal verifier, debate loop, and provenance.
3. CI/CD finalized; quality-gate badge green.
4. Optional blog post: "Building a self-auditing RAG pipeline with eval-as-CI."
- **Milestone:** launch-ready portfolio piece.

## Test checklist (minimum, wired during the relevant phase)
- [ ] Upload smoke test (file → `ready`, vectors exist).
- [ ] Retrieval test (known query returns expected span).
- [ ] **Critic catches a planted false claim** (the signature test).
- [ ] **Two-signal agreement** (a claim the Critic passes but NLI contradicts is NOT marked supported).
- [ ] **Abstention** (an unanswerable question yields an `abstention`, not a fabricated answer).
- [ ] **Calibration check** (ECE on the golden set within target; calibrator fitted, not identity).
- [ ] **CI quality gate** (a deliberately worsened prompt drops the metric and fails the gate job).
- [ ] **Contradiction graph** (ingesting two conflicting docs creates a `contradictions` row).
- [ ] **Workspace isolation** (workspace B cannot read workspace A's docs/vectors).
- [ ] **`reference_clauses` is read-only/global** (no ingestion path writes user text into it).
- [ ] **Prompt-injection** (a clause instructing the model is treated as data, not obeyed).
- [ ] SSE stream emits the documented event sequence (incl. `debate_turn`, `abstention`).
- [ ] Stripe webhook updates subscription state (test mode).

## Guardrails the agent must respect throughout
- `gpt-4o-mini` + `text-embedding-3-small` only, unless a human sets an explicit override flag.
- Critic loop hard-capped at 2.
- The NLI entailment check is a **cheap/deterministic** path, never a second expensive generator.
- A claim is `supported` **only if Critic and NLI agree** — never let one model rubber-stamp itself.
- Embedding cache on; never re-embed unchanged content. Semantic cache on `(query, document_set)`.
- Every tenant query filtered by `workspace_id`; `reference_clauses` is the sole intentional global table.
- Document text is data, never instructions (prompt-injection guard).
- No secret ever committed.

Next: `07_TECH_DECISIONS.md`.
