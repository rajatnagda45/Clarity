'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';

interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  accent: string;
  accentBg: string;
}

const ACTIONS: QuickAction[] = [
  {
    label: 'Upload Contract',
    description: 'Add a new PDF or DOCX for analysis',
    href: '/documents',
    accent: 'text-[var(--color-accent)]',
    accentBg: 'bg-[var(--color-accent-subtle)]',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
        <path d="M9 1l5 5H11v7H7V6H4L9 1zM2 14h14v2H2v-2z" />
      </svg>
    ),
  },
  {
    label: 'Ask a Question',
    description: 'Start a new verified conversation',
    href: '/conversations',
    accent: 'text-[var(--color-success)]',
    accentBg: 'bg-[var(--color-success-subtle)]',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
        <path d="M18 2H0v10a1 1 0 0 0 1 1h3v4l5-4h9a1 1 0 0 0 1-1V2z" />
      </svg>
    ),
  },
  {
    label: 'View Documents',
    description: 'Browse all ingested contracts',
    href: '/documents',
    accent: 'text-[var(--color-warning)]',
    accentBg: 'bg-[var(--color-warning-subtle)]',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
        <path d="M4 1h7.586L15 4.414V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm7 0v4h4l-4-4zM6 8h6v1.5H6V8zm0 3h6v1.5H6V11zm0 3h4v1.5H6V14z" />
      </svg>
    ),
  },
  {
    label: 'Contradiction Map',
    description: 'Explore cross-document conflicts',
    href: '/contradictions',
    accent: 'text-[var(--color-error)]',
    accentBg: 'bg-[var(--color-error-subtle)]',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
        <path d="M9 1l8 15H1L9 1zm0 4L4 14h10L9 5zm0 4a1 1 0 0 1 1 1v2a1 1 0 0 1-2 0v-2a1 1 0 0 1 1-1zm0 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
      </svg>
    ),
  },
];

export function QuickActionsWidget() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className={cn(
              'group flex flex-col gap-3 rounded-xl p-3',
              'border border-[var(--color-border-subtle)]',
              'transition-all duration-fast',
              'hover:border-[var(--color-border-default)] hover:shadow-sm',
            )}
          >
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-fast group-hover:scale-110',
                action.accentBg,
                action.accent,
              )}
            >
              {action.icon}
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
                {action.label}
              </p>
              <p className="mt-0.5 text-2xs text-[var(--color-text-tertiary)] leading-snug">
                {action.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
