from __future__ import annotations

import json
import logging

from config import settings

logger = logging.getLogger(__name__)

_NLI_LABELS = frozenset({"entail", "neutral", "contradict"})


class NLIResult:
    __slots__ = ("label", "score", "support_probability", "contradiction_probability")

    def __init__(
        self,
        label: str,
        score: float,
        *,
        support_probability: float | None = None,
        contradiction_probability: float | None = None,
    ) -> None:
        self.label = label
        self.score = score
        self.support_probability = score if support_probability is None and label == "entail" else (support_probability or 0.0)
        self.contradiction_probability = (
            score if contradiction_probability is None and label == "contradict" else (contradiction_probability or 0.0)
        )

    def to_dict(self) -> dict:
        return {
            "label": self.label,
            "score": self.score,
            "support_probability": self.support_probability,
            "contradiction_probability": self.contradiction_probability,
        }


async def _check_via_openai(claim_text: str, span_text: str) -> NLIResult:
    """Constrained gpt-4o-mini call that behaves as a 3-way NLI classifier."""
    try:
        import openai  # type: ignore[import]
    except ImportError as exc:
        raise RuntimeError("openai package required for NLI via OpenAI") from exc

    client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
    system = (
        "You are an entailment classifier. Decide whether the HYPOTHESIS is entailed, "
        "contradicted, or neutral with respect to the PREMISE. "
        "Output ONLY valid JSON with fields: "
        '{"label": "entail" | "neutral" | "contradict", "score": <float 0-1>, '
        '"supportProbability": <float 0-1>, "contradictionProbability": <float 0-1>}. '
        "No other text."
    )
    user = f"PREMISE: {span_text}\nHYPOTHESIS: {claim_text}"
    response = await client.chat.completions.create(
        model=settings.llm_model,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=0,
        max_tokens=40,
    )
    raw = (response.choices[0].message.content or "").strip()
    try:
        parsed = json.loads(raw)
        label = str(parsed.get("label", "neutral")).lower()
        if label not in _NLI_LABELS:
            label = "neutral"
        score = float(parsed.get("score", 0.5))
        score = max(0.0, min(1.0, score))
        support_probability = float(parsed.get("supportProbability", score if label == "entail" else 0.0))
        contradiction_probability = float(parsed.get("contradictionProbability", score if label == "contradict" else 0.0))
        return NLIResult(
            label=label,
            score=score,
            support_probability=max(0.0, min(1.0, support_probability)),
            contradiction_probability=max(0.0, min(1.0, contradiction_probability)),
        )
    except (json.JSONDecodeError, KeyError, TypeError, ValueError):
        logger.warning("NLI parse failure; defaulting to neutral. raw=%r", raw)
        return NLIResult(label="neutral", score=0.5, support_probability=0.0, contradiction_probability=0.0)


async def _check_via_hosted(claim_text: str, span_text: str) -> NLIResult:
    """Calls a hosted DeBERTa-NLI endpoint (nli_model is the URL or model id)."""
    try:
        import httpx  # type: ignore[import]
    except ImportError as exc:
        raise RuntimeError("httpx package required for hosted NLI") from exc

    payload = {"inputs": {"premise": span_text, "hypothesis": claim_text}}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(settings.nli_model, json=payload)
        resp.raise_for_status()
        data = resp.json()

    label_map = {"entailment": "entail", "contradiction": "contradict", "neutral": "neutral"}
    best_label, best_score = "neutral", 0.0
    support_probability = 0.0
    contradiction_probability = 0.0
    for entry in data if isinstance(data, list) else [data]:
        raw_label = str(entry.get("label", "")).lower()
        mapped = label_map.get(raw_label, "neutral")
        score = float(entry.get("score", 0.0))
        if mapped == "entail":
            support_probability = max(support_probability, score)
        if mapped == "contradict":
            contradiction_probability = max(contradiction_probability, score)
        if score > best_score:
            best_label, best_score = mapped, score
    return NLIResult(
        label=best_label,
        score=best_score,
        support_probability=support_probability,
        contradiction_probability=contradiction_probability,
    )


async def check_entailment(claim_text: str, span_text: str) -> NLIResult:
    """Route to the configured NLI provider."""
    if settings.nli_provider == "hosted" and settings.nli_model:
        try:
            return await _check_via_hosted(claim_text, span_text)
        except Exception:
            logger.warning("Hosted NLI failed; falling back to OpenAI NLI.", exc_info=True)
    return await _check_via_openai(claim_text, span_text)


async def check_batch(
    claim_span_pairs: list[tuple[str, str]],
) -> list[NLIResult]:
    """Check a list of (claim_text, span_text) pairs concurrently."""
    import asyncio

    return list(await asyncio.gather(*[check_entailment(c, s) for c, s in claim_span_pairs]))
