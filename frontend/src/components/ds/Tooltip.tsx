'use client';

import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: ReactNode;
  side?: TooltipSide;
  delay?: number;
  children: ReactElement<{ onMouseEnter?: () => void; onMouseLeave?: () => void; onFocus?: () => void; onBlur?: () => void }>;
  className?: string;
}

export function Tooltip({ content, side = 'top', delay = 300, children, className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => setMounted(true), []);

  function show() {
    timer.current = setTimeout(() => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const gap = 6;
      let top = 0;
      let left = 0;
      switch (side) {
        case 'top':
          top = rect.top + window.scrollY - gap;
          left = rect.left + window.scrollX + rect.width / 2;
          break;
        case 'bottom':
          top = rect.bottom + window.scrollY + gap;
          left = rect.left + window.scrollX + rect.width / 2;
          break;
        case 'left':
          top = rect.top + window.scrollY + rect.height / 2;
          left = rect.left + window.scrollX - gap;
          break;
        case 'right':
          top = rect.top + window.scrollY + rect.height / 2;
          left = rect.right + window.scrollX + gap;
          break;
      }
      setCoords({ top, left });
      setVisible(true);
    }, delay);
  }

  function hide() {
    clearTimeout(timer.current);
    setVisible(false);
  }

  const translateClass: Record<TooltipSide, string> = {
    top: '-translate-x-1/2 -translate-y-full',
    bottom: '-translate-x-1/2',
    left: '-translate-x-full -translate-y-1/2',
    right: '-translate-y-1/2',
  };

  const trigger = cloneElement(
    isValidElement(children) ? children : <span>{children}</span>,
    {
      ref: triggerRef,
      onMouseEnter: show,
      onMouseLeave: hide,
      onFocus: show,
      onBlur: hide,
    } as Record<string, unknown>,
  );

  return (
    <>
      {trigger}
      {mounted &&
        visible &&
        createPortal(
          <div
            role="tooltip"
            style={{ top: coords.top, left: coords.left }}
            className={cn(
              'pointer-events-none fixed z-[9998]',
              'max-w-[200px] rounded-md px-2.5 py-1.5',
              'bg-[var(--color-text-primary)] text-[var(--color-bg-surface)]',
              'text-xs leading-5 shadow-lg animate-fade-in',
              translateClass[side],
              className,
            )}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
