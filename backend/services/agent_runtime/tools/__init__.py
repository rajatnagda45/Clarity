"""
ToolRegistry — central catalog of every tool the Agent Runtime can call.

The registry is a singleton (lazily built) that maps tool names to the
wrapped async functions. The runtime calls `registry.get(name)` to look
up a tool; the Planner and LLM-driven nodes see the registry's manifest
(`describe_all`) to make tool choices.

The catalog is *the* contract between the runtime and the dev console's
Tool Inspector: the same descriptors power the timeline view, the
argument schema, and the auto-complete in the planner prompt.
"""
from __future__ import annotations

import inspect
import logging
from typing import Any, Callable

from services.agent_runtime.tools.base import ToolContext, ToolResult

logger = logging.getLogger(__name__)


class ToolDescriptor:
    """Static description of a tool, surfaced to the planner and dev console."""

    def __init__(
        self,
        name: str,
        description: str,
        signature: dict[str, Any],
        timeout_s: float,
        max_retries: int,
    ) -> None:
        self.name = name
        self.description = description
        self.signature = signature
        self.timeout_s = timeout_s
        self.max_retries = max_retries

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "signature": self.signature,
            "timeout_s": self.timeout_s,
            "max_retries": self.max_retries,
        }


class ToolRegistry:
    """Registry of all available agent tools."""

    def __init__(self) -> None:
        self._tools: dict[str, Callable[..., Any]] = {}
        self._descriptors: dict[str, ToolDescriptor] = {}

    def register(
        self,
        name: str,
        fn: Callable[..., Any],
        *,
        description: str,
        arg_descriptions: dict[str, str] | None = None,
    ) -> None:
        self._tools[name] = fn
        sig = inspect.signature(fn)
        signature_dict: dict[str, Any] = {}
        for pname, param in sig.parameters.items():
            if pname == "ctx":
                continue
            annotation = (
                str(param.annotation) if param.annotation is not inspect.Parameter.empty
                else "Any"
            )
            default = (
                None if param.default is inspect.Parameter.empty
                else (
                    param.default if not isinstance(param.default, inspect.Parameter.empty)
                    else None
                )
            )
            required = param.default is inspect.Parameter.empty
            arg_desc = (arg_descriptions or {}).get(pname, "")
            signature_dict[pname] = {
                "type": annotation,
                "required": required,
                "default": default,
                "description": arg_desc,
            }
        # Pull decorator metadata set on the wrapper
        timeout_s = float(getattr(fn, "__tool_timeout__", 30.0))
        max_retries = int(getattr(fn, "__tool_max_retries__", 2))
        self._descriptors[name] = ToolDescriptor(
            name=name,
            description=description,
            signature=signature_dict,
            timeout_s=timeout_s,
            max_retries=max_retries,
        )

    def get(self, name: str) -> Callable[..., Any] | None:
        return self._tools.get(name)

    def has(self, name: str) -> bool:
        return name in self._tools

    def describe(self, name: str) -> dict[str, Any] | None:
        d = self._descriptors.get(name)
        return d.to_dict() if d else None

    def describe_all(self) -> list[dict[str, Any]]:
        return [d.to_dict() for d in self._descriptors.values()]

    def names(self) -> list[str]:
        return list(self._tools.keys())

    async def invoke(
        self,
        name: str,
        ctx: ToolContext,
        **kwargs: Any,
    ) -> ToolResult:
        fn = self._tools.get(name)
        if fn is None:
            return ToolResult(
                ok=False,
                error=f"unknown_tool:{name}",
                error_kind="fatal",
            )
        return await fn(ctx, **kwargs)


# ─── Default registry construction ────────────────────────────────────────────

_singleton: ToolRegistry | None = None


def get_tool_registry() -> ToolRegistry:
    """Return the singleton ToolRegistry, building it on first access."""
    global _singleton
    if _singleton is None:
        _singleton = _build_default_registry()
    return _singleton


def reset_tool_registry() -> None:
    """For tests that need to inject a clean registry."""
    global _singleton
    _singleton = None


def _build_default_registry() -> ToolRegistry:
    from services.agent_runtime.tools import (
        search_documents,
        hybrid_retrieval,
        collection_search,
        citation_lookup,
        document_summary,
        clause_extraction,
        run_evaluation,
        benchmark_execution,
        generate_report,
        workspace_search,
    )

    reg = ToolRegistry()

    reg.register(
        "search_documents",
        search_documents.search_documents,
        description="Hybrid retrieval over all indexed documents in the workspace.",
        arg_descriptions={
            "query": "Natural-language query to search for.",
            "document_ids": "Optional list of document IDs to restrict the search.",
            "top_k": "Maximum number of chunks to return (1-20).",
        },
    )
    reg.register(
        "hybrid_retrieval",
        hybrid_retrieval.hybrid_retrieval,
        description=(
            "Explicit hybrid dense + sparse retrieval with full stage telemetry "
            "(dense / sparse / fused candidate counts and scores)."
        ),
        arg_descriptions={
            "query": "Natural-language query.",
            "top_k": "Maximum number of chunks to return (1-20).",
        },
    )
    reg.register(
        "collection_search",
        collection_search.collection_search,
        description="Hybrid retrieval restricted to a single document collection.",
        arg_descriptions={
            "query": "Natural-language query.",
            "collection_id": "UUID of the collection to search within.",
            "top_k": "Maximum number of chunks to return (1-20).",
        },
    )
    reg.register(
        "citation_lookup",
        citation_lookup.citation_lookup,
        description=(
            "Resolve citation keys (chunk UUIDs) to their full source metadata "
            "(text, page range, section, clause, offsets)."
        ),
        arg_descriptions={
            "citation_keys": "List of chunk IDs to look up.",
        },
    )
    reg.register(
        "document_summary",
        document_summary.document_summary,
        description="Retrieve top chunks for a query and produce a concise, detailed, or bulleted summary.",
        arg_descriptions={
            "query": "Query describing what to summarise.",
            "document_ids": "Optional list of document IDs to restrict.",
            "max_chunks": "Number of chunks to feed into the summary (1-15).",
            "style": "One of: concise, detailed, bullets.",
        },
    )
    reg.register(
        "clause_extraction",
        clause_extraction.clause_extraction,
        description=(
            "Extract structured legal clauses (title, type, risk flag, risk score, "
            "rationale, verbatim text) from retrieved contract excerpts."
        ),
        arg_descriptions={
            "query": "Query describing which clauses to find.",
            "document_ids": "Optional list of document IDs to restrict.",
            "max_chunks": "Number of chunks to feed into extraction (1-12).",
        },
    )
    reg.register(
        "run_evaluation",
        run_evaluation.run_evaluation,
        description=(
            "Trigger the LLM-as-judge evaluator on a recent answer_run_id. "
            "Returns the 8-dimension judge scores."
        ),
        arg_descriptions={
            "answer_run_id": "The answer_run to evaluate (defaults to most recent in memory).",
        },
    )
    reg.register(
        "benchmark_execution",
        benchmark_execution.benchmark_execution,
        description="Execute a benchmark dataset against the live pipeline and return aggregate metrics.",
        arg_descriptions={
            "dataset_id": "UUID of the benchmark dataset to run.",
        },
    )
    reg.register(
        "generate_report",
        generate_report.generate_report,
        description=(
            "Synthesise a structured markdown report from the run's prior step "
            "results. Use at the end of a multi-step run."
        ),
        arg_descriptions={
            "title": "Title of the report.",
            "style": "One of: executive, technical, legal.",
            "include_citations": "Whether to include inline source references.",
        },
    )
    reg.register(
        "workspace_search",
        workspace_search.workspace_search,
        description=(
            "Fast keyword (BM25-style) search across every indexed chunk in the "
            "workspace. Cheaper than hybrid retrieval; no semantic rerank."
        ),
        arg_descriptions={
            "query": "Query string (will be tokenised on whitespace).",
            "top_k": "Maximum number of chunks to return (1-25).",
        },
    )

    return reg
