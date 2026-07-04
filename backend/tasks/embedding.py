"""ARQ task wrapper — document embedding."""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def run_document_embedding(ctx: dict, document_id: str, workspace_id: str) -> dict:
    """
    ARQ entrypoint for the embedding pipeline: generate OpenAI embeddings
    for all chunks of a document, then chain to indexing.
    """
    logger.info("task:run_document_embedding doc=%s ws=%s", document_id, workspace_id)
    try:
        from services.embeddings.pipeline import run_document_embedding_task
        await run_document_embedding_task(document_id, workspace_id)
        return {"status": "ok", "document_id": document_id}
    except Exception as exc:
        logger.exception("embedding task failed doc=%s: %s", document_id, exc)
        raise
