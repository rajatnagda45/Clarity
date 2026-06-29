from __future__ import annotations

import tiktoken

from config import settings
from services.answer_generation.models import ConversationTurn, EvidenceBlock, PromptEnvelope


SYSTEM_PROMPTS: dict[str, str] = {
    "a8.writer.v1": (
        "You are Clarity's grounded contract-answer writer. "
        "Answer ONLY from the provided evidence blocks. "
        "Never retrieve new information. Never invent facts or citations. "
        "If the evidence is insufficient, say that clearly. "
        "Return strict JSON with keys answerMarkdown, citations, and insufficientEvidence."
    ),
    "b1.writer.revision.v1": (
        "You are Clarity's grounded contract-answer writer performing a verification revision. "
        "You will receive the original user request, retrieved evidence, the previous draft answer, "
        "and critic feedback about unsupported or partial claims. "
        "Revise ONLY to keep statements fully grounded in the provided evidence blocks. "
        "Do not invent facts. Remove or narrow unsupported claims. "
        "Return strict JSON with keys answerMarkdown, citations, and insufficientEvidence."
    )
}


def build_prompt(
    *,
    query: str,
    evidence: list[EvidenceBlock],
    history: list[ConversationTurn],
    prompt_version: str,
) -> PromptEnvelope:
    system_prompt = SYSTEM_PROMPTS[prompt_version]

    evidence_lines = []
    for block in evidence:
        label = (
            f"{block.citation_key} | doc={block.document_id} | chunk={block.chunk_id} "
            f"| pages={block.page_start}-{block.page_end}"
        )
        if block.section_title:
            label += f" | section={block.section_title}"
        if block.clause_number:
            label += f" | clause={block.clause_number}"
        evidence_lines.append(f"[{label}]\n{block.text}")

    context_lines = [f"{turn.role.upper()}: {turn.content}" for turn in history]

    return PromptEnvelope(
        systemPrompt=system_prompt,
        evidenceSection="\n\n".join(evidence_lines),
        conversationContext="\n".join(context_lines),
        userRequest=query,
        promptVersion=prompt_version,
    )


def build_revision_prompt(
    *,
    original_query: str,
    revision_query: str,
    previous_answer: str,
    critic_feedback: list[str],
    evidence: list[EvidenceBlock],
    history: list[ConversationTurn],
    prompt_version: str,
) -> PromptEnvelope:
    system_prompt = SYSTEM_PROMPTS[prompt_version]

    evidence_lines = []
    for block in evidence:
        label = (
            f"{block.citation_key} | doc={block.document_id} | chunk={block.chunk_id} "
            f"| pages={block.page_start}-{block.page_end}"
        )
        if block.section_title:
            label += f" | section={block.section_title}"
        if block.clause_number:
            label += f" | clause={block.clause_number}"
        evidence_lines.append(f"[{label}]\n{block.text}")

    context_lines = [f"{turn.role.upper()}: {turn.content}" for turn in history]
    revision_context = "\n".join(
        [
            f"Original request: {original_query}",
            f"Refined verification query: {revision_query}",
            f"Previous draft answer:\n{previous_answer}",
            "Critic feedback:",
            *[f"- {item}" for item in critic_feedback],
        ]
    )
    if context_lines:
        revision_context = f"{revision_context}\n\nConversation context:\n" + "\n".join(context_lines)

    return PromptEnvelope(
        systemPrompt=system_prompt,
        evidenceSection="\n\n".join(evidence_lines),
        conversationContext=revision_context,
        userRequest=original_query,
        promptVersion=prompt_version,
    )


def estimate_token_count(text: str, *, model: str | None = None) -> int:
    encoding_name = "cl100k_base"
    if model:
        try:
            encoding = tiktoken.encoding_for_model(model)
            return len(encoding.encode(text))
        except KeyError:
            pass
    encoding = tiktoken.get_encoding(encoding_name)
    return len(encoding.encode(text))


def serialize_prompt(prompt: PromptEnvelope) -> str:
    return (
        f"SYSTEM:\n{prompt.system_prompt}\n\n"
        f"CONVERSATION:\n{prompt.conversation_context or '[none]'}\n\n"
        f"EVIDENCE:\n{prompt.evidence_section}\n\n"
        f"USER:\n{prompt.user_request}"
    )


def build_history_window(messages: list[dict]) -> list[ConversationTurn]:
    turns = [
        ConversationTurn(role=row["role"], content=row["content"])
        for row in messages[-settings.answer_max_history_messages :]
    ]
    return turns
