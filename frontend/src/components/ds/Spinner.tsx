import { cn } from '@/lib/cn';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

const sizes: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3 border',
  sm: 'h-4 w-4 border-2',
  md: 'h-5 w-5 border-2',
  lg: 'h-6 w-6 border-2',
};

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}

export function Spinner({ size = 'md', className, label = 'Loading…' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block rounded-full border-[var(--color-border-strong)] border-t-[var(--color-accent)] animate-spin',
        sizes[size],
        className,
      )}
    />
  );
}

export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Spinner size="md" />
      <p className="text-sm text-[var(--color-text-secondary)]">{message}</p>
    </div>
  );
}
