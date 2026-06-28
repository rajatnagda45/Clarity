'use client';

import Link from 'next/link';
import { useAuth, useUser } from '@clerk/nextjs';
import { useEffect, useMemo, useState } from 'react';

import { createWorkspace, getMe } from '@/lib/api';
import type { Workspace } from '@/types/clarity';


type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

function workspaceHref(path: string, workspaceId: string): string {
  return `${path}?workspace=${workspaceId}`;
}

export function WorkspaceDashboard() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadState('loading');
      setErrorMessage('');

      try {
        const token = await getToken();
        if (!token) {
          throw new Error('Clerk session token unavailable.');
        }

        const data = await getMe({ token });
        if (cancelled) return;

        setWorkspaces(data.workspaces);
        setSelectedWorkspaceId(data.workspaces[0]?.id ?? '');
        setLoadState('loaded');
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load workspaces.');
        setLoadState('error');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null,
    [workspaces, selectedWorkspaceId],
  );

  async function handleCreateWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = workspaceName.trim();
    if (!trimmedName) return;

    setIsCreating(true);
    setErrorMessage('');

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Clerk session token unavailable.');
      }

      const workspace = await createWorkspace(
        { token, workspaceId: selectedWorkspaceId || undefined },
        { name: trimmedName },
      );

      setWorkspaces((current) => [...current, workspace]);
      setSelectedWorkspaceId(workspace.id);
      setWorkspaceName('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create workspace.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">Phase A1</p>
        <h1 className="text-4xl font-semibold text-slate-900">
          Welcome back{user?.firstName ? `, ${user.firstName}` : ''}.
        </h1>
        <p className="max-w-2xl text-base text-slate-600">
          This milestone locks in authenticated routing and workspace access before document
          ingestion and chat land in later Phase A milestones.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Your workspaces</h2>
              <p className="mt-1 text-sm text-slate-500">
                Workspace membership is loaded from the backend using your Clerk session.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {workspaces.length} total
            </span>
          </div>

          <div className="mt-6">
            {loadState === 'loading' ? (
              <p className="text-sm text-slate-500">Loading workspace access…</p>
            ) : null}

            {loadState === 'error' ? (
              <p className="text-sm text-red-600">{errorMessage}</p>
            ) : null}

            {loadState === 'loaded' && workspaces.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
                <p className="text-sm text-slate-600">
                  No workspaces yet. Create your first workspace to unlock documents and chat.
                </p>
              </div>
            ) : null}

            <div className="mt-3 grid gap-3">
              {workspaces.map((workspace) => {
                const isSelected = workspace.id === selectedWorkspaceId;
                return (
                  <button
                    key={workspace.id}
                    type="button"
                    onClick={() => setSelectedWorkspaceId(workspace.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-medium text-slate-900">{workspace.name}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {workspace.role} • {workspace.plan}
                        </p>
                      </div>
                      {isSelected ? (
                        <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                          Active
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Create a workspace</h2>
          <p className="mt-1 text-sm text-slate-500">
            A workspace is the tenant boundary for documents, vectors, and conversations.
          </p>

          <form className="mt-6 flex flex-col gap-4" onSubmit={handleCreateWorkspace}>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Workspace name
              <input
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                placeholder="Acme Legal"
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
              />
            </label>

            <button
              type="submit"
              disabled={isCreating || workspaceName.trim().length === 0}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isCreating ? 'Creating workspace…' : 'Create workspace'}
            </button>
          </form>

          {errorMessage && loadState !== 'error' ? (
            <p className="mt-4 text-sm text-red-600">{errorMessage}</p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
          <p className="mt-2 text-sm text-slate-600">
            Upload and ingestion land in Milestone A2. The protected route and workspace routing
            are ready now.
          </p>
          <Link
            href={selectedWorkspace ? workspaceHref('/documents', selectedWorkspace.id) : '/documents'}
            className="mt-4 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Open documents module
          </Link>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Chat</h2>
          <p className="mt-2 text-sm text-slate-600">
            Streaming question answering lands in Milestone A6. This route now shares the same
            workspace-aware shell as the rest of the app.
          </p>
          <Link
            href={selectedWorkspace ? workspaceHref('/chat', selectedWorkspace.id) : '/chat'}
            className="mt-4 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Open chat module
          </Link>
        </div>
      </section>

      {selectedWorkspace ? (
        <section className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-300">Active workspace</p>
          <h2 className="mt-2 text-2xl font-semibold">{selectedWorkspace.name}</h2>
          <p className="mt-2 text-sm text-slate-300">
            Workspace ID: <span className="font-mono">{selectedWorkspace.id}</span>
          </p>
        </section>
      ) : null}
    </div>
  );
}
