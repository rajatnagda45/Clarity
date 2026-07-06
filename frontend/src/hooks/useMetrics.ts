'use client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { getLiveMetrics } from '@/lib/api';
import type { LiveMetrics } from '@/types/clarity';

export function useMetrics() {
  const { getToken } = useAuth();

  return useQuery<LiveMetrics, Error>({
    queryKey: ['live-metrics'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return getLiveMetrics({ token });
    },
    refetchInterval: 10_000,
    staleTime: 8_000,
    retry: 2,
    retryDelay: 2_000,
  });
}
