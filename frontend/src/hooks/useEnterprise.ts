'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  listApiKeys, createApiKey, revokeApiKey,
  listWebhooks, createWebhook, toggleWebhook, deleteWebhook, listWebhookDeliveries,
  listAuditLogs,
  listIntegrations, disconnectIntegration,
  listAutomationRules, createAutomationRule, toggleAutomationRule, deleteAutomationRule,
  listPromptLibrary, createPromptEntry, updatePromptEntry, deletePromptEntry,
} from '@/lib/api';
import type {
  CreateApiKeyPayload,
  CreateWebhookPayload,
  AuditLogFilters,
  CreateAutomationRulePayload,
  CreatePromptPayload,
  UpdatePromptPayload,
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

// ─── API Keys ─────────────────────────────────────────────────────────────────

export function useApiKeys() {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['api-keys', workspaceId],
    queryFn: async () => {
      const auth = await getAuth();
      return listApiKeys(auth);
    },
    enabled: !!workspaceId,
  });
}

export function useCreateApiKey() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (payload: CreateApiKeyPayload) => {
      const auth = await getAuth();
      return createApiKey(auth, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['api-keys', workspaceId] });
    },
  });
}

export function useRevokeApiKey() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (keyId: string) => {
      const auth = await getAuth();
      return revokeApiKey(auth, keyId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['api-keys', workspaceId] });
    },
  });
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export function useWebhooks() {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['webhooks', workspaceId],
    queryFn: async () => {
      const auth = await getAuth();
      return listWebhooks(auth);
    },
    enabled: !!workspaceId,
  });
}

export function useCreateWebhook() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (payload: CreateWebhookPayload) => {
      const auth = await getAuth();
      return createWebhook(auth, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['webhooks', workspaceId] });
    },
  });
}

export function useToggleWebhook() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (webhookId: string) => {
      const auth = await getAuth();
      return toggleWebhook(auth, webhookId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['webhooks', workspaceId] });
    },
  });
}

export function useDeleteWebhook() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (webhookId: string) => {
      const auth = await getAuth();
      return deleteWebhook(auth, webhookId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['webhooks', workspaceId] });
    },
  });
}

export function useWebhookDeliveries(webhookId: string) {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['webhook-deliveries', workspaceId, webhookId],
    queryFn: async () => {
      const auth = await getAuth();
      return listWebhookDeliveries(auth, webhookId);
    },
    enabled: !!workspaceId && !!webhookId,
  });
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export function useAuditLogs(filters?: AuditLogFilters) {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['audit-logs', workspaceId, filters],
    queryFn: async () => {
      const auth = await getAuth();
      return listAuditLogs(auth, filters);
    },
    enabled: !!workspaceId,
  });
}

// ─── Integrations ─────────────────────────────────────────────────────────────

export function useIntegrations() {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['integrations', workspaceId],
    queryFn: async () => {
      const auth = await getAuth();
      return listIntegrations(auth);
    },
    enabled: !!workspaceId,
  });
}

export function useDisconnectIntegration() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (provider: string) => {
      const auth = await getAuth();
      return disconnectIntegration(auth, provider);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['integrations', workspaceId] });
    },
  });
}

// ─── Automation Rules ─────────────────────────────────────────────────────────

export function useAutomationRules() {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['automation-rules', workspaceId],
    queryFn: async () => {
      const auth = await getAuth();
      return listAutomationRules(auth);
    },
    enabled: !!workspaceId,
  });
}

export function useCreateAutomationRule() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (payload: CreateAutomationRulePayload) => {
      const auth = await getAuth();
      return createAutomationRule(auth, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['automation-rules', workspaceId] });
    },
  });
}

export function useToggleAutomationRule() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const auth = await getAuth();
      return toggleAutomationRule(auth, ruleId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['automation-rules', workspaceId] });
    },
  });
}

export function useDeleteAutomationRule() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const auth = await getAuth();
      return deleteAutomationRule(auth, ruleId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['automation-rules', workspaceId] });
    },
  });
}

// ─── Prompt Library ───────────────────────────────────────────────────────────

export function usePromptLibrary(opts?: { category?: string; favoritesOnly?: boolean }) {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['prompt-library', workspaceId, opts],
    queryFn: async () => {
      const auth = await getAuth();
      return listPromptLibrary(auth, opts);
    },
    enabled: !!workspaceId,
  });
}

export function useCreatePromptEntry() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (payload: CreatePromptPayload) => {
      const auth = await getAuth();
      return createPromptEntry(auth, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['prompt-library', workspaceId] });
    },
  });
}

export function useUpdatePromptEntry() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async ({ promptId, payload }: { promptId: string; payload: UpdatePromptPayload }) => {
      const auth = await getAuth();
      return updatePromptEntry(auth, promptId, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['prompt-library', workspaceId] });
    },
  });
}

export function useDeletePromptEntry() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (promptId: string) => {
      const auth = await getAuth();
      return deletePromptEntry(auth, promptId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['prompt-library', workspaceId] });
    },
  });
}
