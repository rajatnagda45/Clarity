from __future__ import annotations

from pathlib import Path


def test_document_ingestion_migration_is_safe_to_reapply():
    migration = Path(__file__).resolve().parents[2] / "migrations" / "002_document_ingestion_pipeline.sql"
    sql = migration.read_text(encoding="utf-8")

    assert "drop constraint if exists documents_status_check" in sql
    assert "add column if not exists ingestion_run_id text" in sql
    assert "create table if not exists document_ingestion_artifacts" in sql
    assert "create index if not exists document_ingestion_artifacts_workspace_id_idx" in sql
    assert "drop policy if exists document_ingestion_artifacts_tenant_isolation" in sql


def test_chunking_migration_is_safe_to_reapply():
    migration = Path(__file__).resolve().parents[2] / "migrations" / "003_chunking_pipeline.sql"
    sql = migration.read_text(encoding="utf-8")

    assert "drop constraint if exists documents_status_check" in sql
    assert "add column if not exists chunk_id text" in sql
    assert "add column if not exists chunk_version text" in sql
    assert "create unique index if not exists chunks_chunk_id_idx" in sql
    assert "create unique index if not exists chunks_document_version_index_idx" in sql


def test_embedding_migration_is_safe_to_reapply():
    migration = Path(__file__).resolve().parents[2] / "migrations" / "004_embedding_pipeline.sql"
    sql = migration.read_text(encoding="utf-8")

    assert "drop constraint if exists documents_status_check" in sql
    assert "add column if not exists embedding_run_id text" in sql
    assert "create table if not exists chunk_embeddings" in sql
    assert "create unique index if not exists chunk_embeddings_identity_idx" in sql
    assert "drop policy if exists chunk_embeddings_tenant_isolation" in sql


def test_vector_indexing_migration_is_safe_to_reapply():
    migration = Path(__file__).resolve().parents[2] / "migrations" / "005_vector_indexing_pipeline.sql"
    sql = migration.read_text(encoding="utf-8")

    assert "drop constraint if exists documents_status_check" in sql
    assert "add column if not exists index_run_id text" in sql
    assert "create table if not exists chunk_vector_index_records" in sql
    assert "create unique index if not exists chunk_vector_index_records_identity_idx" in sql
    assert "drop policy if exists chunk_vector_index_records_tenant_isolation" in sql


def test_retrieval_migration_is_safe_to_reapply():
    migration = Path(__file__).resolve().parents[2] / "migrations" / "006_hybrid_retrieval_engine.sql"
    sql = migration.read_text(encoding="utf-8")

    assert "create table if not exists retrieval_events" in sql
    assert "create index if not exists retrieval_events_workspace_created_idx" in sql
    assert "drop policy if exists retrieval_events_tenant_isolation" in sql


def test_answer_generation_migration_is_safe_to_reapply():
    migration = Path(__file__).resolve().parents[2] / "migrations" / "007_answer_generation_platform.sql"
    sql = migration.read_text(encoding="utf-8")

    assert "add column if not exists last_message_at timestamptz" in sql
    assert "create table if not exists retrieval_runs" in sql
    assert "create table if not exists retrieval_run_evidence" in sql
    assert "create unique index if not exists answer_runs_workspace_request_idx" in sql
    assert "create table if not exists answer_stream_events" in sql
    assert "drop policy if exists message_citations_tenant_isolation" in sql
