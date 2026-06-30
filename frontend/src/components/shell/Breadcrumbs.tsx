'use client';

import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: ReactNode;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center', className)}>
      <ol className="flex items-center gap-1.5">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <Fragment key={`${item.label}-${i}`}>
              <li className="flex items-center">
                {isLast || !item.href ? (
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className={cn(
                      'inline-flex items-center gap-1 text-sm',
                      isLast
                        ? 'font-medium text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-tertiary)]',
                    )}
                  >
                    {item.icon && <span aria-hidden="true">{item.icon}</span>}
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className={cn(
                      'inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)]',
                      'transition-colors duration-fast hover:text-[var(--color-text-primary)]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded',
                    )}
                  >
                    {item.icon && <span aria-hidden="true">{item.icon}</span>}
                    {item.label}
                  </Link>
                )}
              </li>

              {!isLast && (
                <li aria-hidden="true" className="text-[var(--color-text-disabled)]">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M4.5 2l4 4-4 4" stroke="currentColor" strokeWidth="1.25" fill="none" strokeLinecap="round" />
                  </svg>
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
