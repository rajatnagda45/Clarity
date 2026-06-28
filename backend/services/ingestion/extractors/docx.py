from __future__ import annotations

from io import BytesIO
from zipfile import BadZipFile, ZipFile
from xml.etree import ElementTree

from services.ingestion.models import ExtractedBlock, ExtractedDocument


WORD_NAMESPACE = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


class DocxExtractionError(ValueError):
    pass


def extract_docx_document(payload: bytes) -> ExtractedDocument:
    if not payload:
        raise DocxExtractionError("DOCX payload is empty.")

    try:
        archive = ZipFile(BytesIO(payload))
    except BadZipFile as exc:
        raise DocxExtractionError("Unable to open DOCX archive.") from exc

    try:
        try:
            document_xml = archive.read("word/document.xml")
        except KeyError as exc:
            raise DocxExtractionError("DOCX document.xml is missing.") from exc
    finally:
        archive.close()

    try:
        root = ElementTree.fromstring(document_xml)
    except ElementTree.ParseError as exc:
        raise DocxExtractionError("DOCX document.xml is malformed.") from exc

    blocks: list[ExtractedBlock] = []
    page_parts: list[str] = []
    cursor = 0

    for paragraph_index, paragraph in enumerate(root.findall(".//w:body/w:p", WORD_NAMESPACE)):
        text_parts = [
            node.text or ""
            for node in paragraph.findall(".//w:t", WORD_NAMESPACE)
            if node.text
        ]
        text = "".join(text_parts).strip()
        if not text:
            continue

        start = cursor
        end = start + len(text)
        blocks.append(
            ExtractedBlock(
                page=1,
                order=paragraph_index,
                text=text,
                char_start=start,
                char_end=end,
            )
        )
        cursor = end + 1
        page_parts.append(text)

    if not blocks:
        raise DocxExtractionError("DOCX extraction produced no readable text.")

    return ExtractedDocument(
        source_type="docx",
        page_count=1,
        blocks=blocks,
        full_text="\n\n".join(page_parts),
    )
