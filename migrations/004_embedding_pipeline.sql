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
