'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ds/Skeleton';

interface StatCardProps {
  label: string;
  value: number | string | null | undefined;
  icon: ReactNode;
  trend?: { value: number; label: string };
  suffix?: string;
  prefix?: string;
  color?: 'default' | 'accent' | 'success' | 'warning' | 'error';
  loading?: boolean;
  className?: string;
}

const colorTokens = {
  default: {
    icon: 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]',
    value: 'text-[var(--color-text-primary)]',
  },
  accent: {
    icon: 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]',
    value: 'text-[var(--color-accent)]',
  },
  success: {
    icon: 'bg-[var(--color-success-subtle)] text-[var(--color-success)]',
    value: 'text-[var(--color-success)]',
  },
  warning: {
    icon: 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)]',
    value: 'text-[var(--color-warning)]',
  },
  error: {
    icon: 'bg-[var(--color-error-subtle)] text-[var(--color-error)]',
    value: 'text-[var(--color-error)]',
  },
};

function AnimatedNumber({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = to;
    if (from === to) return;

    const duration = 600;
    const start = performance.now();
    let raf: number;

    function step(now: number) {
      const elapsed = Math.min((now - start) / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setDisplayed(Math.round(from + (to - from) * eased));
      if (elapsed < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{displayed.toLocaleString()}</>;
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  suffix,
  prefix,
  color = 'default',
  loading = false,
  className,
}: StatCardProps) {
  const tokens = colorTokens[color];

  if (loading) {
    return (
      <div className={cn('flex flex-col gap-4 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5', className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-24 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>
      </div>
    );
  }

  const numericValue = typeof value === 'number' ? value : null;

  return (
    <div
      className={cn(
        'group flex flex-col gap-4 rounded-2xl border border-[var(--color-border-subtle)]',
        'bg-[var(--color-bg-surface)] p-5',
        'transition-all duration-normal hover:border-[var(--color-border-default)] hover:shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', tokens.icon)}>
          {icon}
        </div>
        {trend && (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              trend.value >= 0
                ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
                : 'bg-[var(--color-error-subtle)] text-[var(--color-error)]',
            )}
          >
            {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <p className={cn('text-2xl font-semibold tabular-nums tracking-tight', tokens.value)}>
          {prefix}
          {numericValue !== null ? <AnimatedNumber value={numericValue} /> : (value ?? '—')}
          {suffix && <span className="ml-0.5 text-base font-normal text-[var(--color-text-tertiary)]">{suffix}</span>}
        </p>
        <p className="text-sm text-[var(--color-text-secondary)]">{label}</p>
        {trend && (
          <p className="text-xs text-[var(--color-text-tertiary)]">{trend.label}</p>
        )}
      </div>
    </div>
  );
}
