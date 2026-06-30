'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ds/Badge';
import { Dialog, DialogFooter } from '@/components/ds/Dialog';
import { Button } from '@/components/ds/Button';
import { Input } from '@/components/ds/Input';
import { Tooltip } from '@/components/ds/Tooltip';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { createWorkspace } from '@/lib/api';
import type { DashboardData } from './useDashboardData';

interface WorkspaceOverviewProps {
  data: DashboardData;
  loading?: boolean;
}

function planVariant(plan: string): React.ComponentProps<typeof Badge>['variant'] {
  if (plan === 'team') return 'success';
  if (plan === 'pro') return 'info';
  return 'default';
}

export function WorkspaceOverview({ data, loading = false }: WorkspaceOverviewProps) {
  const { activeWorkspace, workspaces, setActiveWorkspace, refresh } = useWorkspace();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const docCount = data.documents.length;
  const convCount = data.conversations.length;
  const indexed = data.devDashboard?.statusCounts['indexed'] ?? 0;
  const failed = data.devDashboard?.failedJobs?.length ?? 0;

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

  if (!activeWorkspace) return null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: wsColor(activeWorkspace.name) }}
          >
            {activeWorkspace.name[0]?.toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {activeWorkspace.name}
            </h3>
            <div className="mt-0.5 flex items-center gap-1.5">
              <Badge variant={planVariant(activeWorkspace.plan)} size="sm">
                {activeWorkspace.plan}
              </Badge>
              <span className="text-xs capitalize text-[var(--color-text-tertiary)]">
                {activeWorkspace.role}
              </span>
            </div>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setCreateOpen(true)}
        >
          New workspace
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { label: 'Documents', value: docCount, icon: '📄' },
          { label: 'Conversations', value: convCount, icon: '💬' },
          { label: 'Indexed', value: indexed, icon: '🗄️' },
          { label: 'Failed', value: failed, accent: failed > 0, icon: '⚠️' },
        ].map((stat) => (
          <div
            key={stat.label}
            className={cn(
              'flex flex-col gap-1 rounded-xl p-3',
              stat.accent ? 'bg-[var(--color-error-subtle)]' : 'bg-[var(--color-bg-elevated)]',
            )}
          >
            <span
              className={cn(
                'text-lg font-semibold tabular-nums',
                stat.accent
                  ? 'text-[var(--color-error-fg)]'
                  : 'text-[var(--color-text-primary)]',
              )}
            >
              {loading ? '—' : stat.value}
            </span>
            <span className="text-xs text-[var(--color-text-tertiary)]">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Workspace ID */}
      <div className="flex items-center gap-2 rounded-xl bg-[var(--color-bg-elevated)] px-3 py-2">
        <span className="flex-1 truncate font-mono text-xs text-[var(--color-text-tertiary)]">
          {activeWorkspace.id}
        </span>
        <Tooltip content={copied ? 'Copied!' : 'Copy workspace ID'} side="top">
          <button
            type="button"
            onClick={copyId}
            aria-label="Copy workspace ID"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        </Tooltip>
      </div>

      {/* Other workspaces */}
      {workspaces.length > 1 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-[var(--color-text-tertiary)]">Switch workspace</p>
          <div className="flex flex-wrap gap-1.5">
            {workspaces
              .filter((ws) => ws.id !== activeWorkspace.id)
              .map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => setActiveWorkspace(ws)}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-border-default)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                >
                  <span
                    className="h-3.5 w-3.5 rounded-sm text-[8px] font-bold text-white flex items-center justify-center"
                    style={{ backgroundColor: wsColor(ws.name) }}
                  >
                    {ws.name[0]?.toUpperCase()}
                  </span>
                  {ws.name}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Create workspace dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create workspace"
        description="A workspace is the tenant boundary for documents, vectors, and conversations."
        size="sm"
      >
        <Input
          label="Workspace name"
          placeholder="Acme Legal"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreate}
            loading={creating}
            disabled={!newName.trim()}
          >
            Create
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

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

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M4 1h6a1 1 0 0 1 1 1v6H4V1zm-1 3H1a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V9H3V4z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
