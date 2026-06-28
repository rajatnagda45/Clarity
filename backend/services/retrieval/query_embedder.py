from __future__ import annotations

from abc import ABC, abstractmethod

from openai import AsyncOpenAI

from config import settings


class QueryEmbeddingProvider(ABC):
    @abstractmethod
    async def embed(self, query: str) -> list[float]: ...


class OpenAIQueryEmbeddingProvider(QueryEmbeddingProvider):
    def __init__(self) -> None:
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def embed(self, query: str) -> list[float]:
        response = await self._client.embeddings.create(
            model=settings.embed_model,
            input=query,
            dimensions=settings.embed_dim,
        )
        return [float(value) for value in response.data[0].embedding]


def get_query_embedding_provider() -> QueryEmbeddingProvider:
    if settings.embedding_provider == "openai":
        return OpenAIQueryEmbeddingProvider()
    raise ValueError(f"Unsupported query embedding provider '{settings.embedding_provider}'.")
