import type { Document } from '@/types/clarity';

import { DocumentCard } from './DocumentCard';


export function DocumentList({ documents }: { documents: Document[] }) {
  if (documents.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
        <p className="text-sm text-slate-600">
          No documents uploaded yet. Use the upload form to store your first contract in this
          workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {documents.map((document) => (
        <DocumentCard key={document.id} document={document} />
      ))}
    </div>
  );
}
