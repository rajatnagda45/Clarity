'use client';

import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  className?: string;
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
  className,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Focus trap + restore
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();

    return () => {
      previouslyFocused.current?.focus();
    };
  }, [open]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return;
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function handleBackdropClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  if (!open) return null;

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[var(--color-bg-overlay)] animate-fade-in"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'dialog-title' : undefined}
        aria-describedby={description ? 'dialog-desc' : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative z-10 w-full rounded-2xl',
          'bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] shadow-xl',
          'flex flex-col gap-5 p-6',
          'animate-slide-up',
          sizes[size],
          className,
        )}
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex flex-col gap-1">
            {title && (
              <h2
                id="dialog-title"
                className="text-base font-semibold text-[var(--color-text-primary)]"
              >
                {title}
              </h2>
            )}
            {description && (
              <p id="dialog-desc" className="text-sm text-[var(--color-text-secondary)]">
                {description}
              </p>
            )}
          </div>
        )}

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className={cn(
            'absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg',
            'text-[var(--color-text-tertiary)] transition-colors duration-fast',
            'hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
          )}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <path d="M2.293 2.293a1 1 0 0 1 1.414 0L7 5.586l3.293-3.293a1 1 0 0 1 1.414 1.414L8.414 7l3.293 3.293a1 1 0 0 1-1.414 1.414L7 8.414l-3.293 3.293a1 1 0 0 1-1.414-1.414L5.586 7 2.293 3.707a1 1 0 0 1 0-1.414z" />
          </svg>
        </button>

        {children}
      </div>
    </div>,
    document.body,
  );
}

interface DialogFooterProps {
  children: ReactNode;
  className?: string;
}

export function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <div className={cn('flex items-center justify-end gap-2 pt-1', className)}>
      {children}
    </div>
  );
}
