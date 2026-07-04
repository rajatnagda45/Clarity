'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  listBenchmarkDatasets,
  getBenchmarkDataset,
  createBenchmarkDataset,
  deleteBenchmarkDataset,
  listBenchmarkCases,
  addBenchmarkCase,
  importBenchmarkCases,
  triggerBenchmarkRun,
  listDatasetRuns,
  listBenchmarkRuns,
  getBenchmarkRun,
} from '@/lib/api';
import type { CreateBenchmarkDatasetPayload, CreateBenchmarkCasePayload } from '@/types/clarity';

function useAuthContext() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return async () => {
    const token = await getToken();
    return { token: token ?? '', workspaceId: workspaceId ?? undefined };
  };
}

export function useBenchmarkDatasets() {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['benchmark-datasets', workspaceId],
    queryFn: async () => {
      const auth = await getAuth();
      return listBenchmarkDatasets(auth);
    },
    enabled: !!workspaceId,
  });
}

export function useBenchmarkDataset(datasetId: string) {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['benchmark-dataset', workspaceId, datasetId],
    queryFn: async () => {
      const auth = await getAuth();
      return getBenchmarkDataset(auth, datasetId);
    },
    enabled: !!workspaceId && !!datasetId,
  });
}

export function useCreateBenchmarkDataset() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (payload: CreateBenchmarkDatasetPayload) => {
      const auth = await getAuth();
      return createBenchmarkDataset(auth, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['benchmark-datasets', workspaceId] });
    },
  });
}

export function useDeleteBenchmarkDataset() {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (datasetId: string) => {
      const auth = await getAuth();
      return deleteBenchmarkDataset(auth, datasetId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['benchmark-datasets', workspaceId] });
    },
  });
}

export function useBenchmarkCases(datasetId: string) {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['benchmark-cases', workspaceId, datasetId],
    queryFn: async () => {
      const auth = await getAuth();
      return listBenchmarkCases(auth, datasetId);
    },
    enabled: !!workspaceId && !!datasetId,
  });
}

export function useAddBenchmarkCase(datasetId: string) {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (payload: CreateBenchmarkCasePayload) => {
      const auth = await getAuth();
      return addBenchmarkCase(auth, datasetId, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['benchmark-cases', workspaceId, datasetId] });
      void qc.invalidateQueries({ queryKey: ['benchmark-dataset', workspaceId, datasetId] });
    },
  });
}

export function useImportBenchmarkCases(datasetId: string) {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async (file: File) => {
      const auth = await getAuth();
      return importBenchmarkCases(auth, datasetId, file);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['benchmark-cases', workspaceId, datasetId] });
      void qc.invalidateQueries({ queryKey: ['benchmark-dataset', workspaceId, datasetId] });
    },
  });
}

export function useTriggerBenchmarkRun(datasetId: string) {
  const getAuth = useAuthContext();
  const qc = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useMutation({
    mutationFn: async () => {
      const auth = await getAuth();
      return triggerBenchmarkRun(auth, datasetId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dataset-runs', workspaceId, datasetId] });
      void qc.invalidateQueries({ queryKey: ['benchmark-runs', workspaceId] });
    },
  });
}

export function useDatasetRuns(datasetId: string, polling = false) {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['dataset-runs', workspaceId, datasetId],
    queryFn: async () => {
      const auth = await getAuth();
      return listDatasetRuns(auth, datasetId);
    },
    enabled: !!workspaceId && !!datasetId,
    refetchInterval: polling ? 3000 : false,
  });
}

export function useBenchmarkRuns() {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['benchmark-runs', workspaceId],
    queryFn: async () => {
      const auth = await getAuth();
      return listBenchmarkRuns(auth);
    },
    enabled: !!workspaceId,
  });
}

export function useBenchmarkRun(runId: string) {
  const getAuth = useAuthContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  return useQuery({
    queryKey: ['benchmark-run', workspaceId, runId],
    queryFn: async () => {
      const auth = await getAuth();
      return getBenchmarkRun(auth, runId);
    },
    enabled: !!workspaceId && !!runId,
  });
}
