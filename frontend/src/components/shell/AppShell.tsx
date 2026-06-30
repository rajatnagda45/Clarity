'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CommandPalette } from './CommandPalette';
import { type BreadcrumbItem, Breadcrumbs } from './Breadcrumbs';

interface AppShellProps {
  children: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  topBarActions?: ReactNode;
  className?: string;
}

export function AppShell({ children, breadcrumbs, topBarActions, className }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-[var(--color-bg-app)]">
      <Sidebar />

      {/* Main content: offset by sidebar width on md+ */}
      <div className={cn('flex flex-1 flex-col md:pl-[var(--sidebar-width)]')}>
        <TopBar
          breadcrumbs={
            breadcrumbs && breadcrumbs.length > 0 ? (
              <Breadcrumbs items={breadcrumbs} />
            ) : undefined
          }
          actions={topBarActions}
        />

        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            'flex flex-1 flex-col',
            'focus-visible:outline-none',
            className,
          )}
        >
          {children}
        </main>
      </div>

      {/* Global portals */}
      <CommandPalette />
    </div>
  );
}
