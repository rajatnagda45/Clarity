'use client';

import Link from 'next/link';
import { FileText, Clock, Server, CheckCircle2, AlertCircle, FileCode2, ExternalLink } from 'lucide-react';
import type { Document, DocumentStatus, SourceType } from '@/types/clarity';
import { EmptyState } from '@/components/ds/EmptyState';
import { formatRelativeTime } from '@/lib/time';

interface DocumentPipelineTableProps {
  documents: Document[];
  loading?: boolean;
  workspaceId: string;
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  if (status === 'indexed') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
        <CheckCircle2 size={12} /> Sync Complete
      </div>
    );
  }
  if (status === 'failed') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider">
        <AlertCircle size={12} /> Sync Failed
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      {status.replace(/_/g, ' ')}
    </div>
  );
}

function SourceTypeIcon({ type }: { type: SourceType }) {
  const map: Record<SourceType, { icon: any; cls: string }> = {
    pdf:  { icon: FileText,  cls: 'text-red-400 bg-red-500/10' },
    docx: { icon: FileText,  cls: 'text-blue-400 bg-blue-500/10' },
    url:  { icon: Server,    cls: 'text-purple-400 bg-purple-500/10' },
  };
  const { icon: Icon, cls } = map[type] ?? { icon: FileCode2, cls: 'text-[#8892AA] bg-white/[0.06]' };
  return (
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cls}`}>
      <Icon size={14} />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="grid grid-cols-[1fr_80px_100px_120px] lg:grid-cols-[2fr_1fr_1fr_1fr_1.5fr] gap-4 px-6 py-4 border-b border-white/[0.04] animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
        <div className="h-4 w-32 rounded bg-white/[0.06]" />
      </div>
      <div className="hidden lg:flex items-center"><div className="h-4 w-12 rounded bg-white/[0.06]" /></div>
      <div className="hidden lg:flex items-center"><div className="h-4 w-12 rounded bg-white/[0.06]" /></div>
      <div className="flex items-center"><div className="h-5 w-24 rounded bg-white/[0.06]" /></div>
      <div className="flex items-center"><div className="h-4 w-16 rounded bg-white/[0.06]" /></div>
    </div>
  );
}

export function DocumentPipelineTable({ documents, loading, workspaceId }: DocumentPipelineTableProps) {
  const sortedDocs = [...documents].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0F1117]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400">
            <Server size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-[#F1F3F9] tracking-tight text-lg">Document Pipeline</h3>
            <p className="text-xs text-[#8892AA]">Live tracking of ingestion, chunking, and embedding sync</p>
          </div>
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_80px_100px_120px] lg:grid-cols-[2fr_1fr_1fr_1fr_1.5fr] gap-4 bg-white/[0.02] border-b border-white/[0.04] px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-[#4A5168]">
        <span>Document Target</span>
        <span className="hidden lg:block">Chunks</span>
        <span className="hidden lg:block">Embeddings</span>
        <span>Pipeline Status</span>
        <span>Ingested</span>
      </div>

      {/* Rows */}
      {loading ? (
        Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
      ) : sortedDocs.length === 0 ? (
        <div className="p-8">
          <EmptyState
            title="Pipeline Idle"
            description="Upload documents to monitor the embedding and indexing pipeline."
          />
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/[0.04]">
          {sortedDocs.map((doc) => (
            <div key={doc.id} className="grid grid-cols-[1fr_80px_100px_120px] lg:grid-cols-[2fr_1fr_1fr_1fr_1.5fr] gap-4 px-6 py-4 items-center hover:bg-white/[0.02] transition-colors group">

              {/* Document Name & Type */}
              <div className="flex items-center gap-3 overflow-hidden">
                <SourceTypeIcon type={doc.sourceType} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#F1F3F9] truncate">{doc.filename}</p>
                  <p className="text-[10px] text-[#4A5168] font-mono mt-0.5 truncate">{doc.id}</p>
                </div>
              </div>

              <div className="hidden lg:flex items-center">
                <span className="text-xs font-mono text-[#8892AA]">
                  {doc.status === 'indexed' ? 'Ready' : '--'}
                </span>
              </div>

              <div className="hidden lg:flex items-center">
                <span className="text-xs font-mono text-[#8892AA]">
                  {doc.status === 'indexed' ? 'Indexed' : '--'}
                </span>
              </div>

              {/* Status */}
              <div className="flex items-center">
                <StatusBadge status={doc.status} />
              </div>

              {/* Time + Inspect */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-[#8892AA]">
                  <Clock size={12} className="opacity-50" />
                  {formatRelativeTime(doc.createdAt)}
                </div>
                <Link
                  href={`/documents/${doc.id}/inspect${workspaceId ? `?workspace=${encodeURIComponent(workspaceId)}` : ''}`}
                  className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs font-semibold text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 px-2 py-1 rounded"
                >
                  <ExternalLink size={10} />
                  Inspect
                </Link>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
