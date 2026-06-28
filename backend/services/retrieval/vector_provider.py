from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod

from config import settings
from services.indexing.inspector import build_index_namespace
from services.retrieval.models import DenseCandidate


class VectorSearchProviderError(Exception):
    pass


class VectorSearchProvider(ABC):
    @abstractmethod
    async def search(
        self,
        *,
        workspace_id: str,
        vector: list[float],
        top_k: int,
        document_ids: list[str],
    ) -> list[DenseCandidate]: ...


class PineconeVectorSearchProvider(VectorSearchProvider):
    def __init__(self) -> None:
        from pinecone import Pinecone

        self._client = Pinecone(api_key=settings.pinecone_api_key)
        self._index = self._client.Index(settings.pinecone_index)

    async def search(
        self,
        *,
        workspace_id: str,
        vector: list[float],
        top_k: int,
        document_ids: list[str],
    ) -> list[DenseCandidate]:
        metadata_filter = {"workspace_id": {"$eq": workspace_id}}
        if document_ids:
            metadata_filter["document_id"] = {"$in": document_ids}

        try:
            response = await asyncio.to_thread(
                self._index.query,
                vector=vector,
                top_k=top_k,
                namespace=build_index_namespace(workspace_id),
                include_metadata=True,
                filter=metadata_filter,
            )
        except Exception as exc:  # pragma: no cover - SDK/integration branch
            raise VectorSearchProviderError(str(exc)) from exc

        matches = getattr(response, "matches", None) or response.get("matches", [])
        candidates: list[DenseCandidate] = []
        for rank, match in enumerate(matches, start=1):
            metadata = getattr(match, "metadata", None) or match.get("metadata", {})
            candidates.append(
                DenseCandidate(
                    vectorId=getattr(match, "id", None) or match.get("id"),
                    chunkId=str(metadata["chunk_id"]),
                    documentId=str(metadata["document_id"]),
                    score=float(getattr(match, "score", None) or match.get("score") or 0.0),
                    rank=rank,
                )
            )
        return candidates


def get_vector_search_provider() -> VectorSearchProvider:
    if settings.index_provider == "pinecone":
        return PineconeVectorSearchProvider()
    raise ValueError(f"Unsupported vector search provider '{settings.index_provider}'.")
