'use client';

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, ArrowRight, BookOpen, BrainCircuit, CheckCircle2,
  Clock, Code2, Cpu, Database,
  FileSearch, FileText, FlaskConical,
  LineChart, Network, RefreshCcw, Search, ShieldCheck,
  Sparkles, UploadCloud, Webhook, Zap, AlertCircle, MessageSquare
} from 'lucide-react';

import { getAnswerMetrics, getDeveloperDashboard, getEmbeddingMetrics, getIndexMetrics, getRetrievalMetrics } from '@/lib/api';
import type { AnswerMetrics, DeveloperDashboard, EmbeddingMetrics, IndexMetrics, RetrievalMetrics } from '@/types/clarity';
import { SystemHealthPanel } from '@/components/developer/SystemHealthPanel';
import { LiveMetricsPanel } from '@/components/developer/LiveMetricsPanel';
import { useWorkspace } from '@/contexts/WorkspaceContext';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

function formatRate(value: number | undefined): string {
  if (value === undefined || isNaN(value)) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
}

function formatNum(value: number | undefined): string {
  if (value === undefined) return '0';
  return value.toLocaleString();
}

function formatTime(value: number | undefined): string {
  if (value === undefined) return '0ms';
  return `${value.toFixed(1)}ms`;
}

// -----------------------------------------------------------------------------
// PREMIUM BACKGROUND
// -----------------------------------------------------------------------------
function PremiumBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#05070B]">
      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.03]" />
      
      {/* Radial Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(91,110,240,0.1)_0%,transparent_70%)]" />
      
      {/* Subtle Gradient Mesh */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#5B6EF0]/[0.02] via-transparent to-[#8B5CF6]/[0.02]" />
    </div>
  );
}

// -----------------------------------------------------------------------------
// UI COMPONENTS
// -----------------------------------------------------------------------------
function SectionCard({ title, icon: Icon, children, className = '', highlight = false }: any) {
  return (
    <motion.article 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-3xl border bg-[#0C0F16]/80 p-6 backdrop-blur-xl transition-all duration-300 hover:bg-[#0F1117] ${
        highlight 
          ? 'border-[rgba(91,110,240,0.2)] shadow-[0_0_30px_rgba(91,110,240,0.05)]' 
          : 'border-[rgba(255,255,255,0.06)] shadow-xl hover:border-[rgba(255,255,255,0.1)]'
      } ${className}`}
    >
      <div className="mb-6 flex items-center gap-3 border-b border-[rgba(255,255,255,0.06)] pb-4">
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${highlight ? 'bg-[#5B6EF0]/20 text-[#5B6EF0]' : 'bg-white/5 text-[#8892AA]'}`}>
          <Icon size={16} />
        </div>
        <h2 className="text-lg font-bold text-[#F1F3F9] tracking-tight">{title}</h2>
      </div>
      {children}
    </motion.article>
  );
}

function MetricCard({ label, value, subValue }: any) {
  return (
    <div className="group rounded-2xl border border-[rgba(255,255,255,0.04)] bg-[#151923] p-4 transition-colors hover:border-[rgba(255,255,255,0.08)] hover:bg-[#1A1F2E]">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#4A5168] group-hover:text-[#8892AA] transition-colors">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-[#F1F3F9] font-mono">{value}</span>
        {subValue && <span className="text-xs text-[#5B6EF0]">{subValue}</span>}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// MAIN PAGE
// -----------------------------------------------------------------------------
export default function DeveloperDashboardPage() {
  const searchParams = useSearchParams();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = searchParams.get('workspace') || activeWorkspace?.id || '';
  const { getToken } = useAuth();

  const [dashboard, setDashboard] = useState<DeveloperDashboard | null>(null);
  const [embeddingMetrics, setEmbeddingMetrics] = useState<EmbeddingMetrics | null>(null);
  const [indexMetrics, setIndexMetrics] = useState<IndexMetrics | null>(null);
  const [retrievalMetrics, setRetrievalMetrics] = useState<RetrievalMetrics | null>(null);
  const [answerMetrics, setAnswerMetrics] = useState<AnswerMetrics | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const loadDashboard = async () => {
    if (!workspaceId) {
      setLoadState('idle'); // Workspace selection needed
      return;
    }

    setLoadState('loading');
    setErrorMessage('');

    try {
      const token = await getToken();
      if (!token) throw new Error('Clerk session token unavailable.');

      const [nextDashboard, nextEmbeddingMetrics, nextIndexMetrics, nextRetrievalMetrics, nextAnswerMetrics] = await Promise.all([
        getDeveloperDashboard({ token, workspaceId }),
        getEmbeddingMetrics({ token, workspaceId }),
        getIndexMetrics({ token, workspaceId }),
        getRetrievalMetrics({ token, workspaceId }),
        getAnswerMetrics({ token, workspaceId }),
      ]);

      setDashboard(nextDashboard);
      setEmbeddingMetrics(nextEmbeddingMetrics);
      setIndexMetrics(nextIndexMetrics);
      setRetrievalMetrics(nextRetrievalMetrics);
      setAnswerMetrics(nextAnswerMetrics);
      setLoadState('loaded');
    } catch (error) {
      setLoadState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load developer dashboard.');
    }
  };

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      if (!cancelled) await loadDashboard();
    };
    fetch();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken, workspaceId]);

  // Derived Data
  const documents = dashboard?.documents ?? [];
  const failedJobs = dashboard?.failedJobs ?? [];
  const statusCounts = dashboard?.statusCounts ?? {};
  
  const totalDocs = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const indexedDocs = statusCounts['indexed'] || 0;
  const errorDocs = statusCounts['error'] || 0;

  // -----------------------------------------------------------------------------
  // RENDER: EMPTY STATE (NO WORKSPACE)
  // -----------------------------------------------------------------------------
  if (!workspaceId) {
    return (
      <>
        <PremiumBackground />
        <div className="relative z-10 flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center p-6 text-center">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="mb-8 relative"
          >
            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#5B6EF0] to-[#8B5CF6] blur-[60px] opacity-20" />
            <div className="relative flex h-32 w-32 items-center justify-center rounded-3xl border border-[rgba(255,255,255,0.06)] bg-[#0C0F16] shadow-2xl">
              <Network size={48} className="text-[#5B6EF0]" />
            </div>
          </motion.div>
          
          <motion.h1 
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
            className="text-4xl font-bold text-white tracking-tight"
          >
            No Active Workspace
          </motion.h1>
          
          <motion.p 
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
            className="mt-4 max-w-lg text-[#8892AA] text-lg leading-relaxed"
          >
            The Developer Console visualizes your complete RAG pipeline. Select a workspace to inspect ingestion, embeddings, vector indexing, retrieval, citations and AI generation.
          </motion.p>
          
          <motion.div 
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
            className="mt-10 flex items-center justify-center gap-4"
          >
            <Link 
              href="/workspace"
              className="flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-[#5B6EF0] to-[#8B5CF6] px-8 text-sm font-semibold text-white shadow-[0_0_30px_rgba(91,110,240,0.3)] transition-transform hover:scale-105"
            >
              Choose Workspace
            </Link>
            <Link 
              href="/dashboard"
              className="flex h-12 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.1)] bg-[#151923] px-8 text-sm font-medium text-[#F1F3F9] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            >
              Go to Dashboard
            </Link>
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <>
      <PremiumBackground />
      <div className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-6 py-10 pb-32">
        
        {/* Header */}
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-400">
                <Sparkles size={12} /> Enterprise Observability
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.06)] bg-[#0C0F16] px-2.5 py-1 text-[10px] font-bold text-[#8892AA]">
                <Database size={12} /> {workspaceId}
              </span>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white">Developer Console</h1>
            <p className="text-sm text-[#8892AA] max-w-xl">
              Monitor every stage of your AI document pipeline in real-time. Inspect chunks, embeddings, vector syncs, and generation latency.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={loadDashboard}
              className="flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[#151923] px-4 py-2.5 text-sm font-medium text-[#F1F3F9] transition-all hover:bg-[rgba(255,255,255,0.05)] active:scale-95"
            >
              <RefreshCcw size={16} className={loadState === 'loading' ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-black transition-transform hover:scale-105 active:scale-95">
              Export Metrics
            </button>
          </div>
        </header>

        {/* LOADING STATE */}
        {loadState === 'loading' && (
          <div className="flex flex-col gap-8">
            <div className="h-64 w-full animate-pulse rounded-3xl bg-[#0C0F16]/80 border border-[rgba(255,255,255,0.06)]" />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-48 w-full animate-pulse rounded-3xl bg-[#0C0F16]/80 border border-[rgba(255,255,255,0.06)]" />
              ))}
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {loadState === 'error' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center rounded-3xl border border-red-500/20 bg-red-500/5 p-12 text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/20 text-red-500">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Pipeline Connection Failed</h3>
            <p className="text-red-400 mb-6">{errorMessage}</p>
            <button onClick={loadDashboard} className="rounded-xl bg-red-500 px-6 py-2.5 text-sm font-bold text-white transition-transform hover:scale-105">
              Retry Connection
            </button>
          </motion.div>
        )}

        {/* LOADED STATE */}
        {loadState === 'loaded' && dashboard && (
          <div className="flex flex-col gap-8">
            
            {/* SECTION 1: Pipeline Overview */}
            <SectionCard title="RAG Pipeline Overview" icon={Network} highlight>
              <div className="relative py-8 px-4 flex flex-col md:flex-row items-center justify-between gap-4 overflow-x-auto custom-scrollbar">
                
                {[
                  { icon: UploadCloud, label: 'Ingest', status: 'Healthy', val: `${totalDocs} docs` },
                  { icon: FileSearch, label: 'Chunk', status: 'Healthy', val: formatTime(embeddingMetrics?.averageEmbeddingLatencyMs) },
                  { icon: BrainCircuit, label: 'Embed', status: 'Healthy', val: formatNum(indexMetrics?.vectorsIndexed) },
                  { icon: Database, label: 'Vector DB', status: 'Healthy', val: formatTime(indexMetrics?.averageIndexingLatencyMs) },
                  { icon: Webhook, label: 'Retrieve', status: 'Healthy', val: formatTime(retrievalMetrics?.retrievalLatencyMs) },
                  { icon: Zap, label: 'Generate', status: 'Healthy', val: formatTime(answerMetrics?.answerLatencyMs) }
                ].map((node, i, arr) => (
                  <div key={i} className="flex items-center shrink-0">
                    <motion.div 
                      whileHover={{ scale: 1.05, y: -2 }}
                      className="group relative flex flex-col items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#151923] p-4 w-32 shadow-lg transition-all hover:border-[#5B6EF0]/50 hover:shadow-[0_0_20px_rgba(91,110,240,0.2)]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(91,110,240,0.1)] text-[#5B6EF0]">
                        <node.icon size={20} />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-bold text-white">{node.label}</p>
                        <p className="text-[10px] font-mono text-[#8892AA] mt-1">{node.val}</p>
                      </div>
                      <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-[#151923] bg-[#22C55E]" />
                    </motion.div>
                    
                    {i < arr.length - 1 && (
                      <div className="mx-2 flex flex-col items-center justify-center w-8">
                        <div className="h-[2px] w-full bg-gradient-to-r from-[#5B6EF0]/50 to-[#8B5CF6]/50 rounded-full" />
                        <ArrowRight size={12} className="text-[#8B5CF6] -mt-1.5" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* SECTION 2: Live Metrics */}
            <SectionCard title="Live Core Metrics" icon={Activity}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Total Docs" value={totalDocs} subValue="Uploaded" />
                <MetricCard label="Indexed Docs" value={indexedDocs} subValue={formatRate(indexedDocs/totalDocs)} />
                <MetricCard label="Total Vectors" value={formatNum(indexMetrics?.vectorsIndexed)} subValue="Synced" />
                <MetricCard label="Pipeline Errors" value={errorDocs} subValue={errorDocs > 0 ? 'Requires Action' : 'Clean'} />
              </div>
            </SectionCard>

            {/* GRID LAYOUT FOR SECTIONS 4 - 9 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* SECTION 4: Pipeline Health */}
              <SectionCard title="Embedding Health" icon={ShieldCheck}>
                <div className="grid grid-cols-2 gap-4">
                  <MetricCard label="Success Rate" value={formatRate(embeddingMetrics?.processingSuccessRate)} />
                  <MetricCard label="Failure Rate" value={formatRate(embeddingMetrics?.processingFailureRate)} />
                  <MetricCard label="Avg Latency" value={formatTime(embeddingMetrics?.averageEmbeddingLatencyMs)} />
                  <MetricCard label="Coverage" value={formatRate(indexMetrics?.currentEmbeddingVersionCoverage)} />
                </div>
              </SectionCard>

              {/* SECTION 7: Vector Database */}
              <SectionCard title="Vector Sync Status" icon={Database}>
                <div className="grid grid-cols-2 gap-4">
                  <MetricCard label="Vectors Stored" value={formatNum(indexMetrics?.vectorsIndexed)} />
                  <MetricCard label="Throughput" value={`${indexMetrics?.indexThroughput.toFixed(1) || '0'} v/s`} />
                  <MetricCard label="Avg Index Latency" value={formatTime(indexMetrics?.averageIndexingLatencyMs)} />
                  <MetricCard label="Sync Lag" value={formatTime(indexMetrics?.synchronizationLagMs)} />
                </div>
              </SectionCard>

              {/* SECTION 5: Retrieval Quality */}
              <SectionCard title="Retrieval Engine" icon={Search}>
                <div className="grid grid-cols-2 gap-4">
                  <MetricCard label="Retrieval Latency" value={formatTime(retrievalMetrics?.retrievalLatencyMs)} />
                  <MetricCard label="Fusion Latency" value={formatTime(retrievalMetrics?.fusionLatencyMs)} />
                  <MetricCard label="Dense Recall" value={formatRate(retrievalMetrics?.denseRecall)} />
                  <MetricCard label="Sparse Recall" value={formatRate(retrievalMetrics?.sparseRecall)} />
                  <MetricCard label="Cache Hits" value={formatNum(retrievalMetrics?.retrievalCacheHits)} />
                  <MetricCard label="Avg Chunks/Query" value={retrievalMetrics?.averageRetrievedChunks.toFixed(1) || '0'} />
                </div>
              </SectionCard>

              {/* SECTION 8 & 9: Generation Metrics & Citation */}
              <SectionCard title="Answer Generation" icon={Cpu}>
                <div className="grid grid-cols-2 gap-4">
                  <MetricCard label="Total Latency" value={formatTime(answerMetrics?.answerLatencyMs)} />
                  <MetricCard label="Est. Cost" value={`$${answerMetrics?.estimatedCostUsd?.toFixed(4) ?? '0.0000'}`} />
                  <MetricCard label="Total Tokens" value={answerMetrics?.totalTokens != null ? answerMetrics.totalTokens.toLocaleString() : 'N/A'} subValue="Lifetime" />
                  <MetricCard label="Avg Citations" value={answerMetrics?.averageCitationsPerAnswer != null ? answerMetrics.averageCitationsPerAnswer.toFixed(1) : 'N/A'} subValue="Per answer" />
                </div>
              </SectionCard>
            </div>

            {/* SECTION 10 & 3: Failed Jobs & Recent Docs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <SectionCard title="Failed Jobs" icon={AlertCircle}>
                {failedJobs.length === 0 ? (
                  <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-[rgba(255,255,255,0.1)] bg-[#151923]">
                    <CheckCircle2 size={24} className="text-[#22C55E] mb-2" />
                    <p className="text-sm font-medium text-white">All jobs healthy</p>
                    <p className="text-xs text-[#8892AA]">No failed processing tasks found.</p>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-3 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                    {failedJobs.map((doc) => (
                      <li key={doc.id} className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex flex-col gap-1">
                        <p className="font-semibold text-white truncate">{doc.filename}</p>
                        <p className="text-xs font-mono text-red-400">Status: {doc.status}</p>
                        <p className="text-xs text-red-300 mt-1">{doc.error ?? 'Unknown error during pipeline execution.'}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              <SectionCard title="Processing Timeline" icon={Clock}>
                 <div className="flex flex-col gap-3 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                    {documents.slice(0, 5).map((doc) => (
                      <div key={doc.id} className="rounded-xl border border-[rgba(255,255,255,0.04)] bg-[#151923] p-4">
                        <div className="flex justify-between items-start mb-3">
                          <p className="font-semibold text-sm text-white truncate max-w-[200px]">{doc.filename}</p>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            doc.status === 'indexed' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 
                            doc.status === 'failed' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'
                          }`}>
                            {doc.status}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5 border-l-2 border-[rgba(255,255,255,0.06)] pl-3 ml-1">
                          {doc.embeddingCompletedAt && (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-[#5B6EF0] -ml-[19px]" />
                              <span className="text-[10px] text-[#8892AA] font-mono">Embed: {new Date(doc.embeddingCompletedAt).toLocaleTimeString()}</span>
                            </div>
                          )}
                          {doc.indexCompletedAt && (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-[#8B5CF6] -ml-[19px]" />
                              <span className="text-[10px] text-[#8892AA] font-mono">Index: {new Date(doc.indexCompletedAt).toLocaleTimeString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {documents.length === 0 && (
                       <div className="flex h-32 items-center justify-center text-sm text-[#8892AA]">
                         No documents processed yet.
                       </div>
                    )}
                 </div>
              </SectionCard>
            </div>

            {/* SECTION 11: Developer Tools (Links Grid) */}
            <SectionCard title="Observability Tools" icon={Code2}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { name: 'Embedding metrics', href: `/developer/embeddings?workspace=${workspaceId}`, icon: BrainCircuit, color: 'text-blue-400' },
                  { name: 'Retrieval Explorer', href: `/developer/retrieval?workspace=${workspaceId}`, icon: Search, color: 'text-purple-400' },
                  { name: 'Answer Explorer', href: `/developer/answers?workspace=${workspaceId}`, icon: MessageSquare, color: 'text-green-400' },
                  { name: 'Experiments', href: `/developer/experiments?workspace=${workspaceId}`, icon: FlaskConical, color: 'text-yellow-400' },
                  { name: 'Prompt Versions', href: `/developer/prompts?workspace=${workspaceId}`, icon: BookOpen, color: 'text-pink-400' },
                  { name: 'Optimization', href: `/developer/optimization?workspace=${workspaceId}`, icon: LineChart, color: 'text-indigo-400' },
                  { name: 'Quality Gates', href: `/developer/quality-gates?workspace=${workspaceId}`, icon: ShieldCheck, color: 'text-orange-400' },
                  { name: 'Release Notes', href: `/developer/release-notes?workspace=${workspaceId}`, icon: FileText, color: 'text-cyan-400' },
                ].map((tool, idx) => (
                  <Link
                    key={idx}
                    href={tool.href}
                    className="group relative flex flex-col items-center justify-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#151923] p-6 transition-all hover:border-[rgba(255,255,255,0.15)] hover:bg-[#1A1F2E]"
                  >
                    <tool.icon size={24} className={`${tool.color} transition-transform group-hover:scale-110`} />
                    <span className="text-xs font-semibold text-[#F1F3F9] text-center">{tool.name}</span>
                  </Link>
                ))}
              </div>
            </SectionCard>

            {/* Observability */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SystemHealthPanel />
              <LiveMetricsPanel />
            </div>

          </div>
        )}
      </div>
    </>
  );
}
