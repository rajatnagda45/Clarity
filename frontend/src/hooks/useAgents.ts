'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  listAgents, createAgent, getAgent, updateAgent, deleteAgent, archiveAgent,
  triggerAgentRun, listAgentRuns, getAgentRun, getAgentAnalytics, listAvailableTools,
  listReviewQueue, submitReviewDecision, getReviewQueueStats,
  listWorkflows, createWorkflow, getWorkflow, updateWorkflow, deleteWorkflow,
} from '@/lib/api';
import type {
  CreateAgentPayload, UpdateAgentPayload,
  TriggerAgentRunPayload, ReviewDecisionPayload,
  CreateWorkflowPayload, UpdateWorkflowPayload,
} from '@/types/clarity';

function useAuthContext() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return async () => {
    const token = await getToken();
    return { token: token ?? '', workspaceId: workspaceId ?? undefined };
  };
}

// ─── Agents ───────────────────────────────────────────────────────────────────

export function useAgents(category?: string) {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['agents', workspaceId, category],
    queryFn: async () => {
      const auth = await getAuth();
      return listAgents(auth, category);
    },
    enabled: !!workspaceId,
  });
}

export function useAgent(agentId: string) {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['agent', workspaceId, agentId],
    queryFn: async () => {
      const auth = await getAuth();
      return getAgent(auth, agentId);
    },
    enabled: !!workspaceId && !!agentId,
  });
}

export function useCreateAgent() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (payload: CreateAgentPayload) => {
      const auth = await getAuth();
      return createAgent(auth, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agents', workspaceId] });
    },
  });
}

export function useUpdateAgent() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async ({ agentId, payload }: { agentId: string; payload: UpdateAgentPayload }) => {
      const auth = await getAuth();
      return updateAgent(auth, agentId, payload);
    },
    onSuccess: (_, { agentId }) => {
      void qc.invalidateQueries({ queryKey: ['agents', workspaceId] });
      void qc.invalidateQueries({ queryKey: ['agent', workspaceId, agentId] });
    },
  });
}

export function useDeleteAgent() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (agentId: string) => {
      const auth = await getAuth();
      return deleteAgent(auth, agentId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agents', workspaceId] });
    },
  });
}

export function useArchiveAgent() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (agentId: string) => {
      const auth = await getAuth();
      return archiveAgent(auth, agentId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agents', workspaceId] });
    },
  });
}

// ─── Agent Runs ───────────────────────────────────────────────────────────────

export function useAgentRuns(agentId: string, enabled = true) {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['agent-runs', workspaceId, agentId],
    queryFn: async () => {
      const auth = await getAuth();
      return listAgentRuns(auth, agentId);
    },
    enabled: !!workspaceId && !!agentId && enabled,
    refetchInterval: 5000,
  });
}

export function useAgentRun(runId: string) {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['agent-run', workspaceId, runId],
    queryFn: async () => {
      const auth = await getAuth();
      return getAgentRun(auth, runId);
    },
    enabled: !!workspaceId && !!runId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      return ['completed', 'failed', 'review_required'].includes(data.status) ? false : 2000;
    },
  });
}

export function useTriggerAgentRun() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async ({ agentId, payload }: { agentId: string; payload: TriggerAgentRunPayload }) => {
      const auth = await getAuth();
      return triggerAgentRun(auth, agentId, payload);
    },
    onSuccess: (_, { agentId }) => {
      void qc.invalidateQueries({ queryKey: ['agent-runs', workspaceId, agentId] });
      void qc.invalidateQueries({ queryKey: ['agents', workspaceId] });
    },
  });
}

export function useAgentAnalytics(agentId: string) {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['agent-analytics', workspaceId, agentId],
    queryFn: async () => {
      const auth = await getAuth();
      return getAgentAnalytics(auth, agentId);
    },
    enabled: !!workspaceId && !!agentId,
  });
}

export function useAvailableTools() {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['available-tools', workspaceId],
    queryFn: async () => {
      const auth = await getAuth();
      return listAvailableTools(auth);
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Review Queue ─────────────────────────────────────────────────────────────

export function useReviewQueue(opts?: { status?: string; priority?: string }) {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['review-queue', workspaceId, opts],
    queryFn: async () => {
      const auth = await getAuth();
      return listReviewQueue(auth, opts);
    },
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });
}

export function useReviewQueueStats() {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['review-queue-stats', workspaceId],
    queryFn: async () => {
      const auth = await getAuth();
      return getReviewQueueStats(auth);
    },
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });
}

export function useSubmitReview() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async ({ itemId, payload }: { itemId: string; payload: ReviewDecisionPayload }) => {
      const auth = await getAuth();
      return submitReviewDecision(auth, itemId, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['review-queue', workspaceId] });
      void qc.invalidateQueries({ queryKey: ['review-queue-stats', workspaceId] });
    },
  });
}

// ─── Workflows ────────────────────────────────────────────────────────────────

export function useWorkflows() {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['workflows', workspaceId],
    queryFn: async () => {
      const auth = await getAuth();
      return listWorkflows(auth);
    },
    enabled: !!workspaceId,
  });
}

export function useWorkflow(workflowId: string) {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['workflow', workspaceId, workflowId],
    queryFn: async () => {
      const auth = await getAuth();
      return getWorkflow(auth, workflowId);
    },
    enabled: !!workspaceId && !!workflowId,
  });
}

export function useCreateWorkflow() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (payload: CreateWorkflowPayload) => {
      const auth = await getAuth();
      return createWorkflow(auth, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['workflows', workspaceId] });
    },
  });
}

export function useUpdateWorkflow() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async ({ workflowId, payload }: { workflowId: string; payload: UpdateWorkflowPayload }) => {
      const auth = await getAuth();
      return updateWorkflow(auth, workflowId, payload);
    },
    onSuccess: (_, { workflowId }) => {
      void qc.invalidateQueries({ queryKey: ['workflows', workspaceId] });
      void qc.invalidateQueries({ queryKey: ['workflow', workspaceId, workflowId] });
    },
  });
}

export function useDeleteWorkflow() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (workflowId: string) => {
      const auth = await getAuth();
      return deleteWorkflow(auth, workflowId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['workflows', workspaceId] });
    },
  });
}
