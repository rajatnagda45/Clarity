'use client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { getDeveloperDashboard, getAnswerMetrics, getEmbeddingMetrics } from '@/lib/api';

export function useDashboardMetrics() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();

  const devDashboard = useQuery({
    queryKey: ['dev-dashboard', activeWorkspace?.id],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return getDeveloperDashboard({ token, workspaceId: activeWorkspace!.id });
    },
    enabled: !!activeWorkspace,
  });

  const answerMetrics = useQuery({
    queryKey: ['answer-metrics', activeWorkspace?.id],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return getAnswerMetrics({ token, workspaceId: activeWorkspace!.id });
    },
    enabled: !!activeWorkspace,
  });

  const embeddingMetrics = useQuery({
    queryKey: ['embedding-metrics', activeWorkspace?.id],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return getEmbeddingMetrics({ token, workspaceId: activeWorkspace!.id });
    },
    enabled: !!activeWorkspace,
  });

  return { devDashboard, answerMetrics, embeddingMetrics };
}
