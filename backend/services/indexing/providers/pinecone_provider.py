from __future__ import annotations

import asyncio
import time

from config import settings
from services.indexing.base import IndexProvider, IndexProviderError, IndexProviderRetryableError
from services.indexing.models import IndexBatchResult, IndexVectorRecord, IndexingTarget


def _classify_pinecone_error(exc: Exception) -> IndexProviderError:
    message = str(exc).lower()
    if any(
        marker in message
        for marker in ("rate limit", "timeout", "temporarily", "unavailable", "connection")
    ):
        return IndexProviderRetryableError(str(exc))
    return IndexProviderError(str(exc))


class PineconeIndexProvider(IndexProvider):
    def __init__(self) -> None:
        from pinecone import Pinecone

        self._client = Pinecone(api_key=settings.pinecone_api_key)
        self._index = self._client.Index(settings.pinecone_index)

    @property
    def provider_name(self) -> str:
        return "pinecone"

    async def upsert(
        self,
        target: IndexingTarget,
        records: list[IndexVectorRecord],
    ) -> IndexBatchResult:
        started = time.perf_counter()
        payload = [
            {
                "id": record.vector_id,
                "values": record.vector,
                "metadata": record.metadata,
            }
            for record in records
        ]
        try:
            await asyncio.to_thread(
                self._index.upsert,
                vectors=payload,
                namespace=target.namespace,
            )
        except Exception as exc:  # pragma: no cover - SDK-specific branches are integration-only
            raise _classify_pinecone_error(exc) from exc

        return IndexBatchResult(
            target=target,
            vector_ids=[record.vector_id for record in records],
            batch_latency_ms=int((time.perf_counter() - started) * 1000),
        )

    async def delete(
        self,
        target: IndexingTarget,
        vector_ids: list[str],
    ) -> int:
        if not vector_ids:
            return 0

        try:
            await asyncio.to_thread(
                self._index.delete,
                ids=vector_ids,
                namespace=target.namespace,
            )
        except Exception as exc:  # pragma: no cover - SDK-specific branches are integration-only
            raise _classify_pinecone_error(exc) from exc

        return len(vector_ids)
