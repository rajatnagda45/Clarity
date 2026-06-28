from typing import Literal
from pydantic import BaseModel, Field


class SpanRef(BaseModel):
    chunk_id: str
    document_id: str
    page: int
    char_start: int
    char_end: int
    text: str
    rerank_score: float = Field(ge=0.0, le=1.0)


class BoundingBox(BaseModel):
    """Pixel-accurate quad from PyMuPDF page.search_for(), for canvas overlay."""
    page: int
    x0: float
    y0: float
    x1: float
    y1: float


class Claim(BaseModel):
    id: str
    text: str
    span_ids: list[str]
    supported: bool = False        # true only if Critic AND NLI entailment agree
    uncertain: bool = False
    entailment_label: Literal["entail", "neutral", "contradict"] | None = None
    entailment_score: float | None = Field(default=None, ge=0.0, le=1.0)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)  # calibrated


class TrustScore(BaseModel):
    faithfulness: float = Field(ge=0.0, le=1.0)
    relevance: float = Field(ge=0.0, le=1.0)
    overall: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0)   # calibrated
    calibrated: bool = True


class Abstention(BaseModel):
    reason: str
    missing_evidence_query: str | None = None


class DebateTurn(BaseModel):
    round: int = Field(ge=0, le=2)
    actor: Literal["writer", "critic"]
    action: Literal["draft", "flag", "revise", "reretrieve", "resolve"]
    claim_id: str | None = None
    note: str | None = None


class Contradiction(BaseModel):
    id: str
    topic: str
    doc_a: str
    span_a: str | None
    value_a: str | None
    doc_b: str
    span_b: str | None
    value_b: str | None
    severity: Literal["minor", "major"]
    note: str | None = None


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    environment: str


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None


class WorkspaceSummary(BaseModel):
    id: str
    name: str
    role: Literal["owner", "editor", "viewer"]
    plan: Literal["free", "pro", "team"]


class MeResponse(BaseModel):
    user_id: str = Field(alias="userId")
    workspaces: list[WorkspaceSummary]

    model_config = {"populate_by_name": True}


class CreateWorkspaceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class CreateWorkspaceResponse(BaseModel):
    id: str
    name: str
    role: Literal["owner"]
    plan: Literal["free", "pro", "team"]


class ClauseSummary(BaseModel):
    id: str
    clause_type: str = Field(alias="clauseType")
    text: str
    page: int
    risk_flag: str = Field(alias="riskFlag")
    rationale: str | None = None
    benchmark_match_id: str | None = Field(default=None, alias="benchmarkMatchId")
    deviation_note: str | None = Field(default=None, alias="deviationNote")
    risk_score: float | None = Field(default=None, alias="riskScore")

    model_config = {"populate_by_name": True}


class DocumentSummary(BaseModel):
    id: str
    filename: str
    status: Literal["uploaded", "extracted", "normalized", "metadata_ready", "awaiting_chunking", "chunking", "chunked", "failed"]
    source_type: Literal["pdf", "docx", "url"] = Field(alias="sourceType")
    page_count: int | None = Field(default=None, alias="pageCount")
    created_at: str = Field(alias="createdAt")
    error: str | None = None

    model_config = {"populate_by_name": True}


class DocumentListResponse(BaseModel):
    documents: list[DocumentSummary]


class DocumentDetailResponse(DocumentSummary):
    clauses: list[ClauseSummary]


class ChunkSourceOffset(BaseModel):
    page: int
    block_order: int = Field(alias="blockOrder")
    char_start: int = Field(alias="charStart")
    char_end: int = Field(alias="charEnd")

    model_config = {"populate_by_name": True}


class DocumentChunkSummary(BaseModel):
    chunk_id: str = Field(alias="chunkId")
    chunk_index: int = Field(alias="chunkIndex")
    section_title: str | None = Field(default=None, alias="sectionTitle")
    clause_number: str | None = Field(default=None, alias="clauseNumber")
    page_start: int = Field(alias="pageStart")
    page_end: int = Field(alias="pageEnd")
    source_offsets: list[ChunkSourceOffset] = Field(alias="sourceOffsets")
    token_count: int = Field(alias="tokenCount")
    checksum: str
    parser_version: str = Field(alias="parserVersion")
    chunk_version: str = Field(alias="chunkVersion")
    chunk_kind: str = Field(alias="chunkKind")
    fragment_index: int = Field(alias="fragmentIndex")
    fragment_count: int = Field(alias="fragmentCount")
    cross_references: list[str] = Field(alias="crossReferences")
    text: str

    model_config = {"populate_by_name": True}


class DocumentChunkListResponse(BaseModel):
    document_id: str = Field(alias="documentId")
    chunks: list[DocumentChunkSummary]

    model_config = {"populate_by_name": True}


class ApiErrorResponse(BaseModel):
    error: dict[str, str]
