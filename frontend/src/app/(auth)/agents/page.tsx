'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Bot, Plus, Search, LayoutGrid, List, Star, Pin, Archive, Trash2, Play, BarChart2, GitBranch, AlertCircle } from 'lucide-react';
import { PremiumBackground } from '@/components/landing/PremiumBackground';
import { useAgents, useDeleteAgent, useArchiveAgent, useUpdateAgent, useReviewQueueStats } from '@/hooks/useAgents';
import { useToast } from '@/contexts/ToastContext';
import { formatRelativeTime } from '@/lib/time';
import type { Agent } from '@/types/clarity';

const CATEGORY_PRESETS: Record<string, { label: string; avatar: string; color: string }> = {
  legal: { label: 'Legal', avatar: '⚖️', color: '#7C3AED' },
  research: { label: 'Research', avatar: '🔬', color: '#2563EB' },
  compliance: { label: 'Compliance', avatar: '🛡️', color: '#059669' },
  sales: { label: 'Sales', avatar: '💼', color: '#D97706' },
  hr: { label: 'HR', avatar: '👥', color: '#DB2777' },
  knowledge: { label: 'Knowledge', avatar: '📚', color: '#7C3AED' },
  custom: { label: 'Custom', avatar: '🤖', color: '#6366F1' },
};

function AgentCardGrid({ agent }: { agent: Agent }) {
  const { toast } = useToast();
  const deleteAgent = useDeleteAgent();
  const archiveAgent = useArchiveAgent();
  const updateAgent = useUpdateAgent();
  const preset = CATEGORY_PRESETS[agent.category] ?? CATEGORY_PRESETS.custom;

  const statusColor = agent.successRate >= 0.8
    ? 'text-emerald-400'
    : agent.successRate >= 0.5
    ? 'text-amber-400'
    : 'text-[#4A5168]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="group bg-[#0F1117] border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.12] transition-all duration-200"
    >
      <div className="flex items-start gap-4 mb-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 border border-white/[0.08]"
          style={{ backgroundColor: `${agent.color}20` }}
        >
          {agent.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-bold text-[#F1F3F9] truncate">{agent.name}</p>
            {agent.isPinned && <Pin size={11} className="text-purple-400 shrink-0" />}
          </div>
          <p className="text-xs text-[#4A5168] truncate">{agent.description || 'No description'}</p>
          <span
            className="inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1"
            style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
          >
            {preset.label}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => updateAgent.mutate({ agentId: agent.id, payload: { isFavorite: !agent.isFavorite } })}
            className={`p-1.5 rounded-lg transition-colors ${agent.isFavorite ? 'text-amber-400' : 'text-[#4A5168] hover:text-amber-400'}`}
          >
            <Star size={13} fill={agent.isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4 pt-4 border-t border-white/[0.04]">
        <div className="text-center">
          <p className="text-base font-bold text-[#F1F3F9]">{agent.runCount}</p>
          <p className="text-[10px] text-[#4A5168]">Runs</p>
        </div>
        <div className="text-center">
          <p className={`text-base font-bold ${statusColor}`}>
            {agent.runCount > 0 ? `${Math.round(agent.successRate * 100)}%` : '—'}
          </p>
          <p className="text-[10px] text-[#4A5168]">Success</p>
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-[#F1F3F9]">
            {agent.avgTrustScore > 0 ? agent.avgTrustScore.toFixed(2) : '—'}
          </p>
          <p className="text-[10px] text-[#4A5168]">Trust</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Link
          href={`/agents/${agent.id}`}
          className="flex-1 py-2 rounded-xl text-xs font-semibold text-center bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 transition-colors"
        >
          Open
        </Link>
        <Link
          href={`/agents/${agent.id}?run=1`}
          className="px-3 py-2 rounded-xl text-xs font-semibold text-[#8892AA] bg-white/[0.03] border border-white/[0.06] hover:text-[#F1F3F9] hover:border-white/[0.1] transition-colors"
        >
          <Play size={12} />
        </Link>
        <button
          onClick={() => archiveAgent.mutate(agent.id, {
            onSuccess: () => toast.success(`${agent.name} archived.`),
            onError: () => toast.error('Failed to archive.'),
          })}
          className="px-3 py-2 rounded-xl text-xs font-semibold text-[#4A5168] bg-white/[0.03] border border-white/[0.06] hover:text-[#F1F3F9] transition-colors"
        >
          <Archive size={12} />
        </button>
      </div>
    </motion.div>
  );
}

function AgentCardList({ agent }: { agent: Agent }) {
  const { toast } = useToast();
  const deleteAgent = useDeleteAgent();
  const preset = CATEGORY_PRESETS[agent.category] ?? CATEGORY_PRESETS.custom;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="group bg-[#0F1117] border border-white/[0.06] rounded-xl px-5 py-4 hover:border-white/[0.1] transition-all flex items-center gap-5"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
        style={{ backgroundColor: `${agent.color}20` }}
      >
        {agent.avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-[#F1F3F9] truncate">{agent.name}</p>
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${agent.color}20`, color: agent.color }}>
            {preset.label}
          </span>
        </div>
        <p className="text-xs text-[#4A5168] truncate">{agent.description}</p>
      </div>
      <div className="hidden md:flex items-center gap-8 shrink-0 text-xs text-[#4A5168]">
        <div className="text-center">
          <p className="font-bold text-[#F1F3F9]">{agent.runCount}</p>
          <p>Runs</p>
        </div>
        <div className="text-center">
          <p className="font-bold text-emerald-400">{agent.runCount > 0 ? `${Math.round(agent.successRate * 100)}%` : '—'}</p>
          <p>Success</p>
        </div>
        <div className="text-center">
          <p className="font-bold text-[#F1F3F9]">{agent.model}</p>
          <p>Model</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Link href={`/agents/${agent.id}`} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 transition-colors">
          Open
        </Link>
        <button
          onClick={() => deleteAgent.mutate(agent.id, {
            onSuccess: () => toast.success(`${agent.name} deleted.`),
            onError: () => toast.error('Failed to delete.'),
          })}
          className="p-1.5 rounded-lg text-[#4A5168] hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </motion.div>
  );
}

const CATEGORIES = [
  { label: 'All', value: '' },
  { label: 'Legal', value: 'legal' },
  { label: 'Research', value: 'research' },
  { label: 'Compliance', value: 'compliance' },
  { label: 'Knowledge', value: 'knowledge' },
  { label: 'Sales', value: 'sales' },
  { label: 'HR', value: 'hr' },
  { label: 'Custom', value: 'custom' },
];

export default function AgentsPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const { data, isLoading, isError } = useAgents();
  const { data: reviewStats } = useReviewQueueStats();
  const pendingReviews = reviewStats?.pending ?? 0;

  const agents = (data?.agents ?? []).filter(a => {
    if (favoritesOnly && !a.isFavorite) return false;
    if (category && a.category !== category) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="relative min-h-screen bg-[#05070B] selection:bg-purple-500/30 pb-32">
      <PremiumBackground glowOpacity={0.1} />
      <div className="relative z-10 mx-auto max-w-7xl px-6 pt-12">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
                <Bot size={22} className="text-purple-400" />
              </span>
              AI Agents
            </h1>
            <p className="text-sm text-[#8892AA] mt-1.5 ml-14">
              Build, deploy and manage specialized AI agents for your workspace.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {pendingReviews > 0 && (
              <Link
                href="/agents/review"
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
              >
                <AlertCircle size={14} />
                {pendingReviews} pending review{pendingReviews !== 1 ? 's' : ''}
              </Link>
            )}
            <Link
              href="/agents/workflows"
              className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] border border-white/[0.08] text-[#F1F3F9] rounded-xl text-sm font-medium hover:bg-white/[0.08] transition-colors"
            >
              <GitBranch size={15} />
              Workflows
            </Link>
            <Link
              href="/agents/new"
              className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors"
            >
              <Plus size={16} />
              New Agent
            </Link>
          </div>
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5168]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search agents…"
              className="bg-[#0F1117] border border-white/[0.08] rounded-xl pl-8 pr-3 py-2.5 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors w-52"
            />
          </div>
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                category === cat.value
                  ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                  : 'bg-white/[0.03] text-[#4A5168] border-white/[0.06] hover:text-[#F1F3F9]'
              }`}
            >
              {cat.label}
            </button>
          ))}
          <button
            onClick={() => setFavoritesOnly(v => !v)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
              favoritesOnly ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-white/[0.03] text-[#4A5168] border-white/[0.06] hover:text-[#F1F3F9]'
            }`}
          >
            <Star size={11} fill={favoritesOnly ? 'currentColor' : 'none'} />
            Favorites
          </button>
          <div className="flex items-center gap-1 ml-auto bg-[#0F1117] border border-white/[0.06] rounded-xl p-1">
            <button onClick={() => setView('grid')} className={`p-1.5 rounded-lg transition-colors ${view === 'grid' ? 'bg-white/[0.08] text-[#F1F3F9]' : 'text-[#4A5168]'}`}>
              <LayoutGrid size={14} />
            </button>
            <button onClick={() => setView('list')} className={`p-1.5 rounded-lg transition-colors ${view === 'list' ? 'bg-white/[0.08] text-[#F1F3F9]' : 'text-[#4A5168]'}`}>
              <List size={14} />
            </button>
          </div>
        </div>

        {/* Stats strip */}
        {!isLoading && !isError && data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Agents', value: data.total, color: 'text-purple-400' },
              { label: 'Total Runs', value: data.agents.reduce((s, a) => s + a.runCount, 0), color: 'text-blue-400' },
              { label: 'Avg Success', value: data.agents.length > 0 ? `${Math.round(data.agents.reduce((s, a) => s + a.successRate, 0) / data.agents.length * 100)}%` : '—', color: 'text-emerald-400' },
              { label: 'Pending Reviews', value: pendingReviews, color: pendingReviews > 0 ? 'text-amber-400' : 'text-[#4A5168]' },
            ].map(stat => (
              <div key={stat.label} className="bg-[#0F1117] border border-white/[0.06] rounded-2xl px-5 py-4">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-[#4A5168] mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {isLoading && (
          <div className={`grid gap-4 ${view === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`bg-white/[0.03] border border-white/[0.04] rounded-2xl animate-pulse ${view === 'grid' ? 'h-52' : 'h-16'}`} />
            ))}
          </div>
        )}

        {isError && (
          <div className="flex items-center justify-center gap-3 py-20 text-center">
            <AlertCircle size={20} className="text-red-400" />
            <p className="text-sm text-red-400">Failed to load agents.</p>
          </div>
        )}

        {!isLoading && !isError && agents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-3xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6">
              <Bot size={36} className="text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-[#F1F3F9] mb-2">
              {search || category || favoritesOnly ? 'No agents match your filters' : 'No agents yet'}
            </h3>
            <p className="text-sm text-[#4A5168] mb-8 max-w-md leading-relaxed">
              Create specialized AI agents tailored to legal review, research, compliance, and more.
              Each agent has its own system prompt, tools, memory, and confidence settings.
            </p>
            {!search && !category && !favoritesOnly && (
              <Link
                href="/agents/new"
                className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Create your first agent
              </Link>
            )}
          </div>
        )}

        {!isLoading && !isError && agents.length > 0 && (
          <div className={`grid gap-4 ${view === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
            {agents.map(agent => (
              view === 'grid'
                ? <AgentCardGrid key={agent.id} agent={agent} />
                : <AgentCardList key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
