"""
NLI entailment check — second signal in the two-signal verifier.

Uses a constrained GPT-4o-mini call (NLI_PROVIDER=openai, default) or a
hosted DeBERTa endpoint (NLI_PROVIDER=hosted) to cross-check each claim
against the span text that the Critic cited.

A claim is "entailed" only if the span text logically supports the claim.
This check is independent of the Critic — no model grades its own output.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass

from openai import OpenAI
from config import settings

logger = logging.getLogger(__name__)

_NLI_SYSTEM = (
    "You are a strict NLI (Natural Language Inference) classifier. "
    "Given a PREMISE (a span of contract text) and a HYPOTHESIS (a claim about it), "
    "classify the relationship as exactly one of: entail, neutral, contradict. "
    "entail: the premise logically supports the hypothesis. "
    "neutral: the premise neither supports nor contradicts. "
    "contradict: the premise contradicts the hypothesis. "
    "Respond with ONLY a JSON object: {\"label\": \"entail\"|\"neutral\"|\"contradict\", \"score\": 0.0-1.0} "
    "where score is your confidence in the label. No other text."
)


@dataclass(frozen=True)
class NLIResult:
    label: str   # "entail" | "neutral" | "contradict"
    score: float  # 0.0 – 1.0 confidence in this label


def check_entailment(premise: str, hypothesis: str) -> NLIResult:
    """
    Returns an NLIResult for (premise, hypothesis).
    Falls back to neutral/0.5 on any API error so a failure is never a false positive.
    """
    provider = getattr(settings, "nli_provider", "openai")
    if provider == "hosted":
        return _check_hosted(premise, hypothesis)
    return _check_openai(premise, hypothesis)


def _check_openai(premise: str, hypothesis: str) -> NLIResult:
    prompt = (
        f"PREMISE:\n{premise}\n\n"
        f"HYPOTHESIS:\n{hypothesis}"
    )
    try:
        client = OpenAI(api_key=settings.openai_api_key)
        resp = client.chat.completions.create(
            model=settings.judge_model,
            messages=[
                {"role": "system", "content": _NLI_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            temperature=0.0,
            max_tokens=60,
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content or "{}"
        data = json.loads(raw)
        label = data.get("label", "neutral")
        if label not in ("entail", "neutral", "contradict"):
            label = "neutral"
        score = float(data.get("score", 0.5))
        score = max(0.0, min(1.0, score))
        return NLIResult(label=label, score=score)
    except Exception as exc:
        logger.warning("NLI check failed, defaulting to neutral: %s", exc)
        return NLIResult(label="neutral", score=0.5)


def check_batch(pairs: list[tuple[str, str]]) -> list[NLIResult]:
    """
    Backward-compat batch entailment check for legacy callers.
    Runs check_entailment() on each (premise, hypothesis) pair sequentially.
    """
    return [check_entailment(premise, hypothesis) for premise, hypothesis in pairs]


def _check_hosted(premise: str, hypothesis: str) -> NLIResult:
    """Hosted DeBERTa-MNLI endpoint (NLI_MODEL env var). Falls back to openai."""
    nli_model = getattr(settings, "nli_model", "")
    if not nli_model:
        logger.warning("NLI_MODEL not configured, falling back to openai NLI")
        return _check_openai(premise, hypothesis)
    try:
        import httpx
        payload = {"inputs": {"premise": premise, "hypothesis": hypothesis}}
        resp = httpx.post(nli_model, json=payload, timeout=5.0)
        resp.raise_for_status()
        data = resp.json()
        # Expect {"label": ..., "score": ...} or HuggingFace inference API format
        if isinstance(data, list):
            # HuggingFace format: [[{label, score}, ...]]
            scores = {item["label"].lower(): item["score"] for item in data[0]}
            best_label = max(scores, key=scores.__getitem__)
            label_map = {"entailment": "entail", "contradiction": "contradict", "neutral": "neutral"}
            label = label_map.get(best_label, "neutral")
            return NLIResult(label=label, score=scores[best_label])
        label = data.get("label", "neutral")
        if label not in ("entail", "neutral", "contradict"):
            label = "neutral"
        return NLIResult(label=label, score=float(data.get("score", 0.5)))
    except Exception as exc:
        logger.warning("Hosted NLI check failed, falling back to openai: %s", exc)
        return _check_openai(premise, hypothesis)
