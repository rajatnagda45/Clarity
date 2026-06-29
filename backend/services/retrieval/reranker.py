from __future__ import annotations

import hashlib
import json
from collections import OrderedDict
from dataclasses import dataclass
from threading import Lock
from time import monotonic

import cohere

from config import settings


@dataclass
class RerankResult:
    chunk_id: str
    score: float


@dataclass
class _CacheEntry:
    value: list[RerankResult]
    expires_at: float


class _RerankCache:
    def __init__(self, max_entries: int = 128) -> None:
        self._entries: OrderedDict[str, _CacheEntry] = OrderedDict()
        self._lock = Lock()
        self._max_entries = max_entries

    def get(self, key: str) -> list[RerankResult] | None:
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            if entry.expires_at <= monotonic():
                self._entries.pop(key, None)
                return None
            self._entries.move_to_end(key)
            return entry.value

    def set(self, key: str, value: list[RerankResult]) -> None:
        with self._lock:
            self._entries[key] = _CacheEntry(
                value=value,
                expires_at=monotonic() + settings.rerank_cache_ttl_seconds,
            )
            self._entries.move_to_end(key)
            while len(self._entries) > self._max_entries:
                self._entries.popitem(last=False)


_cache = _RerankCache()


def _cache_key(query: str, rows: list[dict]) -> str:
    payload = {
        "query": query,
        "rows": [(row["chunk_id"], row["document_id"], row["text"]) for row in rows],
        "model": settings.rerank_model,
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()


class CohereReranker:
    def __init__(self) -> None:
        self._client = cohere.ClientV2(api_key=settings.cohere_api_key)

    async def rerank(self, query: str, rows: list[dict], *, top_n: int) -> list[RerankResult]:
        key = _cache_key(query, rows)
        cached = _cache.get(key)
        if cached is not None:
            return cached[:top_n]

        response = self._client.rerank(
            model=settings.rerank_model,
            query=query,
            documents=[row["text"] for row in rows],
            top_n=min(top_n, len(rows)),
        )
        results = [
            RerankResult(chunk_id=rows[item.index]["chunk_id"], score=float(item.relevance_score))
            for item in response.results
        ]
        _cache.set(key, results)
        return results


_provider: CohereReranker | None = None


def get_reranker() -> CohereReranker:
    global _provider
    if _provider is None:
        _provider = CohereReranker()
    return _provider
