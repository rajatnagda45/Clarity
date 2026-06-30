'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
  variant: 'underline' | 'pill';
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs compound component used outside <Tabs>');
  return ctx;
}

interface TabsProps {
  defaultTab: string;
  variant?: 'underline' | 'pill';
  children: ReactNode;
  className?: string;
}

export function Tabs({ defaultTab, variant = 'underline', children, className }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: useCallback((id) => setActiveTab(id), []), variant }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabListProps {
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}

export function TabList({ children, className, 'aria-label': ariaLabel }: TabListProps) {
  const { variant } = useTabsContext();
  const listRef = useRef<HTMLDivElement>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const tabs = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    if (!tabs) return;
    const current = document.activeElement;
    const idx = Array.from(tabs).indexOf(current as HTMLButtonElement);
    if (idx === -1) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      tabs[(idx + 1) % tabs.length]?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      tabs[(idx - 1 + tabs.length) % tabs.length]?.focus();
    }
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex items-center gap-0.5',
        variant === 'underline' &&
          'border-b border-[var(--color-border-subtle)] pb-px',
        variant === 'pill' && 'gap-1 rounded-xl bg-[var(--color-bg-elevated)] p-1',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface TabProps {
  id: string;
  children: ReactNode;
  className?: string;
}

export function Tab({ id, children, className }: TabProps) {
  const { activeTab, setActiveTab, variant } = useTabsContext();
  const isActive = activeTab === id;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`panel-${id}`}
      id={`tab-${id}`}
      tabIndex={isActive ? 0 : -1}
      onClick={() => setActiveTab(id)}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium',
        'transition-colors duration-fast',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
        variant === 'underline' && [
          'border-b-2 px-3 pb-2.5 pt-1',
          isActive
            ? 'border-[var(--color-accent)] text-[var(--color-text-primary)]'
            : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-default)]',
        ],
        variant === 'pill' && [
          'rounded-lg px-3 py-1.5',
          isActive
            ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-xs'
            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
        ],
        className,
      )}
    >
      {children}
    </button>
  );
}

interface TabPanelProps {
  id: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ id, children, className }: TabPanelProps) {
  const { activeTab } = useTabsContext();
  if (activeTab !== id) return null;
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className={className}>
      {children}
    </div>
  );
}
