from __future__ import annotations

import asyncio
import time

from openai import APITimeoutError, OpenAI, RateLimitError

from config import settings
from services.embeddings.base import EmbeddingProvider, EmbeddingProviderError, EmbeddingProviderRetryableError
from services.embeddings.models import (
    EmbeddingBatchResult,
    EmbeddingRequestItem,
    EmbeddingTarget,
    GeneratedEmbedding,
)


class OpenAIEmbeddingProvider(EmbeddingProvider):
    def __init__(self) -> None:
        self._client = OpenAI(api_key=settings.openai_api_key, timeout=settings.embedding_timeout_seconds)
        self._target = EmbeddingTarget(
            provider=settings.embedding_provider,
            model=settings.embed_model,
            dimension=settings.embed_dim,
            version=settings.embedding_version,
            parser_version=settings.parser_version,
            chunk_version=settings.chunk_version,
        )

    @property
    def target(self) -> EmbeddingTarget:
        return self._target

    async def embed(self, items: list[EmbeddingRequestItem]) -> EmbeddingBatchResult:
        started = time.perf_counter()
        try:
            response = await asyncio.to_thread(
                self._client.embeddings.create,
                model=self._target.model,
                input=[item.text for item in items],
            )
        except (RateLimitError, APITimeoutError) as exc:
            raise EmbeddingProviderRetryableError(str(exc)) from exc
        except Exception as exc:
            raise EmbeddingProviderError(str(exc)) from exc

        vectors = [row.embedding for row in response.data]
        if len(vectors) != len(items):
            raise EmbeddingProviderError("Embedding provider returned an unexpected vector count.")

        batch_latency_ms = int((time.perf_counter() - started) * 1000)
        per_item_latency_ms = int(batch_latency_ms / max(len(items), 1))
        embeddings = [
            GeneratedEmbedding(
                workspace_id=item.workspace_id,
                document_id=item.document_id,
                chunk_id=item.chunk_id,
                chunk_index=item.chunk_index,
                embedding_provider=self._target.provider,
                embedding_model=self._target.model,
                embedding_dimension=self._target.dimension,
                embedding_version=self._target.version,
                parser_version=self._target.parser_version,
                chunk_version=self._target.chunk_version,
                checksum=item.checksum,
                token_count=item.token_count,
                latency_ms=max(per_item_latency_ms, 0),
                retry_count=0,
                estimated_cost_usd=(item.token_count / 1000) * settings.embedding_cost_per_1k_tokens_usd,
                vector_preview=[float(value) for value in vectors[index][:10]],
                vector=[float(value) for value in vectors[index]]
                if settings.persist_embedding_vectors_locally
                else None,
            )
            for index, item in enumerate(items)
        ]

        return EmbeddingBatchResult(
            target=self._target,
            embeddings=embeddings,
            batch_latency_ms=batch_latency_ms,
        )
