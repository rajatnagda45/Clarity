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
