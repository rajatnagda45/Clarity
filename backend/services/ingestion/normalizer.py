from __future__ import annotations

import re
import unicodedata

from services.ingestion.models import ExtractedDocument, NormalizedBlock, NormalizedDocument


MULTISPACE_RE = re.compile(r"[ \t]+")
MULTINEWLINE_RE = re.compile(r"\n{3,}")


def _normalize_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text or "")
    normalized = normalized.replace("\xa0", " ")
    normalized = MULTISPACE_RE.sub(" ", normalized)
    normalized = MULTINEWLINE_RE.sub("\n\n", normalized)
    return normalized.strip()


def normalize_extracted_document(document: ExtractedDocument) -> NormalizedDocument:
    blocks: list[NormalizedBlock] = []
    page_cursor: dict[int, int] = {}
    page_texts: dict[int, list[str]] = {}

    for block in document.blocks:
        text = _normalize_text(block.text)
        if not text:
            continue

        cursor = page_cursor.get(block.page, 0)
        start = cursor
        end = start + len(text)

        blocks.append(
            NormalizedBlock(
                page=block.page,
                order=block.order,
                text=text,
                char_start=start,
                char_end=end,
            )
        )

        page_cursor[block.page] = end + 1
        page_texts.setdefault(block.page, []).append(text)

    if not blocks:
        raise ValueError("Normalization removed all extracted text.")

    ordered_pages = [page_texts[page] for page in sorted(page_texts)]
    full_text = "\n\n".join("\n".join(parts) for parts in ordered_pages)

    return NormalizedDocument(
        source_type=document.source_type,
        page_count=document.page_count,
        blocks=blocks,
        full_text=full_text,
    )
