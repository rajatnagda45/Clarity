-- =============================================================================
-- Migration 015 — Enterprise Platform
-- Tables: collections, collection_documents, workflows, api_keys, webhooks,
--         webhook_deliveries, automation_rules, prompt_library,
--         workspace_integrations, audit_logs
-- All tables are tenant-scoped with RLS + tenant isolation policies.
-- Safe to re-apply: uses IF NOT EXISTS / DROP IF EXISTS guards.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. COLLECTIONS
-- ---------------------------------------------------------------------------
create table if not exists collections (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  description  text,
  color        text not null default '#6366f1',
  icon         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists collections_workspace_id_idx on collections (workspace_id);

alter table collections enable row level security;

drop policy if exists collections_tenant_isolation on collections;
create policy collections_tenant_isolation on collections
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 2. COLLECTION_DOCUMENTS (many-to-many join table)
-- ---------------------------------------------------------------------------
create table if not exists collection_documents (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid not null references collections(id) on delete cascade,
  document_id   uuid not null references documents(id) on delete cascade,
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  added_at      timestamptz not null default now(),
  unique (collection_id, document_id)
);

create index if not exists collection_documents_collection_id_idx on collection_documents (collection_id);
create index if not exists collection_documents_document_id_idx on collection_documents (document_id);
create index if not exists collection_documents_workspace_id_idx on collection_documents (workspace_id);

alter table collection_documents enable row level security;

drop policy if exists collection_documents_tenant_isolation on collection_documents;
create policy collection_documents_tenant_isolation on collection_documents
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 3. WORKFLOWS
-- ---------------------------------------------------------------------------
create table if not exists workflows (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  description  text not null default '',
  nodes        jsonb not null default '[]',
  edges        jsonb not null default '[]',
  enabled      boolean not null default true,
  run_count    int not null default 0,
  last_run_at  timestamptz,
  created_by   text,
  created_at   timestamptz not null default now()
);

create index if not exists workflows_workspace_id_idx on workflows (workspace_id);
create index if not exists workflows_workspace_enabled_idx on workflows (workspace_id, enabled);

alter table workflows enable row level security;

drop policy if exists workflows_tenant_isolation on workflows;
create policy workflows_tenant_isolation on workflows
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 4. API_KEYS
-- ---------------------------------------------------------------------------
create table if not exists api_keys (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  key_prefix   text not null,
  key_hash     text not null,
  scopes       jsonb not null default '[]',
  last_used_at timestamptz,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists api_keys_workspace_id_idx on api_keys (workspace_id);
create index if not exists api_keys_key_hash_idx on api_keys (key_hash);
create index if not exists api_keys_workspace_active_idx on api_keys (workspace_id, revoked_at)
  where revoked_at is null;

alter table api_keys enable row level security;

drop policy if exists api_keys_tenant_isolation on api_keys;
create policy api_keys_tenant_isolation on api_keys
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 5. WEBHOOKS
-- ---------------------------------------------------------------------------
create table if not exists webhooks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  url          text not null,
  events       jsonb not null default '[]',
  description  text,
  secret_hash  text not null,
  enabled      boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists webhooks_workspace_id_idx on webhooks (workspace_id);

alter table webhooks enable row level security;

drop policy if exists webhooks_tenant_isolation on webhooks;
create policy webhooks_tenant_isolation on webhooks
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 6. WEBHOOK_DELIVERIES
-- ---------------------------------------------------------------------------
create table if not exists webhook_deliveries (
  id            uuid primary key default gen_random_uuid(),
  webhook_id    uuid not null references webhooks(id) on delete cascade,
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  event_type    text not null,
  status        text not null default 'pending'
                  check (status in ('pending','delivered','failed')),
  response_code int,
  latency_ms    int,
  error         text,
  created_at    timestamptz not null default now()
);

create index if not exists webhook_deliveries_webhook_id_idx on webhook_deliveries (webhook_id);
create index if not exists webhook_deliveries_workspace_id_idx on webhook_deliveries (workspace_id);
create index if not exists webhook_deliveries_workspace_created_idx on webhook_deliveries (workspace_id, created_at desc);

alter table webhook_deliveries enable row level security;

drop policy if exists webhook_deliveries_tenant_isolation on webhook_deliveries;
create policy webhook_deliveries_tenant_isolation on webhook_deliveries
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 7. AUTOMATION_RULES
-- ---------------------------------------------------------------------------
create table if not exists automation_rules (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  trigger_type text not null,
  condition    jsonb not null default '{}',
  actions      jsonb not null default '[]',
  enabled      boolean not null default true,
  run_count    int not null default 0,
  last_run_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists automation_rules_workspace_id_idx on automation_rules (workspace_id);
create index if not exists automation_rules_workspace_enabled_idx on automation_rules (workspace_id, enabled);

alter table automation_rules enable row level security;

drop policy if exists automation_rules_tenant_isolation on automation_rules;
create policy automation_rules_tenant_isolation on automation_rules
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 8. PROMPT_LIBRARY
-- ---------------------------------------------------------------------------
create table if not exists prompt_library (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title        text not null,
  content      text not null,
  category     text not null default 'general',
  variables    jsonb not null default '[]',
  is_favorite  boolean not null default false,
  use_count    int not null default 0,
  created_by   text,
  created_at   timestamptz not null default now()
);

create index if not exists prompt_library_workspace_id_idx on prompt_library (workspace_id);
create index if not exists prompt_library_workspace_category_idx on prompt_library (workspace_id, category);

alter table prompt_library enable row level security;

drop policy if exists prompt_library_tenant_isolation on prompt_library;
create policy prompt_library_tenant_isolation on prompt_library
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 9. WORKSPACE_INTEGRATIONS
-- ---------------------------------------------------------------------------
create table if not exists workspace_integrations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider     text not null,
  status       text not null default 'not_connected'
                 check (status in ('not_connected','connected','disconnected','error')),
  last_sync_at timestamptz,
  docs_imported int not null default 0,
  config       jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  unique (workspace_id, provider)
);

create index if not exists workspace_integrations_workspace_id_idx on workspace_integrations (workspace_id);

alter table workspace_integrations enable row level security;

drop policy if exists workspace_integrations_tenant_isolation on workspace_integrations;
create policy workspace_integrations_tenant_isolation on workspace_integrations
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));

-- ---------------------------------------------------------------------------
-- 10. AUDIT_LOGS
-- ---------------------------------------------------------------------------
create table if not exists audit_logs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  user_id       text,
  action        text not null,
  resource_type text,
  resource_id   text,
  metadata      jsonb not null default '{}',
  ip_address    text,
  severity      text not null default 'info'
                  check (severity in ('info','warning','error','critical')),
  created_at    timestamptz not null default now()
);

create index if not exists audit_logs_workspace_id_idx on audit_logs (workspace_id);
create index if not exists audit_logs_workspace_created_idx on audit_logs (workspace_id, created_at desc);
create index if not exists audit_logs_workspace_action_idx on audit_logs (workspace_id, action);
create index if not exists audit_logs_workspace_severity_idx on audit_logs (workspace_id, severity);

alter table audit_logs enable row level security;

drop policy if exists audit_logs_tenant_isolation on audit_logs;
create policy audit_logs_tenant_isolation on audit_logs
  using (workspace_id::text = any (
    select jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
  ));
