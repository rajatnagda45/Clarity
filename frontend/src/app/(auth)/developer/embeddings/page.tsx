'use client';

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { getEmbeddingMetrics } from '@/lib/api';
import type { EmbeddingMetrics } from '@/types/clarity';


type LoadState = 'idle' | 'loading' | 'loaded' | 'error';


function formatRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}


export default function EmbeddingMetricsPage() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspace') ?? '';
  const { getToken } = useAuth();

  const [metrics, setMetrics] = useState<EmbeddingMetrics | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadMetrics() {
      if (!workspaceId) {
        setLoadState('error');
        setErrorMessage('Embedding metrics require an active workspace.');
        return;
      }

      setLoadState('loading');
      setErrorMessage('');

      try {
        const token = await getToken();
        if (!token) {
          throw new Error('Clerk session token unavailable.');
        }

        const nextMetrics = await getEmbeddingMetrics({ token, workspaceId });
        if (cancelled) return;
        setMetrics(nextMetrics);
        setLoadState('loaded');
      } catch (error) {
        if (cancelled) return;
        setLoadState('error');
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load embedding metrics.');
      }
    }

    void loadMetrics();
    return () => {
      cancelled = true;
    };
  }, [getToken, workspaceId]);

  const cards = metrics
    ? [
        ['Documents processed', String(metrics.documentsProcessed)],
        ['Chunks processed', String(metrics.chunksProcessed)],
        ['Avg chunks / document', metrics.averageChunksPerDocument.toFixed(2)],
        ['Avg tokens / chunk', metrics.averageTokensPerChunk.toFixed(2)],
        ['Avg embedding latency', `${metrics.averageEmbeddingLatencyMs.toFixed(2)} ms`],
        ['Success rate', formatRate(metrics.processingSuccessRate)],
        ['Failure rate', formatRate(metrics.processingFailureRate)],
        ['Retry count', String(metrics.retryCount)],
        ['Avg document time', `${metrics.averageDocumentProcessingTimeMs.toFixed(2)} ms`],
        ['Avg queue time', `${metrics.averageEmbeddingQueueTimeMs.toFixed(2)} ms`],
        ['Estimated total tokens', String(metrics.estimatedTotalTokens)],
        ['Estimated total cost', `$${metrics.estimatedTotalCostUsd.toFixed(6)}`],
      ]
    : [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">
            Developer Embedding Metrics
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">Embedding engineering dashboard</h1>
          <p className="text-sm text-slate-600">
            Validate throughput, latency, queue behavior, retry behavior, model usage, and
            estimated provider cost before vector indexing is introduced.
          </p>
        </div>
        <Link
          href={workspaceId ? `/documents?workspace=${encodeURIComponent(workspaceId)}` : '/documents'}
          className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Back to documents
        </Link>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">
          Active workspace:{' '}
          <span className="font-mono text-slate-800">{workspaceId || 'not selected'}</span>
        </p>
      </div>

      {loadState === 'loading' ? <p className="text-sm text-slate-500">Loading embedding metrics…</p> : null}
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      {metrics ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map(([label, value]) => (
              <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Provider usage</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {Object.entries(metrics.providerUsageCounts).map(([provider, count]) => (
                  <li key={provider} className="flex items-center justify-between">
                    <span className="font-mono text-slate-900">{provider}</span>
                    <span>{count}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Model usage</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {Object.entries(metrics.modelUsageCounts).map(([model, count]) => (
                  <li key={model} className="flex items-center justify-between">
                    <span className="font-mono text-slate-900">{model}</span>
                    <span>{count}</span>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        </>
      ) : null}
    </div>
  );
}
