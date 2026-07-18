'use client';

/**
 * AgentGraphViewer — visualises the execution graph for a single agent run.
 *
 * Each node shows: type, status, attempt, latency, tokens, cost, error.
 * Edges are derived from parent_node_id. The user can click a node to
 * see its input/output/error detail in a side panel.
 *
 * The component is a thin shell — it pulls data via the existing
 * /api/agents/runs/{id}/graph endpoint (tenant-scoped, RLS-protected)
 * and renders the existing dark-glass design system.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  Box,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  FileText,
  GitBranch,
  Loader2,
  MemoryStick,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Search,
  ShieldCheck,
  Square,
  Target,
  Wrench,
  XCircle,
  Zap,
} from 'lucide-react';
import type { AgentRunGraph, AgentRunNode } from '@/types/clarity';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { getAgentRunGraph, listAgentRunToolCalls, getAgentRunMemory } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { AuthContext } from '@/lib/api';

interface AgentGraphViewerProps {
  runId: string;
}

const NODE_ICONS: Record<string, typeof Box> = {
  planner: Target,
  memory: MemoryStick,
  action: Wrench,
  decision: GitBranch,
  retriever: Search,
  writer: FileText,
  critic: ShieldCheck,
  verifier: ShieldCheck,
  judge: Activity,
  approval: PauseCircle,
  finish: CheckCircle2,
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-fg-muted',
  running: 'text-accent',
  success: 'text-success',
  error: 'text-danger',
  skipped: 'text-fg-muted',
  awaiting_approval: 'text-warning',
};

const STATUS_BG: Record<string, string> = {
  pending: 'bg-white/[0.04]',
  running: 'bg-accent/10',
  success: 'bg-success/10',
  error: 'bg-danger/10',
  skipped: 'bg-white/[0.02]',
  awaiting_approval: 'bg-warning/10',
};

export function AgentGraphViewer({ runId }: AgentGraphViewerProps) {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [graph, setGraph] = useState<AgentRunGraph | null>(null);
  const [toolCalls, setToolCalls] = useState<Array<Record<string, unknown>>>([]);
  const [memoryCount, setMemoryCount] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAuth = useCallback(async (): Promise<AuthContext | null> => {
    const token = await getToken();
    if (!token || !activeWorkspace?.id) return null;
    return { token, workspaceId: activeWorkspace.id };
  }, [getToken, activeWorkspace?.id]);

  const load = useCallback(async () => {
    const auth = await getAuth();
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const [g, tc, mem] = await Promise.all([
        getAgentRunGraph(auth, runId),
        listAgentRunToolCalls(auth, runId).catch(() => ({ tool_calls: [], count: 0 })),
        getAgentRunMemory(auth, runId).catch(() => ({ entries: [], count: 0 })),
      ]);
      setGraph(g);
      setToolCalls(tc.tool_calls);
      setMemoryCount(mem.count);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [getAuth, runId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-surface-elevated p-6 text-fg-secondary">
        <Loader2 className="h-4 w-4 animate-spin text-accent" />
        Loading execution graph…
      </div>
    );
  }
  if (error || !graph) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 p-6 text-danger">
        <AlertCircle className="h-4 w-4" />
        {error ?? 'Run not found.'}
      </div>
    );
  }

  const selectedNode = selectedNodeId
    ? graph.nodes.find((n) => n.id === selectedNodeId) ?? null
    : null;

  return (
    <div className="space-y-4">
      <SummaryHeader graph={graph} toolCount={toolCalls.length} memoryCount={memoryCount} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <NodeList
          nodes={graph.nodes}
          edges={graph.edges}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
        />
        <NodeInspector node={selectedNode} onClose={() => setSelectedNodeId(null)} />
      </div>
    </div>
  );
}

function SummaryHeader({
  graph,
  toolCount,
  memoryCount,
}: {
  graph: AgentRunGraph;
  toolCount: number;
  memoryCount: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-2 gap-3 rounded-2xl border border-white/[0.06] bg-surface-elevated p-4 md:grid-cols-4 lg:grid-cols-7"
    >
      <Stat label="Status" value={graph.status} icon={graph.status === 'completed' ? CheckCircle2 : Activity} />
      <Stat label="Nodes" value={graph.summary.node_count} icon={Box} />
      <Stat label="Tool calls" value={toolCount} icon={Wrench} />
      <Stat label="Memory" value={memoryCount} icon={MemoryStick} />
      <Stat
        label="Total latency"
        value={`${(graph.summary.total_latency_ms / 1000).toFixed(1)}s`}
        icon={Clock}
      />
      <Stat
        label="Tokens"
        value={graph.summary.total_tokens_in + graph.summary.total_tokens_out}
        icon={Cpu}
      />
      <Stat
        label="Cost"
        value={`$${graph.summary.total_cost_usd.toFixed(4)}`}
        icon={Coins}
      />
    </motion.div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Box;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="rounded-lg bg-white/[0.04] p-2">
        <Icon className="h-4 w-4 text-accent" />
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-fg-muted">{label}</div>
        <div className="text-sm font-medium text-fg-primary">{value}</div>
      </div>
    </div>
  );
}

function NodeList({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
}: {
  nodes: AgentRunNode[];
  edges: Array<{ source: string; target: string; type: string }>;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}) {
  // Group by parent to render the DAG visually
  const byParent = useMemo(() => {
    const m = new Map<string | null, AgentRunNode[]>();
    for (const n of nodes) {
      const key = n.parent_node_id ?? null;
      const arr = m.get(key) ?? [];
      arr.push(n);
      m.set(key, arr);
    }
    return m;
  }, [nodes]);

  const rootNodes = byParent.get(null) ?? [];

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-surface-elevated p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg-primary">Execution graph</h3>
        <span className="text-xs text-fg-muted">{nodes.length} nodes · {edges.length} edges</span>
      </div>
      <div className="space-y-2">
        {rootNodes.map((n) => (
          <NodeRow
            key={n.id}
            node={n}
            descendants={byParent.get(n.id) ?? []}
            byParent={byParent}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
}

function NodeRow({
  node,
  descendants,
  byParent,
  selectedNodeId,
  onSelectNode,
  depth,
}: {
  node: AgentRunNode;
  descendants: AgentRunNode[];
  byParent: Map<string | null, AgentRunNode[]>;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  depth: number;
}) {
  const Icon = NODE_ICONS[node.node_type] ?? Box;
  const isSelected = node.id === selectedNodeId;
  return (
    <div style={{ marginLeft: depth * 16 }}>
      <button
        type="button"
        onClick={() => onSelectNode(node.id)}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
          isSelected ? 'border-accent/50 bg-accent/5' : 'border-white/[0.06] hover:border-white/[0.12]',
          STATUS_BG[node.status],
        )}
      >
        <Icon className={cn('h-4 w-4', STATUS_COLOR[node.status])} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-fg-primary">{node.node_type}</span>
            <span className="text-[11px] text-fg-muted">#{node.id.slice(-6)}</span>
            {node.attempt > 1 && (
              <span className="inline-flex items-center gap-1 rounded bg-warning/10 px-1.5 py-0.5 text-[10px] text-warning">
                <RotateCcw className="h-3 w-3" /> attempt {node.attempt}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-[11px] text-fg-muted">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {node.latency_ms} ms
            </span>
            <span className="inline-flex items-center gap-1">
              <Cpu className="h-3 w-3" />
              {node.tokens_in + node.tokens_out}
            </span>
            <span className="inline-flex items-center gap-1">
              <Coins className="h-3 w-3" />
              ${node.cost_usd.toFixed(4)}
            </span>
            {node.error && (
              <span className="inline-flex items-center gap-1 text-danger">
                <XCircle className="h-3 w-3" />
                {node.error.slice(0, 60)}
              </span>
            )}
          </div>
        </div>
        <NodeStatusBadge status={node.status} />
      </button>
      {descendants.length > 0 && (
        <div className="mt-1 space-y-1 border-l border-white/[0.06] pl-2">
          {descendants.map((c) => (
            <NodeRow
              key={c.id}
              node={c}
              descendants={byParent.get(c.id) ?? []}
              byParent={byParent}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NodeStatusBadge({ status }: { status: string }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-success/15 px-1.5 py-0.5 text-[10px] text-success">
        <CheckCircle2 className="h-3 w-3" /> success
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-danger/15 px-1.5 py-0.5 text-[10px] text-danger">
        <XCircle className="h-3 w-3" /> error
      </span>
    );
  }
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent">
        <Loader2 className="h-3 w-3 animate-spin" /> running
      </span>
    );
  }
  if (status === 'awaiting_approval') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-warning/15 px-1.5 py-0.5 text-[10px] text-warning">
        <PauseCircle className="h-3 w-3" /> awaiting approval
      </span>
    );
  }
  return (
    <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-fg-muted">{status}</span>
  );
}

function NodeInspector({ node, onClose }: { node: AgentRunNode | null; onClose: () => void }) {
  return (
    <AnimatePresence mode="popLayout">
      {node && (
        <motion.div
          key={node.id}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 8 }}
          className="rounded-2xl border border-white/[0.06] bg-surface-elevated p-4"
        >
          <div className="mb-3 flex items-start justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-fg-muted">{node.node_type} node</div>
              <div className="text-sm font-semibold text-fg-primary">#{node.id.slice(-8)}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-fg-muted hover:bg-white/[0.04] hover:text-fg-primary"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          </div>
          <KV label="Status" value={node.status} />
          <KV label="Latency" value={`${node.latency_ms} ms`} />
          <KV label="Tokens (in/out)" value={`${node.tokens_in} / ${node.tokens_out}`} />
          <KV label="Cost" value={`$${node.cost_usd.toFixed(6)}`} />
          {node.error && <KV label="Error" value={node.error} mono />}
          <details className="mt-3">
            <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-fg-muted hover:text-fg-primary">
              Input
            </summary>
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-black/30 p-2 font-mono text-[11px] text-fg-secondary">
              {JSON.stringify(node.input, null, 2)}
            </pre>
          </details>
          <details className="mt-2" open>
            <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-fg-muted hover:text-fg-primary">
              Output
            </summary>
            <pre className="mt-1 max-h-60 overflow-auto rounded bg-black/30 p-2 font-mono text-[11px] text-fg-secondary">
              {JSON.stringify(node.output, null, 2)}
            </pre>
          </details>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function KV({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-b border-white/[0.04] py-1.5 text-xs last:border-b-0">
      <span className="text-fg-muted">{label}</span>
      <span className={cn('text-right', mono ? 'font-mono text-fg-secondary' : 'text-fg-primary')}>
        {value}
      </span>
    </div>
  );
}
