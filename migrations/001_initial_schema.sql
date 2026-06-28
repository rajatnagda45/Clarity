-- =============================================================================
-- Migration 001 — Initial schema
-- Creation order respects FK dependencies:
--   workspaces → memberships, documents
--   reference_clauses (no FK deps) → clauses (FK to reference_clauses + documents)
--   documents → chunks, clauses, conversations, contradictions
--   conversations → messages → claims, answer_evals, abstentions, debate_turns
--   eval_runs → eval_case_results; eval_cases → eval_case_results
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. WORKSPACES (tenant root)
-- ---------------------------------------------------------------------------
create table workspaces (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  owner_user_id text not null,        -- Clerk user id
  plan          text not null default 'free' check (plan in ('free', 'pro', 'team')),
  created_at    timestamptz not null default now()
);

alter table workspaces enable row level security;
create policy workspaces_tenant_isolation on workspaces
  using (id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 2. MEMBERSHIPS
-- ---------------------------------------------------------------------------
create table memberships (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  user_id       text not null,
  role          text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  created_at    timestamptz not null default now(),
  unique (workspace_id, user_id)
);

alter table memberships enable row level security;
create policy memberships_tenant_isolation on memberships
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 3. REFERENCE_CLAUSES (global, intentionally NOT tenant-scoped)
-- The ONE table without workspace_id. Read-only market-standard reference data.
-- Never write user contract text here — that would be a cross-tenant leak.
-- Must be created before `clauses` because clauses.benchmark_match_id references it.
-- ---------------------------------------------------------------------------
create table reference_clauses (
  id            uuid primary key default gen_random_uuid(),
  clause_type   text not null,         -- termination | renewal | liability | payment | ip | confidentiality | other
  standard_text text not null,
  notes         text,
  created_at    timestamptz not null default now()
);
-- No RLS — this is intentionally public, read-only reference data.
-- Protect at the API layer: expose read-only, never accept writes from user flows.

-- ---------------------------------------------------------------------------
-- 4. DOCUMENTS
-- ---------------------------------------------------------------------------
create table documents (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  filename      text not null,
  source_type   text not null check (source_type in ('pdf', 'docx', 'url')),
  r2_key        text not null,
  page_count    int,
  status        text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  error         text,
  created_at    timestamptz not null default now()
);

create index on documents (workspace_id);
alter table documents enable row level security;
create policy documents_tenant_isolation on documents
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 5. CHUNKS
-- ---------------------------------------------------------------------------
create table chunks (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  document_id   uuid not null references documents(id) on delete cascade,
  page          int not null,
  char_start    int not null,
  char_end      int not null,
  text          text not null,
  content_hash  text not null,
  bm25_tokens   text,
  created_at    timestamptz not null default now()
);

create index on chunks (document_id);
create index on chunks (workspace_id);
alter table chunks enable row level security;
create policy chunks_tenant_isolation on chunks
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 6. CLAUSES (structured clause map + market benchmarking)
-- ---------------------------------------------------------------------------
create table clauses (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references workspaces(id) on delete cascade,
  document_id        uuid not null references documents(id) on delete cascade,
  clause_type        text not null,
  text               text not null,
  page               int not null,
  risk_flag          text not null default 'normal' check (risk_flag in ('normal', 'non_standard', 'flagged')),
  rationale          text,
  benchmark_match_id uuid references reference_clauses(id),
  deviation_note     text,
  risk_score         numeric(3,2) check (risk_score between 0.00 and 1.00),
  created_at         timestamptz not null default now()
);

create index on clauses (document_id);
create index on clauses (workspace_id);
alter table clauses enable row level security;
create policy clauses_tenant_isolation on clauses
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 7. CONVERSATIONS + MESSAGES
-- ---------------------------------------------------------------------------
create table conversations (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  title         text,
  created_at    timestamptz not null default now()
);

alter table conversations enable row level security;
create policy conversations_tenant_isolation on conversations
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

create table messages (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index on messages (conversation_id);
alter table messages enable row level security;
create policy messages_tenant_isolation on messages
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 8. CLAIMS (verifiable units; supported only if Critic AND NLI agree)
-- ---------------------------------------------------------------------------
create table claims (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  message_id       uuid not null references messages(id) on delete cascade,
  text             text not null,
  span_ids         uuid[] not null default '{}',
  supported        boolean not null default false,
  uncertain        boolean not null default false,
  entailment_label text check (entailment_label in ('entail', 'neutral', 'contradict')),
  entailment_score numeric(3,2) check (entailment_score between 0.00 and 1.00),
  confidence       numeric(3,2) check (confidence between 0.00 and 1.00),
  -- Invariant: supported=true requires both Critic approval AND entailment_label='entail'
  constraint claims_supported_requires_entailment
    check (not supported or entailment_label = 'entail'),
  created_at       timestamptz not null default now()
);

create index on claims (message_id);
alter table claims enable row level security;
create policy claims_tenant_isolation on claims
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 9. ANSWER EVALS (LLM-as-judge scores; RAGAS-style metrics)
-- ---------------------------------------------------------------------------
create table answer_evals (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  message_id        uuid not null references messages(id) on delete cascade,
  faithfulness      numeric(3,2) check (faithfulness between 0.00 and 1.00),
  relevance         numeric(3,2) check (relevance between 0.00 and 1.00),
  context_precision numeric(3,2) check (context_precision between 0.00 and 1.00),
  context_recall    numeric(3,2) check (context_recall between 0.00 and 1.00),
  overall           numeric(3,2) check (overall between 0.00 and 1.00),
  judge_notes       text,
  created_at        timestamptz not null default now()
);

alter table answer_evals enable row level security;
create policy answer_evals_tenant_isolation on answer_evals
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 10. ABSTENTIONS
-- ---------------------------------------------------------------------------
create table abstentions (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null references workspaces(id) on delete cascade,
  message_id             uuid not null references messages(id) on delete cascade,
  reason                 text not null,
  missing_evidence_query text,
  created_at             timestamptz not null default now()
);

alter table abstentions enable row level security;
create policy abstentions_tenant_isolation on abstentions
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 11. DEBATE TURNS (Writer↔Critic exchange, persisted + streamed live)
-- ---------------------------------------------------------------------------
create table debate_turns (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  message_id    uuid not null references messages(id) on delete cascade,
  round         int not null check (round between 0 and 2),
  actor         text not null check (actor in ('writer', 'critic')),
  action        text not null check (action in ('draft', 'flag', 'revise', 'reretrieve', 'resolve')),
  claim_id      uuid references claims(id),
  note          text,
  created_at    timestamptz not null default now()
);

create index on debate_turns (message_id);
alter table debate_turns enable row level security;
create policy debate_turns_tenant_isolation on debate_turns
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 12. CONTRADICTIONS (persistent corpus-wide graph, rebuilt on ingest)
-- ---------------------------------------------------------------------------
create table contradictions (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  topic         text not null,
  doc_a         uuid not null references documents(id) on delete cascade,
  span_a        uuid references chunks(id),
  value_a       text,
  doc_b         uuid not null references documents(id) on delete cascade,
  span_b        uuid references chunks(id),
  value_b       text,
  severity      text not null default 'minor' check (severity in ('minor', 'major')),
  note          text,
  created_at    timestamptz not null default now()
);

create index on contradictions (workspace_id);
alter table contradictions enable row level security;
create policy contradictions_tenant_isolation on contradictions
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 13. EVAL RUNS (CI quality gate reads these)
-- Admin-scoped, not tenant-scoped — holds fixture/test data, not user content.
-- ---------------------------------------------------------------------------
create table eval_runs (
  id                uuid primary key default gen_random_uuid(),
  suite             text not null check (suite in ('golden', 'adversarial')),
  commit_sha        text,
  faithfulness      numeric(3,2),
  relevance         numeric(3,2),
  context_precision numeric(3,2),
  context_recall    numeric(3,2),
  catch_rate        numeric(3,2),
  calibration_ece   numeric(3,2),
  cases_total       int,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 14. EVAL CASES (golden + adversarial datasets)
-- ---------------------------------------------------------------------------
create table eval_cases (
  id               uuid primary key default gen_random_uuid(),
  suite            text not null check (suite in ('golden', 'adversarial')),
  contract_ref     text not null,
  question         text not null,
  reference_answer text,
  expected_span_refs text[],
  planted_claim    text,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 15. EVAL CASE RESULTS
-- ---------------------------------------------------------------------------
create table eval_case_results (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references eval_runs(id) on delete cascade,
  case_id      uuid not null references eval_cases(id) on delete cascade,
  passed       boolean not null,
  faithfulness numeric(3,2),
  caught       boolean,
  notes        text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 16. QUALITY ROLLUPS (daily drift tracking; workspace_id nullable = global)
-- ---------------------------------------------------------------------------
create table quality_rollups (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid references workspaces(id) on delete cascade,
  day               date not null,
  avg_faithfulness  numeric(3,2),
  abstention_rate   numeric(3,2),
  n                 int,
  created_at        timestamptz not null default now()
);

alter table quality_rollups enable row level security;
-- Non-null workspace rows are tenant-scoped; null rows (global) are admin-only
create policy quality_rollups_tenant_isolation on quality_rollups
  using (
    workspace_id is null
    or workspace_id::text = any (
      select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
    )
  );

-- ---------------------------------------------------------------------------
-- 17. USAGE EVENTS (metering for billing + analytics)
-- ---------------------------------------------------------------------------
create table usage_events (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  kind          text not null check (kind in ('query', 'ingest', 'embed')),
  input_tokens  int default 0,
  output_tokens int default 0,
  latency_ms    int,
  created_at    timestamptz not null default now()
);

create index on usage_events (workspace_id, created_at);
alter table usage_events enable row level security;
create policy usage_events_tenant_isolation on usage_events
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 18. SUBSCRIPTIONS (Stripe mirror)
-- ---------------------------------------------------------------------------
create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null references workspaces(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  plan                   text not null default 'free' check (plan in ('free', 'pro', 'team')),
  status                 text check (status in ('active', 'past_due', 'canceled')),
  current_period_end     timestamptz,
  updated_at             timestamptz not null default now()
);

alter table subscriptions enable row level security;
create policy subscriptions_tenant_isolation on subscriptions
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));
