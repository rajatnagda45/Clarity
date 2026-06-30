'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ds/Button';
import { Badge } from '@/components/ds/Badge';
import { Dialog, DialogFooter } from '@/components/ds/Dialog';
import { Input } from '@/components/ds/Input';
import { createWorkspace } from '@/lib/api';

const PALETTE = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
];

function wsColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export default function WorkspaceSettingsPage() {
  const { activeWorkspace, workspaces, setActiveWorkspace, refresh } = useWorkspace();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No token');
      const ws = await createWorkspace({ token }, { name: newName.trim() });
      setActiveWorkspace(ws);
      await refresh();
      toast.success(`Workspace "${ws.name}" created`);
      setCreateOpen(false);
      setNewName('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setCreating(false);
    }
  }

  function copyId() {
    if (!activeWorkspace) return;
    void navigator.clipboard.writeText(activeWorkspace.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
      <div className="mx-auto w-full max-w-2xl px-6 py-8 flex flex-col gap-8">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Workspace settings</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Manage your workspaces — each workspace is a separate tenant with isolated documents, vectors, and conversations.
          </p>
        </div>

        {/* Workspace list */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Your workspaces</h2>
            <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              New workspace
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            {workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspace?.id;
              return (
                <div
                  key={ws.id}
                  className={`flex items-center gap-4 rounded-2xl border p-4 transition-colors ${
                    isActive
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)]'
                      : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] hover:border-[var(--color-border-default)]'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                    style={{ backgroundColor: wsColor(ws.name) }}
                  >
                    {ws.name[0]?.toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">{ws.name}</span>
                      {isActive && (
                        <Badge variant="info" size="sm">Active</Badge>
                      )}
                    </div>
                    <span className="text-xs text-[var(--color-text-tertiary)] capitalize">
                      {ws.role} · {ws.plan} plan
                    </span>
                    <span className="mt-0.5 font-mono text-xs text-[var(--color-text-disabled)]">
                      {ws.id}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <button
                        type="button"
                        onClick={copyId}
                        className="flex h-7 items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] px-2.5 text-xs font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-border-default)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                      >
                        {copied ? '✓ Copied' : 'Copy ID'}
                      </button>
                    )}
                    {!isActive && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setActiveWorkspace(ws)}
                      >
                        Switch
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Create workspace dialog */}
        <Dialog
          open={createOpen}
          onClose={() => { setCreateOpen(false); setNewName(''); }}
          title="Create workspace"
          description="A workspace is a tenant boundary for documents, vectors, and conversations."
          size="sm"
        >
          <Input
            label="Workspace name"
            placeholder="Acme Legal"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setCreateOpen(false); setNewName(''); }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreate}
              loading={creating}
              disabled={!newName.trim()}
            >
              Create workspace
            </Button>
          </DialogFooter>
        </Dialog>
      </div>
  );
}
