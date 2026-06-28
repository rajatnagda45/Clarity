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
