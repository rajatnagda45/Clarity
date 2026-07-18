"""
Tool base + decorators for timeout, retry, and recovery.

Every tool returns a `ToolResult` (a typed dict) so the runtime can
serialise, stream, and persist uniformly. The decorator stack is:

  @tool(name, timeout_s, max_retries, recoverable)
  async def my_tool(ctx: ToolContext, **kwargs) -> dict: ...

The decorator:
  1. Validates required args (no KeyError on missing input).
  2. Times the call with `asyncio.wait_for`.
  3. Retries with exponential backoff on transient errors.
  4. Emits a `tool_retried` or `tool_timeout` runtime event on each retry.
  5. Returns a normalised `ToolResult` envelope.

The `ctx` provides the live runtime context: workspace_id, run_id, the
StepMemory handle, and an `emit(event_type, payload)` callable that
the runtime injects. Tools never import the runtime directly.
"""
from __future__ import annotations

import asyncio
import functools
import inspect
import logging
import time
import traceback
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

logger = logging.getLogger(__name__)


@dataclass
class ToolContext:
    """Live context passed to every tool call. Mutable — the runtime
    updates counters after each call so tools can show running totals
    in their own log lines."""
    workspace_id: str
    run_id: str
    agent_id: str
    user_id: str | None
    allowed_collections: list[str]
    memory: Any  # StepMemory
    emit: Callable[[str, dict[str, Any]], None]
    # Running counters — tools that want to log "we've spent $X so far" read these
    total_tokens_in: int = 0
    total_tokens_out: int = 0
    total_cost_usd: float = 0.0
    cancel_event: asyncio.Event = field(default_factory=asyncio.Event)


@dataclass
class ToolResult:
    """Normalised return value from a tool."""
    ok: bool
    data: dict[str, Any] = field(default_factory=dict)
    error: str | None = None
    error_kind: str | None = None  # "timeout" | "retryable" | "fatal" | "cancelled"
    metadata: dict[str, Any] = field(default_factory=dict)
    tokens_in: int = 0
    tokens_out: int = 0
    cost_usd: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "data": self.data,
            "error": self.error,
            "error_kind": self.error_kind,
            "metadata": self.metadata,
        }


class ToolError(Exception):
    """Raised by a tool to signal a transient failure that the decorator
    should retry. The runtime distinguishes these from fatal errors."""
    def __init__(self, message: str, kind: str = "retryable") -> None:
        super().__init__(message)
        self.kind = kind  # "retryable" | "fatal" | "timeout"


def tool(
    name: str,
    *,
    timeout_s: float = 30.0,
    max_retries: int = 2,
    backoff_base: float = 0.5,
    backoff_max: float = 4.0,
    recoverable: bool = True,
) -> Callable[[Callable[..., Awaitable[dict[str, Any]]]], Callable[..., Awaitable[ToolResult]]]:
    """Decorator: turn an async function into a registered, timed, retried tool.

    The wrapped function must accept `ctx: ToolContext` as the first arg
    and return a `dict` (the `data` field of the result) or raise ToolError.
    """
    def decorator(fn: Callable[..., Awaitable[dict[str, Any]]]) -> Callable[..., Awaitable[ToolResult]]:
        sig = inspect.signature(fn)

        @functools.wraps(fn)
        async def wrapper(ctx: ToolContext, **kwargs: Any) -> ToolResult:
            # Validate required args against the function signature
            for pname, param in sig.parameters.items():
                if pname == "ctx":
                    continue
                if param.default is inspect.Parameter.empty and pname not in kwargs:
                    return ToolResult(
                        ok=False,
                        error=f"missing_required_arg:{pname}",
                        error_kind="fatal",
                    )

            last_exc: Exception | None = None
            for attempt in range(max_retries + 1):
                if ctx.cancel_event.is_set():
                    return ToolResult(
                        ok=False,
                        error="cancelled",
                        error_kind="cancelled",
                    )
                t0 = time.monotonic()
                try:
                    raw = await asyncio.wait_for(fn(ctx, **kwargs), timeout=timeout_s)
                    latency = int((time.monotonic() - t0) * 1000)
                    if not isinstance(raw, dict):
                        raw = {"result": raw}
                    return ToolResult(
                        ok=True,
                        data=raw,
                        metadata={"attempt": attempt + 1, "latency_ms": latency},
                    )
                except asyncio.TimeoutError as exc:
                    last_exc = exc
                    ctx.emit("tool_timeout", {
                        "tool": name,
                        "attempt": attempt + 1,
                        "timeout_s": timeout_s,
                    })
                    if attempt >= max_retries:
                        return ToolResult(
                            ok=False,
                            error=f"timeout_after_{timeout_s}s",
                            error_kind="timeout",
                            metadata={"attempt": attempt + 1},
                        )
                except ToolError as exc:
                    last_exc = exc
                    if exc.kind == "fatal" or not recoverable:
                        return ToolResult(
                            ok=False,
                            error=str(exc),
                            error_kind="fatal",
                        )
                    ctx.emit("tool_retried", {
                        "tool": name,
                        "attempt": attempt + 1,
                        "error": str(exc),
                    })
                except Exception as exc:  # unexpected — log full trace
                    last_exc = exc
                    logger.warning(
                        "tool_unexpected_error name=%s attempt=%d\n%s",
                        name, attempt + 1, traceback.format_exc(),
                    )
                    if attempt >= max_retries or not recoverable:
                        return ToolResult(
                            ok=False,
                            error=str(exc) or exc.__class__.__name__,
                            error_kind="fatal",
                        )
                    ctx.emit("tool_retried", {
                        "tool": name,
                        "attempt": attempt + 1,
                        "error": str(exc),
                    })

                # Backoff between attempts
                if attempt < max_retries:
                    backoff = min(backoff_max, backoff_base * (2 ** attempt))
                    try:
                        await asyncio.wait_for(
                            ctx.cancel_event.wait(), timeout=backoff
                        )
                        # cancel fired during backoff
                        return ToolResult(
                            ok=False,
                            error="cancelled_during_backoff",
                            error_kind="cancelled",
                        )
                    except asyncio.TimeoutError:
                        pass

            # Unreachable but defensive
            return ToolResult(
                ok=False,
                error=str(last_exc) if last_exc else "unknown_failure",
                error_kind="fatal",
            )

        wrapper.__tool_name__ = name  # type: ignore[attr-defined]
        wrapper.__tool_timeout__ = timeout_s  # type: ignore[attr-defined]
        wrapper.__tool_max_retries__ = max_retries  # type: ignore[attr-defined]
        return wrapper

    return decorator
