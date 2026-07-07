'use client';
import { useQueries } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  getDeveloperDashboard,
  getEmbeddingMetrics,
  getIndexMetrics,
  getRetrievalMetrics,
  getAnswerMetrics,
} from '@/lib/api';

const STALE = 30_000;
const GC = 10 * 60_000;

export function useDeveloperConsole() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const id = activeWorkspace?.id;

  const results = useQueries({
    queries: [
      {
        queryKey: ['dev-dashboard', id] as const,
        queryFn: async () => {
          const token = await getToken();
          if (!token) throw new Error('No auth token');
          return getDeveloperDashboard({ token, workspaceId: id! });
        },
        enabled: !!id,
        staleTime: STALE,
        gcTime: GC,
      },
      {
        queryKey: ['embedding-metrics', id] as const,
        queryFn: async () => {
          const token = await getToken();
          if (!token) throw new Error('No auth token');
          return getEmbeddingMetrics({ token, workspaceId: id! });
        },
        enabled: !!id,
        staleTime: STALE,
        gcTime: GC,
      },
      {
        queryKey: ['index-metrics', id] as const,
        queryFn: async () => {
          const token = await getToken();
          if (!token) throw new Error('No auth token');
          return getIndexMetrics({ token, workspaceId: id! });
        },
        enabled: !!id,
        staleTime: STALE,
        gcTime: GC,
      },
      {
        queryKey: ['retrieval-metrics', id] as const,
        queryFn: async () => {
          const token = await getToken();
          if (!token) throw new Error('No auth token');
          return getRetrievalMetrics({ token, workspaceId: id! });
        },
        enabled: !!id,
        staleTime: STALE,
        gcTime: GC,
      },
      {
        queryKey: ['answer-metrics', id] as const,
        queryFn: async () => {
          const token = await getToken();
          if (!token) throw new Error('No auth token');
          return getAnswerMetrics({ token, workspaceId: id! });
        },
        enabled: !!id,
        staleTime: STALE,
        gcTime: GC,
      },
    ],
  });

  const [devDashboard, embeddingMetrics, indexMetrics, retrievalMetrics, answerMetrics] = results;

  const isLoading = results.some((r) => r.isPending);
  const isError = results.some((r) => r.isError);
  const error = results.find((r) => r.error)?.error;

  return {
    dashboard: devDashboard.data ?? null,
    embeddingMetrics: embeddingMetrics.data ?? null,
    indexMetrics: indexMetrics.data ?? null,
    retrievalMetrics: retrievalMetrics.data ?? null,
    answerMetrics: answerMetrics.data ?? null,
    isLoading,
    isError,
    error: error instanceof Error ? error.message : error ? String(error) : '',
    refetch: () => results.forEach((r) => r.refetch()),
  };
}
