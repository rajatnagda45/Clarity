from __future__ import annotations

from io import BytesIO

import fitz

from services.ingestion.models import ExtractedBlock, ExtractedDocument


class PdfExtractionError(ValueError):
    pass


def extract_pdf_document(payload: bytes) -> ExtractedDocument:
    if not payload:
        raise PdfExtractionError("PDF payload is empty.")

    try:
        pdf = fitz.open(stream=BytesIO(payload), filetype="pdf")
    except Exception as exc:  # pragma: no cover - PyMuPDF raises format-specific errors
        raise PdfExtractionError("Unable to open PDF document.") from exc

    blocks: list[ExtractedBlock] = []
    page_texts: list[str] = []

    try:
        page_count = pdf.page_count
        for page_index, page in enumerate(pdf, start=1):
            raw_blocks = sorted(
                page.get_text("blocks"),
                key=lambda item: (round(item[1], 3), round(item[0], 3)),
            )

            page_cursor = 0
            page_parts: list[str] = []
            page_blocks = 0

            for raw_block in raw_blocks:
                text = (raw_block[4] or "").strip()
                if not text:
                    continue

                start = page_cursor
                end = start + len(text)
                blocks.append(
                    ExtractedBlock(
                        page=page_index,
                        order=page_blocks,
                        text=text,
                        char_start=start,
                        char_end=end,
                    )
                )
                page_cursor = end + 1
                page_blocks += 1
                page_parts.append(text)

            page_text = "\n".join(page_parts).strip()
            if page_text:
                page_texts.append(page_text)

    finally:
        pdf.close()

    if not blocks:
        raise PdfExtractionError("PDF extraction produced no readable text.")

    return ExtractedDocument(
        source_type="pdf",
        page_count=max(1, page_count),
        blocks=blocks,
        full_text="\n\n".join(page_texts),
    )
