# Clarity — Documentation Package (READ THIS FIRST)

> **You are a coding agent (Claude Code / Codex). This folder is your complete brief for building the Clarity application. Read every file in order before writing code.**

## What you are building

**Clarity** is a self-auditing contract intelligence SaaS. Users upload commercial contracts (SaaS agreements, vendor contracts, NDAs, leases) and ask questions in plain English. The system answers with verifiable, self-audited responses — every claim is checked against the source text by a Critic agent before it reaches the user, every answer carries a measured trust score, and clicking any claim highlights the exact supporting sentences in the original PDF.

**One-line pitch:** *An AI contract auditor that catches its own hallucinations, proves every claim against the source text, and shows you a measured trust score.*

This is NOT a generic document-Q&A clone. The defining features — the **Critic self-critique loop**, the **visible trust score**, the **provenance view**, and the **conflict detection** — are what make it unique. Treat them as core requirements, not nice-to-haves.

## Reading order

| # | File | What it gives you |
|---|------|-------------------|
| 00 | `00_README.md` | This file — orientation and conventions |
| 01 | `01_PRD.md` | Product requirements: what to build and why, scope, personas, success metrics |
| 02 | `02_ARCHITECTURE.md` | System architecture, request flows, component responsibilities |
| 03 | `03_DATA_MODEL.md` | Postgres schema, Pinecone layout, RLS policies, TypeScript/Pydantic types |
| 04 | `04_API_SPEC.md` | Every REST + SSE endpoint with request/response shapes |
| 05 | `05_AGENT_LOGIC.md` | LangGraph state, node logic, the Critic loop, exact prompts |
| 06 | `06_BUILD_PLAN.md` | Phased, milestone-driven build order. Build in this sequence. |
| 07 | `07_TECH_DECISIONS.md` | Stack choices, cost constraints, environment, conventions |
| 08 | `08_NEXT_LEVEL_PLAN.md` | The differentiator-depth layer: how the base becomes a 10/10. Read for the *why* behind the upgrades below. |
| 09 | `09_EVAL_SYSTEM.md` | The evaluation platform in depth: golden dataset, RAGAS-style metrics, the CI quality gate, drift tracking. |
| 10 | `10_VERIFICATION.md` | The two-signal verifier in depth: Critic + entailment ensemble, confidence calibration, abstention, the interview answer. |
| 11 | `11_AI_ENGINEERING_RULES.md` | **The engineering constitution. Read before writing a single line of code. Non-negotiable.** |
| 12 | `12_EXECUTION_ROADMAP.md` | Complete phase-by-phase build roadmap: goals, tasks, tests, risks, file counts, and build order for all 8 phases. |
| 13 | `13_DEPENDENCY_GRAPH.md` | Full dependency graph: what depends on what, parallel build tracks, API-before-frontend map, file creation order, and external service provisioning order. |

## Hard constraints (apply to all work)

1. **OpenAI-first, budget-bound.** Use `gpt-4o-mini` for all LLM calls in development and `text-embedding-3-small` (1536 dims) for embeddings. The developer has a $25 OpenAI key. Do not call expensive models without an explicit flag. See `07_TECH_DECISIONS.md`.
2. **Never commit secrets.** All keys load from environment variables. Add `.env`, `.env.local` to `.gitignore` in the first commit.
3. **Multi-tenancy is non-negotiable.** Every data access is scoped by `workspace_id` at three layers (Pinecone namespace, Postgres RLS, API middleware). Never write a query that can leak across workspaces.
4. **The Critic loop must be real.** The Critic checks claims against *retrieved source spans only* — it can reject or downgrade a claim but can never introduce new facts. This is the project's core integrity guarantee.
5. **Cap agent loops.** Critic re-retrieval is capped at 2 iterations to bound cost and latency.
6. **Not legal advice.** Every user-facing answer carries a disclaimer. The product flags and explains; it does not advise.
7. **The verifier is a two-signal ensemble.** A claim is "supported" only when the Critic LLM *and* an independent NLI entailment check agree it is grounded in the retrieved spans. Never let a single model judge its own output — this is the answer to "how do you know the Critic isn't hallucinating?" See `10_VERIFICATION.md`.
8. **Answer quality is gated in CI.** A frozen eval suite runs on every PR; if faithfulness or the adversarial catch rate regresses below the last green threshold, the build fails. Quality is a test, not a vibe. See `09_EVAL_SYSTEM.md`.
9. **Calibrated trust, with abstention.** The trust score is calibrated against a golden set so "0.8" means ~80% empirically correct; when confidence is below threshold the system abstains ("I can't verify this from the documents") rather than guessing.

## Conventions

- **Monorepo:** `frontend/` (Next.js 15 + TypeScript) and `backend/` (FastAPI + Python 3.11).
- **Naming:** snake_case in Python and Postgres, camelCase in TypeScript, kebab-case for files in frontend where idiomatic.
- **Every LLM call is traced** via LangSmith. Wire this from the first chain.
- **Tests:** pytest (backend), vitest (frontend). At minimum: an upload smoke test, a retrieval test, a Critic-catches-planted-error test, and a workspace-isolation test.

## Definition of done for v1

A stranger can open the public URL, sign up, upload a contract, ask "does this auto-renew and how do I cancel?", watch the reasoning graph run, receive a cited answer with a **calibrated trust score**, click a claim to see the **bounding-box-highlighted** source text, and export a risk report — all without it breaking. When the evidence is thin, the system **abstains** instead of guessing. Two separate workspaces cannot see each other's data. A **public eval dashboard** shows a real, dated faithfulness trend; one public LangSmith trace and one adversarial-eval catch-rate number exist; and the **CI quality gate** is green on the live build.

Now read `01_PRD.md`.
