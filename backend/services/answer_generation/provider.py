from __future__ import annotations

import json
from typing import AsyncGenerator, Protocol

from openai import AsyncOpenAI

from config import settings
from services.answer_generation.models import PromptEnvelope, WriterResult, WriterOutput, WriterUsage
from services.answer_generation.prompt_builder import estimate_token_count, serialize_prompt


class WriterProviderError(RuntimeError):
    pass


class WriterProvider(Protocol):
    async def generate(self, prompt: PromptEnvelope) -> WriterResult: ...


class _MarkdownStreamExtractor:
    """
    Incrementally extracts the "answerMarkdown" value from a streaming JSON response.

    Handles escape sequences (\\n, \\t, \\", \\\\, \\uXXXX) so that the emitted
    text is the decoded string value, not raw JSON-escaped characters.
    """

    _SEARCHING = 0
    _IN_VALUE = 1
    _DONE = 2

    def __init__(self) -> None:
        self._state = self._SEARCHING
        self._buf = ""
        self._escape_next = False
        self._in_unicode = False
        self._unicode_buf = ""

    def feed(self, text: str) -> str:
        """Feed a text fragment; return decoded markdown characters to emit (may be "")."""
        if self._state == self._DONE:
            return ""

        self._buf += text

        if self._state == self._SEARCHING:
            marker = '"answerMarkdown"'
            idx = self._buf.find(marker)
            if idx == -1:
                # Keep a tail long enough to catch a marker split across chunks.
                keep = max(0, len(self._buf) - len(marker) + 1)
                self._buf = self._buf[keep:]
                return ""
            pos = idx + len(marker)
            # Skip colon and whitespace between key and value.
            while pos < len(self._buf) and self._buf[pos] in " \t\n\r:":
                pos += 1
            if pos >= len(self._buf):
                self._buf = self._buf[idx:]
                return ""
            if self._buf[pos] != '"':
                self._state = self._DONE
                return ""
            pos += 1  # skip opening quote
            self._buf = self._buf[pos:]
            self._state = self._IN_VALUE

        # State: _IN_VALUE — scan buffer character by character.
        out: list[str] = []
        i = 0
        buf = self._buf

        while i < len(buf):
            c = buf[i]

            if self._in_unicode:
                self._unicode_buf += c
                if len(self._unicode_buf) == 4:
                    try:
                        out.append(chr(int(self._unicode_buf, 16)))
                    except ValueError:
                        out.append(f"\\u{self._unicode_buf}")
                    self._unicode_buf = ""
                    self._in_unicode = False
                i += 1
                continue

            if self._escape_next:
                self._escape_next = False
                match c:
                    case "n":
                        out.append("\n")
                    case "t":
                        out.append("\t")
                    case "r":
                        out.append("\r")
                    case '"':
                        out.append('"')
                    case "\\":
                        out.append("\\")
                    case "/":
                        out.append("/")
                    case "b":
                        out.append("\b")
                    case "f":
                        out.append("\f")
                    case "u":
                        self._in_unicode = True
                        self._unicode_buf = ""
                    case _:
                        out.append(c)
                i += 1
                continue

            if c == "\\":
                self._escape_next = True
                i += 1
                continue

            if c == '"':
                self._state = self._DONE
                self._buf = buf[i + 1 :]
                break

            out.append(c)
            i += 1

        if self._state == self._IN_VALUE:
            self._buf = ""  # consumed all available input

        return "".join(out)


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
                totalTokens=estimate_token_count(
                    prompt_text + output.answer_markdown, model=settings.llm_model
                ),
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

    async def generate_streaming(self, prompt: PromptEnvelope) -> AsyncGenerator[str, None]:
        """
        Stream JSON text fragments from the LLM.

        Callers should concatenate all yielded fragments — the result is a valid
        JSON string matching WriterOutput schema.  Use _MarkdownStreamExtractor to
        extract the answerMarkdown value incrementally as fragments arrive.
        """
        stream = await self._client.chat.completions.create(
            model=settings.llm_model,
            temperature=0,
            response_format={"type": "json_object"},
            stream=True,
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
        async for chunk in stream:
            if chunk.choices:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta


def get_writer_provider() -> WriterProvider:
    return OpenAIWriterProvider()
