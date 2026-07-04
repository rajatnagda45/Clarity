-- Rollback for migration 015 — Enterprise Platform
-- Run ONLY to undo migration 015. All data in these tables will be lost.
drop table if exists audit_logs cascade;
drop table if exists workspace_integrations cascade;
drop table if exists prompt_library cascade;
drop table if exists automation_rules cascade;
drop table if exists webhook_deliveries cascade;
drop table if exists webhooks cascade;
drop table if exists api_keys cascade;
drop table if exists workflows cascade;
drop table if exists collection_documents cascade;
drop table if exists collections cascade;
