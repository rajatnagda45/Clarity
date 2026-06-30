'use client';

import { cn } from '@/lib/cn';

interface NotificationBellProps {
  count?: number;
  onClick?: () => void;
  className?: string;
}

export function NotificationBell({ count = 0, onClick, className }: NotificationBellProps) {
  const hasNotifications = count > 0;
  const label = hasNotifications
    ? `Notifications (${count} unread)`
    : 'Notifications';

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'relative flex h-8 w-8 items-center justify-center rounded-lg',
        'text-[var(--color-text-secondary)] transition-colors duration-fast',
        'hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
        className,
      )}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 1a5.5 5.5 0 0 0-5.5 5.5v2L1 10v1h14v-1l-1.5-1.5v-2A5.5 5.5 0 0 0 8 1zM6.5 12a1.5 1.5 0 0 0 3 0h-3z" />
      </svg>

      {hasNotifications && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute right-1 top-1 flex items-center justify-center rounded-full',
            'bg-[var(--color-accent)] text-white font-semibold',
            count > 9 ? 'h-4 w-4 text-[9px]' : 'h-3.5 w-3.5 text-[9px]',
          )}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
