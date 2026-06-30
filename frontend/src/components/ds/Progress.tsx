import { cn } from '@/lib/cn';

interface ProgressBarProps {
  value: number; // 0–100
  max?: number;
  label?: string;
  showValue?: boolean;
  size?: 'sm' | 'md';
  variant?: 'default' | 'success' | 'warning' | 'error';
  className?: string;
}

const trackColors = {
  default: 'bg-[var(--color-bg-elevated)]',
  success: 'bg-[var(--color-success-subtle)]',
  warning: 'bg-[var(--color-warning-subtle)]',
  error: 'bg-[var(--color-error-subtle)]',
};

const fillColors = {
  default: 'bg-[var(--color-accent)]',
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  error: 'bg-[var(--color-error)]',
};

const heights = {
  sm: 'h-1',
  md: 'h-1.5',
};

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
  size = 'md',
  variant = 'default',
  className,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
          )}
          {showValue && (
            <span className="text-xs font-medium tabular-nums text-[var(--color-text-primary)]">
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? 'Progress'}
        className={cn('w-full overflow-hidden rounded-full', heights[size], trackColors[variant])}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-slow',
            fillColors[variant],
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
