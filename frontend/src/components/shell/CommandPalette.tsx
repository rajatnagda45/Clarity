'use client';

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useUI } from '@/contexts/UIContext';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useUI();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  // Reset state on open
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [commandPaletteOpen]);

  // Lock scroll
  useEffect(() => {
    if (!commandPaletteOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [commandPaletteOpen]);

  function close() {
    setCommandPaletteOpen(false);
  }

  function navigate(href: string) {
    router.push(href);
    close();
  }

  const allCommands: CommandItem[] = [
    {
      id: 'nav-dashboard',
      label: 'Go to Dashboard',
      icon: <NavIcon />,
      action: () => navigate('/dashboard'),
      keywords: ['home', 'overview'],
    },
    {
      id: 'nav-documents',
      label: 'Go to Documents',
      icon: <NavIcon />,
      action: () => navigate('/documents'),
      keywords: ['files', 'contracts'],
    },
    {
      id: 'nav-conversations',
      label: 'Go to Conversations',
      icon: <NavIcon />,
      action: () => navigate('/conversations'),
      keywords: ['chat', 'questions'],
    },
    {
      id: 'nav-contradictions',
      label: 'Go to Contradictions',
      icon: <NavIcon />,
      action: () => navigate('/contradictions'),
      keywords: ['conflicts', 'graph'],
    },
    {
      id: 'nav-eval',
      label: 'Go to Eval Dashboard',
      icon: <NavIcon />,
      action: () => navigate('/eval'),
      keywords: ['metrics', 'quality'],
    },
    {
      id: 'nav-settings',
      label: 'Go to Settings',
      icon: <NavIcon />,
      action: () => navigate('/settings'),
      keywords: ['preferences', 'account'],
    },
  ];

  const filtered = query.trim()
    ? allCommands.filter((cmd) => {
        const q = query.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(q) ||
          cmd.description?.toLowerCase().includes(q) ||
          cmd.keywords?.some((k) => k.includes(q))
        );
      })
    : allCommands;

  // Clamp activeIdx
  const safeIdx = Math.min(activeIdx, Math.max(0, filtered.length - 1));

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[safeIdx]?.action();
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const li = listRef.current?.children[safeIdx] as HTMLElement | undefined;
    li?.scrollIntoView({ block: 'nearest' });
  }, [safeIdx]);

  if (!mounted || !commandPaletteOpen) return null;

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-[1100] flex items-start justify-center pt-[15vh] px-4"
      onKeyDown={handleKeyDown}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[var(--color-bg-overlay)] animate-fade-in"
        onClick={close}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className={cn(
          'relative z-10 w-full max-w-[560px]',
          'flex flex-col rounded-2xl overflow-hidden',
          'bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] shadow-xl',
          'animate-slide-up',
        )}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-[var(--color-border-subtle)] px-4 py-3">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="shrink-0 text-[var(--color-text-tertiary)]"
            aria-hidden="true"
          >
            <path d="M6.5 1a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zm0 1a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm4.854 7.646 3 3-.707.708-3-3 .707-.708z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={filtered.length > 0}
            aria-autocomplete="list"
            aria-controls="cp-list"
            aria-activedescendant={filtered[safeIdx] ? `cp-item-${filtered[safeIdx].id}` : undefined}
            placeholder="Search or jump to…"
            value={query}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            className={cn(
              'flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]',
              'focus:outline-none',
            )}
          />
          <kbd className="shrink-0 rounded bg-[var(--color-bg-elevated)] px-1.5 py-0.5 text-2xs text-[var(--color-text-tertiary)]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <ul
          id="cp-list"
          ref={listRef}
          role="listbox"
          aria-label="Commands"
          className="max-h-[360px] overflow-y-auto py-2"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-[var(--color-text-tertiary)]">
              No results for &ldquo;{query}&rdquo;
            </li>
          ) : (
            filtered.map((cmd, i) => (
              <li
                key={cmd.id}
                id={`cp-item-${cmd.id}`}
                role="option"
                aria-selected={i === safeIdx}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => cmd.action()}
                className={cn(
                  'flex cursor-pointer items-center gap-3 px-4 py-2.5',
                  'transition-colors duration-fast',
                  i === safeIdx
                    ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                    : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]',
                )}
              >
                {cmd.icon && (
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                      i === safeIdx
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]',
                    )}
                    aria-hidden="true"
                  >
                    {cmd.icon}
                  </span>
                )}
                <div className="flex flex-1 flex-col min-w-0">
                  <span className="text-sm font-medium truncate">{cmd.label}</span>
                  {cmd.description && (
                    <span className="text-xs text-[var(--color-text-tertiary)] truncate">
                      {cmd.description}
                    </span>
                  )}
                </div>
                {i === safeIdx && (
                  <kbd
                    aria-hidden="true"
                    className="shrink-0 rounded bg-[var(--color-bg-surface)] px-1.5 py-0.5 text-2xs text-[var(--color-text-tertiary)]"
                  >
                    ↵
                  </kbd>
                )}
              </li>
            ))
          )}
        </ul>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-[var(--color-border-subtle)] px-4 py-2">
          <span className="flex items-center gap-1 text-2xs text-[var(--color-text-tertiary)]">
            <kbd className="rounded bg-[var(--color-bg-elevated)] px-1 py-0.5">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1 text-2xs text-[var(--color-text-tertiary)]">
            <kbd className="rounded bg-[var(--color-bg-elevated)] px-1 py-0.5">↵</kbd>
            select
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function NavIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M2 2h3v3H2V2zm5 0h3v3H7V2zM2 7h3v3H2V7zm5 0h3v3H7V7z" />
    </svg>
  );
}
