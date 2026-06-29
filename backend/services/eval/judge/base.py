from __future__ import annotations

from abc import ABC, abstractmethod

from services.eval.models import JudgeInput, JudgeScores


class JudgeError(Exception):
    pass


class JudgeProviderError(JudgeError):
    pass


class JudgeParseError(JudgeError):
    pass


class JudgeProvider(ABC):
    @property
    @abstractmethod
    def provider_name(self) -> str: ...

    @property
    @abstractmethod
    def model_name(self) -> str: ...

    @abstractmethod
    async def judge(self, input: JudgeInput) -> JudgeScores: ...
