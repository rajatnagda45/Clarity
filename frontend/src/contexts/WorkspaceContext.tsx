'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@clerk/nextjs';

import { getMe } from '@/lib/api';
import type { Workspace } from '@/types/clarity';

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isLoading: boolean;
  error: string | null;
  setActiveWorkspace: (workspace: Workspace) => void;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const STORAGE_KEY = 'clarity:active-workspace-id';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const load = useCallback(async () => {
    if (!isSignedIn) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getMe({ token });
      setWorkspaces(data.workspaces);

      // Restore last active workspace from localStorage
      const storedId =
        typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      const restored = storedId
        ? data.workspaces.find((w) => w.id === storedId) ?? null
        : null;
      setActiveWorkspaceState(restored ?? data.workspaces[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspaces.');
    } finally {
      setIsLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (isSignedIn && !hasFetched.current) {
      hasFetched.current = true;
      void load();
    }
  }, [isSignedIn, load]);

  const setActiveWorkspace = useCallback((workspace: Workspace) => {
    setActiveWorkspaceState(workspace);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, workspace.id);
    }
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        isLoading,
        error,
        setActiveWorkspace,
        refresh: load,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}
