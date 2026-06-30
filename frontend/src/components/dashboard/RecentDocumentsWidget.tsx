'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ds/Badge';
import { SkeletonText } from '@/components/ds/Skeleton';
import { EmptyState } from '@/components/ds/EmptyState';
import type { Document } from '@/types/clarity';

interface RecentDocumentsWidgetProps {
  documents: Document[];
  loading?: boolean;
}

function statusVariant(status: string): React.ComponentProps<typeof Badge>['variant'] {
  if (status === 'indexed') return 'success';
  if (status === 'failed') return 'error';
  if (['embedding', 'indexing', 'chunking'].includes(status)) return 'info';
  return 'default';
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    uploaded: 'Uploaded',
    extracted: 'Extracted',
    normalized: 'Normalized',
    metadata_ready: 'Ready',
    awaiting_chunking: 'Queued',
    chunking: 'Chunking',
    chunked: 'Chunked',
    awaiting_embeddings: 'Queued',
    embedding: 'Embedding',
    embedded: 'Embedded',
    awaiting_index: 'Queued',
    indexing: 'Indexing',
    indexed: 'Indexed',
    failed: 'Failed',
  };
  return labels[status] ?? status;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function DocIcon({ type }: { type: string }) {
  return (
    <div
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
        type === 'pdf'
          ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'
          : type === 'docx'
            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
            : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-tertiary)]',
      )}
    >
      {type.toUpperCase().slice(0, 3)}
    </div>
  );
}

export function RecentDocumentsWidget({ documents, loading = false }: RecentDocumentsWidgetProps) {
  const recent = documents.slice(0, 6).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="flex flex-col rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Recent Documents</h3>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {documents.length} total
          </p>
        </div>
        <Link
          href="/documents"
          className="text-xs font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
        >
          View all →
        </Link>
      </div>

      {/* List */}
      <div className="flex flex-col divide-y divide-[var(--color-border-subtle)]">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <div className="h-7 w-7 rounded-lg bg-[var(--color-bg-elevated)]" />
              <div className="flex flex-1 flex-col gap-1.5">
                <SkeletonText lines={1} />
              </div>
            </div>
          ))
        ) : recent.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              icon={<DocEmptyIcon />}
              title="No documents yet"
              description="Upload your first contract to get started."
              action={
                <Link
                  href="/documents"
                  className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)] transition-colors"
                >
                  Upload document
                </Link>
              }
            />
          </div>
        ) : (
          recent.map((doc) => (
            <Link
              key={doc.id}
              href={`/documents/${doc.id}`}
              className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--color-bg-hover)]"
            >
              <DocIcon type={doc.sourceType} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)]">
                  {doc.filename}
                </span>
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  {formatRelativeTime(doc.createdAt)}
                  {doc.pageCount ? ` · ${doc.pageCount}p` : ''}
                </span>
              </div>
              <Badge variant={statusVariant(doc.status)} size="sm">
                {statusLabel(doc.status)}
              </Badge>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function DocEmptyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M4 2h8.586L17 6.414V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm8 0v5h5l-5-5zM6 9h8v1.5H6V9zm0 3h8v1.5H6V12zm0 3h5v1.5H6V15z" />
    </svg>
  );
}
