'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  listEvalRuns,
  getQualityDashboard,
  getCitationAnalytics,
  getTrustAnalytics,
  getConversationEvals,
  triggerQualityRollup,
} from '@/lib/api';

function useAuthContext() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return async () => {
    const token = await getToken();
    return { token: token ?? '', workspaceId: workspaceId ?? undefined };
  };
}

export function useEvalRuns(limit = 20) {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['eval-runs', workspaceId, limit],
    queryFn: async () => {
      const auth = await getAuth();
      return listEvalRuns(auth, limit);
    },
    enabled: !!workspaceId,
  });
}

export function useQualityDashboard(days = 30) {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['quality-dashboard', workspaceId, days],
    queryFn: async () => {
      const auth = await getAuth();
      return getQualityDashboard(auth, days);
    },
    enabled: !!workspaceId,
  });
}

export function useCitationAnalytics(days = 30) {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['citation-analytics', workspaceId, days],
    queryFn: async () => {
      const auth = await getAuth();
      return getCitationAnalytics(auth, days);
    },
    enabled: !!workspaceId,
  });
}

export function useTrustAnalytics(days = 30) {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['trust-analytics', workspaceId, days],
    queryFn: async () => {
      const auth = await getAuth();
      return getTrustAnalytics(auth, days);
    },
    enabled: !!workspaceId,
  });
}

export function useConversationEvals(limit = 20) {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['conversation-evals', workspaceId, limit],
    queryFn: async () => {
      const auth = await getAuth();
      return getConversationEvals(auth, limit);
    },
    enabled: !!workspaceId,
  });
}

export function useTriggerQualityRollup() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async () => {
      const auth = await getAuth();
      return triggerQualityRollup(auth);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['quality-dashboard', workspaceId] });
    },
  });
}
