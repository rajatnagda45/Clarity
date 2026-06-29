from __future__ import annotations

from config import settings
from services.eval.judge.base import JudgeProvider


def get_judge_provider() -> JudgeProvider:
    provider = settings.judge_provider
    if provider == "openai":
        from services.eval.judge.openai_judge import OpenAIJudge
        return OpenAIJudge()
    raise ValueError(f"Unknown judge provider: {provider!r}")
