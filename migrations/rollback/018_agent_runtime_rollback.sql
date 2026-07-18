-- Rollback for migration 018
BEGIN;

DROP POLICY IF EXISTS agent_run_run_approvals_tenant_isolation ON agent_run_approvals;
DROP TABLE IF EXISTS agent_run_approvals CASCADE;

DROP POLICY IF EXISTS agent_run_events_tenant_isolation ON agent_run_events;
DROP TABLE IF EXISTS agent_run_events CASCADE;

DROP POLICY IF EXISTS agent_run_memory_tenant_isolation ON agent_run_memory;
DROP TABLE IF EXISTS agent_run_memory CASCADE;

DROP POLICY IF EXISTS agent_run_nodes_tenant_isolation ON agent_run_nodes;
DROP TABLE IF EXISTS agent_run_nodes CASCADE;

ALTER TABLE agent_runs
    DROP COLUMN IF EXISTS plan,
    DROP COLUMN IF EXISTS current_node,
    DROP COLUMN IF EXISTS max_depth,
    DROP COLUMN IF EXISTS max_loop_count,
    DROP COLUMN IF EXISTS total_tokens_in,
    DROP COLUMN IF EXISTS total_tokens_out,
    DROP COLUMN IF EXISTS total_cost_usd,
    DROP COLUMN IF EXISTS pause_reason,
    DROP COLUMN IF EXISTS resumed_at,
    DROP COLUMN IF EXISTS current_step_index,
    DROP COLUMN IF EXISTS last_error,
    DROP COLUMN IF EXISTS agent_config,
    DROP COLUMN IF EXISTS stream_requested,
    DROP COLUMN IF EXISTS judge_scores,
    DROP COLUMN IF EXISTS abstention_reason;

COMMIT;
