'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, Plus, Trash2, ToggleLeft, ToggleRight, ArrowRight, Bot, Zap, CheckSquare, AlertCircle, Settings2 } from 'lucide-react';
import { PremiumBackground } from '@/components/landing/PremiumBackground';
import { useWorkflows, useCreateWorkflow, useUpdateWorkflow, useDeleteWorkflow } from '@/hooks/useAgents';
import { useAgents } from '@/hooks/useAgents';
import { useToast } from '@/contexts/ToastContext';
import { formatRelativeTime } from '@/lib/time';
import type { Workflow, WorkflowNode, WorkflowEdge, WorkflowNodeType } from '@/types/clarity';

const NODE_TYPES: { type: WorkflowNodeType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'trigger', label: 'Trigger', icon: <Zap size={14} />, color: '#F59E0B' },
  { type: 'agent', label: 'Agent', icon: <Bot size={14} />, color: '#7C3AED' },
  { type: 'condition', label: 'Condition', icon: <Settings2 size={14} />, color: '#2563EB' },
  { type: 'action', label: 'Action', icon: <CheckSquare size={14} />, color: '#059669' },
  { type: 'output', label: 'Output', icon: <ArrowRight size={14} />, color: '#6366F1' },
];

const NODE_COLORS: Record<WorkflowNodeType, string> = {
  trigger: '#F59E0B',
  agent: '#7C3AED',
  condition: '#2563EB',
  action: '#059669',
  output: '#6366F1',
};

function VisualPipeline({ nodes, edges }: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }) {
  if (nodes.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center border-2 border-dashed border-white/[0.06] rounded-xl">
        <p className="text-xs text-[#4A5168]">No nodes in this workflow</p>
      </div>
    );
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const childMap = new Map<string, string[]>();
  edges.forEach(e => {
    if (!childMap.has(e.source)) childMap.set(e.source, []);
    childMap.get(e.source)!.push(e.target);
  });

  const roots = nodes.filter(n => !edges.some(e => e.target === n.id));

  const renderNode = (node: WorkflowNode, depth = 0): React.ReactNode => {
    const color = NODE_COLORS[node.type] ?? '#6366F1';
    const children = (childMap.get(node.id) ?? []).map(cid => nodeMap.get(cid)).filter(Boolean) as WorkflowNode[];
    return (
      <div key={node.id} className="flex flex-col items-center gap-2">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold"
          style={{ backgroundColor: `${color}15`, borderColor: `${color}30`, color }}
        >
          {NODE_TYPES.find(t => t.type === node.type)?.icon}
          {node.label}
        </div>
        {children.length > 0 && (
          <>
            <div className="w-px h-4 bg-white/[0.1]" />
            <div className="flex gap-4">
              {children.map(child => (
                <div key={child.id} className="flex flex-col items-center gap-2">
                  {renderNode(child, depth + 1)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="overflow-x-auto py-4 flex gap-8 justify-center">
      {roots.map(root => renderNode(root))}
    </div>
  );
}

function CreateWorkflowModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const create = useCreateWorkflow();
  const { data: agentsData } = useAgents();
  const agents = agentsData?.agents ?? [];

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nodes, setNodes] = useState<WorkflowNode[]>([
    { id: 'trigger', type: 'trigger', label: 'Document Uploaded', config: {}, positionX: 0, positionY: 0 },
  ]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);

  const addNode = (type: WorkflowNodeType) => {
    const id = `node-${Date.now()}`;
    const nodeType = NODE_TYPES.find(t => t.type === type)!;
    const newNode: WorkflowNode = {
      id,
      type,
      label: type === 'agent' && agents.length > 0 ? agents[0].name : nodeType.label,
      config: type === 'agent' && agents.length > 0 ? { agentId: agents[0].id } : {},
      positionX: nodes.length * 200,
      positionY: 0,
    };
    const lastNode = nodes[nodes.length - 1];
    const newEdge: WorkflowEdge = { id: `edge-${Date.now()}`, source: lastNode.id, target: id, label: null };
    setNodes(prev => [...prev, newNode]);
    setEdges(prev => [...prev, newEdge]);
  };

  const handleCreate = () => {
    if (!name.trim()) { toast.error('Workflow name is required.'); return; }
    create.mutate({ name: name.trim(), description, nodes, edges }, {
      onSuccess: () => { toast.success('Workflow created.'); onClose(); },
      onError: () => toast.error('Failed to create workflow.'),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        className="bg-[#0F1117] border border-white/[0.1] rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-base font-bold text-[#F1F3F9] mb-5">Create Workflow</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#8892AA] mb-1.5">Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Contract Review Pipeline"
                className="w-full bg-[#151923] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#8892AA] mb-1.5">Description</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional"
                className="w-full bg-[#151923] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors" />
            </div>
          </div>

          {/* Visual pipeline preview */}
          <div>
            <p className="text-xs font-semibold text-[#8892AA] mb-2">Pipeline Preview</p>
            <div className="bg-[#090B11] border border-white/[0.06] rounded-xl p-4 min-h-24">
              <VisualPipeline nodes={nodes} edges={edges} />
            </div>
          </div>

          {/* Add nodes */}
          <div>
            <p className="text-xs font-semibold text-[#8892AA] mb-2">Add Node</p>
            <div className="flex flex-wrap gap-2">
              {NODE_TYPES.filter(t => t.type !== 'trigger').map(t => (
                <button key={t.type} onClick={() => addNode(t.type)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:border-white/[0.1]"
                  style={{ backgroundColor: `${t.color}15`, borderColor: `${t.color}30`, color: t.color }}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Node list */}
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {nodes.map((node, i) => {
              const cfg = NODE_TYPES.find(t => t.type === node.type)!;
              return (
                <div key={node.id} className="flex items-center gap-3 px-3 py-2 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                  <span style={{ color: cfg.color }}>{cfg.icon}</span>
                  <span className="text-xs text-[#F1F3F9] font-medium flex-1">{node.label}</span>
                  <span className="text-[9px] uppercase tracking-wide font-bold" style={{ color: cfg.color }}>{node.type}</span>
                  {i > 0 && (
                    <button onClick={() => {
                      setNodes(prev => prev.filter(n => n.id !== node.id));
                      setEdges(prev => prev.filter(e => e.source !== node.id && e.target !== node.id));
                    }} className="text-[#4A5168] hover:text-red-400 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#8892AA] bg-white/[0.04] hover:bg-white/[0.08] transition-colors">Cancel</button>
          <button onClick={handleCreate} disabled={create.isPending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 transition-colors">
            {create.isPending ? 'Creating…' : 'Create Workflow'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function WorkflowCard({ workflow }: { workflow: Workflow }) {
  const { toast } = useToast();
  const update = useUpdateWorkflow();
  const remove = useDeleteWorkflow();

  return (
    <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.1] transition-all">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-bold text-[#F1F3F9]">{workflow.name}</p>
          {workflow.description && <p className="text-xs text-[#4A5168] mt-0.5">{workflow.description}</p>}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-[#4A5168]">
            <span>{workflow.nodes.length} nodes · {workflow.edges.length} edges</span>
            <span>Created {formatRelativeTime(workflow.createdAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${workflow.enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/[0.04] text-[#4A5168]'}`}>
            {workflow.enabled ? 'Active' : 'Paused'}
          </span>
          <button onClick={() => update.mutate({ workflowId: workflow.id, payload: { enabled: !workflow.enabled } })}
            className="p-1.5 rounded-lg text-[#4A5168] hover:text-[#F1F3F9] hover:bg-white/[0.06] transition-colors">
            {workflow.enabled ? <ToggleRight size={18} className="text-emerald-400" /> : <ToggleLeft size={18} />}
          </button>
          <button onClick={() => remove.mutate(workflow.id, {
            onSuccess: () => toast.success('Workflow deleted.'),
            onError: () => toast.error('Failed to delete.'),
          })} className="p-1.5 rounded-lg text-[#4A5168] hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="bg-[#090B11] border border-white/[0.04] rounded-xl p-3">
        <VisualPipeline nodes={workflow.nodes} edges={workflow.edges} />
      </div>
    </div>
  );
}

export default function WorkflowsPage() {
  const { data, isLoading, isError } = useWorkflows();
  const [showCreate, setShowCreate] = useState(false);
  const workflows = data?.workflows ?? [];

  return (
    <div className="relative min-h-screen bg-[#05070B] selection:bg-purple-500/30 pb-32">
      <PremiumBackground glowOpacity={0.08} />
      <div className="relative z-10 mx-auto max-w-5xl px-6 pt-12">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
                <GitBranch size={22} className="text-purple-400" />
              </span>
              Workflow Builder
            </h1>
            <p className="text-sm text-[#8892AA] mt-1.5 ml-14">
              Build visual multi-agent pipelines with triggers, conditions, and actions.
            </p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors shrink-0">
            <Plus size={16} />New Workflow
          </button>
        </div>

        {isLoading && (
          <div className="space-y-4">
            {[1, 2].map(i => <div key={i} className="h-48 bg-white/[0.03] border border-white/[0.04] rounded-2xl animate-pulse" />)}
          </div>
        )}

        {isError && (
          <div className="flex items-center justify-center gap-3 py-12 bg-[#0F1117] border border-white/[0.06] rounded-2xl">
            <AlertCircle size={18} className="text-red-400" />
            <p className="text-sm text-red-400">Failed to load workflows.</p>
          </div>
        )}

        {!isLoading && !isError && workflows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 bg-[#0F1117] border border-white/[0.06] rounded-2xl text-center">
            <div className="w-20 h-20 rounded-3xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6">
              <GitBranch size={36} className="text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-[#F1F3F9] mb-2">No workflows yet</h3>
            <p className="text-sm text-[#4A5168] mb-8 max-w-md leading-relaxed">
              Create multi-agent pipelines where agents hand off context to each other sequentially or in parallel, with conditional branching.
            </p>
            <button onClick={() => setShowCreate(true)} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition-colors">
              Build your first workflow
            </button>
          </div>
        )}

        {!isLoading && !isError && workflows.length > 0 && (
          <div className="space-y-5">
            {workflows.map(wf => <WorkflowCard key={wf.id} workflow={wf} />)}
          </div>
        )}

        <AnimatePresence>
          {showCreate && <CreateWorkflowModal onClose={() => setShowCreate(false)} />}
        </AnimatePresence>
      </div>
    </div>
  );
}
