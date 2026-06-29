from __future__ import annotations

from typing import Literal, TypedDict


class Span(TypedDict):
    chunk_id: str
    document_id: str
    page: int
    char_start: int
    char_end: int
    text: str
    rerank_score: float


class DraftClaim(TypedDict):
    id: str
    text: str
    span_ids: list[str]
    supported: bool
    uncertain: bool
    entailment_label: str | None
    entailment_score: float | None
    confidence: float | None


class DebateTurnEntry(TypedDict):
    round: int
    actor: Literal["writer", "critic"]
    action: str
    claim_id: str | None
    note: str


class AgentState(TypedDict):
    workspace_id: str
    conversation_id: str
    query: str
    document_ids: list[str]
    route: str | None
    history: list[dict]
    spans: list[Span]
    claims: list[DraftClaim]
    critic_loops: int
    debate: list[DebateTurnEntry]
    conflicts: list[dict]
    trust: dict | None
    abstained: bool
    abstention_reason: str | None
