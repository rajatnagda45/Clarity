'use client';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,           // 1 min — data stays fresh across route transitions
        gcTime: 10 * 60_000,         // 10 min — keep unused cache so back-nav is instant
        retry: 1,
        refetchOnWindowFocus: false, // prevent background refetch on every tab-switch
        refetchOnReconnect: 'always',
      },
    },
  }));
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
