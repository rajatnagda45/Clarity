"""
Sprint 1 ingestion verification suite.

Checks:
  1. 10 PDFs uploaded consecutively all complete without stalling.
  2. Every document reaches a terminal state — none stuck in processing.
  3. No duplicate pipeline runs when ARQ and BackgroundTask both fire.
  4. Exactly one ingestion pipeline executes per document.
  5. Workers recover cleanly after a simulated mid-pipeline crash (stale lease).
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import fitz
import pytest


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

def _make_pdf(text: str = "1. Confidentiality\nParties must protect confidential information.") -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), text)
    payload = doc.tobytes()
    doc.close()
    return payload


PDF_BYTES = _make_pdf()


def _ts(offset_seconds: int = 0) -> str:
    return (datetime.now(UTC) + timedelta(seconds=offset_seconds)).isoformat()


def _base_doc(doc_id: str, ws_id: str = "ws-1", **overrides) -> dict:
    return {
        "id": doc_id,
        "workspace_id": ws_id,
        "filename": f"{doc_id}.pdf",
        "r2_key": f"workspaces/{ws_id}/documents/{doc_id}/{doc_id}.pdf",
        "source_type": "pdf",
        "status": "uploaded",
        "ingestion_run_id": None,
        "ingestion_started_at": None,
        "ingestion_completed_at": None,
        **overrides,
    }


# ---------------------------------------------------------------------------
# In-memory document store with CAS support
# ---------------------------------------------------------------------------

class InMemoryDocumentTable:
    """
    In-memory replica of the documents table with proper compare-and-swap.

    Every status transition is appended to status_history for assertion in
    tests. All access is synchronous because the production DB calls are
    synchronous (get_client() returns a sync Supabase client).
    """

    def __init__(self, rows: list[dict]) -> None:
        self._rows: dict[str, dict] = {r["id"]: dict(r) for r in rows}
        self.status_history: dict[str, list[str]] = defaultdict(list)

    def select_one(self, doc_id: str) -> dict | None:
        row = self._rows.get(doc_id)
        return dict(row) if row else None

    def sync_update(self, doc_id: str, payload: dict, where: dict) -> dict | None:
        """
        Atomic compare-and-swap: apply payload only if all WHERE conditions
        match. A WHERE value of None means the column must be NULL.
        Returns the updated row on success, None on condition mismatch.
        """
        row = self._rows.get(doc_id)
        if row is None:
            return None
        for k, v in where.items():
            if v is None:
                if row.get(k) is not None:
                    return None
            else:
                if row.get(k) != v:
                    return None
        row.update(payload)
        if "status" in payload and payload["status"] is not None:
            self.status_history[doc_id].append(payload["status"])
        return dict(row)


def _build_shared_mock_client(tables: dict[str, InMemoryDocumentTable]) -> MagicMock:
    """
    Build a single get_client() mock that routes all documents-table calls to
    the correct InMemoryDocumentTable based on the doc_id supplied via
    .eq("id", doc_id). All other tables return empty success.

    Using a single shared client avoids the problem of concurrent patch.object
    calls in asyncio.gather overwriting each other.
    """

    class _QB:
        """Tracks one builder chain (select or update) for a single table call."""

        def __init__(self, table_name: str) -> None:
            self._tname = table_name
            self._payload: dict = {}
            self._where: dict = {}
            self._is_update = False

        def select(self, *_, **__):
            return self

        def eq(self, col: str, val):
            self._where[col] = val
            return self

        def is_(self, col: str, val):
            # .is_("col", "null") means the column must be NULL
            self._where[col] = None
            return self

        def in_(self, *_, **__):
            return self

        def order(self, *_, **__):
            return self

        def limit(self, *_, **__):
            return self

        def upsert(self, *_, **__):
            return self

        def delete(self, *_, **__):
            return self

        def insert(self, *_, **__):
            return self

        def update(self, payload: dict):
            self._payload = dict(payload)
            self._is_update = True
            return self

        def execute(self) -> SimpleNamespace:
            if self._tname != "documents":
                return SimpleNamespace(data=[])

            doc_id: str | None = self._where.get("id")
            if doc_id is None:
                return SimpleNamespace(data=[])

            tbl = tables.get(doc_id)
            if tbl is None:
                return SimpleNamespace(data=[])

            if self._is_update:
                row = tbl.sync_update(doc_id, self._payload, self._where)
                return SimpleNamespace(data=[row] if row else [])
            else:
                row = tbl.select_one(doc_id)
                return SimpleNamespace(data=[row] if row else [])

    client = MagicMock()
    client.table.side_effect = lambda name: _QB(name)
    return client


# ---------------------------------------------------------------------------
# 1 + 2 + 4 · Ten documents — all succeed, none stuck, one extraction each
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ten_documents_all_complete_successfully():
    """
    Ten documents processed concurrently via run_document_ingestion.
    All must reach a terminal state; extraction must run exactly once per doc.
    """
    from services.ingestion import pipeline as ip

    n = 10
    doc_ids = [f"doc-{i:02d}" for i in range(n)]
    ws_id = "ws-batch"

    tables = {d: InMemoryDocumentTable([_base_doc(d, ws_id)]) for d in doc_ids}
    shared_client = _build_shared_mock_client(tables)

    extraction_calls = {"total": 0}
    original_extract = ip._extract_document

    def _counting_extract(source_type, payload):
        extraction_calls["total"] += 1
        return original_extract(source_type, payload)

    with (
        patch.object(ip, "get_client", return_value=shared_client),
        patch.object(ip, "fetch_document_source", return_value=PDF_BYTES),
        patch.object(ip, "_extract_document", side_effect=_counting_extract),
        patch.object(ip, "run_document_embedding_task", new=AsyncMock()),
    ):
        await asyncio.gather(*[ip.run_document_ingestion(d, ws_id) for d in doc_ids])

    # All 10 must have advanced past the initial 'uploaded' status
    stalled = [d for d in doc_ids if not tables[d].status_history[d]]
    assert not stalled, f"These documents never transitioned: {stalled}"

    # None may be stuck in an intermediate processing state
    processing = {"uploaded", "extracted", "normalized", "metadata_ready", "awaiting_chunking", "chunking"}
    stuck = [
        d for d in doc_ids
        if tables[d].status_history[d] and tables[d].status_history[d][-1] in processing
    ]
    assert not stuck, (
        "Documents stuck in a processing state:\n"
        + "\n".join(f"  {d}: {tables[d].status_history[d]}" for d in stuck)
    )

    # Exactly one extraction per document
    assert extraction_calls["total"] == n, (
        f"Expected {n} total extractions (one per doc), got {extraction_calls['total']}"
    )


# ---------------------------------------------------------------------------
# 3 + 4 · No duplicate execution when ARQ + BackgroundTask both fire
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_no_duplicate_execution_when_both_arq_and_background_task_fire():
    """
    Both the ARQ worker and the FastAPI BackgroundTask call run_document_ingestion
    for the same document. The in-memory CAS must ensure only one wins the lease;
    extraction must run exactly once.
    """
    from services.ingestion import pipeline as ip

    doc_id = "doc-dedup"
    ws_id = "ws-1"
    table = InMemoryDocumentTable([_base_doc(doc_id, ws_id)])
    shared_client = _build_shared_mock_client({doc_id: table})

    extraction_calls = {"n": 0}
    original_extract = ip._extract_document

    def _counting_extract(source_type, payload):
        extraction_calls["n"] += 1
        return original_extract(source_type, payload)

    with (
        patch.object(ip, "get_client", return_value=shared_client),
        patch.object(ip, "fetch_document_source", return_value=PDF_BYTES),
        patch.object(ip, "_extract_document", side_effect=_counting_extract),
        patch.object(ip, "run_document_embedding_task", new=AsyncMock()),
    ):
        # Simulate ARQ + BackgroundTask racing for the same document
        await asyncio.gather(
            ip.run_document_ingestion(doc_id, ws_id),
            ip.run_document_ingestion(doc_id, ws_id),
        )

    assert extraction_calls["n"] == 1, (
        f"Extraction ran {extraction_calls['n']} times — duplicate execution not prevented by lease"
    )
    assert table.status_history[doc_id], "No status transitions recorded — pipeline did not run"


@pytest.mark.asyncio
async def test_concurrent_claim_second_raises_ingestion_busy():
    """
    _claim_ingestion_lease must raise IngestionBusy when a live (non-stale)
    lease already exists on the document.
    """
    from services.ingestion import pipeline as ip

    live_row = _base_doc(
        "doc-race",
        ingestion_run_id="run-live",
        ingestion_started_at=_ts(0),  # fresh — well within lease window
    )
    with patch.object(ip, "_load_document", return_value=live_row):
        with pytest.raises(ip.IngestionBusy):
            ip._claim_ingestion_lease("doc-race", "ws-1")


# ---------------------------------------------------------------------------
# 5 · Worker crash recovery via stale lease
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_crash_recovery_via_stale_lease():
    """
    A document with a stale ingestion_run_id (worker crashed mid-pipeline)
    must be picked up by the next invocation and complete successfully.
    """
    from services.ingestion import pipeline as ip
    from config import settings

    doc_id = "doc-crashed"
    ws_id = "ws-1"
    stale_started_at = _ts(-(settings.ingestion_lease_seconds + 10))

    crashed_doc = _base_doc(
        doc_id, ws_id,
        status="extracted",
        ingestion_run_id="run-crashed",
        ingestion_started_at=stale_started_at,
    )
    table = InMemoryDocumentTable([crashed_doc])
    shared_client = _build_shared_mock_client({doc_id: table})

    extraction_calls = {"n": 0}
    original_extract = ip._extract_document

    def _counting_extract(source_type, payload):
        extraction_calls["n"] += 1
        return original_extract(source_type, payload)

    with (
        patch.object(ip, "get_client", return_value=shared_client),
        patch.object(ip, "fetch_document_source", return_value=PDF_BYTES),
        patch.object(ip, "_extract_document", side_effect=_counting_extract),
        patch.object(ip, "run_document_embedding_task", new=AsyncMock()),
    ):
        await ip.run_document_ingestion(doc_id, ws_id)

    assert table.status_history[doc_id], (
        "No status transitions recorded — pipeline did not recover from crash"
    )
    assert "chunked" in table.status_history[doc_id], (
        f"Recovery must reach 'chunked'. Got: {table.status_history[doc_id]}"
    )
    assert extraction_calls["n"] == 1, "Recovery run must extract exactly once"


def test_stale_lease_threshold_uses_settings():
    """
    Lease expiry threshold is read from settings.ingestion_lease_seconds.
    A lease 1s before the threshold is live (raises IngestionBusy).
    A lease 1s past the threshold is stale (new run allowed).
    """
    from services.ingestion import pipeline as ip
    from config import settings

    lease_secs = settings.ingestion_lease_seconds

    # 1s before deadline → still live → raises IngestionBusy
    live_row = _base_doc(
        "doc-live",
        ingestion_run_id="run-live",
        ingestion_started_at=_ts(-(lease_secs - 1)),
    )
    with patch.object(ip, "_load_document", return_value=live_row):
        with pytest.raises(ip.IngestionBusy):
            ip._claim_ingestion_lease("doc-live", "ws-1")

    # 1s past deadline → stale → CAS must target the old run_id
    stale_row = _base_doc(
        "doc-stale",
        ingestion_run_id="run-stale",
        ingestion_started_at=_ts(-(lease_secs + 1)),
    )
    cas_mock = MagicMock()
    cas_mock.update.return_value = cas_mock
    cas_mock.eq.return_value = cas_mock
    cas_mock.is_.return_value = cas_mock
    cas_mock.execute.return_value = SimpleNamespace(data=[{"id": "doc-stale"}])

    client_mock = MagicMock()
    client_mock.table.return_value = cas_mock

    with (
        patch.object(ip, "_load_document", return_value=stale_row),
        patch.object(ip, "get_client", return_value=client_mock),
    ):
        _, run_id = ip._claim_ingestion_lease("doc-stale", "ws-1")

    assert run_id is not None, "Stale lease must yield a fresh run_id"
    # CAS must lock on the old run_id so concurrent recovery attempts
    # can't both claim the lease
    assert any(
        c.args == ("ingestion_run_id", "run-stale")
        for c in cas_mock.eq.call_args_list
    ), "CAS must filter on the old ingestion_run_id when breaking a stale lease"


# ---------------------------------------------------------------------------
# 2 (edge) · Extraction failure → 'failed', lease cleared for retries
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_failed_document_reaches_terminal_status_not_stuck():
    """
    A bad PDF (extraction error) must land on status='failed' and clear the
    ingestion_run_id so subsequent retries can claim the lease.
    """
    from services.ingestion import pipeline as ip

    doc_id = "doc-fail"
    ws_id = "ws-1"
    table = InMemoryDocumentTable([_base_doc(doc_id, ws_id)])
    shared_client = _build_shared_mock_client({doc_id: table})

    with (
        patch.object(ip, "get_client", return_value=shared_client),
        patch.object(ip, "fetch_document_source", return_value=b"NOT_A_VALID_PDF"),
    ):
        await ip.run_document_ingestion(doc_id, ws_id)

    assert table.status_history[doc_id], "Pipeline must run and record at least one status"
    final = table.status_history[doc_id][-1]
    assert final == "failed", f"Expected 'failed', got '{final}'"

    row = table.select_one(doc_id)
    assert row is not None
    assert row.get("ingestion_run_id") is None, (
        "ingestion_run_id must be cleared after failure so retries can claim the lease"
    )


# ---------------------------------------------------------------------------
# Status ordering
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ingestion_status_sequence_is_correct():
    """
    Status transitions must occur in the exact documented order.
    'chunking' must appear BEFORE chunks are generated (not after).
    """
    from services.ingestion import pipeline as ip

    doc_id = "doc-seq"
    ws_id = "ws-1"
    table = InMemoryDocumentTable([_base_doc(doc_id, ws_id)])
    shared_client = _build_shared_mock_client({doc_id: table})

    with (
        patch.object(ip, "get_client", return_value=shared_client),
        patch.object(ip, "fetch_document_source", return_value=PDF_BYTES),
        patch.object(ip, "run_document_embedding_task", new=AsyncMock()),
    ):
        await ip.run_document_ingestion(doc_id, ws_id)

    expected = [
        "extracted",
        "normalized",
        "metadata_ready",
        "awaiting_chunking",
        "chunking",
        "chunked",
        "awaiting_embeddings",
    ]
    assert table.status_history[doc_id] == expected, (
        f"Status sequence mismatch:\n"
        f"  got:      {table.status_history[doc_id]}\n"
        f"  expected: {expected}"
    )


# ---------------------------------------------------------------------------
# Upload handler: both ARQ enqueue + BackgroundTask must be present
# ---------------------------------------------------------------------------

def test_upload_handler_schedules_both_arq_and_background_task():
    """
    The upload endpoint must schedule a BackgroundTask AND enqueue an ARQ job.
    The BackgroundTask is the safety net when no ARQ worker is running.
    """
    import inspect
    from api.routers import documents as documents_router

    source = inspect.getsource(documents_router.upload_document)
    assert "background_tasks.add_task" in source, (
        "upload_document must always schedule a BackgroundTask as a safety net"
    )
    assert "enqueue_job" in source, (
        "upload_document must also enqueue to ARQ for when the worker is running"
    )


# ---------------------------------------------------------------------------
# Lease timeouts must be short enough to avoid long stalls
# ---------------------------------------------------------------------------

def test_lease_timeouts_are_short_enough_to_not_cause_long_stalls():
    """
    All lease timeouts must be <= 300 seconds.
    The original 900s value caused 40+ minute stalls when workers crashed
    (3 stages x 15 min worst case).
    """
    from config import settings

    for attr, label in [
        ("ingestion_lease_seconds", "ingestion"),
        ("embedding_lease_seconds", "embedding"),
        ("index_lease_seconds", "indexing"),
    ]:
        value = getattr(settings, attr)
        assert value <= 300, (
            f"{label} lease timeout is {value}s — must be <= 300s to prevent "
            "long stalls when workers crash."
        )
