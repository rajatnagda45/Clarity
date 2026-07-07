import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { getDocumentPipelineInspect } from '@/lib/api';
import type { PipelineInspectReport } from '@/types/clarity';

export function useDocumentInspect(documentId: string) {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();

  return useQuery<PipelineInspectReport>({
    queryKey: ['pipeline-inspect', documentId, activeWorkspace?.id],
    enabled: !!documentId && !!activeWorkspace?.id,
    queryFn: async () => {
      const token = await getToken();
      if (!token || !activeWorkspace?.id) throw new Error('Auth not ready');
      return getDocumentPipelineInspect(
        { token, workspaceId: activeWorkspace.id },
        documentId,
      );
    },
    staleTime: 15_000,
    refetchInterval: (query) => {
      const status = query.state.data?.document.status;
      if (!status) return 10_000;
      const terminal = new Set(['indexed', 'failed']);
      return terminal.has(status) ? false : 5_000;
    },
  });
}
