from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass

from config import settings
from services.ingestion.models import (
    GeneratedChunk,
    NormalizedBlock,
    NormalizedDocument,
    PreprocessingResult,
    SourceOffset,
)
from services.ingestion.tokenizer import count_tokens


CLAUSE_NUMBER_RE = re.compile(
    r"^(?:section\s+)?(?P<number>\d+(?:\.\d+)*(?:\([a-z0-9]+\))?)",
    re.IGNORECASE,
)
BULLET_PREFIX_RE = re.compile(r"^(?:[-*•]|\([a-z0-9]+\)|[a-z0-9]+\.)\s+")
APPENDIX_HEADING_RE = re.compile(r"^(appendix|schedule|exhibit)\b", re.IGNORECASE)
TABLE_ROW_RE = re.compile(r"\|")
DEFINITION_HEADING_RE = re.compile(r"definitions?|defined terms", re.IGNORECASE)
CROSS_REFERENCE_RE = re.compile(
    r"\b(?:section|clause|article)\s+\d+(?:\.\d+)*(?:\([a-z0-9]+\))?\b",
    re.IGNORECASE,
)
SENTENCE_SPLIT_RE = re.compile(r"(?<=[.;:])\s+")


@dataclass
class ChunkUnit:
    kind: str
    text: str
    section_title: str | None
    clause_number: str | None
    source_offsets: list[SourceOffset]
    cross_references: list[str]
    definition_atomic: bool = False

    @property
    def page_start(self) -> int:
        return min(offset.page for offset in self.source_offsets)

    @property
    def page_end(self) -> int:
        return max(offset.page for offset in self.source_offsets)


def _detect_clause_number(text: str) -> str | None:
    match = CLAUSE_NUMBER_RE.match(text.strip())
    return match.group("number") if match else None


def _detect_kind(text: str, section_title: str | None) -> str:
    stripped = text.strip()
    if TABLE_ROW_RE.search(stripped):
        return "table"
    if _detect_clause_number(stripped):
        return "clause"
    if BULLET_PREFIX_RE.match(stripped):
        return "bullet_group"
    if APPENDIX_HEADING_RE.match((section_title or "").strip()):
        return "appendix"
    if DEFINITION_HEADING_RE.search(section_title or ""):
        return "definition"
    return "paragraph"


def _unique_cross_references(text: str) -> list[str]:
    seen: list[str] = []
    for match in CROSS_REFERENCE_RE.findall(text):
        normalized = match.strip()
        if normalized not in seen:
            seen.append(normalized)
    return seen


def _make_offset(block: NormalizedBlock) -> SourceOffset:
    return SourceOffset(
        page=block.page,
        block_order=block.order,
        char_start=block.char_start,
        char_end=block.char_end,
    )


def _build_units(document: NormalizedDocument, preprocessing: PreprocessingResult) -> list[ChunkUnit]:
    blocks_by_key = {(block.page, block.order): block for block in document.blocks}
    units: list[ChunkUnit] = []
    current_heading: str | None = None
    current_unit: ChunkUnit | None = None

    for segment in preprocessing.segments:
        block = blocks_by_key.get((segment.page, segment.block_order))
        if block is None:
            continue

        text = block.text.strip()
        if not text:
            continue

        if segment.kind == "heading":
            current_heading = text
            current_unit = None
            continue

        clause_number = _detect_clause_number(text)
        kind = _detect_kind(text, current_heading)
        definition_atomic = bool(current_heading and DEFINITION_HEADING_RE.search(current_heading))
        offset = _make_offset(block)
        cross_refs = _unique_cross_references(text)

        should_start_new_unit = (
            current_unit is None
            or clause_number is not None
            or kind in {"table", "appendix", "definition"}
            or current_unit.kind == "table"
            or (kind == "bullet_group" and current_unit.kind not in {"clause", "bullet_group", "definition"})
        )

        if should_start_new_unit:
            current_unit = ChunkUnit(
                kind=kind,
                text=text,
                section_title=current_heading,
                clause_number=clause_number,
                source_offsets=[offset],
                cross_references=cross_refs,
                definition_atomic=definition_atomic,
            )
            units.append(current_unit)
            continue

        current_unit.text = f"{current_unit.text}\n{text}"
        current_unit.source_offsets.append(offset)
        for ref in cross_refs:
            if ref not in current_unit.cross_references:
                current_unit.cross_references.append(ref)

    return units


def _chunk_checksum(text: str, offsets: list[SourceOffset], chunk_index: int) -> str:
    payload = {
        "text": text,
        "offsets": [offset.model_dump(mode="json") for offset in offsets],
        "chunk_index": chunk_index,
        "parser_version": settings.parser_version,
        "chunk_version": settings.chunk_version,
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()


def _build_chunk(
    *,
    workspace_id: str,
    document_id: str,
    chunk_index: int,
    units: list[ChunkUnit],
    fragment_index: int = 0,
    fragment_count: int = 1,
) -> GeneratedChunk:
    text = "\n\n".join(unit.text for unit in units)
    source_offsets = [offset for unit in units for offset in unit.source_offsets]
    section_title = next((unit.section_title for unit in units if unit.section_title), None)
    clause_number = next((unit.clause_number for unit in units if unit.clause_number), None)
    cross_references: list[str] = []
    for unit in units:
        for reference in unit.cross_references:
            if reference not in cross_references:
                cross_references.append(reference)

    checksum = _chunk_checksum(text, source_offsets, chunk_index)
    content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
    chunk_key_payload = json.dumps(
        {
            "document_id": document_id,
            "chunk_index": chunk_index,
            "checksum": checksum,
            "chunk_version": settings.chunk_version,
        },
        sort_keys=True,
    )
    chunk_id = f"chk_{hashlib.sha256(chunk_key_payload.encode('utf-8')).hexdigest()[:20]}"

    return GeneratedChunk(
        workspace_id=workspace_id,
        document_id=document_id,
        chunk_id=chunk_id,
        chunk_index=chunk_index,
        section_title=section_title,
        clause_number=clause_number,
        page_start=min(offset.page for offset in source_offsets),
        page_end=max(offset.page for offset in source_offsets),
        source_offsets=source_offsets,
        token_count=count_tokens(text),
        checksum=checksum,
        parser_version=settings.parser_version,
        chunk_version=settings.chunk_version,
        text=text,
        content_hash=content_hash,
        cross_references=cross_references,
        chunk_kind=units[0].kind,
        fragment_index=fragment_index,
        fragment_count=fragment_count,
    )


def _split_long_unit(unit: ChunkUnit) -> list[ChunkUnit]:
    segments: list[str]
    if unit.kind == "table":
        rows = [line for line in unit.text.splitlines() if line.strip()]
        if len(rows) <= 2:
            segments = rows
        else:
            header = rows[0]
            segments = [header]
            for row in rows[1:]:
                segments.append(f"{header}\n{row}")
    else:
        segments = [part.strip() for part in SENTENCE_SPLIT_RE.split(unit.text) if part.strip()]
        if not segments:
            segments = [unit.text]

    fragments: list[list[str]] = []
    current: list[str] = []
    current_tokens = 0

    for segment in segments:
        segment_tokens = count_tokens(segment)
        if current and current_tokens + segment_tokens > settings.chunk_target_tokens:
            fragments.append(current)
            overlap: list[str] = []
            if current:
                last_segment = current[-1]
                if count_tokens(last_segment) <= settings.chunk_overlap_tokens:
                    overlap = [last_segment]
            current = overlap + [segment]
            current_tokens = count_tokens("\n".join(current))
            continue

        current.append(segment)
        current_tokens += segment_tokens

    if current:
        fragments.append(current)

    return [
        ChunkUnit(
            kind=unit.kind,
            text="\n".join(fragment),
            section_title=unit.section_title,
            clause_number=unit.clause_number,
            source_offsets=unit.source_offsets,
            cross_references=unit.cross_references,
            definition_atomic=unit.definition_atomic,
        )
        for fragment in fragments
    ]


def generate_chunks(
    workspace_id: str,
    document_id: str,
    document: NormalizedDocument,
    preprocessing: PreprocessingResult,
) -> list[GeneratedChunk]:
    units = _build_units(document, preprocessing)
    if not units:
        raise ValueError("Chunk generation requires at least one normalized unit.")

    chunks: list[GeneratedChunk] = []
    pending_units: list[ChunkUnit] = []
    pending_tokens = 0
    chunk_index = 0

    for unit in units:
        unit_tokens = count_tokens(unit.text)
        unit_limit = settings.chunk_max_tokens if unit.definition_atomic else settings.chunk_target_tokens

        if unit_tokens > settings.chunk_max_tokens:
            if pending_units:
                chunks.append(
                    _build_chunk(
                        workspace_id=workspace_id,
                        document_id=document_id,
                        chunk_index=chunk_index,
                        units=pending_units,
                    )
                )
                chunk_index += 1
                pending_units = []
                pending_tokens = 0

            fragments = _split_long_unit(unit)
            fragment_count = len(fragments)
            for fragment_index, fragment in enumerate(fragments):
                chunks.append(
                    _build_chunk(
                        workspace_id=workspace_id,
                        document_id=document_id,
                        chunk_index=chunk_index,
                        units=[fragment],
                        fragment_index=fragment_index,
                        fragment_count=fragment_count,
                    )
                )
                chunk_index += 1
            continue

        if pending_units and pending_tokens + unit_tokens > unit_limit:
            chunks.append(
                _build_chunk(
                    workspace_id=workspace_id,
                    document_id=document_id,
                    chunk_index=chunk_index,
                    units=pending_units,
                )
            )
            chunk_index += 1
            pending_units = []
            pending_tokens = 0

        pending_units.append(unit)
        pending_tokens += unit_tokens

    if pending_units:
        chunks.append(
            _build_chunk(
                workspace_id=workspace_id,
                document_id=document_id,
                chunk_index=chunk_index,
                units=pending_units,
            )
        )

    return chunks
