from __future__ import annotations

from services.ingestion.chunker import generate_chunks
from services.ingestion.models import (
    DocumentMetadata,
    NormalizedBlock,
    NormalizedDocument,
    PreprocessingResult,
    PreprocessingSegment,
)


def _build_document(blocks: list[tuple[int, int, str]], source_type: str = "pdf") -> NormalizedDocument:
    normalized_blocks = []
    page_cursors: dict[int, int] = {}
    for page, order, text in blocks:
        cursor = page_cursors.get(page, 0)
        start = cursor
        end = start + len(text)
        normalized_blocks.append(
            NormalizedBlock(
                page=page,
                order=order,
                text=text,
                char_start=start,
                char_end=end,
            )
        )
        page_cursors[page] = end + 1

    return NormalizedDocument(
        source_type=source_type,
        page_count=max(page for page, _, _ in blocks),
        blocks=normalized_blocks,
        full_text="\n".join(text for _, _, text in blocks),
    )


def _build_preprocessing(blocks: list[tuple[int, int, str]], kinds: list[str]) -> PreprocessingResult:
    return PreprocessingResult(
        metadata=DocumentMetadata(
            source_sha256="sha256",
            page_count=max(page for page, _, _ in blocks),
            block_count=len(blocks),
            character_count=sum(len(text) for _, _, text in blocks),
            word_count=sum(len(text.split()) for _, _, text in blocks),
            normalized_character_count=sum(len(text) for _, _, text in blocks),
            normalized_word_count=sum(len(text.split()) for _, _, text in blocks),
        ),
        segments=[
            PreprocessingSegment(
                page=page,
                block_order=order,
                kind=kind,  # type: ignore[arg-type]
                label=text[:120],
                char_start=0,
                char_end=len(text),
            )
            for (page, order, text), kind in zip(blocks, kinds, strict=True)
        ],
    )


def test_generate_chunks_preserves_simple_contract_clause_order():
    blocks = [
        (1, 0, "TERMINATION"),
        (1, 1, "1. Either party may terminate for convenience on thirty days notice."),
        (1, 2, "2. Confidential information must remain protected."),
    ]
    document = _build_document(blocks)
    preprocessing = _build_preprocessing(blocks, ["heading", "clause", "clause"])

    chunks = generate_chunks("ws-1", "doc-1", document, preprocessing)

    assert len(chunks) == 1
    assert chunks[0].section_title == "TERMINATION"
    assert chunks[0].clause_number == "1"
    assert chunks[0].chunk_index == 0


def test_generate_chunks_splits_large_contract_deterministically():
    long_clause = "1. " + "Payment is due within thirty days. " * 120
    blocks = [(1, 0, "PAYMENT"), (1, 1, long_clause)]
    document = _build_document(blocks)
    preprocessing = _build_preprocessing(blocks, ["heading", "clause"])

    first_run = generate_chunks("ws-1", "doc-2", document, preprocessing)
    second_run = generate_chunks("ws-1", "doc-2", document, preprocessing)

    assert len(first_run) > 1
    assert [chunk.chunk_id for chunk in first_run] == [chunk.chunk_id for chunk in second_run]
    assert [chunk.checksum for chunk in first_run] == [chunk.checksum for chunk in second_run]


def test_generate_chunks_keeps_appendix_context():
    blocks = [
        (1, 0, "APPENDIX A"),
        (1, 1, "Schedule of Services"),
        (1, 2, "1. Support includes monitoring and patching."),
    ]
    document = _build_document(blocks)
    preprocessing = _build_preprocessing(blocks, ["heading", "heading", "clause"])

    chunks = generate_chunks("ws-1", "doc-3", document, preprocessing)

    assert chunks[0].section_title == "Schedule of Services"
    assert chunks[0].chunk_kind in {"appendix", "clause"}


def test_generate_chunks_preserves_table_rows():
    blocks = [
        (1, 0, "FEES"),
        (1, 1, "Plan | Monthly Fee | Term"),
        (1, 2, "Standard | $100 | 12 months"),
        (1, 3, "Premium | $250 | 24 months"),
    ]
    document = _build_document(blocks)
    preprocessing = _build_preprocessing(blocks, ["heading", "paragraph", "paragraph", "paragraph"])

    chunks = generate_chunks("ws-1", "doc-4", document, preprocessing)

    assert "Plan | Monthly Fee | Term" in chunks[0].text
    assert chunks[0].chunk_kind == "table"


def test_generate_chunks_handles_clause_spanning_pages():
    blocks = [
        (1, 0, "LIABILITY"),
        (1, 1, "9.1 Liability is limited except as stated below"),
        (2, 0, "(a) for breach of confidentiality and"),
        (2, 1, "(b) for fraud or willful misconduct."),
    ]
    document = _build_document(blocks)
    preprocessing = _build_preprocessing(blocks, ["heading", "clause", "paragraph", "paragraph"])

    chunks = generate_chunks("ws-1", "doc-5", document, preprocessing)

    assert chunks[0].page_start == 1
    assert chunks[0].page_end == 2
    assert len(chunks[0].source_offsets) == 3


def test_generate_chunks_preserves_definition_sections_as_atomic_units():
    blocks = [
        (1, 0, "DEFINITIONS"),
        (1, 1, '"Services" means the hosted platform and support commitments.'),
        (1, 2, '"Customer Data" means all data submitted by Customer.'),
    ]
    document = _build_document(blocks)
    preprocessing = _build_preprocessing(blocks, ["heading", "paragraph", "paragraph"])

    chunks = generate_chunks("ws-1", "doc-6", document, preprocessing)

    assert all(chunk.chunk_kind == "definition" for chunk in chunks)


def test_generate_chunks_extracts_cross_references_and_metadata():
    blocks = [
        (1, 0, "CONFIDENTIALITY"),
        (1, 1, "7.1 Obligations in this Section survive termination and are subject to Section 9.2."),
    ]
    document = _build_document(blocks)
    preprocessing = _build_preprocessing(blocks, ["heading", "clause"])

    chunks = generate_chunks("ws-1", "doc-7", document, preprocessing)

    assert chunks[0].cross_references == ["Section 9.2"]
    assert chunks[0].token_count > 0
    assert chunks[0].parser_version == "a3.v1"
    assert chunks[0].chunk_version == "a4.v1"
