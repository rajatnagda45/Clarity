from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import fitz
import pytest


def _sample_pdf_bytes() -> bytes:
    pdf = fitz.open()
    page = pdf.new_page()
    page.insert_text((72, 72), "1. Confidentiality\nThe parties must protect confidential information.")
    payload = pdf.tobytes()
    pdf.close()
    return payload


def _build_documents_table(row: dict, execute_count: int) -> MagicMock:
    table = MagicMock()
    table.select.return_value = table
    table.eq.return_value = table
    table.is_.return_value = table
    table.limit.return_value = table
    table.update.return_value = table
    table.execute.side_effect = [SimpleNamespace(data=[row])] + [
        SimpleNamespace(data=[{"id": row["id"]}]) for _ in range(execute_count - 1)
    ]
    return table


def _document_row(**overrides):
    row = {
        "id": "doc-1",
        "workspace_id": "ws-1",
        "r2_key": "workspaces/ws-1/documents/doc-1/msa.pdf",
        "source_type": "pdf",
        "status": "uploaded",
        "ingestion_run_id": None,
        "ingestion_started_at": None,
    }
    row.update(overrides)
    return row


@pytest.mark.asyncio
async def test_run_document_ingestion_transitions_document_to_awaiting_chunking():
    from services.ingestion import pipeline as ingestion_pipeline

    row = _document_row()

    documents_table = _build_documents_table(row, execute_count=6)
    artifacts_table = MagicMock()
    artifacts_table.upsert.return_value = artifacts_table
    artifacts_table.execute.return_value = SimpleNamespace(data=[])

    usage_table = MagicMock()
    usage_table.insert.return_value = usage_table
    usage_table.execute.return_value = SimpleNamespace(data=[])

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "documents": documents_table,
        "document_ingestion_artifacts": artifacts_table,
        "usage_events": usage_table,
    }[name]

    with patch.object(ingestion_pipeline, "get_client", return_value=client_mock), patch.object(
        ingestion_pipeline, "fetch_document_source", return_value=_sample_pdf_bytes()
    ):
        await ingestion_pipeline.run_document_ingestion("doc-1", "ws-1")

    statuses = [
        call.args[0]["status"]
        for call in documents_table.update.call_args_list
        if "status" in call.args[0]
    ]
    assert statuses == ["extracted", "normalized", "metadata_ready", "awaiting_chunking"]
    assert artifacts_table.upsert.call_count == 3
    assert usage_table.insert.call_count == 1
    assert documents_table.update.call_args_list[-1].args[0]["ingestion_run_id"] is None


@pytest.mark.asyncio
async def test_run_document_ingestion_marks_failed_on_extraction_error():
    from services.ingestion import pipeline as ingestion_pipeline

    row = _document_row(id="doc-2", r2_key="workspaces/ws-1/documents/doc-2/bad.pdf")

    documents_table = _build_documents_table(row, execute_count=3)

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "documents": documents_table,
        "document_ingestion_artifacts": MagicMock(),
        "usage_events": MagicMock(),
    }[name]

    with patch.object(ingestion_pipeline, "get_client", return_value=client_mock), patch.object(
        ingestion_pipeline, "fetch_document_source", return_value=b"bad-pdf"
    ):
        await ingestion_pipeline.run_document_ingestion("doc-2", "ws-1")

    assert documents_table.update.call_args_list[-1].args[0]["status"] == "failed"
    assert documents_table.update.call_args_list[-1].args[0]["error"]


@pytest.mark.asyncio
async def test_run_document_ingestion_skips_documents_already_awaiting_chunking():
    from services.ingestion import pipeline as ingestion_pipeline

    row = _document_row(
        id="doc-3",
        r2_key="workspaces/ws-1/documents/doc-3/ready.pdf",
        status="awaiting_chunking",
    )

    documents_table = _build_documents_table(row, execute_count=1)
    artifacts_table = MagicMock()
    usage_table = MagicMock()

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: {
        "documents": documents_table,
        "document_ingestion_artifacts": artifacts_table,
        "usage_events": usage_table,
    }[name]

    with patch.object(ingestion_pipeline, "get_client", return_value=client_mock), patch.object(
        ingestion_pipeline, "fetch_document_source"
    ) as fetch_mock:
        await ingestion_pipeline.run_document_ingestion("doc-3", "ws-1")

    fetch_mock.assert_not_called()
    artifacts_table.upsert.assert_not_called()
    usage_table.insert.assert_not_called()


def test_claim_ingestion_lease_rejects_concurrent_attempts():
    from services.ingestion import pipeline as ingestion_pipeline

    active_row = _document_row(
        ingestion_run_id="run-active",
        ingestion_started_at="2099-06-28T12:00:00+00:00",
    )

    with patch.object(ingestion_pipeline, "_load_document", return_value=active_row):
        with pytest.raises(ingestion_pipeline.IngestionBusy):
            ingestion_pipeline._claim_ingestion_lease("doc-1", "ws-1")


def test_claim_ingestion_lease_allows_stale_retry():
    from services.ingestion import pipeline as ingestion_pipeline

    stale_row = _document_row(
        ingestion_run_id="run-stale",
        ingestion_started_at="2000-06-28T12:00:00+00:00",
    )

    documents_table = MagicMock()
    documents_table.update.return_value = documents_table
    documents_table.eq.return_value = documents_table
    documents_table.execute.return_value = SimpleNamespace(data=[{"id": "doc-1"}])

    client_mock = MagicMock()
    client_mock.table.return_value = documents_table

    with patch.object(ingestion_pipeline, "_load_document", return_value=stale_row), patch.object(
        ingestion_pipeline, "get_client", return_value=client_mock
    ):
        _, run_id = ingestion_pipeline._claim_ingestion_lease("doc-1", "ws-1")

    assert run_id
    assert documents_table.eq.call_args_list[-1].args == ("ingestion_run_id", "run-stale")


def test_stale_failure_cannot_overwrite_completed_document():
    from services.ingestion import pipeline as ingestion_pipeline

    documents_table = MagicMock()
    documents_table.update.return_value = documents_table
    documents_table.eq.return_value = documents_table
    documents_table.execute.return_value = SimpleNamespace(data=[])

    client_mock = MagicMock()
    client_mock.table.return_value = documents_table

    with patch.object(ingestion_pipeline, "get_client", return_value=client_mock):
        with pytest.raises(ingestion_pipeline.IngestionOwnershipLost):
            ingestion_pipeline._finalize_document(
                "doc-1",
                "ws-1",
                "run-lost",
                status="failed",
                error="late failure",
            )
