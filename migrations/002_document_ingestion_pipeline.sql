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
