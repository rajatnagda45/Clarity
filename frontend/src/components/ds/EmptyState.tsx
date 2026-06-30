import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl',
        'border border-dashed border-[var(--color-border-default)]',
        'px-8 py-12 text-center',
        className,
      )}
    >
      {icon && (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)] text-[var(--color-text-tertiary)]">
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{title}</p>
        {description && (
          <p className="max-w-xs text-sm text-[var(--color-text-secondary)]">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl',
        'border border-[var(--color-error-subtle)] bg-[var(--color-error-subtle)]',
        'px-8 py-10 text-center',
        className,
      )}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-error-subtle)] text-[var(--color-error-fg)]">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM7 5a1 1 0 0 1 2 0v3a1 1 0 0 1-2 0V5zm1 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
        </svg>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
        <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">{message}</p>
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
