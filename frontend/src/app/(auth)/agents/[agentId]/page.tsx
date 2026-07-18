'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play, Settings, Bot, CheckCircle2, XCircle, Clock, AlertCircle, Wrench, BarChart2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { PremiumBackground } from '@/components/landing/PremiumBackground';
import { useAgent, useAgentRuns, useAgentAnalytics, useUpdateAgent, useDeleteAgent, useDuplicateAgent, useRestoreAgent } from '@/hooks/useAgents';
import { useToast } from '@/contexts/ToastContext';
import { formatRelativeTime } from '@/lib/time';
import type { AgentRun } from '@/types/clarity';

const STATUS_CONFIG = {
  queued: { label: 'Queued', color: 'text-[#4A5168]', bg: 'bg-white/[0.04]', icon: <Clock size={12} /> },
  running: { label: 'Running', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: <Loader2 size={12} className="animate-spin" /> },
  completed: { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: <CheckCircle2 size={12} /> },
  failed: { label: 'Failed', color: 'text-red-400', bg: 'bg-red-500/10', icon: <XCircle size={12} /> },
  review_required: { label: 'Review Required', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: <AlertCircle size={12} /> },
};

function RunCard({ run }: { run: AgentRun }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.queued;

  return (
    <div className="border border-white/[0.06] rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full bg-[#0F1117] px-5 py-4 flex items-center gap-4 hover:bg-white/[0.01] transition-colors text-left"
      >
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.bg} ${cfg.color} shrink-0`}>
          {cfg.icon}{cfg.label}
        </span>
        <p className="flex-1 text-sm text-[#F1F3F9] truncate">{run.input}</p>
        <div className="flex items-center gap-4 text-xs text-[#4A5168] shrink-0">
          {run.latencyMs > 0 && <span>{run.latencyMs}ms</span>}
          {run.trustScore !== null && <span className="text-purple-400">{run.trustScore.toFixed(2)} trust</span>}
          <span>{formatRelativeTime(run.createdAt)}</span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-[#4A5168]" /> : <ChevronDown size={14} className="text-[#4A5168]" />}
      </button>
      <div className="border-t border-white/[0.04] bg-[#090B11] px-5 py-2 flex items-center justify-end gap-2">
        <Link href={`/developer/runs/${run.id}`} className="text-xs text-[#8892AA] hover:text-[#F1F3F9] transition-colors">
          Open in developer console →
        </Link>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/[0.04]"
          >
            <div className="bg-[#090B11] p-5 space-y-4">
              {run.output && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#4A5168] mb-2">Output</p>
                  <p className="text-sm text-[#F1F3F9] leading-relaxed">{run.output}</p>
                </div>
              )}
              {run.toolCalls.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#4A5168] mb-2">Tool Calls ({run.toolCalls.length})</p>
                  <div className="space-y-2">
                    {run.toolCalls.map(tc => (
                      <div key={tc.id} className="flex items-center gap-3 bg-white/[0.02] rounded-xl px-3 py-2 text-xs">
                        <Wrench size={12} className="text-purple-400 shrink-0" />
                        <span className="font-mono font-semibold text-purple-400">{tc.toolName}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tc.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                          {tc.status}
                        </span>
                        <span className="text-[#4A5168] ml-auto">{tc.latencyMs}ms</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-4 text-[10px] text-[#4A5168]">
                {run.tokensUsed > 0 && <span>{run.tokensUsed} tokens</span>}
                {run.costEstimate !== null && <span>${run.costEstimate.toFixed(5)}</span>}
                {run.confidence !== null && <span>Confidence: {run.confidence.toFixed(2)}</span>}
                {run.humanReviewRequired && (
                  <span className="text-amber-400 font-semibold">⚠ Routed to review</span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AgentDetailPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'runs' | 'analytics' | 'settings'>('runs');

  const { data: agent, isLoading: agentLoading, isError: agentError } = useAgent(agentId);
  const { data: runsData, isLoading: runsLoading } = useAgentRuns(agentId);
  const { data: analytics } = useAgentAnalytics(agentId);
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();
  const duplicateAgent = useDuplicateAgent();
  const restoreAgent = useRestoreAgent();

  const runs = runsData?.runs ?? [];

  const handleRun = () => {
    router.push(`/agents/${agentId}/live?run=1`);
  };

  const handleDelete = () => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete "${agent?.name}"? This cannot be undone.`)) return;
    deleteAgent.mutate(agentId, {
      onSuccess: () => {
        toast.success('Agent deleted.');
        router.push('/agents');
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete.'),
    });
  };

  const handleDuplicate = () => {
    duplicateAgent.mutate(agentId, {
      onSuccess: (newAgent) => {
        toast.success('Agent duplicated.');
        router.push(`/agents/${newAgent.id}`);
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to duplicate.'),
    });
  };

  const handleRestore = () => {
    restoreAgent.mutate(agentId, {
      onSuccess: () => toast.success('Agent restored.'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to restore.'),
    });
  };

  if (agentLoading) {
    return (
      <div className="relative min-h-screen bg-[#05070B] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-purple-400" />
      </div>
    );
  }

  if (agentError || !agent) {
    return (
      <div className="relative min-h-screen bg-[#05070B] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-[#F1F3F9] font-semibold">Agent not found</p>
          <Link href="/agents" className="text-purple-400 text-sm mt-2 inline-block hover:underline">← Back to agents</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#05070B] selection:bg-purple-500/30 pb-32">
      <PremiumBackground glowOpacity={0.08} />
      <div className="relative z-10 mx-auto max-w-5xl px-6 pt-12">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/agents" className="p-2 rounded-xl text-[#4A5168] hover:text-[#F1F3F9] hover:bg-white/[0.06] transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl border border-white/[0.08]"
              style={{ backgroundColor: `${agent.color}20` }}
            >
              {agent.avatar}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#F1F3F9] tracking-tight">{agent.name}</h1>
              <p className="text-sm text-[#4A5168]">{agent.description}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ backgroundColor: `${agent.color}20`, color: agent.color }}>
                  {agent.category}
                </span>
                <span className="text-[10px] text-[#4A5168]">{agent.model}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateAgent.mutate({ agentId, payload: { isFavorite: !agent.isFavorite } })}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${agent.isFavorite ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-white/[0.04] text-[#4A5168] border-white/[0.08] hover:text-[#F1F3F9]'}`}
            >
              {agent.isFavorite ? '★ Favorited' : '☆ Favorite'}
            </button>
            <button
              onClick={handleDuplicate}
              disabled={duplicateAgent.isPending}
              className="px-3 py-2 rounded-xl text-xs font-semibold border bg-white/[0.04] text-[#4A5168] border-white/[0.08] hover:text-[#F1F3F9] disabled:opacity-50 transition-colors"
              title="Duplicate this agent"
            >
              Duplicate
            </button>
            <button
              onClick={handleRun}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <Play size={14} />
              Run Agent
            </button>
          </div>
        </div>

        {/* Archived banner */}
        {agent.archivedAt && (
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertCircle size={16} />
              <span className="text-sm">This agent is archived. Restore it to use it again.</span>
            </div>
            <button
              onClick={handleRestore}
              disabled={restoreAgent.isPending}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 transition-colors"
            >
              {restoreAgent.isPending ? 'Restoring…' : 'Restore'}
            </button>
          </div>
        )}

        {/* Delete confirmation banner */}
        <details className="mb-6 group">
          <summary className="cursor-pointer text-xs text-[#4A5168] hover:text-red-400 transition-colors list-none">
            ⚠ Danger zone
          </summary>
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-sm text-red-400">Delete this agent permanently.</p>
            <button
              onClick={handleDelete}
              disabled={deleteAgent.isPending}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/15 text-red-300 hover:bg-red-500/25 disabled:opacity-50 transition-colors"
            >
              {deleteAgent.isPending ? 'Deleting…' : 'Delete agent'}
            </button>
          </div>
        </details>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[#0F1117] border border-white/[0.06] rounded-xl p-1 w-fit">
          {[
            { id: 'runs', label: 'Runs', icon: <Play size={13} /> },
            { id: 'analytics', label: 'Analytics', icon: <BarChart2 size={13} /> },
            { id: 'settings', label: 'Settings', icon: <Settings size={13} /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${activeTab === tab.id ? 'bg-white/[0.08] text-[#F1F3F9]' : 'text-[#4A5168] hover:text-[#F1F3F9]'}`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* Runs Tab */}
        {activeTab === 'runs' && (
          <div>
            {runsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-white/[0.03] border border-white/[0.04] rounded-2xl animate-pulse" />)}
              </div>
            ) : runs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-[#0F1117] border border-white/[0.06] rounded-2xl text-center">
                <Bot size={32} className="text-[#4A5168] mb-3" />
                <p className="text-sm font-semibold text-[#F1F3F9] mb-1">No runs yet</p>
                <p className="text-xs text-[#4A5168] mb-4">Click &quot;Run Agent&quot; to start this agent&apos;s first execution.</p>
                <Link href={`/agents/${agentId}/live?run=1`} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition-colors inline-block">
                  Run Agent
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {runs.map(run => <RunCard key={run.id} run={run} />)}
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div>
            {analytics ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Total Runs', value: analytics.totalRuns, color: 'text-purple-400' },
                  { label: 'Success Rate', value: `${Math.round(analytics.successRate * 100)}%`, color: 'text-emerald-400' },
                  { label: 'Avg Latency', value: analytics.avgLatencyMs > 0 ? `${analytics.avgLatencyMs}ms` : '—', color: 'text-blue-400' },
                  { label: 'Avg Trust', value: analytics.avgTrustScore > 0 ? analytics.avgTrustScore.toFixed(2) : '—', color: 'text-purple-400' },
                  { label: 'Avg Tokens', value: analytics.avgTokensUsed > 0 ? analytics.avgTokensUsed : '—', color: 'text-[#F1F3F9]' },
                  { label: 'Tool Calls', value: analytics.totalToolCalls, color: 'text-[#F1F3F9]' },
                  { label: 'Review Required', value: analytics.reviewRequiredRuns, color: analytics.reviewRequiredRuns > 0 ? 'text-amber-400' : 'text-[#4A5168]' },
                  { label: 'Failed', value: analytics.failedRuns, color: analytics.failedRuns > 0 ? 'text-red-400' : 'text-[#4A5168]' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-[#0F1117] border border-white/[0.06] rounded-2xl px-5 py-4">
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-[#4A5168] mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-[#4A5168]">Run this agent to see analytics.</p>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'System Prompt', value: agent.systemPrompt, full: true },
              { label: 'Model', value: agent.model },
              { label: 'Temperature', value: agent.temperature.toFixed(1) },
              { label: 'Behavior', value: agent.behavior },
              { label: 'Confidence Threshold', value: agent.confidenceThreshold.toFixed(2) },
              { label: 'Memory', value: agent.memoryEnabled ? 'Enabled' : 'Disabled' },
              { label: 'Citation Required', value: agent.citationRequired ? 'Yes' : 'No' },
              { label: 'Verification Mode', value: agent.verificationMode ? 'Enabled' : 'Disabled' },
              { label: 'Auto Retry', value: agent.autoRetry ? 'Yes' : 'No' },
              { label: 'Tools', value: agent.allowedTools.length > 0 ? agent.allowedTools.join(', ') : 'None' },
            ].map(({ label, value, full }) => (
              <div key={label} className={`bg-[#0F1117] border border-white/[0.06] rounded-xl p-4 ${full ? 'col-span-2' : ''}`}>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#4A5168] mb-1">{label}</p>
                <p className={`text-sm text-[#F1F3F9] ${full ? 'font-mono text-xs leading-relaxed' : 'font-semibold'}`}>{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
