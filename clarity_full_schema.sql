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
-- =============================================================================
-- Migration 002 — Document ingestion pipeline state + artifacts
-- Extends A2 upload storage with deterministic A3 ingestion lifecycle.
-- =============================================================================

alter table documents
  drop constraint if exists documents_status_check;

alter table documents
  add constraint documents_status_check
  check (
    status in (
      'uploaded',
      'extracted',
      'normalized',
      'metadata_ready',
      'awaiting_chunking',
      'failed'
    )
  );

alter table documents
  alter column status set default 'uploaded';

alter table documents
  add column if not exists ingestion_run_id text,
  add column if not exists ingestion_started_at timestamptz,
  add column if not exists ingestion_completed_at timestamptz;

update documents
set status = case
  when status = 'processing' then 'uploaded'
  when status = 'ready' then 'awaiting_chunking'
  else status
end;

update documents
set ingestion_completed_at = coalesce(ingestion_completed_at, created_at)
where status = 'awaiting_chunking';

create table if not exists document_ingestion_artifacts (
  document_id             uuid primary key references documents(id) on delete cascade,
  workspace_id            uuid not null references workspaces(id) on delete cascade,
  ingestion_run_id        text,
  source_sha256           text not null,
  extraction_text         text not null default '',
  extraction_blocks       jsonb not null default '[]'::jsonb,
  normalized_text         text not null default '',
  normalized_blocks       jsonb not null default '[]'::jsonb,
  metadata                jsonb not null default '{}'::jsonb,
  preprocessing_segments  jsonb not null default '[]'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists document_ingestion_artifacts_workspace_id_idx
  on document_ingestion_artifacts (workspace_id);

alter table document_ingestion_artifacts enable row level security;

drop policy if exists document_ingestion_artifacts_tenant_isolation
  on document_ingestion_artifacts;

create policy document_ingestion_artifacts_tenant_isolation
  on document_ingestion_artifacts
  using (
    workspace_id::text = any (
      select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
    )
  );
-- =============================================================================
-- Migration 003 — Clause-aware chunking pipeline
-- Extends A3 ingestion with deterministic chunk persistence and lifecycle.
-- =============================================================================

alter table documents
  drop constraint if exists documents_status_check;

alter table documents
  add constraint documents_status_check
  check (
    status in (
      'uploaded',
      'extracted',
      'normalized',
      'metadata_ready',
      'awaiting_chunking',
      'chunking',
      'chunked',
      'failed'
    )
  );

alter table chunks
  add column if not exists chunk_id text,
  add column if not exists chunk_index int,
  add column if not exists section_title text,
  add column if not exists clause_number text,
  add column if not exists page_start int,
  add column if not exists page_end int,
  add column if not exists source_offsets jsonb not null default '[]'::jsonb,
  add column if not exists token_count int,
  add column if not exists checksum text,
  add column if not exists parser_version text,
  add column if not exists chunk_version text,
  add column if not exists chunk_kind text,
  add column if not exists fragment_index int not null default 0,
  add column if not exists fragment_count int not null default 1,
  add column if not exists cross_references text[] not null default '{}';

update chunks
set
  chunk_id = coalesce(chunk_id, id::text),
  chunk_index = coalesce(chunk_index, 0),
  page_start = coalesce(page_start, page),
  page_end = coalesce(page_end, page),
  source_offsets = case
    when jsonb_array_length(source_offsets) = 0
      then jsonb_build_array(
        jsonb_build_object(
          'page', page,
          'block_order', 0,
          'char_start', char_start,
          'char_end', char_end
        )
      )
    else source_offsets
  end,
  token_count = coalesce(token_count, 0),
  checksum = coalesce(checksum, content_hash),
  parser_version = coalesce(parser_version, 'a3.v1'),
  chunk_version = coalesce(chunk_version, 'a4.v1'),
  chunk_kind = coalesce(chunk_kind, 'paragraph')
where chunk_id is null
   or chunk_index is null
   or page_start is null
   or page_end is null
   or token_count is null
   or checksum is null
   or parser_version is null
   or chunk_version is null
   or chunk_kind is null;

alter table chunks
  alter column chunk_id set not null,
  alter column chunk_index set not null,
  alter column page_start set not null,
  alter column page_end set not null,
  alter column token_count set not null,
  alter column checksum set not null,
  alter column parser_version set not null,
  alter column chunk_version set not null,
  alter column chunk_kind set not null;

create unique index if not exists chunks_chunk_id_idx on chunks (chunk_id);
create unique index if not exists chunks_document_version_index_idx
  on chunks (document_id, chunk_version, chunk_index);
-- Phase B: add two-signal verification columns to claims
-- Entailment label + score come from the independent NLI check.
-- Confidence is the calibrated blend of all four signals.
-- The constraint enforces the two-signal rule at the DB level:
--   a claim can only be supported=true when the NLI model agreed (entail).

ALTER TABLE claims
    ADD COLUMN IF NOT EXISTS entailment_label text
        CHECK (entailment_label IN ('entail', 'neutral', 'contradict')),
    ADD COLUMN IF NOT EXISTS entailment_score numeric(3,2)
        CHECK (entailment_score BETWEEN 0 AND 1),
    ADD COLUMN IF NOT EXISTS confidence numeric(3,2)
        CHECK (confidence BETWEEN 0 AND 1);

-- Enforces the two-signal rule: supported=true requires entailment_label='entail'.
-- Added as a separate statement so it can be applied to existing rows safely.
-- PostgreSQL does not support ADD CONSTRAINT IF NOT EXISTS, so guard with a DO block.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'claims_supported_requires_entailment'
    ) THEN
        ALTER TABLE claims
            ADD CONSTRAINT claims_supported_requires_entailment
                CHECK (supported = false OR entailment_label = 'entail');
    END IF;
END $$;

-- Confirm debate_turns table exists (created in 001_initial_schema.sql).
-- This is a guard, not a creation: the migration fails fast if it was missed.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'debate_turns'
    ) THEN
        RAISE EXCEPTION 'debate_turns table missing — re-apply 001_initial_schema.sql';
    END IF;
END $$;
-- =============================================================================
-- Migration 004 — Embedding pipeline
-- Extends A4 chunking with versioned embedding persistence and lifecycle.
-- =============================================================================

alter table documents
  drop constraint if exists documents_status_check;

alter table documents
  add constraint documents_status_check
  check (
    status in (
      'uploaded',
      'extracted',
      'normalized',
      'metadata_ready',
      'awaiting_chunking',
      'chunking',
      'chunked',
      'awaiting_embeddings',
      'embedding',
      'embedded',
      'failed'
    )
  );

alter table documents
  add column if not exists embedding_run_id text,
  add column if not exists embedding_queued_at timestamptz,
  add column if not exists embedding_started_at timestamptz,
  add column if not exists embedding_completed_at timestamptz,
  add column if not exists embedding_retry_count int not null default 0,
  add column if not exists embedded_chunk_count int not null default 0,
  add column if not exists current_embedding_provider text,
  add column if not exists current_embedding_model text,
  add column if not exists current_embedding_dimension int,
  add column if not exists current_embedding_version text,
  add column if not exists current_embedding_parser_version text,
  add column if not exists current_embedding_chunk_version text;

create table if not exists chunk_embeddings (
  id                      uuid primary key default gen_random_uuid(),
  workspace_id            uuid not null references workspaces(id) on delete cascade,
  document_id             uuid not null references documents(id) on delete cascade,
  chunk_id                text not null,
  chunk_index             int not null,
  embedding_provider      text not null,
  embedding_model         text not null,
  embedding_dimension     int not null,
  embedding_version       text not null,
  parser_version          text not null,
  chunk_version           text not null,
  checksum                text not null,
  token_count             int not null,
  latency_ms              int,
  retry_count             int not null default 0,
  estimated_cost_usd      numeric(12,6) not null default 0,
  vector_preview          jsonb not null default '[]'::jsonb,
  vector                  jsonb,
  created_at              timestamptz not null default now()
);

create unique index if not exists chunk_embeddings_identity_idx
  on chunk_embeddings (
    workspace_id,
    document_id,
    chunk_id,
    embedding_provider,
    embedding_model,
    embedding_version,
    parser_version,
    chunk_version,
    checksum
  );

create index if not exists chunk_embeddings_workspace_document_idx
  on chunk_embeddings (workspace_id, document_id);

create index if not exists chunk_embeddings_document_index_idx
  on chunk_embeddings (document_id, chunk_index);

create index if not exists chunk_embeddings_model_version_idx
  on chunk_embeddings (embedding_provider, embedding_model, embedding_version);

alter table chunk_embeddings enable row level security;

drop policy if exists chunk_embeddings_tenant_isolation
  on chunk_embeddings;

create policy chunk_embeddings_tenant_isolation
  on chunk_embeddings
  using (
    workspace_id::text = any (
      select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
    )
  );
-- =============================================================================
-- Migration 005 — Vector indexing pipeline
-- Extends A5 embeddings with provider-agnostic vector index synchronization.
-- =============================================================================

alter table documents
  drop constraint if exists documents_status_check;

alter table documents
  add constraint documents_status_check
  check (
    status in (
      'uploaded',
      'extracted',
      'normalized',
      'metadata_ready',
      'awaiting_chunking',
      'chunking',
      'chunked',
      'awaiting_embeddings',
      'embedding',
      'embedded',
      'awaiting_index',
      'indexing',
      'indexed',
      'failed'
    )
  );

alter table documents
  add column if not exists index_run_id text,
  add column if not exists index_queued_at timestamptz,
  add column if not exists index_started_at timestamptz,
  add column if not exists index_completed_at timestamptz,
  add column if not exists index_retry_count int not null default 0,
  add column if not exists indexed_chunk_count int not null default 0,
  add column if not exists current_index_provider text,
  add column if not exists current_index_name text,
  add column if not exists current_index_namespace text;

create table if not exists chunk_vector_index_records (
  id                      uuid primary key default gen_random_uuid(),
  workspace_id            uuid not null references workspaces(id) on delete cascade,
  document_id             uuid not null references documents(id) on delete cascade,
  chunk_id                text not null,
  chunk_index             int not null,
  index_provider          text not null,
  index_name              text not null,
  namespace               text not null,
  vector_id               text not null,
  embedding_provider      text not null,
  embedding_model         text not null,
  embedding_dimension     int not null,
  embedding_version       text not null,
  parser_version          text not null,
  chunk_version           text not null,
  checksum                text not null,
  section_title           text,
  clause_number           text,
  page_start              int not null,
  page_end                int not null,
  status                  text not null default 'indexed'
                          check (status in ('indexed', 'stale', 'failed')),
  latency_ms              int,
  retry_count             int not null default 0,
  indexed_at              timestamptz,
  last_error_code         text,
  last_error_message      text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create unique index if not exists chunk_vector_index_records_identity_idx
  on chunk_vector_index_records (index_provider, index_name, namespace, vector_id);

create index if not exists chunk_vector_index_records_workspace_document_idx
  on chunk_vector_index_records (workspace_id, document_id);

create index if not exists chunk_vector_index_records_namespace_status_idx
  on chunk_vector_index_records (namespace, status);

create index if not exists chunk_vector_index_records_version_idx
  on chunk_vector_index_records (
    embedding_provider,
    embedding_model,
    embedding_version,
    parser_version,
    chunk_version
  );

alter table chunk_vector_index_records enable row level security;

drop policy if exists chunk_vector_index_records_tenant_isolation
  on chunk_vector_index_records;

create policy chunk_vector_index_records_tenant_isolation
  on chunk_vector_index_records
  using (
    workspace_id::text = any (
      select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
    )
  );
-- =============================================================================
-- Migration 006 — Hybrid retrieval engine
-- Adds retrieval observability for dense + sparse + fused evidence retrieval.
-- =============================================================================

create table if not exists retrieval_events (
  id                         uuid primary key default gen_random_uuid(),
  workspace_id               uuid not null references workspaces(id) on delete cascade,
  query_hash                 text not null,
  normalized_query           text not null,
  cache_hit                  boolean not null default false,
  failed                     boolean not null default false,
  dense_latency_ms           int,
  sparse_latency_ms          int,
  fusion_latency_ms          int,
  total_latency_ms           int,
  dense_candidate_count      int not null default 0,
  sparse_candidate_count     int not null default 0,
  dense_contributed_count    int not null default 0,
  sparse_contributed_count   int not null default 0,
  final_result_count         int not null default 0,
  filter_count               int not null default 0,
  created_at                 timestamptz not null default now()
);

create index if not exists retrieval_events_workspace_created_idx
  on retrieval_events (workspace_id, created_at desc);

create index if not exists retrieval_events_query_hash_idx
  on retrieval_events (workspace_id, query_hash);

alter table retrieval_events enable row level security;

drop policy if exists retrieval_events_tenant_isolation
  on retrieval_events;

create policy retrieval_events_tenant_isolation
  on retrieval_events
  using (
    workspace_id::text = any (
      select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
    )
  );
-- =============================================================================
-- Migration 007 — Answer generation platform
-- Adds conversations persistence, retrieval/answer run tracking, SSE replay,
-- structured citations, and answer observability for Phase A8.
-- =============================================================================

alter table conversations
  add column if not exists last_message_at timestamptz,
  add column if not exists title_source text not null default 'first_user_message',
  add column if not exists archived_at timestamptz;

update conversations
set last_message_at = coalesce(last_message_at, created_at)
where last_message_at is null;

create index if not exists conversations_workspace_last_message_idx
  on conversations (workspace_id, last_message_at desc, created_at desc);

create table if not exists retrieval_runs (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references workspaces(id) on delete cascade,
  conversation_id    uuid not null references conversations(id) on delete cascade,
  user_message_id    uuid not null references messages(id) on delete cascade,
  query              text not null,
  normalized_query   text not null,
  retrieval_mode     text not null default 'hybrid',
  cache_hit          boolean not null default false,
  result_count       int not null default 0,
  document_ids       uuid[] not null default '{}',
  created_at         timestamptz not null default now()
);

create index if not exists retrieval_runs_workspace_created_idx
  on retrieval_runs (workspace_id, created_at desc);

alter table retrieval_runs enable row level security;

drop policy if exists retrieval_runs_tenant_isolation
  on retrieval_runs;

create policy retrieval_runs_tenant_isolation
  on retrieval_runs
  using (
    workspace_id::text = any (
      select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
    )
  );

create table if not exists retrieval_run_evidence (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references workspaces(id) on delete cascade,
  retrieval_run_id   uuid not null references retrieval_runs(id) on delete cascade,
  citation_key       text not null,
  document_id        uuid not null references documents(id) on delete cascade,
  chunk_id           text not null,
  chunk_index        int not null,
  text               text not null,
  section_title      text,
  clause_number      text,
  page_start         int not null,
  page_end           int not null,
  chunk_kind         text not null default 'clause',
  cross_references   text[] not null default '{}',
  retrieval_reason   text not null,
  retrieval_sources  text[] not null default '{}',
  vector_score       double precision,
  bm25_score         double precision,
  rrf_score          double precision not null,
  final_score        double precision not null,
  final_rank         int not null,
  parser_version     text not null,
  chunk_version      text not null,
  embedding_version  text,
  created_at         timestamptz not null default now()
);

create unique index if not exists retrieval_run_evidence_key_idx
  on retrieval_run_evidence (retrieval_run_id, citation_key);

create index if not exists retrieval_run_evidence_workspace_idx
  on retrieval_run_evidence (workspace_id, retrieval_run_id, final_rank);

alter table retrieval_run_evidence enable row level security;

drop policy if exists retrieval_run_evidence_tenant_isolation
  on retrieval_run_evidence;

create policy retrieval_run_evidence_tenant_isolation
  on retrieval_run_evidence
  using (
    workspace_id::text = any (
      select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
    )
  );

create table if not exists answer_runs (
  id                          uuid primary key default gen_random_uuid(),
  workspace_id                uuid not null references workspaces(id) on delete cascade,
  conversation_id             uuid not null references conversations(id) on delete cascade,
  user_message_id             uuid not null references messages(id) on delete cascade,
  retrieval_run_id            uuid not null references retrieval_runs(id) on delete cascade,
  assistant_message_id        uuid references messages(id) on delete set null,
  request_id                  text,
  provider                    text not null,
  model                       text not null,
  prompt_version              text not null,
  writer_version              text not null,
  status                      text not null default 'completed',
  answer_markdown             text,
  answer_text                 text,
  prompt_payload              jsonb not null default '{}'::jsonb,
  error_code                  text,
  error_message               text,
  prompt_tokens               int not null default 0,
  completion_tokens           int not null default 0,
  total_tokens                int not null default 0,
  estimated_cost_usd          numeric(12,6) not null default 0.0,
  latency_ms                  int,
  first_token_latency_ms      int,
  citation_count              int not null default 0,
  evidence_chunk_count        int not null default 0,
  retry_count                 int not null default 0,
  created_at                  timestamptz not null default now(),
  completed_at                timestamptz
);

create unique index if not exists answer_runs_workspace_request_idx
  on answer_runs (workspace_id, request_id)
  where request_id is not null;

create index if not exists answer_runs_workspace_created_idx
  on answer_runs (workspace_id, created_at desc);

alter table answer_runs enable row level security;

drop policy if exists answer_runs_tenant_isolation
  on answer_runs;

create policy answer_runs_tenant_isolation
  on answer_runs
  using (
    workspace_id::text = any (
      select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
    )
  );

create table if not exists answer_stream_events (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references workspaces(id) on delete cascade,
  answer_run_id      uuid not null references answer_runs(id) on delete cascade,
  sequence_number    int not null,
  event_type         text not null,
  payload            jsonb not null,
  created_at         timestamptz not null default now()
);

create unique index if not exists answer_stream_events_seq_idx
  on answer_stream_events (answer_run_id, sequence_number);

create index if not exists answer_stream_events_workspace_idx
  on answer_stream_events (workspace_id, answer_run_id, sequence_number);

alter table answer_stream_events enable row level security;

drop policy if exists answer_stream_events_tenant_isolation
  on answer_stream_events;

create policy answer_stream_events_tenant_isolation
  on answer_stream_events
  using (
    workspace_id::text = any (
      select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
    )
  );

create table if not exists message_citations (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references workspaces(id) on delete cascade,
  message_id         uuid not null references messages(id) on delete cascade,
  answer_run_id      uuid not null references answer_runs(id) on delete cascade,
  retrieval_run_id   uuid not null references retrieval_runs(id) on delete cascade,
  citation_key       text not null,
  document_id        uuid not null references documents(id) on delete cascade,
  chunk_id           text not null,
  section_title      text,
  clause_number      text,
  page_start         int not null,
  page_end           int not null,
  checksum           text,
  source_offsets     jsonb,
  created_at         timestamptz not null default now()
);

create unique index if not exists message_citations_message_key_idx
  on message_citations (message_id, citation_key);

create index if not exists message_citations_workspace_idx
  on message_citations (workspace_id, message_id);

alter table message_citations enable row level security;

drop policy if exists message_citations_tenant_isolation
  on message_citations;

create policy message_citations_tenant_isolation
  on message_citations
  using (
    workspace_id::text = any (
      select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
    )
  );
-- =============================================================================
-- Migration 008 — Verified runtime integration
-- Adds additive persistence for claim extraction, verification metadata,
-- calibrated trust, and abstention details used by Phase B1.
-- =============================================================================

alter table claims
  alter column span_ids type text[] using coalesce(span_ids::text[], '{}'::text[]);

alter table claims
  add column if not exists answer_run_id uuid references answer_runs(id) on delete cascade,
  add column if not exists claim_index int not null default 0,
  add column if not exists citation_keys text[] not null default '{}',
  add column if not exists section text,
  add column if not exists verification_pass int not null default 1,
  add column if not exists critic_status text,
  add column if not exists critic_note text,
  add column if not exists corrected_text text,
  add column if not exists support_probability numeric(3,2) check (support_probability between 0.00 and 1.00),
  add column if not exists contradiction_probability numeric(3,2) check (contradiction_probability between 0.00 and 1.00);

create index if not exists claims_answer_run_idx
  on claims (answer_run_id, claim_index);

alter table claims
  drop constraint if exists claims_critic_status_check;

alter table claims
  add constraint claims_critic_status_check
  check (critic_status is null or critic_status in ('supported', 'partial', 'unsupported'));

alter table answer_runs
  add column if not exists trust_faithfulness numeric(3,2) check (trust_faithfulness between 0.00 and 1.00),
  add column if not exists trust_relevance numeric(3,2) check (trust_relevance between 0.00 and 1.00),
  add column if not exists trust_overall numeric(3,2) check (trust_overall between 0.00 and 1.00),
  add column if not exists trust_confidence numeric(3,2) check (trust_confidence between 0.00 and 1.00),
  add column if not exists trust_calibrated boolean not null default false,
  add column if not exists confidence_band text,
  add column if not exists verification_passes int not null default 1,
  add column if not exists claim_count int not null default 0,
  add column if not exists supported_claim_count int not null default 0,
  add column if not exists abstained boolean not null default false;

alter table answer_runs
  drop constraint if exists answer_runs_confidence_band_check;

alter table answer_runs
  add constraint answer_runs_confidence_band_check
  check (confidence_band is null or confidence_band in ('low', 'medium', 'high'));

alter table abstentions
  add column if not exists suggested_follow_up text;
-- B3: Continuous Evaluation & Self-Improvement Platform
-- Extends answer_evals with 7-dimension LLM-as-judge scores (0–100 scale).
-- Adds benchmark, regression, and experiment tables.

-- ─── Extend answer_evals ──────────────────────────────────────────────────────

ALTER TABLE answer_evals
  ADD COLUMN IF NOT EXISTS answer_run_id        uuid REFERENCES answer_runs(id),
  ADD COLUMN IF NOT EXISTS judge_provider        text,
  ADD COLUMN IF NOT EXISTS judge_model           text,
  ADD COLUMN IF NOT EXISTS judge_prompt_version  text,
  ADD COLUMN IF NOT EXISTS judge_latency_ms      int,
  -- 0–100 integer scores from the LLM judge (distinct from the 0–1 RAGAS metrics)
  ADD COLUMN IF NOT EXISTS judge_faithfulness    smallint CHECK (judge_faithfulness    BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS judge_grounding       smallint CHECK (judge_grounding       BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS judge_completeness    smallint CHECK (judge_completeness    BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS judge_correctness     smallint CHECK (judge_correctness     BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS judge_clarity         smallint CHECK (judge_clarity         BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS judge_citation_quality smallint CHECK (judge_citation_quality BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS judge_hallucination_risk smallint CHECK (judge_hallucination_risk BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS judge_overall         smallint CHECK (judge_overall         BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS judge_reasoning       jsonb;   -- {"faithfulness": "...", ...}

CREATE INDEX IF NOT EXISTS idx_answer_evals_answer_run_id
  ON answer_evals (answer_run_id);

CREATE INDEX IF NOT EXISTS idx_answer_evals_workspace_judge_overall
  ON answer_evals (workspace_id, judge_overall);

-- ─── Extend quality_rollups ──────────────────────────────────────────────────

ALTER TABLE quality_rollups
  ADD COLUMN IF NOT EXISTS avg_judge_overall       numeric(5, 2),
  ADD COLUMN IF NOT EXISTS avg_hallucination_risk  numeric(5, 2),
  ADD COLUMN IF NOT EXISTS avg_confidence_score    numeric(3, 2),
  ADD COLUMN IF NOT EXISTS abstention_count        int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_pass_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_answers           int NOT NULL DEFAULT 0;

-- ─── Benchmark datasets ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS benchmark_datasets (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  dataset_type text        NOT NULL CHECK (dataset_type IN ('contract_qa', 'lease_qa', 'policy_qa', 'custom')),
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_datasets_workspace
  ON benchmark_datasets (workspace_id);

-- ─── Benchmark cases ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS benchmark_cases (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  dataset_id      uuid        NOT NULL REFERENCES benchmark_datasets(id) ON DELETE CASCADE,
  question        text        NOT NULL,
  reference_answer text,
  document_ids    text[]      NOT NULL DEFAULT '{}',
  expected_citations jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_cases_dataset
  ON benchmark_cases (dataset_id);

CREATE INDEX IF NOT EXISTS idx_benchmark_cases_workspace
  ON benchmark_cases (workspace_id);

-- ─── Benchmark runs ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS benchmark_runs (
  id                           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                 uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  dataset_id                   uuid        NOT NULL REFERENCES benchmark_datasets(id),
  prompt_version               text        NOT NULL,
  model_version                text        NOT NULL,
  writer_version               text        NOT NULL,
  verification_runtime_version text        NOT NULL,
  status                       text        NOT NULL DEFAULT 'running'
                                           CHECK (status IN ('running', 'completed', 'failed')),
  total_cases                  int         NOT NULL DEFAULT 0,
  completed_cases              int         NOT NULL DEFAULT 0,
  failed_cases                 int         NOT NULL DEFAULT 0,
  avg_judge_overall            numeric(5, 2),
  avg_trust_confidence         numeric(3, 2),
  avg_latency_ms               int,
  total_cost_usd               numeric(10, 6),
  started_at                   timestamptz,
  completed_at                 timestamptz,
  error_detail                 text,
  created_at                   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_runs_workspace
  ON benchmark_runs (workspace_id, created_at DESC);

-- ─── Benchmark run results ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS benchmark_run_results (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id           uuid        NOT NULL REFERENCES benchmark_runs(id) ON DELETE CASCADE,
  case_id          uuid        NOT NULL REFERENCES benchmark_cases(id),
  answer_run_id    uuid        REFERENCES answer_runs(id),
  eval_id          uuid        REFERENCES answer_evals(id),
  judge_overall    smallint    CHECK (judge_overall BETWEEN 0 AND 100),
  trust_confidence numeric(3, 2),
  latency_ms       int,
  abstained        boolean     NOT NULL DEFAULT false,
  error            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_run_results_run
  ON benchmark_run_results (run_id);

-- ─── Regression reports ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS regression_reports (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  current_eval_id             uuid        NOT NULL REFERENCES answer_evals(id),
  window_size                 int         NOT NULL,
  baseline_avg_judge_overall  numeric(5, 2),
  current_judge_overall       smallint,
  judge_overall_delta         numeric(5, 2),
  baseline_avg_trust_confidence numeric(3, 2),
  current_trust_confidence    numeric(3, 2),
  trust_confidence_delta      numeric(5, 2),
  baseline_avg_hallucination_risk numeric(5, 2),
  current_hallucination_risk  smallint,
  hallucination_risk_delta    numeric(5, 2),
  has_regression              boolean     NOT NULL DEFAULT false,
  regression_flags            text[]      NOT NULL DEFAULT '{}',
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regression_reports_workspace
  ON regression_reports (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_regression_reports_eval
  ON regression_reports (current_eval_id);

-- ─── Experiments ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS experiments (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name                text        NOT NULL,
  description         text,
  status              text        NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active', 'completed', 'archived')),
  winner_candidate_id uuid,       -- FK added below after experiment_candidates is created
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experiments_workspace
  ON experiments (workspace_id, status);

-- ─── Experiment candidates ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS experiment_candidates (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  experiment_id        uuid        NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  name                 text        NOT NULL,
  prompt_version       text        NOT NULL,
  model_version        text        NOT NULL,
  writer_version       text        NOT NULL,
  avg_judge_overall    numeric(5, 2),
  avg_trust_confidence numeric(3, 2),
  avg_latency_ms       int,
  avg_cost_usd         numeric(10, 6),
  eval_count           int         NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experiment_candidates_experiment
  ON experiment_candidates (experiment_id);

-- Add FK from experiments.winner_candidate_id → experiment_candidates.id
ALTER TABLE experiments
  ADD CONSTRAINT fk_experiments_winner
  FOREIGN KEY (winner_candidate_id)
  REFERENCES experiment_candidates(id)
  ON DELETE SET NULL;

-- RLS: all new tables follow the standard workspace-scoped pattern.
-- Enable after applying: ALTER TABLE ... ENABLE ROW LEVEL SECURITY; (done at deploy time)
-- B4: Autonomous Quality Improvement Platform
-- Adds prompt versioning, optimization recommendations, quality gates,
-- release notes, and benchmark suggestion tables.
-- Extends experiments and experiment_candidates for retrieval strategy tracking.

-- ─── Extend experiments ───────────────────────────────────────────────────────

ALTER TABLE experiments
  ADD COLUMN IF NOT EXISTS benchmark_id        uuid REFERENCES benchmark_datasets(id),
  ADD COLUMN IF NOT EXISTS retrieval_strategy  text,
  ADD COLUMN IF NOT EXISTS outcome             text CHECK (outcome IN ('candidate_a', 'candidate_b', 'tie', 'inconclusive'));

-- ─── Extend experiment_candidates ────────────────────────────────────────────

ALTER TABLE experiment_candidates
  ADD COLUMN IF NOT EXISTS retrieval_strategy text;

-- ─── Prompt versions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prompt_versions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prompt_key   text        NOT NULL,  -- "writer" | "critic" | "judge"
  version      text        NOT NULL,  -- e.g. "b4.writer.v2"
  description  text,
  content      text        NOT NULL,
  author       text,
  active       boolean     NOT NULL DEFAULT false,
  retired      boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_prompt_versions_key_ver
  ON prompt_versions (workspace_id, prompt_key, version);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_workspace
  ON prompt_versions (workspace_id, prompt_key, active);

-- ─── Optimization recommendations ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS optimization_recommendations (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  dimension    text        NOT NULL,
  severity     text        NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  recommendation text      NOT NULL,
  evidence     jsonb,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'accepted', 'dismissed')),
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_optimization_workspace
  ON optimization_recommendations (workspace_id, status, created_at DESC);

-- ─── Quality gate rules ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quality_gate_rules (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  metric       text        NOT NULL,  -- "judge_overall" | "hallucination_risk" | "trust" | "latency_ms"
  operator     text        NOT NULL CHECK (operator IN ('gte', 'lte', 'gt', 'lt')),
  threshold    numeric     NOT NULL,
  active       boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quality_gate_rules_workspace
  ON quality_gate_rules (workspace_id, active);

-- ─── Quality gate runs ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quality_gate_runs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  benchmark_run_id  uuid        REFERENCES benchmark_runs(id),
  experiment_id     uuid        REFERENCES experiments(id),
  rules_evaluated   int         NOT NULL DEFAULT 0,
  rules_passed      int         NOT NULL DEFAULT 0,
  rules_failed      int         NOT NULL DEFAULT 0,
  passed            boolean     NOT NULL DEFAULT false,
  details           jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quality_gate_runs_workspace
  ON quality_gate_runs (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quality_gate_runs_benchmark
  ON quality_gate_runs (benchmark_run_id);

-- ─── Release notes ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS release_notes (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title             text        NOT NULL,
  from_version      text,
  to_version        text        NOT NULL,
  summary           text        NOT NULL,
  metrics_delta     jsonb,
  benchmark_run_id  uuid        REFERENCES benchmark_runs(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_release_notes_workspace
  ON release_notes (workspace_id, created_at DESC);

-- ─── Benchmark suggestions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS benchmark_suggestions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  answer_run_id     uuid        REFERENCES answer_runs(id),
  question          text        NOT NULL,
  suggested_reason  text        NOT NULL,
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'approved', 'dismissed')),
  approved_case_id  uuid        REFERENCES benchmark_cases(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_suggestions_workspace
  ON benchmark_suggestions (workspace_id, status, created_at DESC);

-- RLS on all new tables follows the workspace-scoped standard.
-- Enable RLS at deploy time: ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
-- Migration 011: RLS policies for B4 tables + verification pipeline tables
-- Applies row-level security to all B4 quality-improvement tables and adds
-- the three verification tables (claims, debate_turns, abstentions).

-- ============================================================
-- 1. Enable RLS on B4 tables (missing from 010)
-- ============================================================

ALTER TABLE prompt_versions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_gate_rules           ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_gate_runs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_notes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_suggestions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiments                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_candidates        ENABLE ROW LEVEL SECURITY;

-- ---- prompt_versions ----
CREATE POLICY prompt_versions_workspace_isolation ON prompt_versions
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

-- ---- optimization_recommendations ----
CREATE POLICY opt_recs_workspace_isolation ON optimization_recommendations
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

-- ---- quality_gate_rules ----
CREATE POLICY gate_rules_workspace_isolation ON quality_gate_rules
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

-- ---- quality_gate_runs ----
CREATE POLICY gate_runs_workspace_isolation ON quality_gate_runs
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

-- ---- release_notes ----
CREATE POLICY release_notes_workspace_isolation ON release_notes
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

-- ---- benchmark_suggestions ----
CREATE POLICY benchmark_suggestions_workspace_isolation ON benchmark_suggestions
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

-- ---- experiments ----
CREATE POLICY experiments_workspace_isolation ON experiments
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

-- ---- experiment_candidates ----
CREATE POLICY experiment_candidates_workspace_isolation ON experiment_candidates
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

-- ============================================================
-- 2. Verification pipeline tables
-- ============================================================

-- Per-claim two-signal verdict stored against an answer_run
CREATE TABLE IF NOT EXISTS claims (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        uuid NOT NULL,
    answer_run_id       uuid NOT NULL REFERENCES answer_runs(id) ON DELETE CASCADE,
    claim_text          text NOT NULL,
    critic_verdict      text NOT NULL CHECK (critic_verdict IN ('supported', 'unsupported', 'uncertain')),
    nli_label           text NOT NULL CHECK (nli_label IN ('entail', 'neutral', 'contradict')),
    nli_score           numeric(4,3) NOT NULL CHECK (nli_score BETWEEN 0 AND 1),
    ensemble_verdict    text NOT NULL CHECK (ensemble_verdict IN ('supported', 'unsupported', 'uncertain')),
    evidence_spans      jsonb NOT NULL DEFAULT '[]',
    debate_turn         integer NOT NULL DEFAULT 1,
    created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY claims_workspace_isolation ON claims
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

CREATE INDEX IF NOT EXISTS claims_answer_run_id_idx ON claims(answer_run_id);
CREATE INDEX IF NOT EXISTS claims_workspace_id_idx  ON claims(workspace_id);

-- Critic ↔ Writer debate rounds stored for replay
CREATE TABLE IF NOT EXISTS debate_turns (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  uuid NOT NULL,
    answer_run_id uuid NOT NULL REFERENCES answer_runs(id) ON DELETE CASCADE,
    turn_number   integer NOT NULL,
    claim_text    text NOT NULL,
    critic_verdict text NOT NULL,
    reasoning     text NOT NULL DEFAULT '',
    created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE debate_turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY debate_turns_workspace_isolation ON debate_turns
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

CREATE INDEX IF NOT EXISTS debate_turns_answer_run_id_idx ON debate_turns(answer_run_id);

-- Abstention records — when calibrated trust < threshold the system declines to answer
CREATE TABLE IF NOT EXISTS abstentions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        uuid NOT NULL,
    answer_run_id       uuid NOT NULL REFERENCES answer_runs(id) ON DELETE CASCADE,
    reason              text NOT NULL,
    trust_score         numeric(4,3) NOT NULL CHECK (trust_score BETWEEN 0 AND 1),
    threshold           numeric(4,3) NOT NULL,
    missing_evidence_query text,
    created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE abstentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY abstentions_workspace_isolation ON abstentions
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

CREATE INDEX IF NOT EXISTS abstentions_answer_run_id_idx ON abstentions(answer_run_id);
CREATE INDEX IF NOT EXISTS abstentions_workspace_id_idx  ON abstentions(workspace_id);

-- ============================================================
-- 3. Add rerank_score column to retrieval_run_evidence
-- ============================================================

ALTER TABLE retrieval_run_evidence
    ADD COLUMN IF NOT EXISTS rerank_score numeric(6,5);
