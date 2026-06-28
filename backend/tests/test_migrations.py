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
