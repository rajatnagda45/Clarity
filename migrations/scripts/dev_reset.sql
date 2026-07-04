-- Helper rollback for Phase 0 schema verification.
-- Run only against a disposable development database.

drop table if exists subscriptions cascade;
drop table if exists usage_events cascade;
drop table if exists quality_rollups cascade;
drop table if exists eval_case_results cascade;
drop table if exists eval_cases cascade;
drop table if exists eval_runs cascade;
drop table if exists contradictions cascade;
drop table if exists debate_turns cascade;
drop table if exists abstentions cascade;
drop table if exists answer_evals cascade;
drop table if exists claims cascade;
drop table if exists messages cascade;
drop table if exists conversations cascade;
drop table if exists clauses cascade;
drop table if exists chunks cascade;
drop table if exists documents cascade;
drop table if exists memberships cascade;
drop table if exists reference_clauses cascade;
drop table if exists workspaces cascade;
