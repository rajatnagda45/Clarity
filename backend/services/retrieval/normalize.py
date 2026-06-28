from __future__ import annotations

import re

from services.retrieval.models import NormalizedQuery


WHITESPACE_RE = re.compile(r"\s+")
TOKEN_RE = re.compile(r"[a-z0-9]+(?:\.[a-z0-9]+)*")
CLAUSE_REF_RE = re.compile(
    r"\b(?:section|clause|article)\s+(\d+(?:\.\d+)*(?:\([a-z0-9]+\))?)\b",
    re.IGNORECASE,
)
QUOTED_PHRASE_RE = re.compile(r'"([^"]+)"')


def normalize_query(query: str) -> NormalizedQuery:
    normalized = WHITESPACE_RE.sub(" ", query.strip().lower())
    clause_refs = []
    for match in CLAUSE_REF_RE.findall(normalized):
        if match not in clause_refs:
            clause_refs.append(match)
    quoted_phrases = [phrase.strip().lower() for phrase in QUOTED_PHRASE_RE.findall(query) if phrase.strip()]
    tokens = TOKEN_RE.findall(normalized)

    return NormalizedQuery(
        rawQuery=query,
        normalizedQuery=normalized,
        tokens=tokens,
        clauseRefs=clause_refs,
        quotedPhrases=quoted_phrases,
    )


def tokenize_text(text: str) -> list[str]:
    normalized = WHITESPACE_RE.sub(" ", text.strip().lower())
    return TOKEN_RE.findall(normalized)
