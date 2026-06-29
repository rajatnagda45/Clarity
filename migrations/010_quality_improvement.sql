-- B4: Autonomous Quality Improvement Platform
-- Adds prompt versioning, optimization recommendations, quality gates,
-- release notes, and benchmark suggestion tables.
-- Extends experiments and experiment_candidates for retrieval strategy tracking.

-- ─── Extend experiments ───────────────────────────────────────────────────────

ALTER TABLE experiments
  ADD COLUMN IF NOT EXISTS benchmark_id        uuid REFERENCES benchmark_datasets(id),
  ADD COLUMN IF NOT EXISTS retrieval_strategy  text,
  ADD COLUMN IF NOT EXISTS outcome             text CHECK (outcome IN ('candidate_a', 'candidate_b', 'tie', 'inconclusive'));

-- ─── Extend experiment_candidates ────────────────────────────────────────────

ALTER TABLE experiment_candidates
  ADD COLUMN IF NOT EXISTS retrieval_strategy text;

-- ─── Prompt versions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prompt_versions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prompt_key   text        NOT NULL,  -- "writer" | "critic" | "judge"
  version      text        NOT NULL,  -- e.g. "b4.writer.v2"
  description  text,
  content      text        NOT NULL,
  author       text,
  active       boolean     NOT NULL DEFAULT false,
  retired      boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_prompt_versions_key_ver
  ON prompt_versions (workspace_id, prompt_key, version);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_workspace
  ON prompt_versions (workspace_id, prompt_key, active);

-- ─── Optimization recommendations ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS optimization_recommendations (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  dimension    text        NOT NULL,
  severity     text        NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  recommendation text      NOT NULL,
  evidence     jsonb,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'accepted', 'dismissed')),
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_optimization_workspace
  ON optimization_recommendations (workspace_id, status, created_at DESC);

-- ─── Quality gate rules ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quality_gate_rules (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  metric       text        NOT NULL,  -- "judge_overall" | "hallucination_risk" | "trust" | "latency_ms"
  operator     text        NOT NULL CHECK (operator IN ('gte', 'lte', 'gt', 'lt')),
  threshold    numeric     NOT NULL,
  active       boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quality_gate_rules_workspace
  ON quality_gate_rules (workspace_id, active);

-- ─── Quality gate runs ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quality_gate_runs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  benchmark_run_id  uuid        REFERENCES benchmark_runs(id),
  experiment_id     uuid        REFERENCES experiments(id),
  rules_evaluated   int         NOT NULL DEFAULT 0,
  rules_passed      int         NOT NULL DEFAULT 0,
  rules_failed      int         NOT NULL DEFAULT 0,
  passed            boolean     NOT NULL DEFAULT false,
  details           jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quality_gate_runs_workspace
  ON quality_gate_runs (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quality_gate_runs_benchmark
  ON quality_gate_runs (benchmark_run_id);

-- ─── Release notes ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS release_notes (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title             text        NOT NULL,
  from_version      text,
  to_version        text        NOT NULL,
  summary           text        NOT NULL,
  metrics_delta     jsonb,
  benchmark_run_id  uuid        REFERENCES benchmark_runs(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_release_notes_workspace
  ON release_notes (workspace_id, created_at DESC);

-- ─── Benchmark suggestions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS benchmark_suggestions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  answer_run_id     uuid        REFERENCES answer_runs(id),
  question          text        NOT NULL,
  suggested_reason  text        NOT NULL,
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'approved', 'dismissed')),
  approved_case_id  uuid        REFERENCES benchmark_cases(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_suggestions_workspace
  ON benchmark_suggestions (workspace_id, status, created_at DESC);

-- RLS on all new tables follows the workspace-scoped standard.
-- Enable RLS at deploy time: ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
