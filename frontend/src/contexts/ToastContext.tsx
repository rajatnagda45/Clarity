'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
  removing?: boolean;
}

interface ToastContextValue {
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
  };
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 4000;

// Icons per variant
const icons: Record<ToastVariant, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const styles: Record<ToastVariant, string> = {
  success:
    'bg-[var(--color-bg-surface)] border-[var(--color-border-default)] [&_[data-icon]]:text-[var(--color-success)]',
  error:
    'bg-[var(--color-bg-surface)] border-[var(--color-border-default)] [&_[data-icon]]:text-[var(--color-error)]',
  warning:
    'bg-[var(--color-bg-surface)] border-[var(--color-border-default)] [&_[data-icon]]:text-[var(--color-warning)]',
  info:
    'bg-[var(--color-bg-surface)] border-[var(--color-border-default)] [&_[data-icon]]:text-[var(--color-accent)]',
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={[
        'flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg',
        'min-w-[260px] max-w-[380px]',
        toast.removing ? 'animate-toast-out' : 'animate-toast-in',
        styles[toast.variant],
      ].join(' ')}
    >
      <span
        data-icon
        aria-hidden="true"
        className="mt-px flex h-4 w-4 shrink-0 items-center justify-center text-xs font-bold leading-none"
      >
        {icons[toast.variant]}
      </span>
      <p className="flex-1 text-sm leading-5 text-[var(--color-text-primary)]">
        {toast.message}
      </p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="ml-1 shrink-0 text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
          <path d="M2.293 2.293a1 1 0 0 1 1.414 0L6 4.586l2.293-2.293a1 1 0 1 1 1.414 1.414L7.414 6l2.293 2.293a1 1 0 0 1-1.414 1.414L6 7.414 3.707 9.707a1 1 0 0 1-1.414-1.414L4.586 6 2.293 3.707a1 1 0 0 1 0-1.414z" />
        </svg>
      </button>
    </div>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || toasts.length === 0) return null;
  return createPortal(
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>,
    document.body,
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    // Mark as removing first for exit animation
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, removing: true } : t)));
    // Then remove after animation
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, 220);
    timers.current.set(`remove-${id}`, timer);
  }, []);

  const add = useCallback(
    (message: string, variant: ToastVariant, duration = DEFAULT_DURATION) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, message, variant, duration }]);

      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
    },
    [dismiss],
  );

  // Cleanup on unmount
  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((timer) => clearTimeout(timer));
  }, []);

  const toast = {
    success: (msg: string, d?: number) => add(msg, 'success', d),
    error: (msg: string, d?: number) => add(msg, 'error', d),
    warning: (msg: string, d?: number) => add(msg, 'warning', d),
    info: (msg: string, d?: number) => add(msg, 'info', d),
  };

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
