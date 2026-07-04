'use client';

import { useState, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Plus, Upload, Play, Loader2, ChevronRight,
  AlertCircle, X, FileText, CheckCircle2, RefreshCw,
  Clock, BarChart2, Target, Zap,
} from 'lucide-react';
import Link from 'next/link';
import { PremiumBackground } from '@/components/landing/PremiumBackground';
import {
  useBenchmarkDataset,
  useBenchmarkCases,
  useAddBenchmarkCase,
  useImportBenchmarkCases,
  useTriggerBenchmarkRun,
  useDatasetRuns,
} from '@/hooks/useBenchmarks';
import type { BenchmarkRun } from '@/types/clarity';

// ─── Add Case Modal ────────────────────────────────────────────────────────────

function AddCaseModal({ datasetId, onClose }: { datasetId: string; onClose: () => void }) {
  const [question, setQuestion] = useState('');
  const [refAnswer, setRefAnswer] = useState('');
  const addMut = useAddBenchmarkCase(datasetId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    await addMut.mutateAsync({ question: question.trim(), referenceAnswer: refAnswer.trim() || undefined });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-xl bg-[#0F1117] border border-white/[0.08] rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-[#F1F3F9]">Add Test Case</h2>
          <button onClick={onClose} className="text-[#4A5168] hover:text-[#F1F3F9] transition-colors"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#8892AA] uppercase tracking-wider mb-1.5 block">Question</label>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="What is the termination clause in this contract?"
              rows={3}
              className="w-full bg-[#05070B] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors resize-none"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#8892AA] uppercase tracking-wider mb-1.5 block">
              Reference Answer <span className="text-[#4A5168] normal-case font-normal">(optional)</span>
            </label>
            <textarea
              value={refAnswer}
              onChange={e => setRefAnswer(e.target.value)}
              placeholder="Expected answer for scoring purposes…"
              rows={4}
              className="w-full bg-[#05070B] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors resize-none"
            />
          </div>

          {addMut.error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
              <AlertCircle size={14} /> {String(addMut.error)}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-sm text-[#8892AA] hover:text-[#F1F3F9] transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={addMut.isPending || !question.trim()}
              className="flex-1 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {addMut.isPending ? <><Loader2 size={14} className="animate-spin" /> Adding…</> : 'Add Case'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Import Modal ──────────────────────────────────────────────────────────────

function ImportModal({ datasetId, onClose }: { datasetId: string; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const importMut = useImportBenchmarkCases(datasetId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!file) return;
    const res = await importMut.mutateAsync(file);
    setResult(res);
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
          <h2 className="text-lg font-bold text-[#F1F3F9]">Import Cases</h2>
          <button onClick={onClose} className="text-[#4A5168] hover:text-[#F1F3F9] transition-colors"><X size={18} /></button>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
              <CheckCircle2 size={28} className="text-emerald-400 mx-auto mb-2" />
              <p className="text-lg font-bold text-[#F1F3F9]">{result.imported} cases imported</p>
              {result.skipped > 0 && <p className="text-sm text-[#8892AA] mt-1">{result.skipped} skipped</p>}
            </div>
            {result.errors.length > 0 && (
              <div className="bg-[#05070B] rounded-xl p-4 border border-white/[0.04]">
                <p className="text-xs font-semibold text-amber-400 mb-2">Warnings ({result.errors.length})</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {result.errors.map((e, i) => <p key={i} className="text-xs text-[#4A5168]">{e}</p>)}
                </div>
              </div>
            )}
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors">
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-[#05070B] border border-white/[0.06] rounded-xl text-xs text-[#8892AA] space-y-1">
              <p className="font-semibold text-[#F1F3F9]">Supported formats:</p>
              <p><span className="text-purple-400">JSONL</span> — one JSON object per line with <code className="bg-white/[0.06] px-1 rounded">question</code> field</p>
              <p><span className="text-blue-400">CSV</span> — headers: <code className="bg-white/[0.06] px-1 rounded">question, reference_answer</code></p>
              <p><span className="text-emerald-400">JSON</span> — array of objects with <code className="bg-white/[0.06] px-1 rounded">question</code> field</p>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-28 border-2 border-dashed border-white/[0.08] rounded-xl flex flex-col items-center justify-center gap-2 text-[#4A5168] hover:border-purple-500/40 hover:text-purple-400 transition-colors"
            >
              <Upload size={20} />
              <p className="text-sm font-medium">{file ? file.name : 'Click to select file'}</p>
              <p className="text-xs">.jsonl · .csv · .json</p>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jsonl,.csv,.json,.txt"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />

            {importMut.error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                <AlertCircle size={14} /> {String(importMut.error)}
              </div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-sm text-[#8892AA] hover:text-[#F1F3F9] transition-colors">
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!file || importMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {importMut.isPending ? <><Loader2 size={14} className="animate-spin" /> Importing…</> : 'Import'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Run Card ──────────────────────────────────────────────────────────────────

function RunCard({ run }: { run: BenchmarkRun }) {
  const pct = run.totalCases > 0 ? Math.round((run.completedCases / run.totalCases) * 100) : 0;
  const statusColor: Record<string, string> = {
    completed: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    running: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    failed: 'text-red-400 bg-red-400/10 border-red-400/20',
    cancelled: 'text-[#4A5168] bg-white/[0.04] border-white/[0.06]',
  };

  return (
    <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-mono text-[#8892AA]">{run.id.slice(0, 8)}…</p>
          <p className="text-xs text-[#4A5168] mt-0.5">{new Date(run.createdAt).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2">
          {run.status === 'running' && <Loader2 size={14} className="animate-spin text-blue-400" />}
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${statusColor[run.status] ?? 'text-[#4A5168]'}`}>
            {run.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 text-xs mb-4">
        <div>
          <p className="text-[#4A5168] mb-0.5 flex items-center gap-1"><Target size={10} /> Progress</p>
          <p className="text-[#F1F3F9] font-semibold">{run.completedCases}/{run.totalCases}</p>
        </div>
        <div>
          <p className="text-[#4A5168] mb-0.5 flex items-center gap-1"><BarChart2 size={10} /> Judge Score</p>
          <p className="text-purple-400 font-semibold">{run.avgJudgeOverall?.toFixed(2) ?? '—'}/10</p>
        </div>
        <div>
          <p className="text-[#4A5168] mb-0.5 flex items-center gap-1"><CheckCircle2 size={10} /> Trust</p>
          <p className="text-emerald-400 font-semibold">{run.avgTrustConfidence != null ? `${(run.avgTrustConfidence * 100).toFixed(0)}%` : '—'}</p>
        </div>
        <div>
          <p className="text-[#4A5168] mb-0.5 flex items-center gap-1"><Zap size={10} /> Latency</p>
          <p className="text-[#F1F3F9] font-semibold">{run.avgLatencyMs ? `${Math.round(run.avgLatencyMs)}ms` : '—'}</p>
        </div>
      </div>

      {(run.status === 'running' || run.totalCases > 0) && (
        <div>
          <div className="flex items-center justify-between text-[10px] text-[#4A5168] mb-1">
            <span>{run.failedCases > 0 ? `${run.failedCases} failed` : 'In progress'}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${run.status === 'failed' ? 'bg-red-500' : 'bg-purple-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function DatasetDetailPage() {
  const params = useParams();
  const datasetId = params.datasetId as string;

  const [activeTab, setActiveTab] = useState<'cases' | 'runs'>('cases');
  const [showAddCase, setShowAddCase] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const { data: dataset, isLoading: dsLoading } = useBenchmarkDataset(datasetId);
  const { data: cases, isLoading: casesLoading } = useBenchmarkCases(datasetId);
  const { data: runs, isLoading: runsLoading } = useDatasetRuns(datasetId, true);
  const triggerMut = useTriggerBenchmarkRun(datasetId);

  const hasRunningRun = runs?.some(r => r.status === 'running') ?? false;

  const handleTriggerRun = async () => {
    await triggerMut.mutateAsync();
    setActiveTab('runs');
  };

  return (
    <div className="relative min-h-screen bg-[#05070B] selection:bg-purple-500/30 selection:text-white pb-32">
      <PremiumBackground glowOpacity={0.08} />

      <div className="relative z-10 mx-auto max-w-[1200px] px-6 pt-10 pb-8">
        {/* Breadcrumb + Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#4A5168] mb-3">
              <Link href="/eval" className="hover:text-[#8892AA] transition-colors">AI Quality Dashboard</Link>
              <ChevronRight size={12} />
              <Link href="/eval/benchmarks" className="hover:text-[#8892AA] transition-colors">Datasets</Link>
              <ChevronRight size={12} />
              <span className="text-[#8892AA]">{dsLoading ? '…' : dataset?.name ?? 'Dataset'}</span>
            </div>

            {dsLoading ? (
              <div className="h-9 w-64 bg-white/[0.04] rounded-xl animate-pulse" />
            ) : (
              <h1 className="text-3xl font-bold text-[#F1F3F9] tracking-tight">{dataset?.name}</h1>
            )}
            {dataset?.description && (
              <p className="text-sm text-[#8892AA] mt-1">{dataset.description}</p>
            )}

            {dataset && (
              <div className="flex items-center gap-4 mt-3">
                <span className="text-xs text-[#4A5168]"><span className="text-[#F1F3F9] font-semibold">{dataset.caseCount}</span> cases</span>
                <span className="text-xs text-[#4A5168]"><span className="text-[#F1F3F9] font-semibold">{dataset.runCount}</span> runs</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-purple-400 bg-purple-400/10 capitalize">
                  {dataset.datasetType.replace('_', ' ')}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleTriggerRun}
              disabled={triggerMut.isPending || hasRunningRun || (dataset?.caseCount ?? 0) === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {triggerMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              {hasRunningRun ? 'Running…' : 'Run Benchmark'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#0F1117] border border-white/[0.06] rounded-2xl p-1 mb-6 w-fit">
          {(['cases', 'runs'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-xl text-sm font-medium capitalize transition-all ${
                activeTab === tab
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.04]'
              }`}
            >
              {tab} {tab === 'cases' && cases ? `(${cases.length})` : tab === 'runs' && runs ? `(${runs.length})` : ''}
            </button>
          ))}
        </div>

        {/* Cases Tab */}
        {activeTab === 'cases' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#8892AA]">Test cases for evaluation</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowImport(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.08] text-sm text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.04] transition-colors"
                >
                  <Upload size={14} />
                  Import JSONL / CSV
                </button>
                <button
                  onClick={() => setShowAddCase(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-sm text-[#F1F3F9] hover:bg-white/[0.1] transition-colors"
                >
                  <Plus size={14} />
                  Add Case
                </button>
              </div>
            </div>

            {casesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white/[0.03] rounded-xl animate-pulse" />)}
              </div>
            ) : !cases?.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-[#0F1117] border border-white/[0.06] rounded-2xl">
                <FileText size={32} className="text-[#4A5168] mb-3" />
                <p className="text-sm font-medium text-[#F1F3F9]">No test cases yet</p>
                <p className="text-xs text-[#4A5168] mt-1">Add cases manually or import from a JSONL/CSV file.</p>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.08] text-sm text-[#8892AA] hover:text-[#F1F3F9] transition-colors">
                    <Upload size={13} /> Import
                  </button>
                  <button onClick={() => setShowAddCase(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors">
                    <Plus size={13} /> Add Case
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {cases.map((c, i) => (
                  <div key={c.id} className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-[#4A5168] mt-0.5 shrink-0 w-5 text-right">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#F1F3F9] font-medium leading-relaxed">{c.question}</p>
                        {c.referenceAnswer && (
                          <p className="text-xs text-[#4A5168] mt-2 leading-relaxed border-l-2 border-white/[0.06] pl-3">
                            <span className="text-[#8892AA] font-medium">Expected: </span>
                            {c.referenceAnswer.slice(0, 200)}{c.referenceAnswer.length > 200 ? '…' : ''}
                          </p>
                        )}
                        {c.documentIds.length > 0 && (
                          <p className="text-xs text-[#4A5168] mt-1">{c.documentIds.length} document{c.documentIds.length !== 1 ? 's' : ''} scoped</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Runs Tab */}
        {activeTab === 'runs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#8892AA]">Benchmark execution history for this dataset</p>
              {hasRunningRun && (
                <div className="flex items-center gap-2 text-xs text-blue-400">
                  <Loader2 size={12} className="animate-spin" />
                  Run in progress — auto-refreshing every 3s
                </div>
              )}
            </div>

            {runsLoading ? (
              <div className="space-y-4">
                {[1, 2].map(i => <div key={i} className="h-32 bg-white/[0.03] rounded-2xl animate-pulse" />)}
              </div>
            ) : !runs?.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-[#0F1117] border border-white/[0.06] rounded-2xl">
                <Play size={32} className="text-[#4A5168] mb-3" />
                <p className="text-sm font-medium text-[#F1F3F9]">No runs yet</p>
                <p className="text-xs text-[#4A5168] mt-1">Trigger a benchmark run to evaluate your AI pipeline against this dataset.</p>
                <button
                  onClick={handleTriggerRun}
                  disabled={triggerMut.isPending || (dataset?.caseCount ?? 0) === 0}
                  className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 disabled:opacity-50 transition-colors"
                >
                  <Play size={15} />
                  Run Benchmark
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {runs.map(run => <RunCard key={run.id} run={run} />)}
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddCase && <AddCaseModal datasetId={datasetId} onClose={() => setShowAddCase(false)} />}
        {showImport && <ImportModal datasetId={datasetId} onClose={() => setShowImport(false)} />}
      </AnimatePresence>
    </div>
  );
}
