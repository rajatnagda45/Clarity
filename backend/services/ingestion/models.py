from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ExtractedBlock(BaseModel):
    page: int = Field(ge=1)
    order: int = Field(ge=0)
    text: str
    char_start: int = Field(ge=0)
    char_end: int = Field(ge=0)


class ExtractedDocument(BaseModel):
    source_type: Literal["pdf", "docx"]
    page_count: int = Field(ge=1)
    blocks: list[ExtractedBlock]
    full_text: str


class NormalizedBlock(BaseModel):
    page: int = Field(ge=1)
    order: int = Field(ge=0)
    text: str
    char_start: int = Field(ge=0)
    char_end: int = Field(ge=0)


class NormalizedDocument(BaseModel):
    source_type: Literal["pdf", "docx"]
    page_count: int = Field(ge=1)
    blocks: list[NormalizedBlock]
    full_text: str


class DocumentMetadata(BaseModel):
    source_sha256: str
    page_count: int = Field(ge=1)
    block_count: int = Field(ge=0)
    character_count: int = Field(ge=0)
    word_count: int = Field(ge=0)
    normalized_character_count: int = Field(ge=0)
    normalized_word_count: int = Field(ge=0)


class PreprocessingSegment(BaseModel):
    page: int = Field(ge=1)
    block_order: int = Field(ge=0)
    kind: Literal["heading", "clause", "paragraph"]
    label: str
    char_start: int = Field(ge=0)
    char_end: int = Field(ge=0)


class PreprocessingResult(BaseModel):
    metadata: DocumentMetadata
    segments: list[PreprocessingSegment]


class SourceOffset(BaseModel):
    page: int = Field(ge=1)
    block_order: int = Field(ge=0)
    char_start: int = Field(ge=0)
    char_end: int = Field(ge=0)


class GeneratedChunk(BaseModel):
    workspace_id: str
    document_id: str
    chunk_id: str
    chunk_index: int = Field(ge=0)
    section_title: str | None = None
    clause_number: str | None = None
    page_start: int = Field(ge=1)
    page_end: int = Field(ge=1)
    source_offsets: list[SourceOffset]
    token_count: int = Field(ge=1)
    checksum: str
    parser_version: str
    chunk_version: str
    text: str
    content_hash: str
    cross_references: list[str] = Field(default_factory=list)
    chunk_kind: Literal["clause", "definition", "table", "bullet_group", "appendix", "paragraph"]
    fragment_index: int = Field(default=0, ge=0)
    fragment_count: int = Field(default=1, ge=1)
