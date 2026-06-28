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
