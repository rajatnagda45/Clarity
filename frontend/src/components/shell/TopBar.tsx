'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useUI } from '@/contexts/UIContext';
import { ThemeSwitcher } from './ThemeSwitcher';
import { NotificationBell } from './NotificationBell';

interface TopBarProps {
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function TopBar({ breadcrumbs, actions, className }: TopBarProps) {
  const { setSidebarOpen, sidebarOpen } = useUI();

  return (
    <header
      className={cn(
        'sticky top-0 z-[100] flex h-[var(--topbar-height)] items-center gap-3 px-4',
        'bg-[var(--color-bg-app)] border-b border-[var(--color-border-subtle)]',
        className,
      )}
    >
      {/* Mobile hamburger */}
      <button
        type="button"
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        aria-expanded={sidebarOpen}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg md:hidden',
          'text-[var(--color-text-secondary)] transition-colors duration-fast',
          'hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
        )}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M2 4h12v1.5H2V4zm0 3.25h12v1.5H2v-1.5zM2 10.5h12V12H2v-1.5z" />
        </svg>
      </button>

      {/* Breadcrumbs / title slot */}
      <div className="flex flex-1 items-center overflow-hidden">
        {breadcrumbs}
      </div>

      {/* Right actions */}
      <div className="flex shrink-0 items-center gap-1">
        {/* Command palette hint */}
        <CommandPaletteButton />
        <ThemeSwitcher />
        <NotificationBell />
        {actions}
      </div>
    </header>
  );
}

function CommandPaletteButton() {
  const { setCommandPaletteOpen } = useUI();

  return (
    <button
      type="button"
      aria-label="Open command palette (⌘K)"
      onClick={() => setCommandPaletteOpen(true)}
      className={cn(
        'hidden md:flex items-center gap-2 rounded-lg px-2.5 h-8',
        'text-xs text-[var(--color-text-tertiary)]',
        'border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]',
        'transition-colors duration-fast hover:border-[var(--color-border-default)] hover:text-[var(--color-text-secondary)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
      )}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
        <path d="M5 1a4 4 0 1 1 0 8A4 4 0 0 1 5 1zm0 1a3 3 0 1 0 0 6A3 3 0 0 0 5 2zm3.9 6.5 2.1 2.1-.7.7L8.2 9.2l.7-.7z" />
      </svg>
      <span>Search…</span>
      <kbd className="rounded bg-[var(--color-bg-surface)] px-1 py-0.5 text-2xs">⌘K</kbd>
    </button>
  );
}
