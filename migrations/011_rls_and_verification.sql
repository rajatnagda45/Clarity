-- Migration 011: RLS policies for B4 tables + verification pipeline tables
-- Applies row-level security to all B4 quality-improvement tables and adds
-- the three verification tables (claims, debate_turns, abstentions).

-- ============================================================
-- 1. Enable RLS on B4 tables (missing from 010)
-- ============================================================

ALTER TABLE prompt_versions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_gate_rules           ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_gate_runs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_notes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_suggestions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiments                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_candidates        ENABLE ROW LEVEL SECURITY;

-- ---- prompt_versions ----
CREATE POLICY prompt_versions_workspace_isolation ON prompt_versions
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

-- ---- optimization_recommendations ----
CREATE POLICY opt_recs_workspace_isolation ON optimization_recommendations
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

-- ---- quality_gate_rules ----
CREATE POLICY gate_rules_workspace_isolation ON quality_gate_rules
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

-- ---- quality_gate_runs ----
CREATE POLICY gate_runs_workspace_isolation ON quality_gate_runs
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

-- ---- release_notes ----
CREATE POLICY release_notes_workspace_isolation ON release_notes
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

-- ---- benchmark_suggestions ----
CREATE POLICY benchmark_suggestions_workspace_isolation ON benchmark_suggestions
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

-- ---- experiments ----
CREATE POLICY experiments_workspace_isolation ON experiments
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

-- ---- experiment_candidates ----
CREATE POLICY experiment_candidates_workspace_isolation ON experiment_candidates
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

-- ============================================================
-- 2. Verification pipeline tables
-- ============================================================

-- Drop old-format tables created by 001_initial_schema.sql (used message_id).
-- RC2 replaces them with answer_run_id references. CASCADE removes stale FKs.
DROP TABLE IF EXISTS debate_turns CASCADE;
DROP TABLE IF EXISTS abstentions  CASCADE;
DROP TABLE IF EXISTS claims       CASCADE;

-- Per-claim two-signal verdict stored against an answer_run
CREATE TABLE claims (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        uuid NOT NULL,
    answer_run_id       uuid NOT NULL REFERENCES answer_runs(id) ON DELETE CASCADE,
    claim_text          text NOT NULL,
    critic_verdict      text NOT NULL CHECK (critic_verdict IN ('supported', 'unsupported', 'uncertain')),
    nli_label           text NOT NULL CHECK (nli_label IN ('entail', 'neutral', 'contradict')),
    nli_score           numeric(4,3) NOT NULL CHECK (nli_score BETWEEN 0 AND 1),
    ensemble_verdict    text NOT NULL CHECK (ensemble_verdict IN ('supported', 'unsupported', 'uncertain')),
    evidence_spans      jsonb NOT NULL DEFAULT '[]',
    debate_turn         integer NOT NULL DEFAULT 1,
    created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY claims_workspace_isolation ON claims
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

CREATE INDEX IF NOT EXISTS claims_answer_run_id_idx ON claims(answer_run_id);
CREATE INDEX IF NOT EXISTS claims_workspace_id_idx  ON claims(workspace_id);

-- Critic ↔ Writer debate rounds stored for replay
CREATE TABLE debate_turns (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  uuid NOT NULL,
    answer_run_id uuid NOT NULL REFERENCES answer_runs(id) ON DELETE CASCADE,
    turn_number   integer NOT NULL,
    claim_text    text NOT NULL,
    critic_verdict text NOT NULL,
    reasoning     text NOT NULL DEFAULT '',
    created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE debate_turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY debate_turns_workspace_isolation ON debate_turns
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

CREATE INDEX IF NOT EXISTS debate_turns_answer_run_id_idx ON debate_turns(answer_run_id);

-- Abstention records — when calibrated trust < threshold the system declines to answer
CREATE TABLE abstentions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        uuid NOT NULL,
    answer_run_id       uuid NOT NULL REFERENCES answer_runs(id) ON DELETE CASCADE,
    reason              text NOT NULL,
    trust_score         numeric(4,3) NOT NULL CHECK (trust_score BETWEEN 0 AND 1),
    threshold           numeric(4,3) NOT NULL,
    missing_evidence_query text,
    created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE abstentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY abstentions_workspace_isolation ON abstentions
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

CREATE INDEX IF NOT EXISTS abstentions_answer_run_id_idx ON abstentions(answer_run_id);
CREATE INDEX IF NOT EXISTS abstentions_workspace_id_idx  ON abstentions(workspace_id);

-- ============================================================
-- 3. Add rerank_score column to retrieval_run_evidence
-- ============================================================

ALTER TABLE retrieval_run_evidence
    ADD COLUMN IF NOT EXISTS rerank_score numeric(6,5);
