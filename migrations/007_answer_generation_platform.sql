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
