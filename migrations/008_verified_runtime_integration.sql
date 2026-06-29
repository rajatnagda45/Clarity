-- =============================================================================
-- Migration 008 — Verified runtime integration
-- Adds additive persistence for claim extraction, verification metadata,
-- calibrated trust, and abstention details used by Phase B1.
-- =============================================================================

alter table claims
  alter column span_ids type text[] using coalesce(span_ids::text[], '{}'::text[]);

alter table claims
  add column if not exists answer_run_id uuid references answer_runs(id) on delete cascade,
  add column if not exists claim_index int not null default 0,
  add column if not exists citation_keys text[] not null default '{}',
  add column if not exists section text,
  add column if not exists verification_pass int not null default 1,
  add column if not exists critic_status text,
  add column if not exists critic_note text,
  add column if not exists corrected_text text,
  add column if not exists support_probability numeric(3,2) check (support_probability between 0.00 and 1.00),
  add column if not exists contradiction_probability numeric(3,2) check (contradiction_probability between 0.00 and 1.00);

create index if not exists claims_answer_run_idx
  on claims (answer_run_id, claim_index);

alter table claims
  drop constraint if exists claims_critic_status_check;

alter table claims
  add constraint claims_critic_status_check
  check (critic_status is null or critic_status in ('supported', 'partial', 'unsupported'));

alter table answer_runs
  add column if not exists trust_faithfulness numeric(3,2) check (trust_faithfulness between 0.00 and 1.00),
  add column if not exists trust_relevance numeric(3,2) check (trust_relevance between 0.00 and 1.00),
  add column if not exists trust_overall numeric(3,2) check (trust_overall between 0.00 and 1.00),
  add column if not exists trust_confidence numeric(3,2) check (trust_confidence between 0.00 and 1.00),
  add column if not exists trust_calibrated boolean not null default false,
  add column if not exists confidence_band text,
  add column if not exists verification_passes int not null default 1,
  add column if not exists claim_count int not null default 0,
  add column if not exists supported_claim_count int not null default 0,
  add column if not exists abstained boolean not null default false;

alter table answer_runs
  drop constraint if exists answer_runs_confidence_band_check;

alter table answer_runs
  add constraint answer_runs_confidence_band_check
  check (confidence_band is null or confidence_band in ('low', 'medium', 'high'));

alter table abstentions
  add column if not exists suggested_follow_up text;
