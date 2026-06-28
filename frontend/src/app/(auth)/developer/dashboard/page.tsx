'use client';

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { getAnswerMetrics, getDeveloperDashboard, getEmbeddingMetrics, getIndexMetrics, getRetrievalMetrics } from '@/lib/api';
import type { AnswerMetrics, DeveloperDashboard, EmbeddingMetrics, IndexMetrics, RetrievalMetrics } from '@/types/clarity';


type LoadState = 'idle' | 'loading' | 'loaded' | 'error';


function formatRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}


function timelineLabel(timestamp: string | null): string {
  return timestamp ? new Date(timestamp).toLocaleString() : 'not started';
}


export default function DeveloperDashboardPage() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspace') ?? '';
  const { getToken } = useAuth();

  const [dashboard, setDashboard] = useState<DeveloperDashboard | null>(null);
  const [embeddingMetrics, setEmbeddingMetrics] = useState<EmbeddingMetrics | null>(null);
  const [indexMetrics, setIndexMetrics] = useState<IndexMetrics | null>(null);
  const [retrievalMetrics, setRetrievalMetrics] = useState<RetrievalMetrics | null>(null);
  const [answerMetrics, setAnswerMetrics] = useState<AnswerMetrics | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      if (!workspaceId) {
        setLoadState('error');
        setErrorMessage('Developer dashboard requires an active workspace.');
        return;
      }

      setLoadState('loading');
      setErrorMessage('');

      try {
        const token = await getToken();
        if (!token) {
          throw new Error('Clerk session token unavailable.');
        }

        const [nextDashboard, nextEmbeddingMetrics, nextIndexMetrics, nextRetrievalMetrics, nextAnswerMetrics] = await Promise.all([
          getDeveloperDashboard({ token, workspaceId }),
          getEmbeddingMetrics({ token, workspaceId }),
          getIndexMetrics({ token, workspaceId }),
          getRetrievalMetrics({ token, workspaceId }),
          getAnswerMetrics({ token, workspaceId }),
        ]);

        if (cancelled) return;
        setDashboard(nextDashboard);
        setEmbeddingMetrics(nextEmbeddingMetrics);
        setIndexMetrics(nextIndexMetrics);
        setRetrievalMetrics(nextRetrievalMetrics);
        setAnswerMetrics(nextAnswerMetrics);
        setLoadState('loaded');
      } catch (error) {
        if (cancelled) return;
        setLoadState('error');
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load developer dashboard.');
      }
    }

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [getToken, workspaceId]);

  const documents = dashboard?.documents ?? [];
  const failedJobs = dashboard?.failedJobs ?? [];
  const statusCounts = dashboard?.statusCounts ?? {};

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">
            Developer Dashboard
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">Pipeline Monitor</h1>
          <p className="text-sm text-slate-600">
            Documents, pipeline status, chunk inspection, embeddings, vector synchronization,
            metrics, processing timeline, and failed jobs in one internal view.
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

      {loadState === 'loading' ? <p className="text-sm text-slate-500">Loading developer dashboard…</p> : null}
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      {dashboard ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Object.entries(statusCounts).map(([status, count]) => (
              <article key={status} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Pipeline status</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{status}</p>
                <p className="text-sm text-slate-600">{count} document(s)</p>
              </article>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Metrics</h2>
              <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                <p>Embedding success rate: <span className="font-mono text-slate-900">{embeddingMetrics ? formatRate(embeddingMetrics.processingSuccessRate) : 'n/a'}</span></p>
                <p>Embedding failure rate: <span className="font-mono text-slate-900">{embeddingMetrics ? formatRate(embeddingMetrics.processingFailureRate) : 'n/a'}</span></p>
                <p>Vectors indexed: <span className="font-mono text-slate-900">{indexMetrics?.vectorsIndexed ?? 0}</span></p>
                <p>Index throughput: <span className="font-mono text-slate-900">{indexMetrics?.indexThroughput.toFixed(2) ?? '0.00'} vectors/s</span></p>
                <p>Average embedding latency: <span className="font-mono text-slate-900">{embeddingMetrics?.averageEmbeddingLatencyMs.toFixed(2) ?? '0.00'} ms</span></p>
                <p>Average indexing latency: <span className="font-mono text-slate-900">{indexMetrics?.averageIndexingLatencyMs.toFixed(2) ?? '0.00'} ms</span></p>
                <p>Sync lag: <span className="font-mono text-slate-900">{indexMetrics?.synchronizationLagMs.toFixed(2) ?? '0.00'} ms</span></p>
                <p>Current coverage: <span className="font-mono text-slate-900">{indexMetrics ? formatRate(indexMetrics.currentEmbeddingVersionCoverage) : 'n/a'}</span></p>
                <p>Retrieval latency: <span className="font-mono text-slate-900">{retrievalMetrics?.retrievalLatencyMs.toFixed(2) ?? '0.00'} ms</span></p>
                <p>Average retrieved chunks: <span className="font-mono text-slate-900">{retrievalMetrics?.averageRetrievedChunks.toFixed(2) ?? '0.00'}</span></p>
                <p>Dense recall: <span className="font-mono text-slate-900">{retrievalMetrics ? formatRate(retrievalMetrics.denseRecall) : 'n/a'}</span></p>
                <p>Sparse recall: <span className="font-mono text-slate-900">{retrievalMetrics ? formatRate(retrievalMetrics.sparseRecall) : 'n/a'}</span></p>
                <p>Fusion latency: <span className="font-mono text-slate-900">{retrievalMetrics?.fusionLatencyMs.toFixed(2) ?? '0.00'} ms</span></p>
                <p>Cache hits: <span className="font-mono text-slate-900">{retrievalMetrics?.retrievalCacheHits ?? 0}</span></p>
                <p>Answer latency: <span className="font-mono text-slate-900">{answerMetrics?.answerLatencyMs.toFixed(2) ?? '0.00'} ms</span></p>
                <p>Answer cost: <span className="font-mono text-slate-900">${answerMetrics?.estimatedCostUsd.toFixed(4) ?? '0.0000'}</span></p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/developer/embeddings?workspace=${encodeURIComponent(workspaceId)}`}
                  className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  Embedding metrics
                </Link>
                <Link
                  href={`/developer/retrieval?workspace=${encodeURIComponent(workspaceId)}`}
                  className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  Retrieval Explorer
                </Link>
                <Link
                  href={`/developer/answers?workspace=${encodeURIComponent(workspaceId)}`}
                  className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  Answer Explorer
                </Link>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Failed jobs</h2>
              {failedJobs.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">No failed jobs in this workspace.</p>
              ) : (
                <ul className="mt-3 space-y-3 text-sm text-slate-600">
                  {failedJobs.map((document) => (
                    <li key={document.id} className="rounded-2xl bg-slate-50 p-3">
                      <p className="font-medium text-slate-900">{document.filename}</p>
                      <p>Status: <span className="font-mono">{document.status}</span></p>
                      <p>{document.error ?? 'Unknown error'}</p>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
            <div className="mt-4 grid gap-4">
              {documents.map((document) => (
                <article key={document.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{document.filename}</p>
                      <p className="text-xs text-slate-500">{document.sourceType.toUpperCase()} • {document.status}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/documents/${document.id}/chunks?workspace=${encodeURIComponent(workspaceId)}`}
                        className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700"
                      >
                        Chunk Inspector
                      </Link>
                      <Link
                        href={`/documents/${document.id}/embeddings?workspace=${encodeURIComponent(workspaceId)}`}
                        className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700"
                      >
                        Embedding Explorer
                      </Link>
                      <Link
                        href={`/documents/${document.id}/vectors?workspace=${encodeURIComponent(workspaceId)}`}
                        className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700"
                      >
                        Vector Index Explorer
                      </Link>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-xs text-slate-600 md:grid-cols-2 xl:grid-cols-4">
                    <p>Created: <span className="font-mono text-slate-900">{timelineLabel(document.createdAt)}</span></p>
                    <p>Embedding queued: <span className="font-mono text-slate-900">{timelineLabel(document.embeddingQueuedAt)}</span></p>
                    <p>Embedding completed: <span className="font-mono text-slate-900">{timelineLabel(document.embeddingCompletedAt)}</span></p>
                    <p>Index queued: <span className="font-mono text-slate-900">{timelineLabel(document.indexQueuedAt)}</span></p>
                    <p>Index started: <span className="font-mono text-slate-900">{timelineLabel(document.indexStartedAt)}</span></p>
                    <p>Index completed: <span className="font-mono text-slate-900">{timelineLabel(document.indexCompletedAt)}</span></p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
