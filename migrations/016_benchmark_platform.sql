-- =============================================================================
-- Migration 016 — Benchmark Platform
-- Tables: benchmark_datasets, benchmark_cases, benchmark_runs
-- All tables are tenant-scoped with RLS + tenant isolation policies.
-- Safe to re-apply: uses IF NOT EXISTS / DROP IF EXISTS guards.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. BENCHMARK_DATASETS
-- ---------------------------------------------------------------------------
create table if not exists benchmark_datasets (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  dataset_type text not null default 'qa'
                 check (dataset_type in ('qa','retrieval','classification','custom')),
  description  text,
  created_at   timestamptz not null default now()
);

create index if not exists benchmark_datasets_workspace_id_idx on benchmark_datasets (workspace_id);
create index if not exists benchmark_datasets_workspace_created_idx on benchmark_datasets (workspace_id, created_at desc);

alter table benchmark_datasets enable row level security;

drop policy if exists benchmark_datasets_tenant_isolation on benchmark_datasets;
create policy benchmark_datasets_tenant_isolation on benchmark_datasets
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 2. BENCHMARK_CASES
-- ---------------------------------------------------------------------------
create table if not exists benchmark_cases (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  dataset_id       uuid not null references benchmark_datasets(id) on delete cascade,
  question         text not null,
  reference_answer text,
  document_ids     jsonb not null default '[]',
  expected_citations jsonb not null default '{}',
  created_at       timestamptz not null default now()
);

create index if not exists benchmark_cases_workspace_id_idx on benchmark_cases (workspace_id);
create index if not exists benchmark_cases_dataset_id_idx on benchmark_cases (dataset_id);

alter table benchmark_cases enable row level security;

drop policy if exists benchmark_cases_tenant_isolation on benchmark_cases;
create policy benchmark_cases_tenant_isolation on benchmark_cases
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 3. BENCHMARK_RUNS
-- ---------------------------------------------------------------------------
create table if not exists benchmark_runs (
  id                           uuid primary key default gen_random_uuid(),
  workspace_id                 uuid not null references workspaces(id) on delete cascade,
  dataset_id                   uuid not null references benchmark_datasets(id) on delete cascade,
  prompt_version               text,
  model_version                text,
  writer_version               text,
  verification_runtime_version text,
  status                       text not null default 'running'
                                 check (status in ('running','completed','failed')),
  total_cases                  int not null default 0,
  completed_cases              int not null default 0,
  failed_cases                 int not null default 0,
  avg_judge_overall            numeric(5,4),
  avg_trust_confidence         numeric(5,4),
  avg_latency_ms               numeric(10,2),
  total_cost_usd               numeric(12,6),
  started_at                   timestamptz,
  completed_at                 timestamptz,
  created_at                   timestamptz not null default now()
);

create index if not exists benchmark_runs_workspace_id_idx on benchmark_runs (workspace_id);
create index if not exists benchmark_runs_dataset_id_idx on benchmark_runs (dataset_id);
create index if not exists benchmark_runs_workspace_created_idx on benchmark_runs (workspace_id, created_at desc);

alter table benchmark_runs enable row level security;

drop policy if exists benchmark_runs_tenant_isolation on benchmark_runs;
create policy benchmark_runs_tenant_isolation on benchmark_runs
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));
