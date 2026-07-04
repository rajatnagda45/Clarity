import { useQuery } from '@tanstack/react-query';
import { getSystemHealth } from '@/lib/api';
import type { SystemHealth } from '@/types/clarity';

export function useSystemHealth() {
  return useQuery<SystemHealth, Error>({
    queryKey: ['system-health'],
    queryFn: getSystemHealth,
    refetchInterval: 30_000,
    retry: 2,
  });
}
