from __future__ import annotations

from io import BytesIO
from zipfile import ZipFile

import fitz
import pytest

from services.ingestion.extractors.docx import DocxExtractionError, extract_docx_document
from services.ingestion.extractors.pdf import PdfExtractionError, extract_pdf_document
from services.ingestion.normalizer import normalize_extracted_document
from services.ingestion.preprocessor import preprocess_document


def _sample_pdf_bytes() -> bytes:
    pdf = fitz.open()
    page = pdf.new_page()
    page.insert_text((72, 72), "1. Termination\nEither party may terminate with thirty days notice.")
    payload = pdf.tobytes()
    pdf.close()
    return payload


def _sample_docx_bytes() -> bytes:
    buffer = BytesIO()
    with ZipFile(buffer, "w") as archive:
        archive.writestr(
            "[Content_Types].xml",
            """<?xml version="1.0" encoding="UTF-8"?>
            <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
              <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
              <Default Extension="xml" ContentType="application/xml"/>
              <Override PartName="/word/document.xml"
                ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
            </Types>""",
        )
        archive.writestr(
            "_rels/.rels",
            """<?xml version="1.0" encoding="UTF-8"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1"
                Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
                Target="word/document.xml"/>
            </Relationships>""",
        )
        archive.writestr(
            "word/document.xml",
            """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
              <w:body>
                <w:p><w:r><w:t>2. Renewal</w:t></w:r></w:p>
                <w:p><w:r><w:t>The agreement renews annually unless cancelled.</w:t></w:r></w:p>
              </w:body>
            </w:document>""",
        )
    return buffer.getvalue()


def test_extract_pdf_document_returns_blocks_and_page_count():
    extracted = extract_pdf_document(_sample_pdf_bytes())

    assert extracted.source_type == "pdf"
    assert extracted.page_count == 1
    assert extracted.blocks
    assert "Termination" in extracted.full_text


def test_extract_docx_document_returns_blocks():
    extracted = extract_docx_document(_sample_docx_bytes())

    assert extracted.source_type == "docx"
    assert extracted.page_count == 1
    assert len(extracted.blocks) == 2
    assert "Renewal" in extracted.full_text


def test_extract_docx_document_rejects_invalid_archive():
    with pytest.raises(DocxExtractionError):
        extract_docx_document(b"not-a-docx")


def test_extract_pdf_document_rejects_invalid_payload():
    with pytest.raises(PdfExtractionError):
        extract_pdf_document(b"not-a-pdf")


def test_normalize_and_preprocess_document_builds_clause_segments():
    extracted = extract_pdf_document(_sample_pdf_bytes())
    normalized = normalize_extracted_document(extracted)
    preprocessing = preprocess_document(normalized, "sha256")

    assert normalized.blocks
    assert preprocessing.metadata.page_count == 1
    assert preprocessing.metadata.block_count == len(normalized.blocks)
    assert preprocessing.segments[0].kind in {"heading", "clause", "paragraph"}
