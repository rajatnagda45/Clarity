from __future__ import annotations

import json
import time

from openai import AsyncOpenAI

from config import settings
from services.eval.judge.base import JudgeParseError, JudgeProvider, JudgeProviderError
from services.eval.judge.prompts import JUDGE_SYSTEM
from services.eval.models import JudgeInput, JudgeScores

_DIMENSIONS = (
    "faithfulness",
    "grounding",
    "completeness",
    "correctness",
    "clarity",
    "citation_quality",
    "hallucination_risk",
    "overall",
)


def _build_user_message(inp: JudgeInput) -> str:
    evidence_block = "\n\n".join(
        f"[EVIDENCE {i + 1}]\n{text}" for i, text in enumerate(inp.evidence_texts)
    ) or "(no evidence passages)"

    claims_block = "\n".join(
        f"- {text}" for text in inp.claim_texts
    ) or "(no individual claims)"

    citations_block = ", ".join(inp.citation_keys) or "(none)"

    return (
        f"QUESTION:\n{inp.question}\n\n"
        f"ANSWER:\n{inp.answer}\n\n"
        f"EVIDENCE PASSAGES:\n{evidence_block}\n\n"
        f"CLAIMS MADE:\n{claims_block}\n\n"
        f"CITATION KEYS USED: {citations_block}"
    )


def _parse_scores(raw: str) -> JudgeScores:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise JudgeParseError(f"Judge response is not valid JSON: {exc}") from exc

    missing = [d for d in _DIMENSIONS if d not in data]
    if missing:
        raise JudgeParseError(f"Judge response missing dimensions: {missing}")

    for dim in _DIMENSIONS:
        val = data[dim]
        if not isinstance(val, int) or not (0 <= val <= 100):
            raise JudgeParseError(f"Dimension '{dim}' must be int in [0, 100], got {val!r}")

    reasoning = data.get("reasoning", {})
    if not isinstance(reasoning, dict):
        reasoning = {}

    return JudgeScores(
        faithfulness=data["faithfulness"],
        grounding=data["grounding"],
        completeness=data["completeness"],
        correctness=data["correctness"],
        clarity=data["clarity"],
        citation_quality=data["citation_quality"],
        hallucination_risk=data["hallucination_risk"],
        overall=data["overall"],
        reasoning={k: str(v) for k, v in reasoning.items()},
    )


class OpenAIJudge(JudgeProvider):
    def __init__(self) -> None:
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)

    @property
    def provider_name(self) -> str:
        return "openai"

    @property
    def model_name(self) -> str:
        return settings.judge_model

    async def judge(self, input: JudgeInput) -> JudgeScores:
        user_message = _build_user_message(input)
        t0 = time.monotonic()
        try:
            response = await self._client.chat.completions.create(
                model=self.model_name,
                temperature=settings.judge_temperature,
                messages=[
                    {"role": "system", "content": JUDGE_SYSTEM},
                    {"role": "user", "content": user_message},
                ],
            )
        except Exception as exc:
            raise JudgeProviderError(f"OpenAI judge call failed: {exc}") from exc

        elapsed_ms = int((time.monotonic() - t0) * 1000)
        raw = (response.choices[0].message.content or "").strip()
        scores = _parse_scores(raw)

        # Attach latency so the engine can persist it
        scores.__dict__["_latency_ms"] = elapsed_ms
        return scores
