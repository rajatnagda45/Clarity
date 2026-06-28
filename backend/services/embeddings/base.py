from __future__ import annotations

from abc import ABC, abstractmethod

from services.embeddings.models import EmbeddingBatchResult, EmbeddingRequestItem, EmbeddingTarget


class EmbeddingProviderError(Exception):
    pass


class EmbeddingProviderRetryableError(EmbeddingProviderError):
    pass


class EmbeddingProvider(ABC):
    @property
    @abstractmethod
    def target(self) -> EmbeddingTarget: ...

    @abstractmethod
    async def embed(self, items: list[EmbeddingRequestItem]) -> EmbeddingBatchResult: ...
