'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Plus, Trash2, Upload, Loader2, FileText,
  ChevronRight, AlertCircle, CheckCircle2, X, FolderOpen,
} from 'lucide-react';
import Link from 'next/link';
import { PremiumBackground } from '@/components/landing/PremiumBackground';
import {
  useBenchmarkDatasets,
  useCreateBenchmarkDataset,
  useDeleteBenchmarkDataset,
} from '@/hooks/useBenchmarks';
import type { DatasetType } from '@/types/clarity';

const DATASET_TYPES: { value: DatasetType; label: string; description: string }[] = [
  { value: 'custom', label: 'Custom', description: 'Any domain Q&A pairs' },
  { value: 'contract_qa', label: 'Contract Q&A', description: 'Contract analysis questions' },
  { value: 'lease_qa', label: 'Lease Q&A', description: 'Lease document questions' },
  { value: 'policy_qa', label: 'Policy Q&A', description: 'Policy and compliance questions' },
];

const TYPE_COLORS: Record<DatasetType, string> = {
  custom: 'text-purple-400 bg-purple-400/10',
  contract_qa: 'text-blue-400 bg-blue-400/10',
  lease_qa: 'text-emerald-400 bg-emerald-400/10',
  policy_qa: 'text-amber-400 bg-amber-400/10',
};

function CreateDatasetModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<DatasetType>('custom');
  const [description, setDescription] = useState('');
  const createMut = useCreateBenchmarkDataset();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createMut.mutateAsync({ name: name.trim(), datasetType: type, description: description.trim() || undefined });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-[#0F1117] border border-white/[0.08] rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-[#F1F3F9]">Create Benchmark Dataset</h2>
          <button onClick={onClose} className="text-[#4A5168] hover:text-[#F1F3F9] transition-colors"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#8892AA] uppercase tracking-wider mb-1.5 block">Dataset Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Contract Extraction Benchmark v1"
              className="w-full bg-[#05070B] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#8892AA] uppercase tracking-wider mb-1.5 block">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {DATASET_TYPES.map(dt => (
                <button
                  key={dt.value}
                  type="button"
                  onClick={() => setType(dt.value)}
                  className={`px-4 py-3 rounded-xl border text-left transition-all ${
                    type === dt.value
                      ? 'bg-purple-500/10 border-purple-500/40 text-[#F1F3F9]'
                      : 'bg-[#05070B] border-white/[0.06] text-[#8892AA] hover:border-white/[0.15]'
                  }`}
                >
                  <p className="text-sm font-medium">{dt.label}</p>
                  <p className="text-xs text-[#4A5168] mt-0.5">{dt.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#8892AA] uppercase tracking-wider mb-1.5 block">Description <span className="text-[#4A5168] normal-case font-normal">(optional)</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this dataset test?"
              rows={3}
              className="w-full bg-[#05070B] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors resize-none"
            />
          </div>

          {createMut.error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
              <AlertCircle size={14} /> {String(createMut.error)}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-sm text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.04] transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMut.isPending || !name.trim()}
              className="flex-1 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {createMut.isPending ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : 'Create Dataset'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function BenchmarksPage() {
  const { data: datasets, isLoading, isError, refetch } = useBenchmarkDatasets();
  const deleteMut = useDeleteBenchmarkDataset();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleDelete = async (datasetId: string) => {
    await deleteMut.mutateAsync(datasetId);
    setDeleteConfirm(null);
  };

  return (
    <div className="relative min-h-screen bg-[#05070B] selection:bg-purple-500/30 selection:text-white pb-32">
      <PremiumBackground glowOpacity={0.08} />

      <div className="relative z-10 mx-auto max-w-[1200px] px-6 pt-10 pb-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#4A5168] mb-3">
              <Link href="/eval" className="hover:text-[#8892AA] transition-colors">AI Quality Dashboard</Link>
              <ChevronRight size={12} />
              <span className="text-[#8892AA]">Benchmark Datasets</span>
            </div>
            <h1 className="text-3xl font-bold text-[#F1F3F9] tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Database size={20} className="text-blue-400" />
              </div>
              Benchmark Datasets
            </h1>
            <p className="text-sm text-[#8892AA] mt-1.5">Create and manage evaluation datasets. Import JSONL or CSV. Trigger runs.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors"
          >
            <Plus size={16} />
            New Dataset
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-white/[0.03] border border-white/[0.04] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle size={32} className="text-red-400 mb-3" />
            <p className="text-sm text-[#F1F3F9]">Failed to load datasets</p>
            <button onClick={() => refetch()} className="mt-3 text-xs text-purple-400 hover:underline">Try again</button>
          </div>
        ) : !datasets?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
              <FolderOpen size={26} className="text-[#4A5168]" />
            </div>
            <p className="text-base font-semibold text-[#F1F3F9]">No benchmark datasets yet</p>
            <p className="text-sm text-[#4A5168] mt-1 max-w-sm">Create your first dataset to start evaluating your AI pipeline against curated question–answer pairs.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors"
            >
              <Plus size={16} />
              Create First Dataset
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex items-center gap-6 px-1 mb-2">
              <p className="text-sm text-[#8892AA]"><span className="text-[#F1F3F9] font-semibold">{datasets.length}</span> dataset{datasets.length !== 1 ? 's' : ''}</p>
              <p className="text-sm text-[#8892AA]"><span className="text-[#F1F3F9] font-semibold">{datasets.reduce((a, d) => a + 0, 0)}</span> total cases</p>
            </div>

            {datasets.map(dataset => (
              <motion.div
                key={dataset.id}
                layout
                className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.1] transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                      <Database size={18} className="text-[#8892AA]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-[#F1F3F9] truncate">{dataset.name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize shrink-0 ${TYPE_COLORS[dataset.datasetType]}`}>
                          {dataset.datasetType.replace('_', ' ')}
                        </span>
                      </div>
                      {dataset.description && <p className="text-xs text-[#4A5168] truncate">{dataset.description}</p>}
                      <p className="text-xs text-[#4A5168] mt-0.5">{new Date(dataset.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {deleteConfirm === dataset.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#8892AA]">Delete?</span>
                        <button
                          onClick={() => handleDelete(dataset.id)}
                          disabled={deleteMut.isPending}
                          className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-colors"
                        >
                          {deleteMut.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-1 rounded-lg bg-white/[0.04] text-[#8892AA] text-xs hover:text-[#F1F3F9] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setDeleteConfirm(dataset.id)}
                          className="p-2 rounded-xl text-[#4A5168] hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={15} />
                        </button>
                        <Link
                          href={`/eval/benchmarks/${dataset.id}`}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.08] transition-colors"
                        >
                          Open
                          <ChevronRight size={14} />
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreate && <CreateDatasetModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>
    </div>
  );
}
