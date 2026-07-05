'use client';

import { motion } from 'framer-motion';
import {
  Calendar, Download, RefreshCw, Server, Database,
  Layers, Search, FileCode2, MessageSquare, AlertCircle, FileText, ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PremiumBackground } from '@/components/landing/PremiumBackground';
import { useDocuments } from '@/hooks/useDocuments';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { PipelineVisualizer } from '@/components/dashboard/PipelineVisualizer';
import { DocumentPipelineTable } from '@/components/dashboard/DocumentPipelineTable';

function MetricCard({ title, value, subtitle, icon: Icon, color }: { title: string, value: string | number, subtitle: string, icon: any, color: string }) {
  return (
    <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6 relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-32 h-32 ${color} opacity-5 blur-[40px] rounded-full pointer-events-none group-hover:opacity-10 transition-opacity`} />
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="flex items-center gap-2 text-[#8892AA]">
          <Icon size={16} className={`group-hover:${color.replace('bg-', 'text-').replace('/10', '')} transition-colors`} />
          <h3 className="text-xs font-semibold uppercase tracking-wider">{title}</h3>
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-3xl font-bold text-[#F1F3F9] tracking-tight">{value}</p>
        <p className="text-xs text-[#4A5168] mt-1 font-medium">{subtitle}</p>
      </div>
    </div>
  );
}

function ExplorerCard({ title, description, icon: Icon, colorClass, href }: { title: string, description: string, icon: any, colorClass: string, href: string }) {
  return (
    <Link href={href} className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6 flex flex-col h-full min-h-[300px] group hover:border-white/[0.12] transition-all">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Icon size={18} className={colorClass} />
          <h3 className="text-sm font-semibold text-[#F1F3F9]">{title}</h3>
        </div>
        <ArrowRight size={14} className="text-[#4A5168] group-hover:text-[#8892AA] group-hover:translate-x-0.5 transition-all" />
      </div>
      <p className="text-xs text-[#8892AA] leading-relaxed flex-1">{description}</p>
      <div className="mt-6 pt-4 border-t border-white/[0.04]">
        <span className="text-xs font-medium text-[#4A5168] group-hover:text-[#8892AA] transition-colors uppercase tracking-wider">Open {title} →</span>
      </div>
    </Link>
  );
}

export function WorkspaceDashboard() {
  const router = useRouter();
  const { data: documents = [], isLoading: docsLoading, refetch } = useDocuments();
  const { devDashboard, answerMetrics, embeddingMetrics } = useDashboardMetrics();

  const totalDocs = documents.length;
  const indexedDocs = devDashboard.data?.statusCounts?.indexed || 0;
  const storageBytes = devDashboard.data?.totalStorageBytes ?? null;
  const failedJobs = devDashboard.data?.failedJobs?.length || 0;
  const chunksProcessed = embeddingMetrics.data?.chunksProcessed ?? null;

  const storageStr = storageBytes != null ? (() => {
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = storageBytes === 0 ? 0 : Math.floor(Math.log(storageBytes) / Math.log(k));
    return parseFloat((storageBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  })() : 'Unavailable';

  return (
    <div className="relative min-h-screen bg-[#05070B] selection:bg-purple-500/30 selection:text-white pb-32">
      <PremiumBackground glowOpacity={0.1} />

      <div className="mx-auto max-w-[1600px] px-6 py-8 relative z-10 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.04] pb-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.2)]">
              <Server size={20} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#F1F3F9] tracking-tight">Developer Console</h1>
              <p className="text-xs text-[#8892AA] mt-0.5">End-to-end RAG pipeline observability</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/developer"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/[0.08] bg-[#0F1117] text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.04] transition-all text-xs font-medium"
            >
              <Calendar size={14} /> Full Dashboard
            </Link>
            <button
              onClick={() => { void devDashboard.refetch(); void refetch(); }}
              className="p-2 rounded-xl border border-white/[0.08] bg-[#0F1117] text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.04] transition-all"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => router.push('/developer/embeddings')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black font-medium text-sm hover:bg-gray-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)] ml-2"
            >
              <Download size={16} /> Export Metrics
            </button>
          </div>
        </div>

        {/* HERO: Pipeline Visualizer */}
        <PipelineVisualizer devDashboard={devDashboard.data ?? null} />

        {/* PIPELINE METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard title="Documents Processed" value={totalDocs} subtitle="Total files ingested" icon={FileText} color="bg-blue-500" />
          <MetricCard title="Vectors Indexed" value={indexedDocs} subtitle="Successfully synced to DB" icon={Database} color="bg-purple-500" />
          <MetricCard title="Chunks Generated" value={chunksProcessed ?? '—'} subtitle="Semantic chunks embedded" icon={Layers} color="bg-pink-500" />
          <MetricCard title="Vector Storage" value={storageStr} subtitle="Pinecone allocation" icon={Server} color="bg-emerald-500" />
          <MetricCard title="Failed Jobs" value={failedJobs} subtitle="Documents requiring retry" icon={AlertCircle} color="bg-red-500" />
        </div>

        {/* DOCUMENT PIPELINE TABLE */}
        <div className="mt-8">
          <DocumentPipelineTable documents={documents} loading={docsLoading} />
        </div>

        {/* EXPLORERS & INSPECTORS */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ExplorerCard
            title="Retrieval Explorer"
            description="Deep-dive into BM25 and Dense scores. Select a query to view RRF rankings and hybrid retrieval performance."
            icon={Search}
            colorClass="text-purple-400"
            href="/developer/retrieval"
          />
          <ExplorerCard
            title="Chunk Inspector"
            description="View raw text, semantic boundaries, and token counts for individual document chunks."
            icon={FileCode2}
            colorClass="text-blue-400"
            href="/developer/embeddings"
          />
          <ExplorerCard
            title="Answer Inspector"
            description="Trace LLM generation. View input tokens, citations, and grounded confidence scores."
            icon={MessageSquare}
            colorClass="text-emerald-400"
            href="/developer/answers"
          />
        </div>

      </div>
    </div>
  );
}
