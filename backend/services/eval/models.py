from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class JudgeInput(BaseModel):
    question: str
    answer: str
    evidence_texts: list[str] = Field(default_factory=list)
    claim_texts: list[str] = Field(default_factory=list)
    citation_keys: list[str] = Field(default_factory=list)
    answer_run_id: str
    workspace_id: str


class JudgeScores(BaseModel):
    faithfulness: int = Field(ge=0, le=100)
    grounding: int = Field(ge=0, le=100)
    completeness: int = Field(ge=0, le=100)
    correctness: int = Field(ge=0, le=100)
    clarity: int = Field(ge=0, le=100)
    citation_quality: int = Field(ge=0, le=100)
    hallucination_risk: int = Field(ge=0, le=100)
    overall: int = Field(ge=0, le=100)
    reasoning: dict[str, str] = Field(default_factory=dict)

    @property
    def dimensions(self) -> dict[str, int]:
        return {
            "faithfulness": self.faithfulness,
            "grounding": self.grounding,
            "completeness": self.completeness,
            "correctness": self.correctness,
            "clarity": self.clarity,
            "citation_quality": self.citation_quality,
            "hallucination_risk": self.hallucination_risk,
            "overall": self.overall,
        }


class EvalRecord(BaseModel):
    id: str
    workspace_id: str
    answer_run_id: str | None
    judge_provider: str | None
    judge_model: str | None
    judge_prompt_version: str | None
    judge_latency_ms: int | None
    judge_faithfulness: int | None
    judge_grounding: int | None
    judge_completeness: int | None
    judge_correctness: int | None
    judge_clarity: int | None
    judge_citation_quality: int | None
    judge_hallucination_risk: int | None
    judge_overall: int | None
    judge_reasoning: dict[str, str] | None
    created_at: str


class BenchmarkDataset(BaseModel):
    id: str
    workspace_id: str
    name: str
    dataset_type: Literal["contract_qa", "lease_qa", "policy_qa", "custom"]
    description: str | None
    created_at: str


class BenchmarkCase(BaseModel):
    id: str
    workspace_id: str
    dataset_id: str
    question: str
    reference_answer: str | None
    document_ids: list[str]
    expected_citations: dict | None
    created_at: str


class BenchmarkRunSummary(BaseModel):
    id: str
    workspace_id: str
    dataset_id: str
    status: Literal["running", "completed", "failed"]
    total_cases: int
    completed_cases: int
    failed_cases: int
    avg_judge_overall: float | None
    avg_trust_confidence: float | None
    avg_latency_ms: int | None
    created_at: str


class RegressionReport(BaseModel):
    id: str
    workspace_id: str
    current_eval_id: str
    window_size: int
    baseline_avg_judge_overall: float | None
    current_judge_overall: int | None
    judge_overall_delta: float | None
    has_regression: bool
    regression_flags: list[str]
    created_at: str


class ExperimentCandidate(BaseModel):
    id: str
    workspace_id: str
    experiment_id: str
    name: str
    prompt_version: str
    model_version: str
    writer_version: str
    avg_judge_overall: float | None
    avg_trust_confidence: float | None
    eval_count: int
    created_at: str


class Experiment(BaseModel):
    id: str
    workspace_id: str
    name: str
    description: str | None
    status: Literal["active", "completed", "archived"]
    winner_candidate_id: str | None
    candidates: list[ExperimentCandidate] = Field(default_factory=list)
    created_at: str


class QualityRollup(BaseModel):
    id: str
    workspace_id: str
    day: str
    avg_faithfulness: float | None
    abstention_rate: float
    n: int
    avg_judge_overall: float | None
    avg_hallucination_risk: float | None
    avg_confidence_score: float | None
    abstention_count: int
    verification_pass_count: int
    total_answers: int
