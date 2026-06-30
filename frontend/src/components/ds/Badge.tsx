import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'trust-high'
  | 'trust-medium'
  | 'trust-low'
  | 'trust-unknown';

export type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  default:
    'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]',
  success:
    'bg-[var(--color-success-subtle)] text-[var(--color-success-fg)] border-[var(--color-success-subtle)]',
  warning:
    'bg-[var(--color-warning-subtle)] text-[var(--color-warning-fg)] border-[var(--color-warning-subtle)]',
  error:
    'bg-[var(--color-error-subtle)] text-[var(--color-error-fg)] border-[var(--color-error-subtle)]',
  info:
    'bg-[var(--color-accent-subtle)] text-[var(--color-accent-fg)] border-[var(--color-accent-subtle)]',
  'trust-high':
    'bg-[var(--color-success-subtle)] text-[var(--color-trust-high)] border-[var(--color-success-subtle)]',
  'trust-medium':
    'bg-[var(--color-warning-subtle)] text-[var(--color-trust-medium)] border-[var(--color-warning-subtle)]',
  'trust-low':
    'bg-[var(--color-error-subtle)] text-[var(--color-trust-low)] border-[var(--color-error-subtle)]',
  'trust-unknown':
    'bg-[var(--color-bg-elevated)] text-[var(--color-trust-unknown)] border-[var(--color-border-default)]',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-[var(--color-text-tertiary)]',
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  error: 'bg-[var(--color-error)]',
  info: 'bg-[var(--color-accent)]',
  'trust-high': 'bg-[var(--color-trust-high)]',
  'trust-medium': 'bg-[var(--color-trust-medium)]',
  'trust-low': 'bg-[var(--color-trust-low)]',
  'trust-unknown': 'bg-[var(--color-trust-unknown)]',
};

const sizes: Record<BadgeSize, string> = {
  sm: 'h-4 px-1.5 text-[11px] gap-1',
  md: 'h-5 px-2 text-xs gap-1.5',
};

export function Badge({
  variant = 'default',
  size = 'md',
  dot = false,
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium leading-none',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotColors[variant])}
        />
      )}
      {children}
    </span>
  );
}
