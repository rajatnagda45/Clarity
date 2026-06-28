from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass
from threading import Lock
from time import monotonic
from typing import Any

from config import settings


@dataclass
class CacheEntry:
    value: Any
    expires_at: float


class RetrievalCache:
    def __init__(self, *, max_entries: int = 128) -> None:
        self._entries: OrderedDict[str, CacheEntry] = OrderedDict()
        self._lock = Lock()
        self._max_entries = max_entries

    def get(self, key: str) -> Any | None:
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            if entry.expires_at <= monotonic():
                self._entries.pop(key, None)
                return None
            self._entries.move_to_end(key)
            return entry.value

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._entries[key] = CacheEntry(
                value=value,
                expires_at=monotonic() + settings.retrieval_cache_ttl_seconds,
            )
            self._entries.move_to_end(key)
            while len(self._entries) > self._max_entries:
                self._entries.popitem(last=False)


_cache = RetrievalCache()


def get_retrieval_cache() -> RetrievalCache:
    return _cache
