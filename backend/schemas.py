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
