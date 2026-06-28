import { describe, expect, it } from 'vitest';

import { isTerminalDocumentStatus, shouldPollDocuments, shouldStartPollingForUpload } from './documentPolling';
import type { Document } from '@/types/clarity';


function makeDocument(status: Document['status']): Document {
  return {
    id: 'doc-1',
    filename: 'msa.pdf',
    sourceType: 'pdf',
    pageCount: null,
    status,
    error: null,
    createdAt: '2026-06-28T12:00:00Z',
  };
}


describe('document polling helpers', () => {
  it('treats indexed and failed as terminal', () => {
    expect(isTerminalDocumentStatus('indexed')).toBe(true);
    expect(isTerminalDocumentStatus('failed')).toBe(true);
    expect(isTerminalDocumentStatus('uploaded')).toBe(false);
  });

  it('starts polling after the first uploaded document is created', () => {
    expect(shouldStartPollingForUpload(makeDocument('uploaded'))).toBe(true);
  });

  it('keeps polling while any document is non-terminal', () => {
    expect(shouldPollDocuments([makeDocument('awaiting_embeddings'), makeDocument('normalized')])).toBe(true);
    expect(shouldPollDocuments([makeDocument('indexed'), makeDocument('failed')])).toBe(false);
  });
});
