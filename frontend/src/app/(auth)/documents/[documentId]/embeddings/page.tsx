'use client';

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

import { getDocumentEmbeddings } from '@/lib/api';
import type { DocumentEmbeddingInspector } from '@/types/clarity';


type LoadState = 'idle' | 'loading' | 'loaded' | 'error';


export default function DocumentEmbeddingExplorerPage() {
  const params = useParams<{ documentId: string }>();
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspace') ?? '';
  const { getToken } = useAuth();

  const [inspector, setInspector] = useState<DocumentEmbeddingInspector | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadEmbeddings() {
      if (!workspaceId) {
        setLoadState('error');
        setErrorMessage('Embedding explorer requires an active workspace.');
        return;
      }

      setLoadState('loading');
      setErrorMessage('');

      try {
        const token = await getToken();
        if (!token) {
          throw new Error('Clerk session token unavailable.');
        }

        const nextInspector = await getDocumentEmbeddings({ token, workspaceId }, params.documentId);
        if (cancelled) return;
        setInspector(nextInspector);
        setLoadState('loaded');
      } catch (error) {
        if (cancelled) return;
        setLoadState('error');
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to load embedding explorer data.',
        );
      }
    }

    void loadEmbeddings();
    return () => {
      cancelled = true;
    };
  }, [getToken, params.documentId, workspaceId]);

  const embeddings = inspector?.embeddings ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">
            Developer Embedding Explorer
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">Document embeddings</h1>
          <p className="text-sm text-slate-600">
            Inspect embedding metadata, version ownership, retry behavior, latency, and a safe
            preview of the first vector dimensions before vector indexing is introduced.
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
        <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-4">
          <p>
            Workspace: <span className="font-mono text-slate-900">{workspaceId || 'missing'}</span>
          </p>
          <p>
            Document: <span className="font-mono text-slate-900">{params.documentId}</span>
          </p>
          <p>
            Current provider:{' '}
            <span className="font-mono text-slate-900">
              {inspector?.currentEmbeddingProvider ?? 'not set'}
            </span>
          </p>
          <p>
            Current model:{' '}
            <span className="font-mono text-slate-900">
              {inspector?.currentEmbeddingModel ?? 'not set'}
            </span>
          </p>
          <p>
            Current dimension:{' '}
            <span className="font-mono text-slate-900">
              {inspector?.currentEmbeddingDimension ?? 'not set'}
            </span>
          </p>
          <p>
            Embedding version:{' '}
            <span className="font-mono text-slate-900">
              {inspector?.currentEmbeddingVersion ?? 'not set'}
            </span>
          </p>
          <p>
            Parser version:{' '}
            <span className="font-mono text-slate-900">
              {inspector?.currentEmbeddingParserVersion ?? 'not set'}
            </span>
          </p>
          <p>
            Chunk version:{' '}
            <span className="font-mono text-slate-900">
              {inspector?.currentEmbeddingChunkVersion ?? 'not set'}
            </span>
          </p>
        </div>
      </div>

      {loadState === 'loading' ? <p className="text-sm text-slate-500">Loading embeddings…</p> : null}
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      {loadState === 'loaded' && embeddings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
          <p className="text-sm text-slate-600">
            No embedding rows are stored for this document yet. Finish the A5 lifecycle first, then
            reopen the explorer.
          </p>
        </div>
      ) : null}

      <section className="grid gap-4">
        {embeddings.map((embedding) => (
          <article key={`${embedding.chunkId}-${embedding.createdAt}`} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    chunk {embedding.chunkIndex}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      embedding.status === 'current'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {embedding.status}
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-slate-900">{embedding.chunkId}</h2>
              </div>
              <div className="space-y-1 text-right text-xs text-slate-500">
                <p>{embedding.tokenCount} estimated tokens</p>
                <p>{embedding.embeddingDimension} dimensions</p>
                <p>{embedding.latencyMs ?? 0} ms latency</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-3">
              <p>
                Provider: <span className="font-mono text-slate-900">{embedding.embeddingProvider}</span>
              </p>
              <p>
                Model: <span className="font-mono text-slate-900">{embedding.embeddingModel}</span>
              </p>
              <p>
                Embedding version: <span className="font-mono text-slate-900">{embedding.embeddingVersion}</span>
              </p>
              <p>
                Parser version: <span className="font-mono text-slate-900">{embedding.parserVersion}</span>
              </p>
              <p>
                Chunk version: <span className="font-mono text-slate-900">{embedding.chunkVersion}</span>
              </p>
              <p>
                Retry count: <span className="font-mono text-slate-900">{embedding.retryCount}</span>
              </p>
              <p className="md:col-span-2 xl:col-span-3">
                Checksum: <span className="font-mono text-slate-900">{embedding.checksum}</span>
              </p>
              <p>
                Estimated cost: <span className="font-mono text-slate-900">${embedding.estimatedCostUsd.toFixed(6)}</span>
              </p>
              <p>
                Created at: <span className="font-mono text-slate-900">{new Date(embedding.createdAt).toLocaleString()}</span>
              </p>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-950 p-4 text-sm text-slate-100">
              <p className="mb-2 font-semibold text-slate-200">Safe vector preview (first 10 values)</p>
              <pre className="whitespace-pre-wrap break-words font-mono">
                [{embedding.vectorPreview.map((value) => value.toFixed(6)).join(', ')}]
              </pre>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
