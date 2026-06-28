from __future__ import annotations

import re

from services.ingestion.models import (
    DocumentMetadata,
    NormalizedDocument,
    PreprocessingResult,
    PreprocessingSegment,
)


CLAUSE_PREFIX_RE = re.compile(r"^\d+(?:\.\d+)*[\).]?\s+")
HEADING_RE = re.compile(r"^[A-Z][A-Z0-9\s,&/-]{3,}$")


def _segment_kind(text: str) -> str:
    if CLAUSE_PREFIX_RE.match(text):
        return "clause"
    if HEADING_RE.match(text):
        return "heading"
    return "paragraph"


def preprocess_document(document: NormalizedDocument, source_sha256: str) -> PreprocessingResult:
    segments = [
        PreprocessingSegment(
            page=block.page,
            block_order=block.order,
            kind=_segment_kind(block.text),
            label=block.text[:120],
            char_start=block.char_start,
            char_end=block.char_end,
        )
        for block in document.blocks
    ]

    raw_character_count = sum(len(block.text) for block in document.blocks)
    raw_word_count = sum(len(block.text.split()) for block in document.blocks)
    normalized_character_count = len(document.full_text)
    normalized_word_count = len(document.full_text.split())

    metadata = DocumentMetadata(
        source_sha256=source_sha256,
        page_count=document.page_count,
        block_count=len(document.blocks),
        character_count=raw_character_count,
        word_count=raw_word_count,
        normalized_character_count=normalized_character_count,
        normalized_word_count=normalized_word_count,
    )

    return PreprocessingResult(metadata=metadata, segments=segments)
