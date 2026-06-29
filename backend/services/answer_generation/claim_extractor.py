from __future__ import annotations

import json
from uuid import uuid4

from openai import AsyncOpenAI

from config import settings
from services.answer_generation.models import (
    ClaimExtractionOutput,
    ClaimRecord,
    EvidenceBlock,
)


CLAIM_EXTRACTOR_SYSTEM = """\
You are Clarity's claim extractor.
Extract discrete factual claims from the provided draft answer.
Rules:
- Claims must be atomic and factual.
- Claims must only reference the provided citation keys.
- Do not verify, critique, or rewrite the answer.
- Ignore hedging, introductions, and legal disclaimers unless they contain factual assertions.
Return ONLY valid JSON:
{"claims":[{"claimId":"c1","text":"...","supportingCitationKeys":["E1"],"section":"optional short section"}]}
"""


def _build_claim_index(evidence: list[EvidenceBlock]) -> tuple[dict[str, str], dict[str, str | None]]:
    citation_to_chunk: dict[str, str] = {}
    citation_to_section: dict[str, str | None] = {}
    for block in evidence:
        citation_to_chunk[block.citation_key] = block.chunk_id
        citation_to_section[block.citation_key] = block.section_title
    return citation_to_chunk, citation_to_section


def _fallback_claims(
    answer_text: str,
    evidence: list[EvidenceBlock],
    verification_pass: int,
) -> list[ClaimRecord]:
    citation_keys = [block.citation_key for block in evidence]
    span_ids = [block.chunk_id for block in evidence]
    section = evidence[0].section_title if evidence else None
    if not answer_text.strip():
        return []
    return [
        ClaimRecord(
            id=str(uuid4()),
            text=answer_text.strip(),
            spanIds=span_ids,
            citationKeys=citation_keys,
            section=section,
            verificationPass=verification_pass,
        )
    ]


async def extract_claims(
    *,
    answer_text: str,
    evidence: list[EvidenceBlock],
    verification_pass: int,
) -> list[ClaimRecord]:
    if not answer_text.strip():
        return []

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    citation_to_chunk, citation_to_section = _build_claim_index(evidence)
    evidence_payload = [
        {
            "citationKey": block.citation_key,
            "chunkId": block.chunk_id,
            "sectionTitle": block.section_title,
            "pageStart": block.page_start,
            "pageEnd": block.page_end,
            "text": block.text,
        }
        for block in evidence
    ]

    response = await client.chat.completions.create(
        model=settings.llm_model,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": CLAIM_EXTRACTOR_SYSTEM},
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "draftAnswer": answer_text,
                        "evidence": evidence_payload,
                    },
                    ensure_ascii=False,
                ),
            },
        ],
    )
    content = response.choices[0].message.content if response.choices else None
    if not content:
        return _fallback_claims(answer_text, evidence, verification_pass)

    try:
        parsed = ClaimExtractionOutput.model_validate(json.loads(content))
    except (json.JSONDecodeError, ValueError):
        return _fallback_claims(answer_text, evidence, verification_pass)

    claims: list[ClaimRecord] = []
    for item in parsed.claims:
        citation_keys = [key for key in item.supporting_citation_keys if key in citation_to_chunk]
        span_ids = [citation_to_chunk[key] for key in citation_keys]
        section = item.section or next((citation_to_section[key] for key in citation_keys if citation_to_section.get(key)), None)
        claims.append(
            ClaimRecord(
                id=str(uuid4()),
                text=item.text.strip(),
                spanIds=span_ids,
                citationKeys=citation_keys,
                section=section,
                verificationPass=verification_pass,
            )
        )

    return claims or _fallback_claims(answer_text, evidence, verification_pass)
