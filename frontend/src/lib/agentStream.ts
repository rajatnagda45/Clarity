/**
 * Agent stream — SSE parser + state reducer for the Agent Runtime.
 *
 * Mirrors lib/chatStream.ts: fetch-based SSE (so we can attach the
 * Authorization header), pure reducer over an immutable state, auto-resume
 * via Last-Event-ID.
 *
 * The runtime emits events in the order:
 *   run_started → plan_created → node_started → ... → node_completed → ...
 *   → tool_started → tool_completed (per Action node)
 *   → trust_score → message → completed
 * The reducer doesn't assume strict ordering — every event carries its
 * own `node_id` so out-of-order arrivals are still addressed correctly.
 */
import type { AgentRuntimeEvent } from '@/types/clarity';

export interface AgentStreamState {
  runId: string | null;
  agentId: string | null;
  status: 'queued' | 'planning' | 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled' | 'review_required' | null;
  plan: PlanStepView[];
  currentStepIndex: number;
  currentNode: { id: string; type: string } | null;
  nodes: Record<string, NodeView>;
  toolCalls: ToolCallView[];
  memoryEntries: MemoryView[];
  events: AgentRuntimeEvent[];
  output: string;
  citations: CitationView[];
  trustScore: number | null;
  confidence: number | null;
  abstained: boolean;
  abstentionReason: string | null;
  approvalId: string | null;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: number;
  elapsedMs: number;
  lastSequence: number;
  errorMessage: string | null;
}

export interface PlanStepView {
  id: string;
  description: string;
  tool: string | null;
  toolArgs: Record<string, unknown>;
  dependsOn: string[];
  expectedOutput: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  startedAt?: string;
  completedAt?: string;
}

export interface NodeView {
  id: string;
  nodeType: string;
  parentNodeId: string | null;
  attempt: number;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

export interface ToolCallView {
  id: string;
  tool: string;
  nodeId: string;
  status: 'success' | 'error' | 'timeout' | 'pending' | 'running';
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  errorKind: string | null;
  latencyMs: number;
  retryCount: number;
  startedAt: string;
  completedAt: string | null;
}

export interface MemoryView {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool' | 'observation';
  content: string;
  tool: string | null;
  scope: 'run' | 'global';
  createdAt: string;
}

export interface CitationView {
  chunkId: string;
  documentId: string;
  pageStart: number | null;
  pageEnd: number | null;
  sectionTitle: string | null;
  rerankScore: number | null;
}

export function createAgentStreamState(): AgentStreamState {
  return {
    runId: null,
    agentId: null,
    status: null,
    plan: [],
    currentStepIndex: 0,
    currentNode: null,
    nodes: {},
    toolCalls: [],
    memoryEntries: [],
    events: [],
    output: '',
    citations: [],
    trustScore: null,
    confidence: null,
    abstained: false,
    abstentionReason: null,
    approvalId: null,
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalCostUsd: 0,
    elapsedMs: 0,
    lastSequence: 0,
    errorMessage: null,
  };
}

export function applyAgentStreamEvent(
  state: AgentStreamState,
  event: AgentRuntimeEvent,
): AgentStreamState {
  const next: AgentStreamState = {
    ...state,
    events: [...state.events, event],
    lastSequence: Math.max(state.lastSequence, event.sequence ?? 0),
    elapsedMs: Math.max(state.elapsedMs, event.elapsedMs ?? 0),
    totalTokensIn: event.totalTokensIn ?? state.totalTokensIn,
    totalTokensOut: event.totalTokensOut ?? state.totalTokensOut,
    totalCostUsd: event.totalCostUsd ?? state.totalCostUsd,
  };

  switch (event.type) {
    case 'run_started':
      return {
        ...next,
        runId: event.runId,
        status: 'running',
      };
    case 'plan_created': {
      const plan = (event.payload?.plan as PlanStepView[]) ?? [];
      return {
        ...next,
        plan: plan.map((s) => ({ ...s, status: 'pending' as const })),
        currentStepIndex: 0,
        status: 'running',
      };
    }
    case 'node_started': {
      const nodeId = event.nodeId ?? `n_${event.sequence}`;
      const nodeType = event.nodeType ?? 'unknown';
      const nodes = {
        ...next.nodes,
        [nodeId]: {
          id: nodeId,
          nodeType,
          parentNodeId: event.parentNodeId ?? null,
          attempt: event.attempt ?? 1,
          status: 'running' as const,
          latencyMs: 0,
          tokensIn: 0,
          tokensOut: 0,
          costUsd: 0,
          error: null,
          startedAt: event.timestamp,
          completedAt: null,
          input: (event.payload as Record<string, unknown>) ?? {},
          output: {},
        },
      };
      // Mark the corresponding plan step as running, and advance the
      // current step index so the PlanCard highlights the active step.
      const plan = [...next.plan];
      let newCurrentIndex = next.currentStepIndex;
      if (nodeType === 'action' || nodeType === 'memory' || nodeType === 'retriever') {
        const idx = plan.findIndex((s) => s.status === 'pending');
        if (idx >= 0) {
          plan[idx] = { ...plan[idx], status: 'running', startedAt: event.timestamp };
          newCurrentIndex = idx;
        }
      }
      return {
        ...next,
        currentNode: { id: nodeId, type: nodeType },
        currentStepIndex: newCurrentIndex,
        nodes,
        plan,
      };
    }
    case 'node_completed':
    case 'node_failed': {
      const nodeId = event.nodeId;
      if (!nodeId) return next;
      const node = next.nodes[nodeId];
      if (!node) return next;
      const isError = event.type === 'node_failed';
      const updated: NodeView = {
        ...node,
        status: isError ? 'error' : 'success',
        latencyMs: (event.payload?.latency_ms as number) ?? node.latencyMs,
        error: isError ? (event.payload?.error as string) ?? null : node.error,
        completedAt: event.timestamp,
        output: (event.payload as Record<string, unknown>) ?? node.output,
      };
      const plan = [...next.plan];
      let newCurrentIndex = next.currentStepIndex;
      // Mark plan step as completed (best-effort match by tool)
      if (updated.nodeType === 'action' && !isError) {
        const idx = plan.findIndex((s) => s.status === 'running' && s.tool !== null);
        if (idx >= 0) {
          plan[idx] = { ...plan[idx], status: 'success', completedAt: event.timestamp };
          newCurrentIndex = idx + 1;
        }
      } else if (isError) {
        const idx = plan.findIndex((s) => s.status === 'running' && s.tool !== null);
        if (idx >= 0) {
          plan[idx] = { ...plan[idx], status: 'error', completedAt: event.timestamp };
          newCurrentIndex = idx + 1;
        }
      }
      return {
        ...next,
        nodes: { ...next.nodes, [nodeId]: updated },
        plan,
        currentStepIndex: newCurrentIndex,
      };
    }
    case 'tool_started': {
      const toolCall: ToolCallView = {
        id: (event.payload?.tool_call_id as string) ?? `tc_${event.sequence}`,
        tool: (event.payload?.tool as string) ?? 'unknown',
        nodeId: event.nodeId ?? '',
        status: 'running',
        input: (event.payload?.tool_args as Record<string, unknown>) ?? {},
        output: null,
        error: null,
        errorKind: null,
        latencyMs: 0,
        retryCount: 0,
        startedAt: event.timestamp,
        completedAt: null,
      };
      return { ...next, toolCalls: [...next.toolCalls, toolCall] };
    }
    case 'tool_completed':
    case 'tool_failed':
    case 'tool_timeout': {
      const toolCallId = event.payload?.tool_call_id as string;
      const idx = next.toolCalls.findIndex((t) => t.id === toolCallId);
      if (idx < 0) return next;
      const updated: ToolCallView = {
        ...next.toolCalls[idx],
        status: event.type === 'tool_completed' ? 'success' : event.type === 'tool_timeout' ? 'timeout' : 'error',
        output: (event.payload?.data_preview as Record<string, unknown>) ?? next.toolCalls[idx].output,
        error: (event.payload?.error as string) ?? null,
        errorKind: (event.payload?.error_kind as string) ?? null,
        latencyMs: (event.payload?.latency_ms as number) ?? next.toolCalls[idx].latencyMs,
        completedAt: event.timestamp,
      };
      const toolCalls = [...next.toolCalls];
      toolCalls[idx] = updated;
      return { ...next, toolCalls };
    }
    case 'tool_retried': {
      const toolCallId = event.payload?.tool_call_id as string;
      const idx = next.toolCalls.findIndex((t) => t.id === toolCallId);
      if (idx < 0) return next;
      const toolCalls = [...next.toolCalls];
      toolCalls[idx] = { ...toolCalls[idx], retryCount: toolCalls[idx].retryCount + 1 };
      return { ...next, toolCalls };
    }
    case 'memory_recalled': {
      const entry: MemoryView = {
        id: `m_${event.sequence}`,
        role: 'system',
        content: (event.payload?.recall_preview as string) ?? '',
        tool: null,
        scope: 'run',
        createdAt: event.timestamp,
      };
      return { ...next, memoryEntries: [...next.memoryEntries, entry] };
    }
    case 'memory_written': {
      const entry: MemoryView = {
        id: (event.payload?.id as string) ?? `m_${event.sequence}`,
        role: ((event.payload?.role as MemoryView['role']) ?? 'observation'),
        content: (event.payload?.content as string) ?? '',
        tool: (event.payload?.tool as string) ?? null,
        scope: (event.payload?.scope as MemoryView['scope']) ?? 'run',
        createdAt: event.timestamp,
      };
      return { ...next, memoryEntries: [...next.memoryEntries, entry] };
    }
    case 'trust_score':
      return {
        ...next,
        trustScore: (event.payload?.calibrated as number) ?? next.trustScore,
        confidence: (event.payload?.calibrated as number) ?? next.confidence,
      };
    case 'abstention':
      return {
        ...next,
        abstained: true,
        abstentionReason: (event.payload?.reason as string) ?? next.abstentionReason,
        status: 'review_required',
      };
    case 'approval_requested':
      return {
        ...next,
        approvalId: (event.payload?.id as string) ?? null,
        status: 'awaiting_approval',
      };
    case 'approval_received':
      return { ...next, status: 'running' };
    case 'token':
      return { ...next, output: `${next.output}${event.payload?.text ?? ''}` };
    case 'message': {
      const msg = event.payload as { output?: string; citations?: CitationView[] };
      return {
        ...next,
        output: msg.output ?? next.output,
        citations: msg.citations ?? next.citations,
      };
    }
    case 'completed':
      return { ...next, status: 'completed' };
    case 'cancelled':
      return { ...next, status: 'cancelled' };
    case 'error': {
      const errPayload = event.payload as { error?: string; message?: string } | undefined;
      return {
        ...next,
        errorMessage: errPayload?.error ?? errPayload?.message ?? 'unknown_error',
        status: 'failed',
      };
    }
    default:
      return next;
  }
}
