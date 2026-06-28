from __future__ import annotations

from abc import ABC, abstractmethod

from services.indexing.models import IndexBatchResult, IndexVectorRecord, IndexingTarget


class IndexProviderError(Exception):
    pass


class IndexProviderRetryableError(IndexProviderError):
    pass


class IndexProvider(ABC):
    @property
    @abstractmethod
    def provider_name(self) -> str: ...

    @abstractmethod
    async def upsert(
        self,
        target: IndexingTarget,
        records: list[IndexVectorRecord],
    ) -> IndexBatchResult: ...

    @abstractmethod
    async def delete(
        self,
        target: IndexingTarget,
        vector_ids: list[str],
    ) -> int: ...
