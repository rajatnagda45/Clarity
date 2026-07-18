import { describe, it, expect } from 'vitest';
import {
  createAgentStreamState,
  applyAgentStreamEvent,
  type AgentStreamState,
} from './agentStream';
import type { AgentRuntimeEvent } from '@/types/clarity';

function ev(partial: Partial<AgentRuntimeEvent>): AgentRuntimeEvent {
  return {
    type: 'node_started',
    runId: 'r-1',
    sequence: 1,
    timestamp: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

describe('createAgentStreamState', () => {
  it('returns the expected initial shape', () => {
    const s = createAgentStreamState();
    expect(s.runId).toBeNull();
    expect(s.status).toBeNull();
    expect(s.plan).toEqual([]);
    expect(s.nodes).toEqual({});
    expect(s.toolCalls).toEqual([]);
    expect(s.memoryEntries).toEqual([]);
    expect(s.output).toBe('');
    expect(s.lastSequence).toBe(0);
    expect(s.errorMessage).toBeNull();
  });
});

describe('applyAgentStreamEvent — identity / sequencing', () => {
  it('records every event and bumps lastSequence', () => {
    let s = createAgentStreamState();
    s = applyAgentStreamEvent(s, ev({ type: 'run_started', runId: 'r-1', sequence: 1 }));
    s = applyAgentStreamEvent(s, ev({ type: 'plan_created', runId: 'r-1', sequence: 2,
      payload: { plan: [{ id: 's1', description: 'Search', tool: 'search_documents',
        tool_args: { query: 'x' }, depends_on: [], expected_output: 'chunks' }] },
    }));
    s = applyAgentStreamEvent(s, ev({ type: 'node_started', runId: 'r-1', sequence: 3,
      nodeId: 'n1', nodeType: 'planner' }));
    expect(s.lastSequence).toBe(3);
    expect(s.events.length).toBe(3);
  });

  it('captures running token + cost totals from each event', () => {
    let s = createAgentStreamState();
    s = applyAgentStreamEvent(s, ev({ type: 'node_started', runId: 'r-1', sequence: 1,
      totalTokensIn: 100, totalTokensOut: 50, totalCostUsd: 0.001 }));
    s = applyAgentStreamEvent(s, ev({ type: 'node_completed', runId: 'r-1', sequence: 2,
      totalTokensIn: 200, totalTokensOut: 80, totalCostUsd: 0.002 }));
    expect(s.totalTokensIn).toBe(200);
    expect(s.totalTokensOut).toBe(80);
    expect(s.totalCostUsd).toBeCloseTo(0.002, 6);
  });
});

describe('applyAgentStreamEvent — run lifecycle', () => {
  it('run_started sets runId and status', () => {
    const s = applyAgentStreamEvent(
      createAgentStreamState(),
      ev({ type: 'run_started', runId: 'r-1', sequence: 1 }),
    );
    expect(s.runId).toBe('r-1');
    expect(s.status).toBe('running');
  });

  it('completed sets status=completed', () => {
    const s = applyAgentStreamEvent(
      createAgentStreamState(),
      ev({ type: 'completed', runId: 'r-1', sequence: 1, payload: { status: 'completed' } }),
    );
    expect(s.status).toBe('completed');
  });

  it('cancelled sets status=cancelled', () => {
    const s = applyAgentStreamEvent(
      createAgentStreamState(),
      ev({ type: 'cancelled', runId: 'r-1', sequence: 1 }),
    );
    expect(s.status).toBe('cancelled');
  });

  it('error sets status=failed and errorMessage', () => {
    const s = applyAgentStreamEvent(
      createAgentStreamState(),
      ev({ type: 'error', runId: 'r-1', sequence: 1, payload: { error: 'boom' } }),
    );
    expect(s.status).toBe('failed');
    expect(s.errorMessage).toBe('boom');
  });
});

describe('applyAgentStreamEvent — plan', () => {
  it('plan_created hydrates the plan steps', () => {
    const s = applyAgentStreamEvent(
      createAgentStreamState(),
      ev({ type: 'plan_created', runId: 'r-1', sequence: 1, payload: {
        plan: [
          { id: 's1', description: 'Search', tool: 'search_documents', tool_args: {}, depends_on: [], expected_output: '' },
          { id: 's2', description: 'Report', tool: 'generate_report', tool_args: {}, depends_on: ['s1'], expected_output: '' },
        ],
      } }),
    );
    expect(s.plan).toHaveLength(2);
    expect(s.plan[0].status).toBe('pending');
  });
});

describe('applyAgentStreamEvent — tool calls', () => {
  it('tool_started appends a new call', () => {
    const s = applyAgentStreamEvent(
      createAgentStreamState(),
      ev({ type: 'tool_started', runId: 'r-1', sequence: 1, nodeId: 'n1',
        payload: { tool_call_id: 'tc1', tool: 'search_documents', tool_args: { query: 'q' } } }),
    );
    expect(s.toolCalls).toHaveLength(1);
    expect(s.toolCalls[0].status).toBe('running');
    expect(s.toolCalls[0].tool).toBe('search_documents');
  });

  it('tool_completed marks success and records latency', () => {
    let s = createAgentStreamState();
    s = applyAgentStreamEvent(s, ev({ type: 'tool_started', runId: 'r-1', sequence: 1, nodeId: 'n1',
      payload: { tool_call_id: 'tc1', tool: 'x', tool_args: {} } }));
    s = applyAgentStreamEvent(s, ev({ type: 'tool_completed', runId: 'r-1', sequence: 2, nodeId: 'n1',
      payload: { tool_call_id: 'tc1', tool: 'x', ok: true, latency_ms: 250,
        data_preview: { result: 'ok' } } }));
    expect(s.toolCalls[0].status).toBe('success');
    expect(s.toolCalls[0].latencyMs).toBe(250);
  });

  it('tool_failed marks error and stores error message', () => {
    let s = createAgentStreamState();
    s = applyAgentStreamEvent(s, ev({ type: 'tool_started', runId: 'r-1', sequence: 1, nodeId: 'n1',
      payload: { tool_call_id: 'tc1', tool: 'x', tool_args: {} } }));
    s = applyAgentStreamEvent(s, ev({ type: 'tool_failed', runId: 'r-1', sequence: 2, nodeId: 'n1',
      payload: { tool_call_id: 'tc1', tool: 'x', ok: false, error: 'kaboom', error_kind: 'fatal' } }));
    expect(s.toolCalls[0].status).toBe('error');
    expect(s.toolCalls[0].error).toBe('kaboom');
    expect(s.toolCalls[0].errorKind).toBe('fatal');
  });

  it('tool_timeout marks timeout', () => {
    let s = createAgentStreamState();
    s = applyAgentStreamEvent(s, ev({ type: 'tool_started', runId: 'r-1', sequence: 1, nodeId: 'n1',
      payload: { tool_call_id: 'tc1', tool: 'x', tool_args: {} } }));
    s = applyAgentStreamEvent(s, ev({ type: 'tool_timeout', runId: 'r-1', sequence: 2, nodeId: 'n1',
      payload: { tool_call_id: 'tc1', tool: 'x' } }));
    expect(s.toolCalls[0].status).toBe('timeout');
  });

  it('tool_retried increments the retry counter', () => {
    let s = createAgentStreamState();
    s = applyAgentStreamEvent(s, ev({ type: 'tool_started', runId: 'r-1', sequence: 1, nodeId: 'n1',
      payload: { tool_call_id: 'tc1', tool: 'x', tool_args: {} } }));
    s = applyAgentStreamEvent(s, ev({ type: 'tool_retried', runId: 'r-1', sequence: 2, nodeId: 'n1',
      payload: { tool_call_id: 'tc1', tool: 'x', attempt: 1 } }));
    s = applyAgentStreamEvent(s, ev({ type: 'tool_retried', runId: 'r-1', sequence: 3, nodeId: 'n1',
      payload: { tool_call_id: 'tc1', tool: 'x', attempt: 2 } }));
    expect(s.toolCalls[0].retryCount).toBe(2);
  });
});

describe('applyAgentStreamEvent — verification', () => {
  it('trust_score updates the trust and confidence', () => {
    const s = applyAgentStreamEvent(
      createAgentStreamState(),
      ev({ type: 'trust_score', runId: 'r-1', sequence: 1, payload: { calibrated: 0.87 } }),
    );
    expect(s.trustScore).toBeCloseTo(0.87, 2);
    expect(s.confidence).toBeCloseTo(0.87, 2);
  });

  it('abstention marks abstained and sets review_required', () => {
    const s = applyAgentStreamEvent(
      createAgentStreamState(),
      ev({ type: 'abstention', runId: 'r-1', sequence: 1,
        payload: { reason: 'insufficient evidence' } }),
    );
    expect(s.abstained).toBe(true);
    expect(s.abstentionReason).toBe('insufficient evidence');
    expect(s.status).toBe('review_required');
  });

  it('approval_requested parks the run', () => {
    const s = applyAgentStreamEvent(
      createAgentStreamState(),
      ev({ type: 'approval_requested', runId: 'r-1', sequence: 1,
        payload: { id: 'apr-1' } }),
    );
    expect(s.status).toBe('awaiting_approval');
    expect(s.approvalId).toBe('apr-1');
  });
});

describe('applyAgentStreamEvent — output', () => {
  it('token appends to output', () => {
    let s = createAgentStreamState();
    s = applyAgentStreamEvent(s, ev({ type: 'token', runId: 'r-1', sequence: 1, payload: { text: 'Hello' } }));
    s = applyAgentStreamEvent(s, ev({ type: 'token', runId: 'r-1', sequence: 2, payload: { text: ' world' } }));
    expect(s.output).toBe('Hello world');
  });

  it('message replaces the final output and citations', () => {
    const s = applyAgentStreamEvent(
      createAgentStreamState(),
      ev({ type: 'message', runId: 'r-1', sequence: 1, payload: {
        output: 'final answer',
        citations: [{ chunkId: 'c1', documentId: 'd1', pageStart: 1, pageEnd: 1, sectionTitle: 's', rerankScore: 0.9 }],
      } }),
    );
    expect(s.output).toBe('final answer');
    expect(s.citations).toHaveLength(1);
  });
});

describe('applyAgentStreamEvent — graph nodes', () => {
  it('node_started creates a node entry', () => {
    const s = applyAgentStreamEvent(
      createAgentStreamState(),
      ev({ type: 'node_started', runId: 'r-1', sequence: 1,
        nodeId: 'n1', nodeType: 'action', parentNodeId: 'n0' }),
    );
    expect(s.nodes['n1']).toBeDefined();
    expect(s.nodes['n1'].nodeType).toBe('action');
    expect(s.nodes['n1'].status).toBe('running');
    expect(s.currentNode).toEqual({ id: 'n1', type: 'action' });
  });

  it('node_started on action advances currentStepIndex', () => {
    let s = createAgentStreamState();
    s = applyAgentStreamEvent(s, ev({ type: 'plan_created', runId: 'r-1', sequence: 1, payload: {
      plan: [
        { id: 's1', description: 'Search', tool: 'search_documents', tool_args: {}, depends_on: [], expected_output: '' },
        { id: 's2', description: 'Report', tool: 'generate_report', tool_args: {}, depends_on: ['s1'], expected_output: '' },
      ],
    } }));
    expect(s.currentStepIndex).toBe(0);
    s = applyAgentStreamEvent(s, ev({ type: 'node_started', runId: 'r-1', sequence: 2,
      nodeId: 'n1', nodeType: 'action' }));
    expect(s.currentStepIndex).toBe(0); // s1 is now running
    s = applyAgentStreamEvent(s, ev({ type: 'node_completed', runId: 'r-1', sequence: 3,
      nodeId: 'n1', nodeType: 'action', payload: { latency_ms: 50, result: 'ok' } }));
    expect(s.currentStepIndex).toBe(1); // advanced to s2
    s = applyAgentStreamEvent(s, ev({ type: 'node_started', runId: 'r-1', sequence: 4,
      nodeId: 'n2', nodeType: 'action' }));
    expect(s.plan[1].status).toBe('running');
  });

  it('node_completed marks success and stores latency', () => {
    let s = createAgentStreamState();
    s = applyAgentStreamEvent(s, ev({ type: 'node_started', runId: 'r-1', sequence: 1,
      nodeId: 'n1', nodeType: 'action' }));
    s = applyAgentStreamEvent(s, ev({ type: 'node_completed', runId: 'r-1', sequence: 2,
      nodeId: 'n1', nodeType: 'action', payload: { latency_ms: 100, result: 'ok' } }));
    expect(s.nodes['n1'].status).toBe('success');
    expect(s.nodes['n1'].latencyMs).toBe(100);
  });

  it('node_failed stores the error', () => {
    let s = createAgentStreamState();
    s = applyAgentStreamEvent(s, ev({ type: 'node_started', runId: 'r-1', sequence: 1,
      nodeId: 'n1', nodeType: 'action' }));
    s = applyAgentStreamEvent(s, ev({ type: 'node_failed', runId: 'r-1', sequence: 2,
      nodeId: 'n1', nodeType: 'action', payload: { error: 'oops' } }));
    expect(s.nodes['n1'].status).toBe('error');
    expect(s.nodes['n1'].error).toBe('oops');
  });
});

describe('applyAgentStreamEvent — memory', () => {
  it('memory_recalled appends an entry', () => {
    const s = applyAgentStreamEvent(
      createAgentStreamState(),
      ev({ type: 'memory_recalled', runId: 'r-1', sequence: 1,
        payload: { recall_preview: 'preview text' } }),
    );
    expect(s.memoryEntries).toHaveLength(1);
    expect(s.memoryEntries[0].role).toBe('system');
    expect(s.memoryEntries[0].content).toBe('preview text');
  });

  it('memory_written uses the payload fields', () => {
    const s = applyAgentStreamEvent(
      createAgentStreamState(),
      ev({ type: 'memory_written', runId: 'r-1', sequence: 1, payload: {
        id: 'm-1', role: 'tool', content: 'tool output', tool: 'search_documents', scope: 'global',
      } }),
    );
    expect(s.memoryEntries[0].id).toBe('m-1');
    expect(s.memoryEntries[0].role).toBe('tool');
    expect(s.memoryEntries[0].tool).toBe('search_documents');
    expect(s.memoryEntries[0].scope).toBe('global');
  });
});
