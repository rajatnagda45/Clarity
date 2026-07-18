'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiAuth, useApiAuthOrThrow } from '@/contexts/useApiAuth';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  listAgents, createAgent, getAgent, updateAgent, deleteAgent, archiveAgent,
  restoreAgent as apiRestoreAgent, duplicateAgent as apiDuplicateAgent,
  cloneAgent as apiCloneAgent, versionAgent as apiVersionAgent,
  bulkDeleteAgents as apiBulkDelete, bulkArchiveAgents as apiBulkArchive,
  exportAgents as apiExportAgents, importAgents as apiImportAgents,
  triggerAgentRunStreaming, listAgentRuns, getAgentRun, getAgentAnalytics, listAvailableTools,
  listReviewQueue, submitReviewDecision, getReviewQueueStats,
  listWorkflows, createWorkflow, getWorkflow, updateWorkflow, deleteWorkflow,
} from '@/lib/api';
import type {
  Agent,
  CreateAgentPayload, UpdateAgentPayload,
  ReviewDecisionPayload,
  CreateWorkflowPayload, UpdateWorkflowPayload,
} from '@/types/clarity';
import type { TriggerAgentRunStreamingOptions } from '@/lib/api';

// ─── Agents ───────────────────────────────────────────────────────────────────

export function useAgents(category?: string) {
  const auth = useApiAuth();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['agents', workspaceId, category],
    queryFn: async () => {
      const a = await auth.getAuth();
      if (!a) throw new Error('not_ready');
      return listAgents(a, category);
    },
    enabled: auth.ready,
    placeholderData: (prev) => prev,
  });
}

export function useAgent(agentId: string) {
  const auth = useApiAuth();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['agent', workspaceId, agentId],
    queryFn: async () => {
      const a = await auth.getAuth();
      if (!a) throw new Error('not_ready');
      return getAgent(a, agentId);
    },
    enabled: auth.ready && !!agentId,
    placeholderData: (prev) => prev,
  });
}

export function useCreateAgent() {
  const getAuth = useApiAuthOrThrow();
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
  const getAuth = useApiAuthOrThrow();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation<
    Agent,
    Error,
    { agentId: string; payload: UpdateAgentPayload },
    { prevList?: { agents: Agent[]; total: number }; prevDetail?: Agent }
  >({
    mutationFn: async ({ agentId, payload }: { agentId: string; payload: UpdateAgentPayload }) => {
      const auth = await getAuth();
      return updateAgent(auth, agentId, payload);
    },
    // Optimistic update — patch the cached agent and the list immediately
    onMutate: async ({ agentId, payload }) => {
      const listKey = ['agents', workspaceId];
      const detailKey = ['agent', workspaceId, agentId];
      await qc.cancelQueries({ queryKey: listKey });
      await qc.cancelQueries({ queryKey: detailKey });
      const prevList = qc.getQueryData<{ agents: Agent[]; total: number }>(listKey);
      const prevDetail = qc.getQueryData<Agent>(detailKey);
      if (prevList) {
        qc.setQueryData(listKey, {
          ...prevList,
          agents: prevList.agents.map(a => a.id === agentId ? { ...a, ...payload } as Agent : a),
        });
      }
      if (prevDetail) {
        qc.setQueryData(detailKey, { ...prevDetail, ...payload } as Agent);
      }
      return { prevList, prevDetail };
    },
    onError: (err, { agentId }, context) => {
      const ctx = context as { prevList?: { agents: Agent[]; total: number }; prevDetail?: Agent } | undefined;
      if (ctx?.prevList) qc.setQueryData(['agents', workspaceId], ctx.prevList);
      if (ctx?.prevDetail) qc.setQueryData(['agent', workspaceId, agentId], ctx.prevDetail);
      void err; // suppress unused warning
    },
    onSettled: (_data, _err, { agentId }) => {
      void qc.invalidateQueries({ queryKey: ['agents', workspaceId] });
      void qc.invalidateQueries({ queryKey: ['agent', workspaceId, agentId] });
    },
  });
}

export function useDeleteAgent() {
  const getAuth = useApiAuthOrThrow();
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
  const getAuth = useApiAuthOrThrow();
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

export function useRestoreAgent() {
  const getAuth = useApiAuthOrThrow();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (agentId: string) => {
      const auth = await getAuth();
      return apiRestoreAgent(auth, agentId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agents', workspaceId] });
    },
  });
}

export function useDuplicateAgent() {
  const getAuth = useApiAuthOrThrow();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (agentId: string) => {
      const auth = await getAuth();
      return apiDuplicateAgent(auth, agentId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agents', workspaceId] });
    },
  });
}

export function useCloneAgent() {
  const getAuth = useApiAuthOrThrow();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async ({ agentId, targetWorkspaceId }: { agentId: string; targetWorkspaceId?: string }) => {
      const auth = await getAuth();
      return apiCloneAgent(auth, agentId, targetWorkspaceId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agents', workspaceId] });
    },
  });
}

export function useVersionAgent() {
  const getAuth = useApiAuthOrThrow();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (agentId: string) => {
      const auth = await getAuth();
      return apiVersionAgent(auth, agentId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agents', workspaceId] });
    },
  });
}

export function useBulkDeleteAgents() {
  const getAuth = useApiAuthOrThrow();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (agentIds: string[]) => {
      const auth = await getAuth();
      return apiBulkDelete(auth, agentIds);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agents', workspaceId] });
    },
  });
}

export function useBulkArchiveAgents() {
  const getAuth = useApiAuthOrThrow();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (agentIds: string[]) => {
      const auth = await getAuth();
      return apiBulkArchive(auth, agentIds);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agents', workspaceId] });
    },
  });
}

export function useExportAgents(includeArchived = false) {
  const auth = useApiAuth();
  return useQuery({
    queryKey: ['agents-export', includeArchived],
    queryFn: async () => {
      const a = await auth.getAuth();
      if (!a) throw new Error('not_ready');
      return apiExportAgents(a, includeArchived);
    },
    enabled: auth.ready,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useImportAgents() {
  const getAuth = useApiAuthOrThrow();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (bundle: { agents: Array<Record<string, unknown>> }) => {
      const auth = await getAuth();
      return apiImportAgents(auth, bundle);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agents', workspaceId] });
    },
  });
}

// ─── Agent Runs ───────────────────────────────────────────────────────────────

export function useAgentRuns(agentId: string, enabled = true) {
  const auth = useApiAuth();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['agent-runs', workspaceId, agentId],
    queryFn: async () => {
      const a = await auth.getAuth();
      if (!a) throw new Error('not_ready');
      return listAgentRuns(a, agentId);
    },
    enabled: auth.ready && !!agentId && enabled,
    refetchInterval: 5000,
    placeholderData: (prev) => prev,
  });
}

export function useAgentRun(runId: string) {
  const auth = useApiAuth();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['agent-run', workspaceId, runId],
    queryFn: async () => {
      const a = await auth.getAuth();
      if (!a) throw new Error('not_ready');
      return getAgentRun(a, runId);
    },
    enabled: auth.ready && !!runId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      return ['completed', 'failed', 'cancelled', 'review_required'].includes(data.status) ? false : 2000;
    },
    placeholderData: (prev) => prev,
  });
}

export function useAgentAnalytics(agentId: string) {
  const auth = useApiAuth();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['agent-analytics', workspaceId, agentId],
    queryFn: async () => {
      const a = await auth.getAuth();
      if (!a) throw new Error('not_ready');
      return getAgentAnalytics(a, agentId);
    },
    enabled: auth.ready && !!agentId,
    placeholderData: (prev) => prev,
  });
}

export function useAvailableTools() {
  const auth = useApiAuth();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['available-tools', workspaceId],
    queryFn: async () => {
      const a = await auth.getAuth();
      if (!a) throw new Error('not_ready');
      return listAvailableTools(a);
    },
    enabled: auth.ready,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Review Queue ─────────────────────────────────────────────────────────────

export function useReviewQueue(opts?: { status?: string; priority?: string }) {
  const auth = useApiAuth();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['review-queue', workspaceId, opts],
    queryFn: async () => {
      const a = await auth.getAuth();
      if (!a) throw new Error('not_ready');
      return listReviewQueue(a, opts);
    },
    enabled: auth.ready,
    refetchInterval: 30000,
    placeholderData: (prev) => prev,
  });
}

export function useReviewQueueStats() {
  const auth = useApiAuth();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['review-queue-stats', workspaceId],
    queryFn: async () => {
      const a = await auth.getAuth();
      if (!a) throw new Error('not_ready');
      return getReviewQueueStats(a);
    },
    enabled: auth.ready,
    refetchInterval: 30000,
    placeholderData: (prev) => prev,
  });
}

export function useSubmitReview() {
  const getAuth = useApiAuthOrThrow();
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
  const auth = useApiAuth();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['workflows', workspaceId],
    queryFn: async () => {
      const a = await auth.getAuth();
      if (!a) throw new Error('not_ready');
      return listWorkflows(a);
    },
    enabled: auth.ready,
    placeholderData: (prev) => prev,
  });
}

export function useWorkflow(workflowId: string) {
  const auth = useApiAuth();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['workflow', workspaceId, workflowId],
    queryFn: async () => {
      const a = await auth.getAuth();
      if (!a) throw new Error('not_ready');
      return getWorkflow(a, workflowId);
    },
    enabled: auth.ready && !!workflowId,
    placeholderData: (prev) => prev,
  });
}

export function useCreateWorkflow() {
  const getAuth = useApiAuthOrThrow();
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
  const getAuth = useApiAuthOrThrow();
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
  const getAuth = useApiAuthOrThrow();
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

export type { TriggerAgentRunStreamingOptions };
