import type { Document, DocumentStatus } from '@/types/clarity';


export const TERMINAL_DOCUMENT_STATUSES: ReadonlySet<DocumentStatus> = new Set([
  'indexed',
  'failed',
]);


export function isTerminalDocumentStatus(status: DocumentStatus): boolean {
  return TERMINAL_DOCUMENT_STATUSES.has(status);
}


export function shouldPollDocuments(documents: Document[]): boolean {
  return documents.some((document) => !isTerminalDocumentStatus(document.status));
}


export function shouldStartPollingForUpload(document: Document): boolean {
  return !isTerminalDocumentStatus(document.status);
}
