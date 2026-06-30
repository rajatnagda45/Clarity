import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
}

const baseInput = [
  'w-full rounded-lg border bg-[var(--color-bg-surface)]',
  'text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]',
  'transition-[border-color,box-shadow] duration-fast',
  'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-0 focus:border-[var(--color-accent)]',
  'disabled:cursor-not-allowed disabled:bg-[var(--color-bg-elevated)] disabled:text-[var(--color-text-disabled)]',
].join(' ');

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, icon, iconPosition = 'left', className, id, ...props },
  ref,
) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const hasError = Boolean(error);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-[var(--color-text-primary)]"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && iconPosition === 'left' && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
          >
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={hasError}
          aria-describedby={
            error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
          className={cn(
            baseInput,
            'h-8 px-3',
            icon && iconPosition === 'left' && 'pl-9',
            icon && iconPosition === 'right' && 'pr-9',
            hasError
              ? 'border-[var(--color-error)] focus:ring-[var(--color-error)]'
              : 'border-[var(--color-border-default)]',
            className,
          )}
          {...props}
        />
        {icon && iconPosition === 'right' && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
          >
            {icon}
          </span>
        )}
      </div>
      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-[var(--color-error-fg)]">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-[var(--color-text-tertiary)]">
          {hint}
        </p>
      )}
    </div>
  );
});
