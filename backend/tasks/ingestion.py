"""ARQ task wrapper — document ingestion."""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def run_document_ingestion(ctx: dict, document_id: str, workspace_id: str) -> dict:
    """
    ARQ entrypoint for the full ingestion pipeline:
    extraction → normalisation → chunking → embedding → indexing.

    The underlying pipeline uses optimistic lease locking, so re-runs of
    a document that is already in a terminal stage are safe no-ops.
    """
    logger.info("task:run_document_ingestion doc=%s ws=%s", document_id, workspace_id)
    try:
        from services.ingestion.pipeline import run_document_ingestion_task
        await run_document_ingestion_task(document_id, workspace_id)
        return {"status": "ok", "document_id": document_id}
    except Exception as exc:
        logger.exception("ingestion task failed doc=%s: %s", document_id, exc)
        raise
