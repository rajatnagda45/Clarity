-- Rollback for migration 016 — Benchmark Platform
-- Run ONLY to undo migration 016. All data in these tables will be lost.
drop table if exists benchmark_runs cascade;
drop table if exists benchmark_cases cascade;
drop table if exists benchmark_datasets cascade;
