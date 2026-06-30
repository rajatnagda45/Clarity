'use client';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ds/Skeleton';
import { Tooltip } from '@/components/ds/Tooltip';
import type { DeveloperDashboard, Document } from '@/types/clarity';

interface PipelineWidgetProps {
  devDashboard: DeveloperDashboard | null;
  documents: Document[];
  loading?: boolean;
}

interface Stage {
  key: string;
  label: string;
  shortLabel: string;
  statuses: string[];
  icon: React.ReactNode;
}

const STAGES: Stage[] = [
  {
    key: 'uploaded',
    label: 'Uploaded',
    shortLabel: 'Upload',
    statuses: ['uploaded'],
    icon: <UploadIcon />,
  },
  {
    key: 'extracted',
    label: 'Extracted',
    shortLabel: 'Extract',
    statuses: ['extracted', 'normalized', 'metadata_ready'],
    icon: <ExtractIcon />,
  },
  {
    key: 'chunked',
    label: 'Chunked',
    shortLabel: 'Chunk',
    statuses: ['awaiting_chunking', 'chunking', 'chunked'],
    icon: <ChunkIcon />,
  },
  {
    key: 'embedded',
    label: 'Embedded',
    shortLabel: 'Embed',
    statuses: ['awaiting_embeddings', 'embedding', 'embedded'],
    icon: <EmbedIcon />,
  },
  {
    key: 'indexed',
    label: 'Indexed',
    shortLabel: 'Index',
    statuses: ['awaiting_index', 'indexing', 'indexed'],
    icon: <IndexIcon />,
  },
];

export function PipelineWidget({ devDashboard, documents, loading = false }: PipelineWidgetProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-5 w-36 rounded" />
          <Skeleton className="h-4 w-24 rounded" />
        </div>
        <div className="flex gap-2">
          {STAGES.map((s) => (
            <Skeleton key={s.key} className="h-16 flex-1 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const statusCounts: Record<string, number> = devDashboard?.statusCounts ?? {};
  const failedCount = devDashboard?.failedJobs?.length ?? 0;
  const total = documents.length;
  const indexed = statusCounts['indexed'] ?? 0;
  const healthPct = total > 0 ? Math.round((indexed / total) * 100) : 0;

  function stageCount(stage: Stage): number {
    return stage.statuses.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0);
  }

  function stageStatus(stage: Stage): 'done' | 'active' | 'idle' {
    const count = stageCount(stage);
    if (count === 0) return 'idle';
    // "active" means in-progress statuses
    const activeStatuses = ['chunking', 'embedding', 'indexing'];
    const hasActive = stage.statuses.some(
      (s) => activeStatuses.includes(s) && (statusCounts[s] ?? 0) > 0,
    );
    if (hasActive) return 'active';
    return 'done';
  }

  const activeStages = STAGES.filter((s) => stageCount(s) > 0);
  const hasActivity = activeStages.length > 0 || total > 0;

  return (
    <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Pipeline Health</h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
            {total} document{total !== 1 ? 's' : ''} · {indexed} indexed
          </p>
        </div>
        <div className="flex items-center gap-2">
          {failedCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-[var(--color-error-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--color-error-fg)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-error)]" />
              {failedCount} failed
            </span>
          )}
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-semibold',
              healthPct >= 80
                ? 'bg-[var(--color-success-subtle)] text-[var(--color-success-fg)]'
                : healthPct >= 40
                  ? 'bg-[var(--color-warning-subtle)] text-[var(--color-warning-fg)]'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-tertiary)]',
            )}
          >
            {hasActivity ? `${healthPct}%` : 'No docs'}
          </span>
        </div>
      </div>

      {/* Stage pills */}
      <div className="flex items-center gap-1.5">
        {STAGES.map((stage, i) => {
          const count = stageCount(stage);
          const status = stageStatus(stage);

          return (
            <div key={stage.key} className="flex flex-1 items-center gap-1">
              <Tooltip content={`${stage.label}: ${count} document${count !== 1 ? 's' : ''}`} side="top">
                <div
                  className={cn(
                    'flex flex-1 flex-col items-center gap-1.5 rounded-xl p-2.5 text-center',
                    'border transition-colors duration-fast cursor-default',
                    status === 'done' &&
                      'border-[var(--color-success-subtle)] bg-[var(--color-success-subtle)]',
                    status === 'active' &&
                      'border-[var(--color-accent-subtle)] bg-[var(--color-accent-subtle)]',
                    status === 'idle' &&
                      'border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-lg',
                      status === 'done' && 'text-[var(--color-success)]',
                      status === 'active' && 'text-[var(--color-accent)]',
                      status === 'idle' && 'text-[var(--color-text-disabled)]',
                    )}
                  >
                    {status === 'active' ? (
                      <span className="flex h-3 w-3 items-center justify-center">
                        <span className="animate-ping absolute h-2 w-2 rounded-full bg-[var(--color-accent)] opacity-75" />
                        <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
                      </span>
                    ) : (
                      stage.icon
                    )}
                  </span>
                  <span
                    className={cn(
                      'text-2xs font-medium leading-tight',
                      status === 'done' && 'text-[var(--color-success-fg)]',
                      status === 'active' && 'text-[var(--color-accent)]',
                      status === 'idle' && 'text-[var(--color-text-disabled)]',
                    )}
                  >
                    {stage.shortLabel}
                    {count > 0 && (
                      <span className="mt-0.5 block text-2xs tabular-nums">{count}</span>
                    )}
                  </span>
                </div>
              </Tooltip>

              {i < STAGES.length - 1 && (
                <svg
                  width="8"
                  height="8"
                  viewBox="0 0 8 8"
                  fill="none"
                  className="shrink-0 text-[var(--color-border-default)]"
                  aria-hidden="true"
                >
                  <path
                    d="M1 4h6M5 2l2 2-2 2"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      {hasActivity && (
        <div className="mt-4">
          <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
            <div
              className="h-full rounded-full bg-[var(--color-success)] transition-[width] duration-slower"
              style={{ width: `${healthPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Inline icons
function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M7 1l4 4H8v5H6V5H3L7 1zM2 11h10v1.5H2V11z" />
    </svg>
  );
}
function ExtractIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M3 2h5.586L11 4.414V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm5 0v3h3l-3-3zM4 6h6v1H4V6zm0 2h6v1H4V8zm0 2h4v1H4v-1z" />
    </svg>
  );
}
function ChunkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M2 2h4v4H2V2zm6 0h4v4H8V2zM2 8h4v4H2V8zm6 0h4v4H8V8z" />
    </svg>
  );
}
function EmbedIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <circle cx="7" cy="7" r="2" />
      <circle cx="2" cy="4" r="1.5" />
      <circle cx="12" cy="4" r="1.5" />
      <circle cx="2" cy="10" r="1.5" />
      <circle cx="12" cy="10" r="1.5" />
      <path d="M3.2 4.5L5 5.8M8.8 5.8L11 4.5M3.2 9.5L5 8.2M8.8 8.2L11 9.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
function IndexIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M1 2h12v2H1V2zm0 4h8v2H1V6zm0 4h10v2H1v-2z" />
    </svg>
  );
}
