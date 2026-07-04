"""ARQ task wrapper — document vector indexing."""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def run_document_indexing(ctx: dict, document_id: str, workspace_id: str) -> dict:
    """
    ARQ entrypoint for the indexing pipeline: upsert document chunk
    embeddings into Pinecone.
    """
    logger.info("task:run_document_indexing doc=%s ws=%s", document_id, workspace_id)
    try:
        from services.indexing.pipeline import run_document_indexing_task
        await run_document_indexing_task(document_id, workspace_id)
        return {"status": "ok", "document_id": document_id}
    except Exception as exc:
        logger.exception("indexing task failed doc=%s: %s", document_id, exc)
        raise
