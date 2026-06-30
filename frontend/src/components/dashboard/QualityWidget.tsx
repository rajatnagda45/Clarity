'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import { ProgressBar } from '@/components/ds/Progress';
import { Skeleton } from '@/components/ds/Skeleton';
import type { EvalMetrics, AnswerMetrics } from '@/types/clarity';

interface QualityWidgetProps {
  evalMetrics: EvalMetrics | null;
  answerMetrics: AnswerMetrics | null;
  loading?: boolean;
}

function TrustRing({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const color =
    pct >= 0.8 ? 'var(--color-success)' : pct >= 0.55 ? 'var(--color-warning)' : 'var(--color-error)';

  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90" aria-hidden="true">
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="var(--color-bg-elevated)"
          strokeWidth="7"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-bold tabular-nums text-[var(--color-text-primary)]">
          {Math.round(pct * 100)}%
        </span>
        <span className="text-2xs text-[var(--color-text-tertiary)]">Trust</span>
      </div>
    </div>
  );
}

export function QualityWidget({ evalMetrics, answerMetrics, loading = false }: QualityWidgetProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
        <div className="flex items-center gap-6">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="flex flex-1 flex-col gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const trustScore = answerMetrics ? 0 : null; // AnswerMetrics doesn't have trust directly
  const faithfulness = evalMetrics?.faithfulness ?? null;
  const relevance = evalMetrics?.relevance ?? null;
  const precision = evalMetrics?.contextPrecision ?? null;
  const recall = evalMetrics?.contextRecall ?? null;
  const catchRate = evalMetrics?.catchRate ?? null;

  const hasEval = faithfulness !== null || relevance !== null;
  const overallTrust = faithfulness ?? 0;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Quality Summary</h3>
          {evalMetrics?.suite && (
            <p className="text-xs text-[var(--color-text-tertiary)] capitalize">
              {evalMetrics.suite} suite
              {evalMetrics.casesTotal ? ` · ${evalMetrics.casesTotal} cases` : ''}
            </p>
          )}
        </div>
        <Link
          href="/eval"
          className="text-xs font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
        >
          Full report →
        </Link>
      </div>

      {!hasEval ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)] text-[var(--color-text-tertiary)]">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <path d="M2 12l4-4 3 3 5-6 1 1-6 7-3-3-3 3-1-1z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">No eval data yet</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">Run an evaluation to see quality metrics.</p>
        </div>
      ) : (
        <div className="flex items-start gap-5">
          <TrustRing value={overallTrust} />
          <div className="flex flex-1 flex-col gap-2.5">
            {[
              { label: 'Faithfulness', value: faithfulness },
              { label: 'Relevance', value: relevance },
              { label: 'Context Precision', value: precision },
              { label: 'Context Recall', value: recall },
              ...(catchRate !== null ? [{ label: 'Catch Rate', value: catchRate }] : []),
            ]
              .filter((m) => m.value !== null)
              .map((metric) => (
                <div key={metric.label} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-secondary)]">{metric.label}</span>
                    <span className="text-xs font-semibold tabular-nums text-[var(--color-text-primary)]">
                      {Math.round((metric.value ?? 0) * 100)}%
                    </span>
                  </div>
                  <ProgressBar
                    value={Math.round((metric.value ?? 0) * 100)}
                    size="sm"
                    variant={
                      (metric.value ?? 0) >= 0.8
                        ? 'success'
                        : (metric.value ?? 0) >= 0.55
                          ? 'warning'
                          : 'error'
                    }
                  />
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
