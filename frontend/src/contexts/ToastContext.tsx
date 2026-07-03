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
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
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
const icons: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle2 size={18} className="text-[#22C55E]" />,
  error: <XCircle size={18} className="text-[#EF4444]" />,
  warning: <AlertTriangle size={18} className="text-[#F59E0B]" />,
  info: <Info size={18} className="text-[#5B6EF0]" />,
};

const styles: Record<ToastVariant, string> = {
  success: 'bg-[#151923] border-[#22C55E]/30',
  error: 'bg-[#151923] border-[#EF4444]/30',
  warning: 'bg-[#151923] border-[#F59E0B]/30',
  info: 'bg-[#151923] border-[#5B6EF0]/30',
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={[
        'flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-md',
        'min-w-[280px] max-w-[400px] pointer-events-auto',
        styles[toast.variant],
      ].join(' ')}
    >
      <span aria-hidden="true" className="shrink-0">
        {icons[toast.variant]}
      </span>
      <p className="flex-1 text-sm font-medium text-[#F1F3F9] leading-snug">
        {toast.message}
      </p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 p-1 rounded-full text-[#8892AA] hover:text-white hover:bg-[rgba(255,255,255,0.1)] transition-colors"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed top-4 right-4 z-[9999] flex flex-col gap-3"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
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
