'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  getWorkspaceMembers,
  addWorkspaceMember,
  updateMemberRole,
  removeWorkspaceMember,
} from '@/lib/api';

function useMembersAuth() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  return { getToken, activeWorkspace };
}

export function useWorkspaceMembers() {
  const { getToken, activeWorkspace } = useMembersAuth();

  return useQuery({
    queryKey: ['workspace-members', activeWorkspace?.id],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return getWorkspaceMembers({ token, workspaceId: activeWorkspace!.id }, activeWorkspace!.id);
    },
    enabled: !!activeWorkspace,
  });
}

export function useAddMember() {
  const { getToken, activeWorkspace } = useMembersAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return addWorkspaceMember({ token, workspaceId: activeWorkspace!.id }, activeWorkspace!.id, userId, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members', activeWorkspace?.id] });
    },
  });
}

export function useUpdateMemberRole() {
  const { getToken, activeWorkspace } = useMembersAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return updateMemberRole({ token, workspaceId: activeWorkspace!.id }, activeWorkspace!.id, userId, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members', activeWorkspace?.id] });
    },
  });
}

export function useRemoveMember() {
  const { getToken, activeWorkspace } = useMembersAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return removeWorkspaceMember({ token, workspaceId: activeWorkspace!.id }, activeWorkspace!.id, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members', activeWorkspace?.id] });
    },
  });
}
