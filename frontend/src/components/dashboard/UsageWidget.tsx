'use client';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ds/Skeleton';
import type { AnswerMetrics, EmbeddingMetrics } from '@/types/clarity';

interface UsageWidgetProps {
  answerMetrics: AnswerMetrics | null;
  embeddingMetrics: EmbeddingMetrics | null;
  loading?: boolean;
}

interface UsageStat {
  label: string;
  value: string;
  sub?: string;
}

function formatCost(usd: number): string {
  if (usd < 0.01) return '<$0.01';
  return `$${usd.toFixed(2)}`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function UsageWidget({ answerMetrics, embeddingMetrics, loading = false }: UsageWidgetProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5">
        <Skeleton className="h-5 w-28 rounded" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const stats: UsageStat[] = [
    ...(answerMetrics
      ? [
          {
            label: 'Answers',
            value: formatNum(answerMetrics.messagesCreated),
            sub: `${answerMetrics.conversationsCreated} sessions`,
          },
          {
            label: 'Avg Latency',
            value: formatMs(answerMetrics.answerLatencyMs),
            sub: `TTFT ${formatMs(answerMetrics.firstTokenLatencyMs)}`,
          },
          {
            label: 'Tokens Used',
            value: formatNum(answerMetrics.totalTokens),
            sub: `${formatNum(answerMetrics.promptTokens)} prompt`,
          },
          {
            label: 'Est. Cost',
            value: formatCost(answerMetrics.estimatedCostUsd),
            sub: 'answer inference',
          },
        ]
      : []),
    ...(embeddingMetrics
      ? [
          {
            label: 'Chunks',
            value: formatNum(embeddingMetrics.chunksProcessed),
            sub: `${formatNum(embeddingMetrics.documentsProcessed)} docs`,
          },
          {
            label: 'Avg Chunk',
            value: `${Math.round(embeddingMetrics.averageTokensPerChunk)} tok`,
            sub: `${formatMs(embeddingMetrics.averageEmbeddingLatencyMs)} embed`,
          },
        ]
      : []),
  ];

  const hasData = stats.length > 0;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Usage Summary</h3>

      {!hasData ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)] text-[var(--color-text-tertiary)]">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <path d="M9 1a8 8 0 1 0 0 16A8 8 0 0 0 9 1zM8 5h2v5H8V5zm0 6h2v2H8v-2z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">No usage data</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">Metrics appear after your first answer run.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col gap-1 rounded-xl bg-[var(--color-bg-elevated)] p-3"
            >
              <span className="text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">
                {stat.value}
              </span>
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">{stat.label}</span>
              {stat.sub && (
                <span className="text-2xs text-[var(--color-text-tertiary)]">{stat.sub}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
