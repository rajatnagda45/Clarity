'use client';

/**
 * Prefetch helpers — hover-on-card to warm the query cache before navigation.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useApiAuth } from '@/contexts/useApiAuth';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { getAgent, listAgentRuns } from '@/lib/api';

export function usePrefetchAgent() {
  const qc = useQueryClient();
  const auth = useApiAuth();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;

  return (agentId: string) => {
    if (!auth.ready || !workspaceId) return;
    void qc.prefetchQuery({
      queryKey: ['agent', workspaceId, agentId],
      queryFn: async () => {
        const a = await auth.getAuth();
        return getAgent(a, agentId);
      },
      staleTime: 30_000,
    });
    void qc.prefetchQuery({
      queryKey: ['agent-runs', workspaceId, agentId],
      queryFn: async () => {
        const a = await auth.getAuth();
        return listAgentRuns(a, agentId);
      },
      staleTime: 30_000,
    });
  };
}
