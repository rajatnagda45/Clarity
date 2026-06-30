'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';
import type { Document, DocumentStatus, SourceType } from '@/types/clarity';
import { EmptyState } from '@/components/ds/EmptyState';
import { formatRelativeTime } from '@/lib/time';

interface RecentDocumentsTableProps {
  documents: Document[];
  loading?: boolean;
}

function sourceTypeBadge(type: SourceType) {
  const map: Record<SourceType, { label: string; cls: string }> = {
    pdf: { label: 'PDF', cls: 'bg-[rgba(239,68,68,0.15)] text-[#FCA5A5]' },
    docx: { label: 'DOCX', cls: 'bg-[rgba(59,130,246,0.15)] text-[#93C5FD]' },
    url: { label: 'URL', cls: 'bg-[rgba(139,92,246,0.15)] text-[#C4B5FD]' },
  };
  const { label, cls } = map[type] ?? { label: type, cls: 'bg-[rgba(255,255,255,0.06)] text-[#8892AA]' };
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function statusBadge(status: DocumentStatus) {
  if (status === 'indexed') {
    return <span className="rounded-md bg-[rgba(34,197,94,0.15)] px-2 py-0.5 text-xs font-medium text-[#86EFAC]">Indexed</span>;
  }
  if (status === 'failed') {
    return <span className="rounded-md bg-[rgba(239,68,68,0.15)] px-2 py-0.5 text-xs font-medium text-[#FCA5A5]">Failed</span>;
  }
  if (status === 'uploaded' || status === 'extracted' || status === 'embedding' || status === 'indexing') {
    return <span className="rounded-md bg-[rgba(245,158,11,0.15)] px-2 py-0.5 text-xs font-medium text-[#FDE68A]">Processing</span>;
  }
  return <span className="rounded-md bg-[rgba(255,255,255,0.06)] px-2 py-0.5 text-xs font-medium text-[#8892AA] capitalize">{status.replace(/_/g, ' ')}</span>;
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="h-4 w-4 rounded bg-[rgba(255,255,255,0.06)] skeleton-shimmer" />
      <div className="h-4 flex-1 rounded bg-[rgba(255,255,255,0.06)] skeleton-shimmer" />
      <div className="h-5 w-12 rounded-md bg-[rgba(255,255,255,0.06)] skeleton-shimmer" />
      <div className="h-5 w-16 rounded-md bg-[rgba(255,255,255,0.06)] skeleton-shimmer" />
      <div className="h-4 w-14 rounded bg-[rgba(255,255,255,0.06)] skeleton-shimmer" />
    </div>
  );
}

export function RecentDocumentsTable({ documents, loading }: RecentDocumentsTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0F1117]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        <span className="font-semibold text-[#F1F3F9]">Recent Documents</span>
        <Link
          href="/documents"
          className="text-xs text-[#5B6EF0] hover:text-[#6B7EF5] transition-colors"
        >
          View all
        </Link>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_64px_80px_80px] gap-3 border-y border-[rgba(255,255,255,0.06)] bg-[#151923] px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#4A5168]">
        <span>Name</span>
        <span>Type</span>
        <span>Status</span>
        <span>Added</span>
      </div>

      {/* Rows */}
      {loading ? (
        Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
      ) : documents.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="No documents yet"
            description="Upload your first document to get started."
            action={
              <Link
                href="/documents"
                className="inline-flex rounded-lg bg-[#5B6EF0] px-4 py-2 text-xs font-medium text-white hover:bg-[#6B7EF5] transition-colors"
              >
                Upload document
              </Link>
            }
          />
        </div>
      ) : (
        documents.map((doc) => (
          <div
            key={doc.id}
            className="grid grid-cols-[1fr_64px_80px_80px] items-center gap-3 border-b border-[rgba(255,255,255,0.04)] px-4 py-3 transition-colors last:border-0 hover:bg-[rgba(255,255,255,0.02)]"
          >
            <div className="flex min-w-0 items-center gap-2">
              <FileText size={14} className="shrink-0 text-[#4A5168]" />
              <span className="truncate text-sm text-[#F1F3F9]">{doc.filename}</span>
            </div>
            <div>{sourceTypeBadge(doc.sourceType)}</div>
            <div>{statusBadge(doc.status)}</div>
            <span className="text-xs text-[#4A5168]">{formatRelativeTime(doc.createdAt)}</span>
          </div>
        ))
      )}
    </div>
  );
}
