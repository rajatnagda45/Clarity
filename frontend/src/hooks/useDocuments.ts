'use client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { listDocuments } from '@/lib/api';
import type { Document } from '@/types/clarity';

const TERMINAL_STATUSES = new Set(['indexed', 'failed']);

function hasInProgress(docs: Document[]) {
  return docs.some((d) => !TERMINAL_STATUSES.has(d.status));
}

export function useDocuments() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['documents', activeWorkspace?.id],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return listDocuments({ token, workspaceId: activeWorkspace!.id });
    },
    enabled: !!activeWorkspace,
    staleTime: 10_000,
    // Poll every 3s while any document is processing, 30s when all are terminal
    refetchInterval: (query) => {
      const data = query.state.data as Document[] | undefined;
      if (!data) return 3_000;
      return hasInProgress(data) ? 3_000 : 30_000;
    },
  });
}
