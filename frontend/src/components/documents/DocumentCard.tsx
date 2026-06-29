import Link from 'next/link';

import type { Document } from '@/types/clarity';


function statusTone(status: Document['status']): string {
  if (status === 'indexed') return 'bg-emerald-100 text-emerald-700';
  if (status === 'failed') return 'bg-red-100 text-red-700';
  if (status === 'indexing') return 'bg-amber-100 text-amber-700';
  if (status === 'awaiting_index') return 'bg-yellow-100 text-yellow-700';
  if (status === 'embedded') return 'bg-lime-100 text-lime-700';
  if (status === 'embedding') return 'bg-lime-100 text-lime-700';
  if (status === 'awaiting_embeddings') return 'bg-green-100 text-green-700';
  if (status === 'chunked') return 'bg-emerald-50 text-emerald-700';
  if (status === 'chunking') return 'bg-teal-100 text-teal-700';
  if (status === 'awaiting_chunking') return 'bg-cyan-100 text-cyan-700';
  if (status === 'metadata_ready') return 'bg-sky-100 text-sky-700';
  if (status === 'normalized') return 'bg-indigo-100 text-indigo-700';
  if (status === 'extracted') return 'bg-violet-100 text-violet-700';
  return 'bg-amber-100 text-amber-700';
}

function statusMessage(status: Document['status']): string {
  if (status === 'uploaded') return 'Stored securely and queued for extraction.';
  if (status === 'extracted') return 'Source text extracted from the original document.';
  if (status === 'normalized') return 'Text normalized into the shared ingestion format.';
  if (status === 'metadata_ready') return 'Metadata and clause-aware preprocessing are complete.';
  if (status === 'awaiting_chunking') return 'Normalized document is queued for clause-aware chunking.';
  if (status === 'chunking') return 'Clause-aware chunks are being generated for retrieval readiness.';
  if (status === 'chunked') return 'Chunk generation is complete and embedding work is about to begin.';
  if (status === 'awaiting_embeddings') return 'Embedding generation is queued for the current chunk set.';
  if (status === 'embedding') return 'Embeddings are being generated for the current document chunks.';
  if (status === 'embedded') return 'Embeddings are complete and the document is ready to enter vector indexing.';
  if (status === 'awaiting_index') return 'Vector indexing is queued for the current embedding set.';
  if (status === 'indexing') return 'The current embedding set is being synchronized into the vector index.';
      if (status === 'indexed') return 'Vector indexing is complete and the document is retrieval-ready.';
  return 'Document ingestion failed before chunking.';
}


export function DocumentCard({
  document,
  workspaceId,
}: {
  document: Document;
  workspaceId: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{document.filename}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {document.sourceType.toUpperCase()} • Added {new Date(document.createdAt).toLocaleString()}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone(document.status)}`}>
          {document.status}
        </span>
      </div>

      {document.error ? (
        <p className="mt-3 text-sm text-red-600">{document.error}</p>
      ) : (
        <p className="mt-3 text-sm text-slate-600">{statusMessage(document.status)}</p>
      )}

      {workspaceId ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/documents/${document.id}?workspace=${encodeURIComponent(workspaceId)}`}
            className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
          >
            Open clause map
          </Link>
          {['chunked', 'awaiting_embeddings', 'embedding', 'embedded', 'awaiting_index', 'indexing', 'indexed'].includes(document.status) ? (
            <>
          <Link
            href={`/documents/${document.id}/chunks?workspace=${encodeURIComponent(workspaceId)}`}
            className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
          >
            Open chunk inspector
          </Link>
          <Link
            href={`/documents/${document.id}/embeddings?workspace=${encodeURIComponent(workspaceId)}`}
            className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
          >
            Open embedding explorer
          </Link>
          <Link
            href={`/documents/${document.id}/vectors?workspace=${encodeURIComponent(workspaceId)}`}
            className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
          >
            Open vector explorer
          </Link>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
