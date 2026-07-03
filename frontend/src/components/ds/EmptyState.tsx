import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn(
        'relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl',
        'border border-[rgba(255,255,255,0.08)] bg-[#151923]/50 backdrop-blur-sm',
        'px-8 py-16 text-center shadow-lg',
        className,
      )}
    >
      {/* Subtle radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/[0.03] via-transparent to-transparent pointer-events-none" />

      {icon && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.05] text-[#8892AA] shadow-inner mb-2"
        >
          {icon}
        </motion.div>
      )}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="flex flex-col gap-1.5 z-10"
      >
        <p className="text-base font-semibold text-[#F1F3F9] tracking-tight">{title}</p>
        {description && (
          <p className="max-w-sm text-sm text-[#8892AA] leading-relaxed">{description}</p>
        )}
      </motion.div>
      {action && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="mt-4 z-10"
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  action,
  className,
}: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn(
        'relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl',
        'border border-[#EF4444]/20 bg-[#EF4444]/[0.02] backdrop-blur-sm',
        'px-8 py-12 text-center shadow-lg',
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#EF4444]/10 via-transparent to-transparent pointer-events-none" />

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] shadow-inner mb-2"
      >
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM7 5a1 1 0 0 1 2 0v3a1 1 0 0 1-2 0V5zm1 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
        </svg>
      </motion.div>
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="flex flex-col gap-1.5 z-10"
      >
        <p className="text-base font-semibold text-[#F1F3F9] tracking-tight">{title}</p>
        <p className="max-w-sm text-sm text-[#8892AA] leading-relaxed">{message}</p>
      </motion.div>
      {action && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="mt-4 z-10"
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}
