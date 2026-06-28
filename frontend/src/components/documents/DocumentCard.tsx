import type { Document } from '@/types/clarity';


function statusTone(status: Document['status']): string {
  if (status === 'ready') return 'bg-emerald-100 text-emerald-700';
  if (status === 'failed') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-700';
}


export function DocumentCard({ document }: { document: Document }) {
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
        <p className="mt-3 text-sm text-slate-600">
          {document.status === 'processing'
            ? 'Stored securely and waiting for later ingestion milestones.'
            : 'Document metadata is available.'}
        </p>
      )}
    </article>
  );
}
