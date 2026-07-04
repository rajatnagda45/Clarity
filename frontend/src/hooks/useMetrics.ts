import { useQuery } from '@tanstack/react-query';
import { getLiveMetrics } from '@/lib/api';
import type { LiveMetrics } from '@/types/clarity';

export function useMetrics() {
  return useQuery<LiveMetrics, Error>({
    queryKey: ['live-metrics'],
    queryFn: getLiveMetrics,
    refetchInterval: 10_000,
    retry: 1,
  });
}
