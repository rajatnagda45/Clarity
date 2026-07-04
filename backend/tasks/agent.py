"""ARQ task wrapper — agent run execution."""
from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)


async def run_agent_execution(
    ctx: dict,
    run_id: str,
    agent_id: str,
    workspace_id: str,
    user_input: str,
    pipeline_agents: list[str],
) -> dict:
    """
    ARQ entrypoint for agent execution. The underlying function is
    synchronous, so we run it in a thread to avoid blocking the event loop.
    """
    logger.info(
        "task:run_agent_execution run=%s agent=%s ws=%s", run_id, agent_id, workspace_id
    )
    try:
        from api.routers.agents import _execute_agent_run
        await asyncio.to_thread(
            _execute_agent_run, run_id, agent_id, workspace_id, user_input, pipeline_agents
        )
        return {"status": "ok", "run_id": run_id}
    except Exception as exc:
        logger.exception("agent task failed run=%s: %s", run_id, exc)
        raise
