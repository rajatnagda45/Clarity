-- B3: Continuous Evaluation & Self-Improvement Platform
-- Extends answer_evals with 7-dimension LLM-as-judge scores (0–100 scale).
-- Adds benchmark, regression, and experiment tables.

-- ─── Extend answer_evals ──────────────────────────────────────────────────────

ALTER TABLE answer_evals
  ADD COLUMN IF NOT EXISTS answer_run_id        uuid REFERENCES answer_runs(id),
  ADD COLUMN IF NOT EXISTS judge_provider        text,
  ADD COLUMN IF NOT EXISTS judge_model           text,
  ADD COLUMN IF NOT EXISTS judge_prompt_version  text,
  ADD COLUMN IF NOT EXISTS judge_latency_ms      int,
  -- 0–100 integer scores from the LLM judge (distinct from the 0–1 RAGAS metrics)
  ADD COLUMN IF NOT EXISTS judge_faithfulness    smallint CHECK (judge_faithfulness    BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS judge_grounding       smallint CHECK (judge_grounding       BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS judge_completeness    smallint CHECK (judge_completeness    BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS judge_correctness     smallint CHECK (judge_correctness     BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS judge_clarity         smallint CHECK (judge_clarity         BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS judge_citation_quality smallint CHECK (judge_citation_quality BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS judge_hallucination_risk smallint CHECK (judge_hallucination_risk BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS judge_overall         smallint CHECK (judge_overall         BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS judge_reasoning       jsonb;   -- {"faithfulness": "...", ...}

CREATE INDEX IF NOT EXISTS idx_answer_evals_answer_run_id
  ON answer_evals (answer_run_id);

CREATE INDEX IF NOT EXISTS idx_answer_evals_workspace_judge_overall
  ON answer_evals (workspace_id, judge_overall);

-- ─── Extend quality_rollups ──────────────────────────────────────────────────

ALTER TABLE quality_rollups
  ADD COLUMN IF NOT EXISTS avg_judge_overall       numeric(5, 2),
  ADD COLUMN IF NOT EXISTS avg_hallucination_risk  numeric(5, 2),
  ADD COLUMN IF NOT EXISTS avg_confidence_score    numeric(3, 2),
  ADD COLUMN IF NOT EXISTS abstention_count        int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_pass_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_answers           int NOT NULL DEFAULT 0;

-- ─── Benchmark datasets ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS benchmark_datasets (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  dataset_type text        NOT NULL CHECK (dataset_type IN ('contract_qa', 'lease_qa', 'policy_qa', 'custom')),
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_datasets_workspace
  ON benchmark_datasets (workspace_id);

-- ─── Benchmark cases ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS benchmark_cases (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  dataset_id      uuid        NOT NULL REFERENCES benchmark_datasets(id) ON DELETE CASCADE,
  question        text        NOT NULL,
  reference_answer text,
  document_ids    text[]      NOT NULL DEFAULT '{}',
  expected_citations jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_cases_dataset
  ON benchmark_cases (dataset_id);

CREATE INDEX IF NOT EXISTS idx_benchmark_cases_workspace
  ON benchmark_cases (workspace_id);

-- ─── Benchmark runs ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS benchmark_runs (
  id                           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                 uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  dataset_id                   uuid        NOT NULL REFERENCES benchmark_datasets(id),
  prompt_version               text        NOT NULL,
  model_version                text        NOT NULL,
  writer_version               text        NOT NULL,
  verification_runtime_version text        NOT NULL,
  status                       text        NOT NULL DEFAULT 'running'
                                           CHECK (status IN ('running', 'completed', 'failed')),
  total_cases                  int         NOT NULL DEFAULT 0,
  completed_cases              int         NOT NULL DEFAULT 0,
  failed_cases                 int         NOT NULL DEFAULT 0,
  avg_judge_overall            numeric(5, 2),
  avg_trust_confidence         numeric(3, 2),
  avg_latency_ms               int,
  total_cost_usd               numeric(10, 6),
  started_at                   timestamptz,
  completed_at                 timestamptz,
  error_detail                 text,
  created_at                   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_runs_workspace
  ON benchmark_runs (workspace_id, created_at DESC);

-- ─── Benchmark run results ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS benchmark_run_results (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id           uuid        NOT NULL REFERENCES benchmark_runs(id) ON DELETE CASCADE,
  case_id          uuid        NOT NULL REFERENCES benchmark_cases(id),
  answer_run_id    uuid        REFERENCES answer_runs(id),
  eval_id          uuid        REFERENCES answer_evals(id),
  judge_overall    smallint    CHECK (judge_overall BETWEEN 0 AND 100),
  trust_confidence numeric(3, 2),
  latency_ms       int,
  abstained        boolean     NOT NULL DEFAULT false,
  error            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_run_results_run
  ON benchmark_run_results (run_id);

-- ─── Regression reports ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS regression_reports (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  current_eval_id             uuid        NOT NULL REFERENCES answer_evals(id),
  window_size                 int         NOT NULL,
  baseline_avg_judge_overall  numeric(5, 2),
  current_judge_overall       smallint,
  judge_overall_delta         numeric(5, 2),
  baseline_avg_trust_confidence numeric(3, 2),
  current_trust_confidence    numeric(3, 2),
  trust_confidence_delta      numeric(5, 2),
  baseline_avg_hallucination_risk numeric(5, 2),
  current_hallucination_risk  smallint,
  hallucination_risk_delta    numeric(5, 2),
  has_regression              boolean     NOT NULL DEFAULT false,
  regression_flags            text[]      NOT NULL DEFAULT '{}',
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regression_reports_workspace
  ON regression_reports (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_regression_reports_eval
  ON regression_reports (current_eval_id);

-- ─── Experiments ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS experiments (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name                text        NOT NULL,
  description         text,
  status              text        NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active', 'completed', 'archived')),
  winner_candidate_id uuid,       -- FK added below after experiment_candidates is created
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experiments_workspace
  ON experiments (workspace_id, status);

-- ─── Experiment candidates ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS experiment_candidates (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  experiment_id        uuid        NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  name                 text        NOT NULL,
  prompt_version       text        NOT NULL,
  model_version        text        NOT NULL,
  writer_version       text        NOT NULL,
  avg_judge_overall    numeric(5, 2),
  avg_trust_confidence numeric(3, 2),
  avg_latency_ms       int,
  avg_cost_usd         numeric(10, 6),
  eval_count           int         NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experiment_candidates_experiment
  ON experiment_candidates (experiment_id);

-- Add FK from experiments.winner_candidate_id → experiment_candidates.id
ALTER TABLE experiments
  ADD CONSTRAINT fk_experiments_winner
  FOREIGN KEY (winner_candidate_id)
  REFERENCES experiment_candidates(id)
  ON DELETE SET NULL;

-- RLS: all new tables follow the standard workspace-scoped pattern.
-- Enable after applying: ALTER TABLE ... ENABLE ROW LEVEL SECURITY; (done at deploy time)
