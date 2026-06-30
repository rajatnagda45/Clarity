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
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

interface DropdownContextValue {
  open: boolean;
  close: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdown() {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error('Dropdown compound component used outside <Dropdown>');
  return ctx;
}

interface DropdownProps {
  children: ReactNode;
  className?: string;
}

export function Dropdown({ children, className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  return (
    <DropdownContext.Provider value={{ open, close, triggerRef }}>
      <div className={cn('relative', className)}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

interface DropdownTriggerProps {
  children: ReactNode;
  className?: string;
  asChild?: boolean;
}

export function DropdownTrigger({ children, className }: DropdownTriggerProps) {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error('DropdownTrigger used outside <Dropdown>');

  function toggle() {
    // We toggle via the parent state through a workaround:
    // get the open state from context and use the enclosing div's state
  }

  return (
    <button
      ref={ctx.triggerRef}
      type="button"
      aria-haspopup="menu"
      aria-expanded={ctx.open}
      className={cn('focus-visible:outline-none', className)}
      onClick={() => {
        // Toggle: controlled externally by DropdownRoot
        const event = new CustomEvent('dropdown-toggle', { bubbles: true });
        ctx.triggerRef.current?.dispatchEvent(event);
      }}
    >
      {children}
    </button>
  );
}

// Cleaner approach — use a root component that owns state
interface DropdownRootProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'end';
  className?: string;
}

export function DropdownMenu({ trigger, children, align = 'start', className }: DropdownRootProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, minWidth: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  function openMenu() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const left = align === 'end' ? rect.right + window.scrollX : rect.left + window.scrollX;
    setCoords({
      top: rect.bottom + window.scrollY + 4,
      left,
      minWidth: rect.width,
    });
    setOpen(true);
  }

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        close();
      }
    }
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Arrow key navigation inside menu
  function handleMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const items = menuRef.current?.querySelectorAll<HTMLElement>(
      '[role="menuitem"]:not([aria-disabled="true"])',
    );
    if (!items || items.length === 0) return;
    const idx = Array.from(items).indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  }

  const translateX = align === 'end' ? '-translate-x-full' : '';

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={open ? close : openMenu}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded"
      >
        {trigger}
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-orientation="vertical"
            onKeyDown={handleMenuKeyDown}
            style={{
              top: coords.top,
              left: coords.left,
              minWidth: coords.minWidth,
            }}
            className={cn(
              'fixed z-[900]',
              translateX,
              'flex flex-col rounded-xl py-1',
              'bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] shadow-lg',
              'animate-slide-up origin-top',
            )}
          >
            <DropdownContext.Provider value={{ open, close, triggerRef }}>
              {children}
            </DropdownContext.Provider>
          </div>,
          document.body,
        )}
    </div>
  );
}

interface DropdownItemProps {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  className?: string;
}

export function DropdownItem({
  children,
  onClick,
  icon,
  destructive = false,
  disabled = false,
  className,
}: DropdownItemProps) {
  const ctx = useContext(DropdownContext);

  function handleClick() {
    if (disabled) return;
    onClick?.();
    ctx?.close();
  }

  return (
    <button
      role="menuitem"
      type="button"
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2 text-sm',
        'transition-colors duration-fast',
        'focus-visible:outline-none',
        !disabled && !destructive && [
          'text-[var(--color-text-primary)]',
          'hover:bg-[var(--color-bg-hover)] focus:bg-[var(--color-bg-hover)]',
        ],
        !disabled && destructive && [
          'text-[var(--color-error-fg)]',
          'hover:bg-[var(--color-error-subtle)] focus:bg-[var(--color-error-subtle)]',
        ],
        disabled && 'cursor-not-allowed text-[var(--color-text-disabled)] opacity-50',
        className,
      )}
    >
      {icon && (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
          {icon}
        </span>
      )}
      <span>{children}</span>
    </button>
  );
}

export function DropdownSeparator({ className }: { className?: string }) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={cn('my-1 h-px bg-[var(--color-border-subtle)]', className)}
    />
  );
}

interface DropdownLabelProps {
  children: ReactNode;
  className?: string;
}

export function DropdownLabel({ children, className }: DropdownLabelProps) {
  return (
    <div
      className={cn(
        'px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
