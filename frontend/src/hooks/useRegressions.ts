'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { listRegressions, listModelComparisons } from '@/lib/api';

function useAuthContext() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return async () => {
    const token = await getToken();
    return { token: token ?? '', workspaceId: workspaceId ?? undefined };
  };
}

export function useRegressions(onlyFlagged = false) {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['regressions', workspaceId, onlyFlagged],
    queryFn: async () => {
      const auth = await getAuth();
      return listRegressions(auth, onlyFlagged);
    },
    enabled: !!workspaceId,
  });
}

export function useModelComparisons() {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['model-comparisons', workspaceId],
    queryFn: async () => {
      const auth = await getAuth();
      return listModelComparisons(auth);
    },
    enabled: !!workspaceId,
  });
}
