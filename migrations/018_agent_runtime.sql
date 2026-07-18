-- Migration 018: Agent Runtime — execution graph, memory, events, approvals.
--
-- Extends the existing agents platform (migrations/014) with the storage
-- the new services/agent_runtime/ module needs:
--   - agent_runs: new columns for plan / current_node / total cost / tokens
--   - agent_run_nodes: one row per node execution (for the dev console graph)
--   - agent_run_memory: episodic memory entries (run-scoped and global)
--   - agent_run_events: streamed event history (for SSE replay and resume)
--   - agent_run_approvals: pending human-review items
--
-- All new tables follow the existing tenant-isolation pattern
-- (workspace_id + RLS via auth.jwt() claim array). The global_table()
-- helper is unchanged.
--
-- This migration is additive — no drops, no destructive changes.
-- Pre-018 rows continue to work; new columns have defaults.

BEGIN;

-- ─── 1. Extend agent_runs ────────────────────────────────────────────────────
ALTER TABLE agent_runs
    ADD COLUMN IF NOT EXISTS plan                 JSONB         DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS current_node         TEXT,
    ADD COLUMN IF NOT EXISTS max_depth            INTEGER       DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_loop_count       INTEGER       DEFAULT 3,
    ADD COLUMN IF NOT EXISTS total_tokens_in      INTEGER       DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_tokens_out     INTEGER       DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_cost_usd       NUMERIC(12,6) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pause_reason         TEXT,
    ADD COLUMN IF NOT EXISTS resumed_at           TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS current_step_index   INTEGER       DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_error           TEXT,
    ADD COLUMN IF NOT EXISTS agent_config         JSONB         DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS stream_requested     BOOLEAN       DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS judge_scores         JSONB         DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS abstention_reason    TEXT;

CREATE INDEX IF NOT EXISTS idx_agent_runs_current_node
    ON agent_runs (workspace_id, current_node)
    WHERE current_node IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_runs_status
    ON agent_runs (workspace_id, status, created_at DESC);


-- ─── 2. agent_run_nodes — one row per node execution ────────────────────────
CREATE TABLE IF NOT EXISTS agent_run_nodes (
    id               TEXT          PRIMARY KEY,
    run_id           UUID          NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    workspace_id     UUID          NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    node_type        TEXT          NOT NULL,
    parent_node_id   TEXT          REFERENCES agent_run_nodes(id) ON DELETE SET NULL,
    attempt          INTEGER       NOT NULL DEFAULT 1,
    status           TEXT          NOT NULL DEFAULT 'running'
                       CHECK (status IN ('pending', 'running', 'success', 'error', 'skipped', 'awaiting_approval')),
    input            JSONB         NOT NULL DEFAULT '{}'::jsonb,
    output           JSONB         NOT NULL DEFAULT '{}'::jsonb,
    error            TEXT,
    latency_ms       INTEGER       NOT NULL DEFAULT 0,
    tokens_in        INTEGER       NOT NULL DEFAULT 0,
    tokens_out       INTEGER       NOT NULL DEFAULT 0,
    cost_usd         NUMERIC(12,6) NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_run_nodes_run
    ON agent_run_nodes (run_id, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_run_nodes_workspace_type
    ON agent_run_nodes (workspace_id, node_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_run_nodes_parent
    ON agent_run_nodes (parent_node_id)
    WHERE parent_node_id IS NOT NULL;

ALTER TABLE agent_run_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_run_nodes_tenant_isolation ON agent_run_nodes;
CREATE POLICY agent_run_nodes_tenant_isolation ON agent_run_nodes
    USING (workspace_id::text = ANY (
        SELECT jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
    ));


-- ─── 3. agent_run_memory — episodic memory entries ──────────────────────────
CREATE TABLE IF NOT EXISTS agent_run_memory (
    id              TEXT         PRIMARY KEY,
    run_id          UUID         NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    workspace_id    UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    scope           TEXT         NOT NULL DEFAULT 'run'
                       CHECK (scope IN ('run', 'global')),
    role            TEXT         NOT NULL
                       CHECK (role IN ('system', 'user', 'assistant', 'tool', 'observation')),
    content         TEXT         NOT NULL,
    tool            TEXT,
    metadata        JSONB        NOT NULL DEFAULT '{}'::jsonb,
    token_count     INTEGER      NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_run_memory_run
    ON agent_run_memory (run_id, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_run_memory_workspace_global
    ON agent_run_memory (workspace_id, created_at DESC)
    WHERE scope = 'global';

CREATE INDEX IF NOT EXISTS idx_agent_run_memory_tool
    ON agent_run_memory (workspace_id, tool, created_at DESC)
    WHERE tool IS NOT NULL;

ALTER TABLE agent_run_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_run_memory_tenant_isolation ON agent_run_memory;
CREATE POLICY agent_run_memory_tenant_isolation ON agent_run_memory
    USING (workspace_id::text = ANY (
        SELECT jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
    ));


-- ─── 4. agent_run_events — streamed event history (replay + resume) ────────
CREATE TABLE IF NOT EXISTS agent_run_events (
    id              TEXT         PRIMARY KEY,
    run_id          UUID         NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    workspace_id    UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    sequence        INTEGER      NOT NULL,
    event_type      TEXT         NOT NULL,
    node_id         TEXT,
    node_type       TEXT,
    parent_node_id  TEXT,
    attempt         INTEGER      NOT NULL DEFAULT 1,
    payload         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    elapsed_ms      INTEGER      NOT NULL DEFAULT 0,
    tokens_in       INTEGER      NOT NULL DEFAULT 0,
    tokens_out      INTEGER      NOT NULL DEFAULT 0,
    cost_usd        NUMERIC(12,6) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (run_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_agent_run_events_run
    ON agent_run_events (run_id, sequence);

CREATE INDEX IF NOT EXISTS idx_agent_run_events_workspace_type
    ON agent_run_events (workspace_id, event_type, created_at DESC);

ALTER TABLE agent_run_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_run_events_tenant_isolation ON agent_run_events;
CREATE POLICY agent_run_events_tenant_isolation ON agent_run_events
    USING (workspace_id::text = ANY (
        SELECT jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
    ));


-- ─── 5. agent_run_approvals — pending human-review items ────────────────────
CREATE TABLE IF NOT EXISTS agent_run_approvals (
    id                TEXT         PRIMARY KEY,
    run_id            UUID         NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    workspace_id      UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    agent_id          UUID         NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    status            TEXT         NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'rejected', 'edited')),
    reason            TEXT,
    trust_score       NUMERIC(4,3),
    confidence        NUMERIC(4,3),
    final_output_excerpt  TEXT,
    edited_output     TEXT,
    reviewed_by       TEXT,
    reviewed_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_run_approvals_pending
    ON agent_run_approvals (workspace_id, created_at DESC)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_agent_run_approvals_run
    ON agent_run_approvals (run_id, created_at DESC);

ALTER TABLE agent_run_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_run_run_approvals_tenant_isolation ON agent_run_approvals;
CREATE POLICY agent_run_run_approvals_tenant_isolation ON agent_run_approvals
    USING (workspace_id::text = ANY (
        SELECT jsonb_array_elements_text(auth.jwt() -> 'workspace_ids')
    ));


COMMIT;
