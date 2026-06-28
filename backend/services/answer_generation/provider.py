from __future__ import annotations

import json
from typing import Protocol

from openai import AsyncOpenAI

from config import settings
from services.answer_generation.models import PromptEnvelope, WriterResult, WriterOutput, WriterUsage
from services.answer_generation.prompt_builder import estimate_token_count, serialize_prompt


class WriterProviderError(RuntimeError):
    pass


class WriterProvider(Protocol):
    async def generate(self, prompt: PromptEnvelope) -> WriterResult:
        raise NotImplementedError


class OpenAIWriterProvider:
    def __init__(self) -> None:
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def generate(self, prompt: PromptEnvelope) -> WriterResult:
        prompt_text = serialize_prompt(prompt)
        response = await self._client.chat.completions.create(
            model=settings.llm_model,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": prompt.system_prompt},
                {
                    "role": "user",
                    "content": (
                        f"Conversation context:\n{prompt.conversation_context or '[none]'}\n\n"
                        f"Evidence blocks:\n{prompt.evidence_section}\n\n"
                        f"User request:\n{prompt.user_request}"
                    ),
                },
            ],
        )

        content = response.choices[0].message.content if response.choices else None
        if not content:
            raise WriterProviderError("Writer provider returned an empty response.")

        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as exc:
            raise WriterProviderError("Writer provider returned invalid JSON.") from exc

        output = WriterOutput.model_validate(parsed)
        usage = response.usage
        if usage is None:
            usage_model = WriterUsage(
                promptTokens=estimate_token_count(prompt_text, model=settings.llm_model),
                completionTokens=estimate_token_count(output.answer_markdown, model=settings.llm_model),
                totalTokens=estimate_token_count(prompt_text + output.answer_markdown, model=settings.llm_model),
            )
        else:
            usage_model = WriterUsage(
                promptTokens=usage.prompt_tokens,
                completionTokens=usage.completion_tokens,
                totalTokens=usage.total_tokens,
            )

        return WriterResult(
            provider="openai",
            model=settings.llm_model,
            output=output,
            usage=usage_model,
        )


def get_writer_provider() -> WriterProvider:
    return OpenAIWriterProvider()
