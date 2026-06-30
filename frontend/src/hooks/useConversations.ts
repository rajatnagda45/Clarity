'use client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { listConversations } from '@/lib/api';

export function useConversations() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['conversations', activeWorkspace?.id],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return listConversations({ token, workspaceId: activeWorkspace!.id });
    },
    enabled: !!activeWorkspace,
  });
}
