'use client';

import { cn } from '@/lib/cn';
import { useUI } from '@/contexts/UIContext';

type Theme = 'light' | 'dark' | 'system';

const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
  {
    value: 'light',
    label: 'Light',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
        <circle cx="7" cy="7" r="2.5" />
        <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M3.05 3.05l1.06 1.06M9.89 9.89l1.06 1.06M3.05 10.95l1.06-1.06M9.89 4.11l1.06-1.06" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
        <path d="M11.5 8.5A5 5 0 0 1 5.5 2.5a5.002 5.002 0 1 0 6 6z" />
      </svg>
    ),
  },
  {
    value: 'system',
    label: 'System',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
        <rect x="1" y="2" width="12" height="8" rx="1" />
        <path d="M4 12h6M7 10v2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    ),
  },
];

interface ThemeSwitcherProps {
  inline?: boolean;
  className?: string;
}

export function ThemeSwitcher({ inline = false, className }: ThemeSwitcherProps) {
  const { theme, setTheme } = useUI();

  if (inline) {
    return (
      <div
        role="radiogroup"
        aria-label="Color theme"
        className={cn(
          'flex items-center rounded-lg bg-[var(--color-bg-elevated)] p-0.5 gap-0.5',
          className,
        )}
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={theme === opt.value}
            onClick={() => setTheme(opt.value)}
            title={opt.label}
            className={cn(
              'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
              'transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
              theme === opt.value
                ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-xs'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
            )}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    );
  }

  // Standalone icon-only toggle (light ↔ dark)
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg',
        'text-[var(--color-text-secondary)] transition-colors duration-fast',
        'hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
        className,
      )}
    >
      {isDark ? options[0].icon : options[1].icon}
    </button>
  );
}
