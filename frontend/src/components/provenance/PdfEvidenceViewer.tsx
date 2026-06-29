'use client';

import React from 'react';

import type { DocumentFile } from '../../types/clarity';


export function PdfEvidenceViewer({
  currentPage,
  documentFile,
  onNextPage,
  onPreviousPage,
}: {
  currentPage: number;
  documentFile: DocumentFile | null;
  onNextPage: () => void;
  onPreviousPage: () => void;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Current page: {currentPage}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPreviousPage}
            aria-label="Previous page"
            className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={onNextPage}
            aria-label="Next page"
            className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700"
          >
            Next
          </button>
        </div>
      </div>
      {documentFile ? (
        <iframe
          title="Source document"
          src={`${documentFile.signedUrl}#page=${currentPage}`}
          className="h-[70vh] w-full rounded-2xl border border-slate-200"
        />
      ) : (
        <div className="flex h-[70vh] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-600">
          Loading signed document…
        </div>
      )}
    </section>
  );
}
