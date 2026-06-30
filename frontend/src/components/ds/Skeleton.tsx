import { cn } from '@/lib/cn';

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export function Skeleton({ className, width, height }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      role="presentation"
      className={cn(
        'block rounded-md skeleton-shimmer',
        className,
      )}
      style={{ width, height }}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3.5"
          width={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'rounded-xl border border-[var(--color-border-subtle)] p-4 shadow-xs',
        'flex flex-col gap-3',
        className,
      )}
    >
      <Skeleton className="h-4 w-2/5" />
      <SkeletonText lines={2} />
    </div>
  );
}
