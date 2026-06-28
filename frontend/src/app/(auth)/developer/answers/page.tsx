'use client';

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { getAnswerExplorer, getAnswerMetrics } from '@/lib/api';
import type { AnswerExplorerResponse, AnswerMetrics } from '@/types/clarity';


type LoadState = 'idle' | 'loading' | 'loaded' | 'error';


export default function DeveloperAnswersPage() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspace') ?? '';
  const { getToken } = useAuth();

  const [answers, setAnswers] = useState<AnswerExplorerResponse | null>(null);
  const [metrics, setMetrics] = useState<AnswerMetrics | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!workspaceId) {
        setLoadState('error');
        setErrorMessage('Answer explorer requires an active workspace.');
        return;
      }

      setLoadState('loading');
      setErrorMessage('');

      try {
        const token = await getToken();
        if (!token) throw new Error('Clerk session token unavailable.');
        const [nextAnswers, nextMetrics] = await Promise.all([
          getAnswerExplorer({ token, workspaceId }),
          getAnswerMetrics({ token, workspaceId }),
        ]);
        if (cancelled) return;
        setAnswers(nextAnswers);
        setMetrics(nextMetrics);
        setLoadState('loaded');
      } catch (error) {
        if (cancelled) return;
        setLoadState('error');
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load answer explorer.');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [getToken, workspaceId]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">Developer Answer Explorer</p>
          <h1 className="text-3xl font-semibold text-slate-900">Answer generation runs</h1>
          <p className="text-sm text-slate-600">
            Inspect grounded prompts, retrieved evidence, streaming events, citations, latency, and token usage for every answer run.
          </p>
        </div>
        <Link
          href={workspaceId ? `/developer/dashboard?workspace=${encodeURIComponent(workspaceId)}` : '/developer/dashboard'}
          className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Back to developer dashboard
        </Link>
      </div>

      {loadState === 'loading' ? <p className="text-sm text-slate-500">Loading answer explorer…</p> : null}
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      {metrics ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Answer latency</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{metrics.answerLatencyMs.toFixed(2)} ms</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total tokens</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{metrics.totalTokens}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Estimated cost</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">${metrics.estimatedCostUsd.toFixed(4)}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Avg citations</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{metrics.averageCitationsPerAnswer.toFixed(2)}</p>
          </article>
        </section>
      ) : null}

      <section className="grid gap-5">
        {answers?.runs.map((run) => (
          <article key={run.answerRunId} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{run.provider} · {run.model}</p>
                <h2 className="text-lg font-semibold text-slate-900">{run.query}</h2>
                <p className="text-sm text-slate-600">Normalized query: <span className="font-mono text-slate-900">{run.normalizedQuery}</span></p>
              </div>
              <div className="space-y-1 text-right text-xs text-slate-500">
                <p>Status: <span className="font-semibold text-slate-900">{run.status}</span></p>
                <p>Prompt: <span className="font-mono text-slate-900">{run.promptVersion}</span></p>
                <p>Writer: <span className="font-mono text-slate-900">{run.writerVersion}</span></p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Prompt payload</h3>
                <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-700">
                  {JSON.stringify(run.promptPayload, null, 2)}
                </pre>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Final answer</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{run.finalAnswer || 'No answer recorded.'}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Retrieved evidence</h3>
                <ul className="mt-2 space-y-2 text-sm text-slate-600">
                  {run.retrievedEvidence.map((evidence) => (
                    <li key={evidence.chunkId} className="rounded-2xl bg-slate-50 p-3">
                      <p className="font-medium text-slate-900">{evidence.sectionTitle || evidence.chunkId}</p>
                      <p>Rank {evidence.finalRank} · pages {evidence.pageStart}-{evidence.pageEnd}</p>
                      <p>{evidence.retrievalReason}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Streaming timeline</h3>
                <ul className="mt-2 space-y-2 text-sm text-slate-600">
                  {run.streamEvents.map((event, index) => (
                    <li key={`${run.answerRunId}-${index}`} className="rounded-2xl bg-slate-50 p-3 font-mono text-xs">
                      {JSON.stringify(event)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
