'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';

import { exploreRetrieval } from '@/lib/api';
import type { RetrievalExplorerResponse } from '@/types/clarity';


export default function RetrievalExplorerPage() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspace') ?? '';
  const { getToken } = useAuth();

  const [query, setQuery] = useState('');
  const [documentIds, setDocumentIds] = useState('');
  const [result, setResult] = useState<RetrievalExplorerResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) {
      setErrorMessage('Retrieval explorer requires an active workspace.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Clerk session token unavailable.');
      }

      const response = await exploreRetrieval(
        { token, workspaceId },
        {
          query,
          documentIds: documentIds
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        },
      );
      setResult(response);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to explore retrieval.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">
            Developer Retrieval Explorer
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">Hybrid retrieval inspector</h1>
          <p className="text-sm text-slate-600">
            Inspect normalized queries, dense and sparse candidates, reciprocal-rank fusion, cross-reference expansion, and final evidence ordering.
          </p>
        </div>
        <Link
          href={workspaceId ? `/developer/dashboard?workspace=${encodeURIComponent(workspaceId)}` : '/documents'}
          className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Back to developer dashboard
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Query</span>
            <textarea
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-28 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900"
              placeholder='Example: "Does this agreement auto-renew and what is the notice period?"'
              required
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Document IDs (optional, comma-separated)</span>
            <textarea
              value={documentIds}
              onChange={(event) => setDocumentIds(event.target.value)}
              className="min-h-28 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-mono text-slate-900"
              placeholder="doc-1, doc-2"
            />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={!workspaceId || isLoading || !query.trim()}
            className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isLoading ? 'Running retrieval…' : 'Run retrieval'}
          </button>
          <p className="text-sm text-slate-500">
            Workspace: <span className="font-mono text-slate-800">{workspaceId || 'not selected'}</span>
          </p>
        </div>
      </form>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      {result ? (
        <>
          <section className="grid gap-4 lg:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Cache hit</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{result.cacheHit ? 'Yes' : 'No'}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Dense latency</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{result.denseLatencyMs} ms</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Sparse latency</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{result.sparseLatencyMs} ms</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Fusion latency</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{result.fusionLatencyMs} ms</p>
            </article>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Normalized query</h2>
            <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
              <p>Raw: <span className="font-mono text-slate-900">{result.normalizedQuery.rawQuery}</span></p>
              <p>Normalized: <span className="font-mono text-slate-900">{result.normalizedQuery.normalizedQuery}</span></p>
              <p>Tokens: <span className="font-mono text-slate-900">{result.normalizedQuery.tokens.join(', ') || 'none'}</span></p>
              <p>Clause refs: <span className="font-mono text-slate-900">{result.normalizedQuery.clauseRefs.join(', ') || 'none'}</span></p>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            {([
              { title: 'Dense candidates', rows: result.denseCandidates },
              { title: 'Sparse candidates', rows: result.sparseCandidates },
              { title: 'Fused candidates', rows: result.fusedCandidates },
            ] as const).map(({ title, rows }) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                <ul className="mt-4 space-y-3 text-sm text-slate-600">
                  {rows.map((row) => (
                    <li key={`${title}-${row.chunkId}-${row.rank}`} className="rounded-2xl bg-slate-50 p-3">
                      <p className="font-mono text-slate-900">#{row.rank} {row.chunkId}</p>
                      <p>Document: <span className="font-mono">{row.documentId}</span></p>
                      <p>Score: <span className="font-mono">{row.score.toFixed(6)}</span></p>
                      {row.reason ? <p>{row.reason}</p> : null}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>

          <section className="grid gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Retrieved evidence</h2>
            {result.results.map((row) => (
              <article key={`${row.chunkId}-${row.finalRank}`} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        rank {row.finalRank}
                      </span>
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                        {row.retrievalSources.join(' + ')}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">{row.chunkId}</h3>
                    <p className="text-sm text-slate-600">{row.retrievalReason}</p>
                  </div>
                  <div className="space-y-1 text-right text-xs text-slate-500">
                    <p>Vector score: {row.vectorScore?.toFixed(6) ?? 'n/a'}</p>
                    <p>BM25 score: {row.bm25Score?.toFixed(6) ?? 'n/a'}</p>
                    <p>RRF score: {row.rrfScore.toFixed(6)}</p>
                    <p>Final score: {row.finalScore.toFixed(6)}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-3">
                  <p>Document: <span className="font-mono text-slate-900">{row.documentId}</span></p>
                  <p>Section title: <span className="font-mono text-slate-900">{row.sectionTitle ?? 'n/a'}</span></p>
                  <p>Clause number: <span className="font-mono text-slate-900">{row.clauseNumber ?? 'n/a'}</span></p>
                  <p>Pages: <span className="font-mono text-slate-900">{row.pageStart}–{row.pageEnd}</span></p>
                  <p>Chunk kind: <span className="font-mono text-slate-900">{row.chunkKind}</span></p>
                  <p>Cross references: <span className="font-mono text-slate-900">{row.crossReferences.join(', ') || 'none'}</span></p>
                </div>

                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="mb-2 font-semibold text-slate-900">Chunk</p>
                  <p className="whitespace-pre-wrap break-words">{row.text}</p>
                </div>
              </article>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}
