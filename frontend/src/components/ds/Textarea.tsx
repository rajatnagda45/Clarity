import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, ...props },
  ref,
) {
  const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const hasError = Boolean(error);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={textareaId}
          className="text-sm font-medium text-[var(--color-text-primary)]"
        >
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        aria-invalid={hasError}
        aria-describedby={
          error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined
        }
        className={cn(
          'w-full rounded-lg border bg-[var(--color-bg-surface)]',
          'min-h-[80px] px-3 py-2',
          'text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]',
          'resize-y transition-[border-color,box-shadow] duration-fast',
          'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-0 focus:border-[var(--color-accent)]',
          'disabled:cursor-not-allowed disabled:bg-[var(--color-bg-elevated)] disabled:text-[var(--color-text-disabled)]',
          hasError
            ? 'border-[var(--color-error)] focus:ring-[var(--color-error)]'
            : 'border-[var(--color-border-default)]',
          className,
        )}
        {...props}
      />
      {error && (
        <p id={`${textareaId}-error`} role="alert" className="text-xs text-[var(--color-error-fg)]">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${textareaId}-hint`} className="text-xs text-[var(--color-text-tertiary)]">
          {hint}
        </p>
      )}
    </div>
  );
});
