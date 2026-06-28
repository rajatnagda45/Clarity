# 04 — API Specification

> All endpoints are under `/api`. Every request carries a Clerk JWT in `Authorization: Bearer <token>`. Middleware resolves `workspace_id` from the active workspace claim and injects it; never trust a `workspace_id` sent in a body. All list endpoints are workspace-scoped implicitly.

## Conventions
- JSON unless noted. Errors: `{ "error": { "code": string, "message": string } }` with appropriate HTTP status.
- Timestamps ISO-8601 UTC.
- Rate limited per tier (Upstash). 429 on exceed with `Retry-After`.

---

## Auth & workspace

### `GET /api/me`
Returns the current user and their workspaces.
```json
{ "userId": "user_…", "workspaces": [ { "id": "uuid", "name": "Acme", "role": "owner", "plan": "free" } ] }
```

### `POST /api/workspaces`
Create a workspace. Body `{ "name": "Acme" }` → returns the workspace. Creator becomes `owner`.

### `POST /api/workspaces/{id}/invites`
Body `{ "email": "x@y.com", "role": "editor" }`. Owner/editor only.

---

## Documents

### `POST /api/documents`
Upload a document. `multipart/form-data` with `file`, OR JSON `{ "url": "https://…" }`.
Response (202):
```json
{ "id": "uuid", "filename": "msa.pdf", "status": "processing" }
```
Triggers the async ingestion pipeline (see `02_ARCHITECTURE.md` §2.1).

### `GET /api/documents`
List documents in the workspace.
```json
{ "documents": [ { "id": "uuid", "filename": "msa.pdf", "status": "ready", "pageCount": 14, "createdAt": "…" } ] }
```

### `GET /api/documents/{id}`
Single document with its clause map.
```json
{
  "id": "uuid", "filename": "msa.pdf", "status": "ready", "pageCount": 14,
  "riskGrade": "C",
  "clauses": [
    { "id": "uuid", "clauseType": "renewal", "text": "...", "page": 4, "riskFlag": "flagged",
      "rationale": "Auto-renews 12mo; 60-day notice.",
      "benchmarkMatchId": "uuid", "deviationNote": "Notice window 2× the market-standard 30 days.", "riskScore": 0.78 }
  ]
}
```

### `GET /api/documents/{id}/file`
Returns a short-lived signed R2 URL for the original (used by the provenance PDF viewer).
```json
{ "url": "https://r2-signed…", "expiresAt": "…" }
```

### `DELETE /api/documents/{id}`
Deletes the document, its chunks (Postgres), and vectors (Pinecone namespace). Owner/editor only.

---

## Chat (the core loop)

### `POST /api/chat` — **SSE stream**
Body:
```json
{ "conversationId": "uuid|null", "query": "Does this auto-renew and how do I cancel?", "documentIds": ["uuid", "..."] }
```
- If `conversationId` is null, a new conversation is created and its id is returned in the first `meta` event.
- `documentIds` optional; if omitted, search spans the whole workspace.

**Response:** `text/event-stream`. Events (each line `data: <json>\n\n`):

```
data: {"type":"meta","conversationId":"uuid","messageId":"uuid"}

data: {"type":"graph_node","node":"supervisor","status":"started"}
data: {"type":"graph_node","node":"supervisor","status":"finished","summary":"route=single_doc_qa"}
data: {"type":"graph_node","node":"retriever","status":"started"}
data: {"type":"graph_node","node":"retriever","status":"finished","summary":"5 spans, top rerank 0.82"}
data: {"type":"graph_node","node":"writer","status":"started"}
data: {"type":"debate_turn","round":0,"actor":"writer","action":"draft","claimId":"c1","note":"Drafted 3 claims"}
data: {"type":"token","claimId":"c1","text":"This contract "}
data: {"type":"token","claimId":"c1","text":"auto-renews for 12 months "}
data: {"type":"claim","claim":{"id":"c1","text":"This contract auto-renews for 12 months unless cancelled 60 days prior.","spanIds":["chunk-uuid"],"supported":true,"uncertain":false,"entailmentLabel":"entail","entailmentScore":0.94,"confidence":0.9}}
data: {"type":"graph_node","node":"critic","status":"started"}
data: {"type":"debate_turn","round":0,"actor":"critic","action":"flag","claimId":"c3","note":"Claim on p.4 not supported by cited span"}
data: {"type":"graph_node","node":"critic","status":"finished","summary":"3 claims checked, 1 downgraded (Critic+entailment agreed)"}
data: {"type":"trust","score":{"faithfulness":0.91,"relevance":0.95,"overall":0.92,"confidence":0.9,"calibrated":true}}
data: {"type":"done"}
```

**Abstention case** — when calibrated confidence is below threshold, the stream ends with an `abstention` instead of asserting:
```
data: {"type":"abstention","abstention":{"reason":"No retrieved span states a cancellation window.","missingEvidenceQuery":"termination notice period cancellation"}}
data: {"type":"done"}
```

> The Critic may emit a revised `claim` event (same `claimId`) flipping `supported`/`uncertain` after verification, along with a `debate_turn` describing the revision. The frontend updates in place. A claim is `supported:true` only when the Critic *and* the NLI entailment check agree (see `10_VERIFICATION.md`). Faithfulness in the `trust` event is the *fast* verifier-derived signal and is **calibrated**; the slower async judge writes the authoritative score to `answer_evals` (fetch via the eval endpoint).

### `GET /api/conversations/{id}`
Full message history with claims.
```json
{ "id": "uuid", "messages": [
  { "id": "uuid", "role": "user", "content": "…" },
  { "id": "uuid", "role": "assistant", "content": "…", "claims": [ /* Claim[] */ ], "trust": { "faithfulness": 0.91, "relevance": 0.95, "overall": 0.92 } }
] }
```

---

## Provenance

### `GET /api/claims/{id}/spans`
Resolve a claim's supporting spans for the highlight view.
```json
{ "spans": [ { "chunkId":"uuid","documentId":"uuid","page":4,"charStart":1203,"charEnd":1361,"text":"…","rerankScore":0.82 } ] }
```
The frontend loads the signed PDF (`/documents/{id}/file`), navigates to `page`, and highlights `[charStart,charEnd]`.

---

## Conflict detection

### `POST /api/conflicts`
On-demand, query-scoped conflict detection. Body `{ "query": "termination terms", "documentIds": ["a","b","c"] }`.
```json
{ "conflicts": [
  { "topic": "termination notice", "positions": [
      { "documentId":"a","value":"30 days","spanId":"…" },
      { "documentId":"c","value":"60 days","spanId":"…" } ],
    "note": "Doc C requires double the notice of Doc A." }
] }
```

### `GET /api/contradictions`
The **persistent corpus-wide contradiction graph** for the workspace, built on ingest — browsable without asking a question. Optional `?topic=` and `?severity=major` filters.
```json
{ "contradictions": [
  { "id":"uuid","topic":"termination notice period","severity":"major",
    "positions":[
      { "documentId":"a","value":"30 days","spanId":"…" },
      { "documentId":"c","value":"60 days","spanId":"…" } ],
    "note":"Doc C requires double the notice of Doc A." }
] }
```

---

## Evaluation & analytics

### `GET /api/messages/{id}/eval`
Authoritative async judge score (may lag the streamed `trust` event by seconds).
```json
{ "faithfulness":0.90,"relevance":0.93,"contextPrecision":0.85,"contextRecall":0.82,"overall":0.91,"judgeNotes":"All claims grounded." }
```

### `POST /api/eval/run`
Runs the **golden offline suite** (RAGAS-style metrics) and records an `eval_runs` row. Admin only. Body `{ "suite":"golden", "commitSha":"abc123" }`.
```json
{ "runId":"uuid","suite":"golden","casesTotal":80,"faithfulness":0.89,"relevance":0.92,"contextPrecision":0.84,"contextRecall":0.81,"calibrationEce":0.07 }
```

### `POST /api/eval/adversarial/run`
Runs the planted-error harness; a claim counts as "caught" only when the two-signal verifier flags it (see `05_AGENT_LOGIC.md` §6 and `09_EVAL_SYSTEM.md`). Admin only.
```json
{ "runId":"uuid","casesTotal":40,"caught":34,"catchRate":0.85 }
```

### `GET /api/eval/metrics?range=90d`
Time series powering the eval dashboard (trend, calibration, drift). Reads `eval_runs` + `quality_rollups`.
```json
{
  "runs":[ {"date":"…","suite":"golden","faithfulness":0.89,"catchRate":0.85,"calibrationEce":0.07,"commitSha":"abc123"} ],
  "drift":[ {"date":"…","avgFaithfulness":0.90,"abstentionRate":0.06,"n":120} ],
  "calibrationCurve":[ {"bucket":0.8,"predicted":0.8,"empirical":0.78} ]
}
```

> **CI quality gate:** the GitHub Actions workflow calls `POST /api/eval/run` (and the adversarial run) against a frozen sample, compares to the last green `eval_runs` row, and fails the build if faithfulness or catch rate regresses past the threshold. See `09_EVAL_SYSTEM.md`.

### `GET /api/analytics/summary?range=30d`
```json
{ "queryVolume":[…], "tokenCost":[…], "latencyP99Ms":780, "trustTrend":[ {"date":"…","overall":0.90} ], "abstentionRate":0.06 }
```

---

## Export

### `POST /api/export/report`
Body `{ "conversationId":"uuid", "format":"pdf|csv" }`. Returns a signed URL to the generated risk report (flagged clauses, explanations, trust scores, source pages).

### `GET /api/documents/{id}/risk-report?format=pdf|csv`
Document-level risk report independent of any conversation: every flagged/non-standard clause with its market-standard deviation, `riskScore`, overall `riskGrade`, and source pages. Returns a signed URL.
```json
{ "url": "https://r2-signed…", "expiresAt": "…" }
```

---

## Billing

### `POST /api/billing/checkout`
Body `{ "plan":"pro|team" }` → `{ "checkoutUrl":"https://checkout.stripe.com/…" }`.

### `POST /api/billing/webhook`
Stripe webhook (no JWT; verify Stripe signature). Updates `subscriptions`. Handle `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.

Next: `05_AGENT_LOGIC.md`.
