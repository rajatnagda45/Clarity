'use client';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useDocumentEvents } from '@/hooks/useDocumentEvents';
import { listDocuments } from '@/lib/api';
import type { Document } from '@/types/clarity';

const TERMINAL_STATUSES = new Set(['indexed', 'failed']);

function hasInProgress(docs: Document[]) {
  return docs.some((d) => !TERMINAL_STATUSES.has(d.status));
}

export function useDocuments() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { connected } = useDocumentEvents();

  return useQuery({
    queryKey: ['documents', activeWorkspace?.id],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return listDocuments({ token, workspaceId: activeWorkspace!.id });
    },
    enabled: !!activeWorkspace,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
    // SSE is the primary update mechanism — polling is a fallback only.
    // When the SSE connection is live, poll every 60 s just to keep data
    // fresh across browser tab switches or brief disconnects.
    // When SSE is not available, fall back to aggressive polling.
    refetchInterval: (query) => {
      if (connected) return 60_000;
      const data = query.state.data as Document[] | undefined;
      if (!data) return 3_000;
      return hasInProgress(data) ? 3_000 : 30_000;
    },
  });
}
