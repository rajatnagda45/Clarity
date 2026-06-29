from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field


class EvidenceBlock(BaseModel):
    citation_key: str = Field(alias="citationKey")
    document_id: str = Field(alias="documentId")
    chunk_id: str = Field(alias="chunkId")
    chunk_index: int = Field(alias="chunkIndex")
    section_title: str | None = Field(default=None, alias="sectionTitle")
    clause_number: str | None = Field(default=None, alias="clauseNumber")
    page_start: int = Field(alias="pageStart")
    page_end: int = Field(alias="pageEnd")
    text: str
    retrieval_reason: str = Field(alias="retrievalReason")
    retrieval_sources: list[str] = Field(alias="retrievalSources")
    checksum: str | None = None
    source_offsets: list[dict] = Field(default_factory=list, alias="sourceOffsets")
    rerank_score: float | None = Field(default=None, alias="rerankScore")

    model_config = {"populate_by_name": True}


class ConversationTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class PromptEnvelope(BaseModel):
    system_prompt: str = Field(alias="systemPrompt")
    evidence_section: str = Field(alias="evidenceSection")
    conversation_context: str = Field(alias="conversationContext")
    user_request: str = Field(alias="userRequest")
    prompt_version: str = Field(alias="promptVersion")

    model_config = {"populate_by_name": True}


class GeneratedCitation(BaseModel):
    citation_key: str = Field(alias="citationKey")
    summary: str | None = None

    model_config = {"populate_by_name": True}


class WriterOutput(BaseModel):
    answer_markdown: str = Field(alias="answerMarkdown", min_length=1)
    citations: list[GeneratedCitation] = Field(default_factory=list)
    insufficient_evidence: bool = Field(default=False, alias="insufficientEvidence")

    model_config = {"populate_by_name": True}


class WriterUsage(BaseModel):
    prompt_tokens: int = Field(default=0, alias="promptTokens")
    completion_tokens: int = Field(default=0, alias="completionTokens")
    total_tokens: int = Field(default=0, alias="totalTokens")

    model_config = {"populate_by_name": True}


class WriterResult(BaseModel):
    provider: str
    model: str
    output: WriterOutput
    usage: WriterUsage


@dataclass(slots=True)
class PreparedAnswerStream:
    conversation_id: str
    user_message_id: str
    assistant_message_id: str | None
    retrieval_run_id: str
    answer_run_id: str
    events: list[dict]
