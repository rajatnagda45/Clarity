-- Migration: pipeline_events table
-- Run this in your Supabase SQL editor (or via psql) once to enable
-- persistent pipeline event history, history replay on SSE reconnect,
-- and the developer console timeline view.
--
-- Safe to re-run: all statements use IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS pipeline_events (
    id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id   text        NOT NULL,
    document_id    text        NOT NULL,
    filename       text,
    stage          text        NOT NULL,
    status         text        NOT NULL,
    progress       integer     NOT NULL DEFAULT 0,
    elapsed_ms     integer     NOT NULL DEFAULT 0,
    worker         text,
    retry_count    integer     NOT NULL DEFAULT 0,
    error          text,
    -- Per-stage wall-clock durations (ms). Keys: fetch_ms, extract_ms,
    -- normalize_ms, preprocess_ms, chunk_ms, persist_ms, embed_ms, upsert_ms
    stage_timings  jsonb,
    -- Snapshot of the worker process at event time.
    -- Keys: pid, hostname, memory_mb, cpu_percent, worker_version, build
    worker_info    jsonb,
    created_at     timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS pipeline_events_ws_doc
    ON pipeline_events (workspace_id, document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pipeline_events_ws_time
    ON pipeline_events (workspace_id, created_at DESC);

-- Automatically purge events older than 30 days to keep the table lean.
-- Requires pg_cron (available in Supabase). Remove if pg_cron is not enabled.
-- SELECT cron.schedule(
--     'cleanup-pipeline-events',
--     '0 3 * * *',
--     $$DELETE FROM pipeline_events WHERE created_at < now() - interval '30 days'$$
-- );
