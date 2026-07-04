-- Rollback for migration 014 — Agents Platform
-- Run ONLY to undo migration 014. All data in these tables will be lost.
drop table if exists review_queue cascade;
drop table if exists agent_tool_calls cascade;
drop table if exists agent_runs cascade;
drop table if exists agents cascade;
