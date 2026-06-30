import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  children?: ReactNode;
}

const base = [
  'inline-flex items-center justify-center gap-2 font-medium leading-none',
  'select-none whitespace-nowrap rounded-lg',
  'transition-[background-color,border-color,color,box-shadow,opacity]',
  'duration-normal ease-default',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1',
  'disabled:pointer-events-none disabled:opacity-40',
  'active:scale-[0.98]',
].join(' ');

const variants: Record<ButtonVariant, string> = {
  primary: [
    'bg-[var(--color-accent)] text-white shadow-sm',
    'hover:bg-[var(--color-accent-hover)]',
    'active:bg-[var(--color-accent-hover)]',
  ].join(' '),
  secondary: [
    'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]',
    'border border-[var(--color-border-default)] shadow-xs',
    'hover:bg-[var(--color-bg-elevated)] hover:border-[var(--color-border-strong)]',
  ].join(' '),
  ghost: [
    'bg-transparent text-[var(--color-text-secondary)]',
    'hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]',
  ].join(' '),
  danger: [
    'bg-[var(--color-error-subtle)] text-[var(--color-error-fg)]',
    'border border-[var(--color-error-subtle)]',
    'hover:bg-[var(--color-error)] hover:text-white hover:border-[var(--color-error)]',
  ].join(' '),
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-8 px-3 text-sm',
  lg: 'h-9 px-4 text-base',
};

const Spinner = () => (
  <svg
    className="h-3.5 w-3.5 animate-spin"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12" cy="12" r="10"
      stroke="currentColor" strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    icon,
    iconPosition = 'left',
    children,
    className,
    disabled,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading && <Spinner />}
      {!loading && icon && iconPosition === 'left' && (
        <span aria-hidden="true" className="shrink-0">{icon}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && icon && iconPosition === 'right' && (
        <span aria-hidden="true" className="shrink-0">{icon}</span>
      )}
    </button>
  );
});

// Icon-only button (square)
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string; // required for accessibility
  size?: ButtonSize;
  variant?: ButtonVariant;
  loading?: boolean;
  children: ReactNode;
}

const iconSizes: Record<ButtonSize, string> = {
  sm: 'h-7 w-7',
  md: 'h-8 w-8',
  lg: 'h-9 w-9',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'md', variant = 'ghost', loading = false, children, className, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      disabled={disabled || loading}
      className={cn(base, variants[variant], iconSizes[size], 'px-0', className)}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
});
