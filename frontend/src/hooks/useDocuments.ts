'use client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { listDocuments } from '@/lib/api';

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
  });
}
