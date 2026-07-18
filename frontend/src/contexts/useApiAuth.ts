'use client';

/**
 * useApiAuth — single source of truth for the per-request auth context.
 *
 * Replaces the ad-hoc `useAuthContext` in `useAgents.ts` and similar hooks.
 * Returns:
 *   - `ready: true`  when both Clerk + workspace context are loaded
 *   - `ready: false` while Clerk is still loading or before a workspace is selected
 *
 * Components should gate every mutation on `ready === true` so the
 * "Failed to X" generic toast never appears for an auth-not-ready state.
 *
 * Usage:
 *   const { ready, getAuth, error } = useApiAuth();
 *   useMutation({ mutationFn: async (input) => { const auth = await getAuth(); ... } });
 */
import { useCallback, useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { AuthContext } from '@/lib/api';

export type ApiAuthState =
  | { ready: true; getAuth: () => Promise<AuthContext> }
  | { ready: false; getAuth: () => Promise<AuthContext | null>; error: string | null };

export function useApiAuth(): ApiAuthState {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { activeWorkspace, isLoading: isLoadingWorkspace } = useWorkspace();
  const [error, setError] = useState<string | null>(null);

  // Reset error when auth state changes
  useEffect(() => {
    if (isLoaded && isSignedIn && activeWorkspace) {
      setError(null);
    } else if (isLoaded && !isSignedIn) {
      setError('not_signed_in');
    } else if (isLoaded && isSignedIn && !activeWorkspace && !isLoadingWorkspace) {
      setError('no_workspace');
    }
  }, [isLoaded, isSignedIn, activeWorkspace, isLoadingWorkspace]);

  const getAuth = useCallback(async (): Promise<AuthContext | null> => {
    if (!isLoaded) return null;
    if (!isSignedIn) {
      setError('not_signed_in');
      return null;
    }
    const token = await getToken();
    if (!token) {
      setError('no_token');
      return null;
    }
    if (!activeWorkspace?.id) {
      setError('no_workspace');
      return null;
    }
    setError(null);
    return { token, workspaceId: activeWorkspace.id };
  }, [isLoaded, isSignedIn, getToken, activeWorkspace?.id]);

  const ready = Boolean(isLoaded && isSignedIn && activeWorkspace?.id);
  if (ready) {
    return {
      ready: true,
      getAuth: getAuth as () => Promise<AuthContext>,
    };
  }
  return {
    ready: false,
    getAuth,
    error,
  };
}

/**
 * useApiAuthOrThrow — never returns null. Throws an Error if not ready.
 * Useful inside `useMutation` where the user must be ready to mutate.
 */
export function useApiAuthOrThrow(): () => Promise<AuthContext> {
  const state = useApiAuth();
  if (!state.ready) {
    return async () => {
      throw new Error(
        state.error === 'not_signed_in'
          ? 'You must be signed in.'
          : state.error === 'no_token'
            ? 'Authentication token unavailable.'
            : state.error === 'no_workspace'
              ? 'Select a workspace first.'
              : 'Loading authentication…',
      );
    };
  }
  return state.getAuth;
}
