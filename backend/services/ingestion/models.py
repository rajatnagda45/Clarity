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
