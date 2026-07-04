-- =============================================================================
-- Migration 014 — Agents Platform
-- Tables: agents, agent_runs, agent_tool_calls, review_queue
-- All tables are tenant-scoped with RLS + tenant isolation policies.
-- Safe to re-apply: uses IF NOT EXISTS / DROP IF EXISTS guards.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. AGENTS
-- ---------------------------------------------------------------------------
create table if not exists agents (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references workspaces(id) on delete cascade,
  name                 text not null,
  description          text not null default '',
  avatar               text not null default '🤖',
  color                text not null default '#7C3AED',
  category             text not null default 'custom',
  system_prompt        text not null default '',
  behavior             text not null default 'balanced',
  temperature          numeric(3,2) not null default 0.70,
  model                text not null default 'gpt-4o',
  allowed_collections  jsonb not null default '[]',
  allowed_tools        jsonb not null default '[]',
  memory_enabled       boolean not null default true,
  citation_required    boolean not null default true,
  verification_mode    boolean not null default false,
  auto_retry           boolean not null default true,
  confidence_threshold numeric(3,2) not null default 0.70,
  is_pinned            boolean not null default false,
  is_favorite          boolean not null default false,
  run_count            int not null default 0,
  success_rate         numeric(5,4) not null default 0.0,
  avg_latency_ms       int not null default 0,
  avg_trust_score      numeric(5,4) not null default 0.0,
  created_by           text,
  archived_at          timestamptz,
  created_at           timestamptz not null default now()
);

create index if not exists agents_workspace_id_idx on agents (workspace_id);
create index if not exists agents_workspace_category_idx on agents (workspace_id, category);
create index if not exists agents_workspace_archived_idx on agents (workspace_id, archived_at);

alter table agents enable row level security;

drop policy if exists agents_tenant_isolation on agents;
create policy agents_tenant_isolation on agents
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 2. AGENT_RUNS
-- ---------------------------------------------------------------------------
create table if not exists agent_runs (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references workspaces(id) on delete cascade,
  agent_id             uuid not null references agents(id) on delete cascade,
  agent_name           text not null default '',
  status               text not null default 'queued'
                         check (status in ('queued','running','completed','failed','review_required')),
  input                text not null,
  output               text,
  tokens_used          int not null default 0,
  latency_ms           int not null default 0,
  trust_score          numeric(5,4),
  confidence           numeric(5,4),
  cost_estimate        numeric(12,6),
  human_review_required boolean not null default false,
  reviewed_by          text,
  review_verdict       text,
  review_comment       text,
  pipeline_agents      jsonb not null default '[]',
  created_by           text,
  completed_at         timestamptz,
  created_at           timestamptz not null default now()
);

create index if not exists agent_runs_workspace_id_idx on agent_runs (workspace_id);
create index if not exists agent_runs_agent_id_idx on agent_runs (agent_id);
create index if not exists agent_runs_workspace_status_idx on agent_runs (workspace_id, status);
create index if not exists agent_runs_workspace_created_idx on agent_runs (workspace_id, created_at desc);

alter table agent_runs enable row level security;

drop policy if exists agent_runs_tenant_isolation on agent_runs;
create policy agent_runs_tenant_isolation on agent_runs
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 3. AGENT_TOOL_CALLS
-- ---------------------------------------------------------------------------
create table if not exists agent_tool_calls (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references agent_runs(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  tool_name    text not null,
  input        jsonb not null default '{}',
  output       jsonb,
  status       text not null default 'success'
                 check (status in ('success','error','timeout')),
  latency_ms   int not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists agent_tool_calls_run_id_idx on agent_tool_calls (run_id);
create index if not exists agent_tool_calls_workspace_id_idx on agent_tool_calls (workspace_id);

alter table agent_tool_calls enable row level security;

drop policy if exists agent_tool_calls_tenant_isolation on agent_tool_calls;
create policy agent_tool_calls_tenant_isolation on agent_tool_calls
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 4. REVIEW_QUEUE
-- ---------------------------------------------------------------------------
create table if not exists review_queue (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  agent_id        uuid not null references agents(id) on delete cascade,
  agent_name      text not null default '',
  run_id          uuid not null references agent_runs(id) on delete cascade,
  input           text not null,
  output          text not null,
  trust_score     numeric(5,4),
  confidence      numeric(5,4),
  reason          text not null default '',
  priority        text not null default 'medium'
                    check (priority in ('critical','high','medium','low')),
  status          text not null default 'pending'
                    check (status in ('pending','approved','rejected','edited')),
  reviewed_by     text,
  review_comment  text,
  review_verdict  text,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists review_queue_workspace_id_idx on review_queue (workspace_id);
create index if not exists review_queue_workspace_status_idx on review_queue (workspace_id, status);
create index if not exists review_queue_workspace_priority_idx on review_queue (workspace_id, priority);
create index if not exists review_queue_workspace_created_idx on review_queue (workspace_id, created_at desc);

alter table review_queue enable row level security;

drop policy if exists review_queue_tenant_isolation on review_queue;
create policy review_queue_tenant_isolation on review_queue
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));
