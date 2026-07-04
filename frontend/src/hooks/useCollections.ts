import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  listCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  addDocumentToCollection,
  removeDocumentFromCollection,
} from '@/lib/api';
import type { CreateCollectionPayload, UpdateCollectionPayload } from '@/types/clarity';

export function useCollections() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;

  return useQuery({
    queryKey: ['collections', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const token = await getToken();
      if (!token || !workspaceId) throw new Error('Not authenticated');
      const res = await listCollections({ token, workspaceId });
      return res;
    },
    staleTime: 30_000,
  });
}

export function useCreateCollection() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateCollectionPayload) => {
      const token = await getToken();
      const workspaceId = activeWorkspace?.id;
      if (!token || !workspaceId) throw new Error('Not authenticated');
      return createCollection({ token, workspaceId }, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['collections', activeWorkspace?.id] });
    },
  });
}

export function useUpdateCollection() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ collectionId, payload }: { collectionId: string; payload: UpdateCollectionPayload }) => {
      const token = await getToken();
      const workspaceId = activeWorkspace?.id;
      if (!token || !workspaceId) throw new Error('Not authenticated');
      return updateCollection({ token, workspaceId }, collectionId, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['collections', activeWorkspace?.id] });
    },
  });
}

export function useDeleteCollection() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (collectionId: string) => {
      const token = await getToken();
      const workspaceId = activeWorkspace?.id;
      if (!token || !workspaceId) throw new Error('Not authenticated');
      return deleteCollection({ token, workspaceId }, collectionId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['collections', activeWorkspace?.id] });
    },
  });
}

export function useAddDocumentToCollection() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ collectionId, documentId }: { collectionId: string; documentId: string }) => {
      const token = await getToken();
      const workspaceId = activeWorkspace?.id;
      if (!token || !workspaceId) throw new Error('Not authenticated');
      return addDocumentToCollection({ token, workspaceId }, collectionId, documentId);
    },
    onSuccess: (_data, { collectionId }) => {
      void qc.invalidateQueries({ queryKey: ['collections', activeWorkspace?.id] });
      void qc.invalidateQueries({ queryKey: ['collection', collectionId] });
    },
  });
}

export function useRemoveDocumentFromCollection() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ collectionId, documentId }: { collectionId: string; documentId: string }) => {
      const token = await getToken();
      const workspaceId = activeWorkspace?.id;
      if (!token || !workspaceId) throw new Error('Not authenticated');
      return removeDocumentFromCollection({ token, workspaceId }, collectionId, documentId);
    },
    onSuccess: (_data, { collectionId }) => {
      void qc.invalidateQueries({ queryKey: ['collections', activeWorkspace?.id] });
      void qc.invalidateQueries({ queryKey: ['collection', collectionId] });
    },
  });
}
