# 02 — System Architecture

> Read after `01_PRD.md`. This describes how the system is structured and how data flows. Component-level contracts are in `03_DATA_MODEL.md` and `04_API_SPEC.md`.

## 1. High-level shape

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Next.js 15, App Router, TS, Tailwind, shadcn/ui)  │
│  - Upload UI / clause map                                    │
│  - Chat with streamed answer + claims                        │
│  - Reasoning graph (live LangGraph node states)              │
│  - Provenance panel (PDF render + highlight)                 │
│  - Trust-score + eval dashboard                              │
└───────────────┬─────────────────────────────────────────────┘
                │ HTTPS (REST + SSE), Clerk JWT on every call
┌───────────────▼─────────────────────────────────────────────┐
│  FastAPI (Python 3.11, async)                                │
│  - Auth middleware (verify Clerk JWT → workspace_id)         │
│  - Rate limiting (Upstash Redis)                             │
│  - Ingestion service                                         │
│  - Retrieval service (hybrid: semantic + BM25 + RRF + rerank)│
│  - LangGraph agent runtime (Supervisor/Retriever/Writer/     │
│    Critic/Conflict)                                          │
│  - Verification service (Critic + NLI entailment ensemble,   │
│    confidence calibration, abstention)                       │
│  - Eval service (golden suite + async judge + drift rollups) │
│  - Semantic cache (query → spans → answer)                   │
│  - Billing/webhooks (Stripe)                                 │
└──┬───────┬────────┬─────────┬──────────┬─────────┬──────────┘
   │       │        │         │          │         │
   ▼       ▼        ▼         ▼          ▼         ▼
Pinecone  Supabase  Cohere   OpenAI    Cloudflare LangSmith
(vectors  (Postgres Rerank   (LLM +    R2         (tracing)
per ns)   +RLS+     API      embed)    (files)
          Storage)
```

## 2. Two primary pipelines

### 2.1 Ingestion pipeline (async, runs on upload)
1. **Receive** file (PDF/DOCX) or URL at `POST /documents`. Store original in Cloudflare R2; create `documents` row with status `processing`.
2. **Extract** text + layout with PyMuPDF (`fitz`), preserving page numbers and character spans. For DOCX, convert/parse to the same normalized block structure.
3. **Segment** into clause-aware chunks (respect section/clause boundaries; never split mid-clause when avoidable). Each chunk records `doc_id`, `page`, `char_start`, `char_end`, `text`.
4. **Embed** each chunk with `text-embedding-3-small` (1536d). Cache by content hash so unchanged chunks are never re-embedded.
5. **Upsert** vectors into Pinecone under namespace `ws_{workspace_id}` with metadata `{doc_id, chunk_id, page, char_start, char_end}`.
6. **Build BM25** index data (store tokenized chunks for keyword scoring; rebuildable from Postgres).
7. **Extract clause map** via a structured LLM call → typed rows in `clauses` (clause_type, text, page, risk_flag).
8. **Benchmark clauses** against the global `reference_clauses` library: for each clause, find the closest market-standard version, classify normal / non_standard / flagged, and store `benchmark_match_id`, `deviation_note`, `risk_score` (see `05_AGENT_LOGIC.md`).
9. **Rebuild contradiction graph** for the workspace: compare the new document's clauses against existing ones and upsert `contradictions` rows (topic, doc_a/span_a vs doc_b/span_b, severity). This makes cross-document conflicts browsable without a query.
10. **Mark** document `ready`; emit status updates the frontend polls or receives via SSE.

### 2.2 Query pipeline (the core loop)
1. `POST /chat` (SSE) with `{workspace_id, conversation_id, query}`.
2. **Semantic cache** check: if a normalized `(query, document_set)` hit exists and is fresh, replay the cached answer + spans (still re-stream the graph for UX). Otherwise continue.
3. **Supervisor** classifies the query → route: `single_doc_qa | multi_doc_compare | clause_audit`.
4. **Retriever** runs hybrid retrieval (see §3) → top-5 spans with scores.
5. **Writer** drafts an answer as a list of discrete **claims**, each linked to the span IDs that support it.
6. **Critic** verifies every claim against its cited spans; a parallel **NLI entailment check** scores each `(claim, span)` pair (entail / neutral / contradict). A claim is **supported only if both agree**:
   - Both agree supported → keep.
   - Disagree or unsupported → either trigger **re-retrieval** (max 2 loops) with a refined query, or mark the claim **uncertain** and strip the unsupported assertion.
7. **Confidence calibration:** blend (fraction supported, min rerank score, entailment margin, Critic↔entailment agreement) into a calibrated confidence. If below the abstention threshold → emit an **abstention** ("can't verify from the documents") and record it.
8. **Conflict agent** (only for multi-doc routes) detects contradictions across documents and updates the persistent contradiction graph.
9. Stream to client, in order: reasoning-graph node events + debate turns → answer claims (token stream) → final calibrated trust badge (or abstention).
10. **Eval service** (async, non-blocking) runs LLM-as-judge for faithfulness + relevance, writes scores to `answer_evals`; a rolling sample feeds daily drift rollups.
11. **Semantic cache** write: store `(query, document_set) → {spans, claims, trust}` for replay.

## 3. Hybrid retrieval detail
- Run **semantic** (Pinecone, namespace-scoped) and **BM25** (keyword) searches in parallel, each returning ~20 candidates.
- Merge with **Reciprocal Rank Fusion** (RRF, k=60).
- Send merged top-20 to **Cohere Rerank**; keep **top-5**.
- Each surviving span carries: `doc_id, page, char_start, char_end, text, semantic_score, rerank_score`. These spans are the *only* evidence the Writer and Critic may use.

## 4. Streaming model (SSE)
A single SSE stream per query emits typed events. Event types:
- `graph_node` — `{node, status: started|finished, summary}` (drives the live reasoning graph)
- `debate_turn` — `{round, actor: writer|critic, action, claim_id?, note}` (drives the live debate panel)
- `token` — `{claim_id, text}` (answer text streaming)
- `claim` — `{claim_id, text, span_ids, supported, uncertain, entailment_label, confidence}`
- `trust` — `{faithfulness, relevance, overall, confidence, calibrated: true}` (final badge)
- `abstention` — `{reason, missing_evidence_query}` (emitted instead of a confident answer when below threshold)
- `done` — end of stream
See `04_API_SPEC.md` for exact payloads.

## 5. Multi-tenancy enforcement (three layers — all required)
1. **Pinecone namespace** `ws_{workspace_id}` — vector search is physically scoped; cross-workspace retrieval is impossible.
2. **Postgres RLS** — every table with tenant data has a policy filtering by `workspace_id` from the request's JWT claim. Enforced at the DB, not the app.
3. **API middleware** — extracts and validates `workspace_id` from the Clerk JWT, injects it into every service call; mismatched claims fail validation. See `03_DATA_MODEL.md` for the RLS policies.

## 6. Component responsibilities (where code lives)
| Service | Responsibility | Key files (suggested) |
|---------|---------------|----------------------|
| `ingestion` | extract → chunk → embed → upsert → clause map → benchmark → contradiction graph | `backend/services/ingestion/` |
| `retrieval` | hybrid search + rerank | `backend/services/retrieval/` |
| `agents` | LangGraph graph, nodes, prompts | `backend/agents/` |
| `verification` | Critic+NLI ensemble, confidence calibration, abstention | `backend/services/verification/` |
| `benchmark` | clause-vs-reference matching + risk scoring | `backend/services/benchmark/` |
| `eval` | golden suite, async judge, drift rollups, adversarial harness, CI gate | `backend/services/eval/` |
| `cache` | semantic cache (query → spans → answer) | `backend/services/cache/` |
| `billing` | Stripe checkout + webhooks + metering | `backend/services/billing/` |
| `api` | routers, SSE, auth/rate-limit middleware | `backend/api/` |
| frontend chat | chat, claims, SSE parsing | `frontend/src/components/chat/` |
| frontend graph | reasoning graph + debate viz | `frontend/src/components/graph/` |
| frontend provenance | PDF canvas render + bounding-box highlight | `frontend/src/components/provenance/` |
| frontend eval | eval dashboard, calibration curve, drill-down | `frontend/src/components/eval/` |
| frontend conflicts | corpus contradiction explorer | `frontend/src/components/conflicts/` |

## 7. Failure & cost guards
- Critic re-retrieval capped at **2** loops.
- The NLI entailment check is a **cheap, deterministic** path (small hosted NLI model or a constrained mini call), not a second expensive generator — it adds a cross-signal without doubling cost.
- Hard per-request token ceiling; abort with a graceful "couldn't verify" abstention if exceeded.
- **Semantic cache** on `(query, document_set)` — repeat questions skip the LLM path entirely.
- Embedding cache by content hash.
- Upstash rate limits per tier.
- OpenAI dashboard hard spend cap ($25). See `07_TECH_DECISIONS.md`.

Next: `03_DATA_MODEL.md`.
