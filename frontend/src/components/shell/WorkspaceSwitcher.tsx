'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Spinner } from '@/components/ds/Spinner';

export function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, isLoading, setActiveWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-8 w-full items-center gap-2 rounded-lg px-2">
        <Spinner size="xs" />
        <span className="text-sm text-[var(--color-text-tertiary)]">Loading…</span>
      </div>
    );
  }

  if (!activeWorkspace) return null;

  return (
    <div className="relative w-full">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Workspace: ${activeWorkspace.name}`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left',
          'transition-colors duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
          'hover:bg-[var(--color-bg-hover)]',
        )}
      >
        {/* Workspace icon */}
        <span
          aria-hidden="true"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-bold text-white"
          style={{ backgroundColor: workspaceColor(activeWorkspace.name) }}
        >
          {activeWorkspace.name[0]?.toUpperCase()}
        </span>

        <span className="flex-1 truncate text-sm font-medium text-[var(--color-text-primary)]">
          {activeWorkspace.name}
        </span>

        {/* Chevron */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="currentColor"
          className={cn(
            'shrink-0 text-[var(--color-text-tertiary)] transition-transform duration-fast',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && workspaces.length > 1 && (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 z-[299]"
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            aria-label="Select workspace"
            className={cn(
              'absolute left-0 top-full z-[300] mt-1 w-full',
              'rounded-xl border border-[var(--color-border-default)]',
              'bg-[var(--color-bg-surface)] shadow-lg',
              'flex flex-col py-1 animate-slide-up',
            )}
          >
            {workspaces.map((ws) => (
              <li key={ws.id} role="option" aria-selected={ws.id === activeWorkspace.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveWorkspace(ws);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-2 py-1.5 text-sm',
                    'transition-colors duration-fast',
                    'focus-visible:outline-none',
                    ws.id === activeWorkspace.id
                      ? 'text-[var(--color-accent)]'
                      : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]',
                  )}
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-bold text-white"
                    style={{ backgroundColor: workspaceColor(ws.name) }}
                  >
                    {ws.name[0]?.toUpperCase()}
                  </span>
                  <span className="flex-1 truncate">{ws.name}</span>
                  {ws.id === activeWorkspace.id && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

const PALETTE = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
];

function workspaceColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
