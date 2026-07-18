'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Plus, Search, LayoutGrid, List, Star, Pin, Archive, Trash2, Copy, RotateCcw, Play, BarChart2, GitBranch, AlertCircle, CheckSquare, Square, Upload, Download, Layers, ChevronDown } from 'lucide-react';
import { PremiumBackground } from '@/components/landing/PremiumBackground';
import {
  useAgents, useDeleteAgent, useArchiveAgent, useUpdateAgent, useReviewQueueStats,
  useBulkDeleteAgents, useBulkArchiveAgents, useRestoreAgent, useDuplicateAgent,
  useExportAgents, useImportAgents,
} from '@/hooks/useAgents';
import { usePrefetchAgent } from '@/hooks/usePrefetchAgent';
import { useToast } from '@/contexts/ToastContext';
import { useApiAuth } from '@/contexts/useApiAuth';
import { ApiErrorView } from '@/components/ui/ApiErrorView';
import { formatRelativeTime } from '@/lib/time';
import type { Agent } from '@/types/clarity';
import { cn } from '@/lib/cn';

const CATEGORY_PRESETS: Record<string, { label: string; avatar: string; color: string }> = {
  legal: { label: 'Legal', avatar: '⚖️', color: '#7C3AED' },
  research: { label: 'Research', avatar: '🔬', color: '#2563EB' },
  compliance: { label: 'Compliance', avatar: '🛡️', color: '#059669' },
  sales: { label: 'Sales', avatar: '💼', color: '#D97706' },
  hr: { label: 'HR', avatar: '👥', color: '#DB2777' },
  knowledge: { label: 'Knowledge', avatar: '📚', color: '#7C3AED' },
  custom: { label: 'Custom', avatar: '🤖', color: '#6366F1' },
};

function AgentCardGrid({
  agent,
  selected,
  onSelectToggle,
  onHover,
}: {
  agent: Agent;
  selected: boolean;
  onSelectToggle: (id: string) => void;
  onHover?: (id: string) => void;
}) {
  const { toast } = useToast();
  const deleteAgent = useDeleteAgent();
  const archiveAgent = useArchiveAgent();
  const updateAgent = useUpdateAgent();
  const duplicateAgent = useDuplicateAgent();
  const restoreAgent = useRestoreAgent();
  const preset = CATEGORY_PRESETS[agent.category] ?? CATEGORY_PRESETS.custom;

  const statusColor = agent.runCount === 0
    ? 'text-[#4A5168]'
    : agent.successRate >= 0.8
    ? 'text-emerald-400'
    : agent.successRate >= 0.5
    ? 'text-amber-400'
    : 'text-red-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onMouseEnter={() => onHover?.(agent.id)}
      className={cn(
        'group bg-[#0F1117] border rounded-2xl p-5 transition-all duration-200 relative',
        selected ? 'border-purple-500/40 ring-1 ring-purple-500/30' : 'border-white/[0.06] hover:border-white/[0.12]',
        agent.archivedAt && 'opacity-60',
      )}
    >
      <button
        onClick={() => onSelectToggle(agent.id)}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-[#4A5168] hover:text-[#F1F3F9] hover:bg-white/[0.06] transition-colors"
        title={selected ? 'Deselect' : 'Select'}
      >
        {selected ? <CheckSquare size={14} className="text-purple-400" /> : <Square size={14} />}
      </button>

      <div className="flex items-start gap-4 mb-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 border border-white/[0.08]"
          style={{ backgroundColor: `${agent.color}20` }}
        >
          {agent.avatar}
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-bold text-[#F1F3F9] truncate">{agent.name}</p>
            {agent.isPinned && <Pin size={11} className="text-purple-400 shrink-0" />}
            {agent.archivedAt && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300">
                archived
              </span>
            )}
          </div>
          <p className="text-xs text-[#4A5168] truncate">{agent.description || 'No description'}</p>
          <span
            className="inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1"
            style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
          >
            {preset.label}
          </span>
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
          href={`/agents/${agent.id}/live?run=1`}
          className="px-3 py-2 rounded-xl text-xs font-semibold text-[#8892AA] bg-white/[0.03] border border-white/[0.06] hover:text-[#F1F3F9] hover:border-white/[0.1] transition-colors"
          title="Run live"
        >
          <Play size={12} />
        </Link>
        <button
          onClick={() => {
            if (agent.archivedAt) {
              restoreAgent.mutate(agent.id, {
                onSuccess: () => toast.success('Agent restored.'),
                onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to restore.'),
              });
            } else {
              archiveAgent.mutate(agent.id, {
                onSuccess: () => toast.success('Agent archived.'),
                onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to archive.'),
              });
            }
          }}
          className="px-3 py-2 rounded-xl text-xs font-semibold text-[#4A5168] bg-white/[0.03] border border-white/[0.06] hover:text-[#F1F3F9] transition-colors"
          title={agent.archivedAt ? 'Restore' : 'Archive'}
        >
          {agent.archivedAt ? <RotateCcw size={12} /> : <Archive size={12} />}
        </button>
      </div>
    </motion.div>
  );
}

function AgentCardList({
  agent,
  selected,
  onSelectToggle,
  onHover,
}: {
  agent: Agent;
  selected: boolean;
  onSelectToggle: (id: string) => void;
  onHover?: (id: string) => void;
}) {
  const { toast } = useToast();
  const deleteAgent = useDeleteAgent();
  const duplicateAgent = useDuplicateAgent();
  const preset = CATEGORY_PRESETS[agent.category] ?? CATEGORY_PRESETS.custom;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      onMouseEnter={() => onHover?.(agent.id)}
      className={cn(
        'group bg-[#0F1117] border rounded-xl px-5 py-4 transition-all flex items-center gap-5',
        selected ? 'border-purple-500/40' : 'border-white/[0.06] hover:border-white/[0.1]',
        agent.archivedAt && 'opacity-60',
      )}
    >
      <button
        onClick={() => onSelectToggle(agent.id)}
        className="text-[#4A5168] hover:text-purple-400"
        title="Select"
      >
        {selected ? <CheckSquare size={14} className="text-purple-400" /> : <Square size={14} />}
      </button>
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
          {agent.archivedAt && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300">
              archived
            </span>
          )}
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
          onClick={() => duplicateAgent.mutate(agent.id, {
            onSuccess: () => toast.success('Agent duplicated.'),
            onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to duplicate.'),
          })}
          className="p-1.5 rounded-lg text-[#4A5168] hover:text-[#F1F3F9] hover:bg-white/[0.06] transition-colors"
          title="Duplicate"
        >
          <Copy size={13} />
        </button>
        <button
          onClick={() => {
            if (typeof window !== 'undefined' && !window.confirm(`Delete "${agent.name}"?`)) return;
            deleteAgent.mutate(agent.id, {
              onSuccess: () => toast.success('Agent deleted.'),
              onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete.'),
            });
          }}
          className="p-1.5 rounded-lg text-[#4A5168] hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Delete"
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
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);

  const auth = useApiAuth();
  const prefetchAgent = usePrefetchAgent();
  const { data, isLoading, isError, error, refetch } = useAgents();
  const { data: reviewStats } = useReviewQueueStats();
  const updateAgent = useUpdateAgent();
  const bulkDelete = useBulkDeleteAgents();
  const bulkArchive = useBulkArchiveAgents();
  const exportAgents = useExportAgents(includeArchived);
  const importAgents = useImportAgents();
  const { toast } = useToast();
  const pendingReviews = reviewStats?.pending ?? 0;

  const allAgents = useMemo(() => data?.agents ?? [], [data?.agents]);
  const agents = useMemo(() => {
    return allAgents.filter(a => {
      if (!includeArchived && a.archivedAt) return false;
      if (favoritesOnly && !a.isFavorite) return false;
      if (category && a.category !== category) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [allAgents, search, category, favoritesOnly, includeArchived]);

  const allSelected = agents.length > 0 && agents.every(a => selected.has(a.id));

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(agents.map(a => a.id)));
    }
  };

  const handleBulkArchive = () => {
    if (selected.size === 0) return;
    bulkArchive.mutate(Array.from(selected), {
      onSuccess: (res) => {
        toast.success(`${res.archived_count} agent(s) archived.`);
        if (res.failed.length > 0) {
          toast.error(`${res.failed.length} failed.`);
        }
        setSelected(new Set());
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to archive.'),
    });
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${selected.size} agent(s)?`)) return;
    bulkDelete.mutate(Array.from(selected), {
      onSuccess: (res) => {
        toast.success(`${res.deleted_count} agent(s) deleted.`);
        if (res.failed.length > 0) {
          toast.error(`${res.failed.length} failed.`);
        }
        setSelected(new Set());
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete.'),
    });
  };

  const handleExport = async () => {
    if (!auth.ready) return;
    try {
      const resolvedAuth = await auth.getAuth();
      const bundle = await exportAgents.refetch();
      const data = bundle.data ?? (await (await import('@/lib/api')).exportAgents(resolvedAuth, includeArchived));
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clarity-agents-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Agents exported.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export.');
    }
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const bundle = JSON.parse(text);
      importAgents.mutate(bundle, {
        onSuccess: (res) => {
          toast.success(`${res.created_count} agent(s) imported.`);
          if (res.failed.length > 0) {
            toast.error(`${res.failed.length} failed.`);
          }
          setImportMenuOpen(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to import.'),
      });
    } catch (err) {
      toast.error('Invalid JSON file.');
    }
  };

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
          <button
            onClick={() => setIncludeArchived(v => !v)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
              includeArchived ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-white/[0.03] text-[#4A5168] border-white/[0.06] hover:text-[#F1F3F9]'
            }`}
          >
            <Archive size={11} />
            Show archived
          </button>

          <div className="flex items-center gap-1 ml-auto">
            {/* Import / Export */}
            <div className="relative">
              <button
                onClick={() => setImportMenuOpen(v => !v)}
                className="px-3 py-2 rounded-xl text-xs font-semibold border bg-white/[0.03] text-[#8892AA] border-white/[0.06] hover:text-[#F1F3F9] flex items-center gap-1.5 transition-colors"
              >
                <Download size={11} /> Import / Export
                <ChevronDown size={11} />
              </button>
              <AnimatePresence>
                {importMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute right-0 top-full mt-1 z-30 w-52 rounded-xl border border-white/[0.08] bg-[#0F1117] p-1 shadow-2xl"
                  >
                    <button
                      onClick={() => { setImportMenuOpen(false); void handleExport(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#F1F3F9] hover:bg-white/[0.06] transition-colors text-left"
                    >
                      <Download size={12} /> Export all
                    </button>
                    <label className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#F1F3F9] hover:bg-white/[0.06] transition-colors cursor-pointer">
                      <Upload size={12} /> Import from JSON
                      <input
                        type="file"
                        accept="application/json"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) void handleImport(file);
                        }}
                      />
                    </label>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-1 bg-[#0F1117] border border-white/[0.06] rounded-xl p-1">
              <button onClick={() => setView('grid')} className={`p-1.5 rounded-lg transition-colors ${view === 'grid' ? 'bg-white/[0.08] text-[#F1F3F9]' : 'text-[#4A5168]'}`}>
                <LayoutGrid size={14} />
              </button>
              <button onClick={() => setView('list')} className={`p-1.5 rounded-lg transition-colors ${view === 'list' ? 'bg-white/[0.08] text-[#F1F3F9]' : 'text-[#4A5168]'}`}>
                <List size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Bulk action bar */}
        <AnimatePresence>
          {selected.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              className="mb-6 flex items-center gap-3 rounded-2xl border border-purple-500/30 bg-purple-500/5 p-3"
            >
              <span className="text-xs font-semibold text-purple-300">
                {selected.size} selected
              </span>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-[#8892AA] hover:text-[#F1F3F9]"
              >
                Clear
              </button>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={handleBulkArchive}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.04] text-[#F1F3F9] hover:bg-white/[0.08] border border-white/[0.08] transition-colors"
                >
                  <Archive size={12} /> Archive all
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/20 transition-colors"
                >
                  <Trash2 size={12} /> Delete all
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats strip */}
        {!isLoading && !isError && data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Agents', value: allAgents.length, color: 'text-purple-400' },
              { label: 'Active', value: allAgents.filter(a => !a.archivedAt).length, color: 'text-emerald-400' },
              { label: 'Total Runs', value: allAgents.reduce((s, a) => s + a.runCount, 0), color: 'text-blue-400' },
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
          <ApiErrorView
            error={error}
            onRetry={() => void refetch()}
            onSwitchWorkspace={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('clarity:open-workspace-switcher'));
              }
            }}
            className="my-12"
            title="Failed to load agents"
          />
        )}

        {!isLoading && !isError && agents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-3xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6">
              <Bot size={36} className="text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-[#F1F3F9] mb-2">
              {search || category || favoritesOnly || includeArchived ? 'No agents match your filters' : 'No agents yet'}
            </h3>
            <p className="text-sm text-[#4A5168] mb-8 max-w-md leading-relaxed">
              Create specialized AI agents tailored to legal review, research, compliance, and more.
              Each agent has its own system prompt, tools, memory, and confidence settings.
            </p>
            {!search && !category && !favoritesOnly && !includeArchived && (
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
          <>
            {/* Select all bar */}
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-xs text-[#8892AA] hover:text-[#F1F3F9] transition-colors"
              >
                {allSelected ? <CheckSquare size={14} className="text-purple-400" /> : <Square size={14} />}
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className={`grid gap-4 ${view === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
              {agents.map(agent => (
                view === 'grid'
                  ? <AgentCardGrid key={agent.id} agent={agent} selected={selected.has(agent.id)} onSelectToggle={toggleSelect} onHover={prefetchAgent} />
                  : <AgentCardList key={agent.id} agent={agent} selected={selected.has(agent.id)} onSelectToggle={toggleSelect} onHover={prefetchAgent} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
