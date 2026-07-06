'use client';

import { createContext, useContext } from 'react';

export interface DocumentEventsContextValue {
  /** True while the SSE connection to /api/events/documents is open. */
  connected: boolean;
}

export const DocumentEventsContext = createContext<DocumentEventsContextValue>({
  connected: false,
});

export function useDocumentEvents(): DocumentEventsContextValue {
  return useContext(DocumentEventsContext);
}
