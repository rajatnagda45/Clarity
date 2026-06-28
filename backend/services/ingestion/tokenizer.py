from __future__ import annotations

import logging
import re

import tiktoken


logger = logging.getLogger(__name__)
FALLBACK_TOKEN_RE = re.compile(r"\w+|[^\w\s]", re.UNICODE)
_encoding: tiktoken.Encoding | None = None
_fallback_logged = False


def _get_encoding() -> tiktoken.Encoding | None:
    global _encoding, _fallback_logged

    if _encoding is not None:
        return _encoding

    try:
        _encoding = tiktoken.encoding_for_model("text-embedding-3-small")
    except Exception:
        try:
            _encoding = tiktoken.get_encoding("cl100k_base")
        except Exception:
            if not _fallback_logged:
                logger.warning("tiktoken_encoding_unavailable_falling_back_to_regex_tokenizer")
                _fallback_logged = True
            return None

    return _encoding


def count_tokens(text: str) -> int:
    encoding = _get_encoding()
    if encoding is None:
        return max(1, len(FALLBACK_TOKEN_RE.findall(text or "")))
    return max(1, len(encoding.encode(text or "")))
