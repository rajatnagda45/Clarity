'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useUI } from '@/contexts/UIContext';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { UserMenu } from './UserMenu';

// ---------------------------------------------------------------------------
// SidebarSection
// ---------------------------------------------------------------------------
interface SidebarSectionProps {
  label?: string;
  children: ReactNode;
  className?: string;
}

export function SidebarSection({ label, children, className }: SidebarSectionProps) {
  return (
    <div className={cn('flex flex-col gap-px', className)}>
      {label && (
        <span className="mb-1 px-3 text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SidebarItem
// ---------------------------------------------------------------------------
interface SidebarItemProps {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: string | number;
  exact?: boolean;
}

export function SidebarItem({ href, label, icon, badge, exact = false }: SidebarItemProps) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group flex h-8 items-center gap-2.5 rounded-lg px-3 text-sm font-medium',
        'transition-colors duration-fast',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
        isActive
          ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]',
      )}
    >
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center',
          isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-primary)]',
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && (
        <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-2xs font-semibold tabular-nums text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
export function Sidebar() {
  const { sidebarOpen } = useUI();

  return (
    <>
      {/* Mobile overlay */}
      <MobileOverlay />

      <aside
        aria-label="Main navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-[200] flex w-[var(--sidebar-width)] flex-col',
          'bg-[var(--color-bg-sidebar)] border-r border-[var(--color-border-subtle)]',
          'transition-transform duration-normal',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          // On desktop always show (handled via layout padding)
          'md:translate-x-0',
        )}
      >
        {/* Workspace switcher */}
        <div className="flex h-[var(--topbar-height)] shrink-0 items-center px-3">
          <WorkspaceSwitcher />
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-3">
          <SidebarSection>
            <SidebarItem
              href="/dashboard"
              label="Dashboard"
              exact
              icon={<DashboardIcon />}
            />
            <SidebarItem
              href="/documents"
              label="Documents"
              icon={<DocumentsIcon />}
            />
            <SidebarItem
              href="/conversations"
              label="Conversations"
              icon={<ConversationsIcon />}
            />
          </SidebarSection>

          <SidebarSection label="Analysis">
            <SidebarItem
              href="/contradictions"
              label="Contradictions"
              icon={<ContradictionsIcon />}
            />
            <SidebarItem
              href="/eval"
              label="Eval Dashboard"
              icon={<EvalIcon />}
            />
          </SidebarSection>

          <SidebarSection label="Settings">
            <SidebarItem
              href="/settings"
              label="Settings"
              icon={<SettingsIcon />}
            />
          </SidebarSection>
        </nav>

        {/* User menu at bottom */}
        <div className="shrink-0 border-t border-[var(--color-border-subtle)] p-2">
          <UserMenu />
        </div>
      </aside>
    </>
  );
}

function MobileOverlay() {
  const { sidebarOpen, setSidebarOpen } = useUI();
  if (!sidebarOpen) return null;
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[199] bg-black/40 md:hidden"
      onClick={() => setSidebarOpen(false)}
    />
  );
}

// ---------------------------------------------------------------------------
// Icons (inline SVG, 16×16)
// ---------------------------------------------------------------------------
function DashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 2h5v5H2V2zm7 0h5v5H9V2zM2 9h5v5H2V9zm7 0h5v5H9V9z" />
    </svg>
  );
}

function DocumentsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 1h5.586L13 4.414V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm5 0v4h4l-4-4zM5 7h6v1H5V7zm0 2.5h6v1H5v-1zm0 2.5h4v1H5v-1z" />
    </svg>
  );
}

function ConversationsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M14 2H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2v3l4-3h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z" />
    </svg>
  );
}

function ContradictionsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1l7 13H1L8 1zm0 3L3 12h10L8 4zm0 4a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0V9a1 1 0 0 1 1-1zm0 3.5a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5z" />
    </svg>
  );
}

function EvalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 10l4-4 3 3 5-6 1 1-6 7-3-3-3 3-1-1z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 5a3 3 0 1 0 0 6A3 3 0 0 0 8 5zm0 1a2 2 0 1 1 0 4A2 2 0 0 1 8 6zm6.32-1.87-.66-1.6-1.68.38A4.97 4.97 0 0 0 10.6 2.1L10 .5H6l-.6 1.6a4.97 4.97 0 0 0-1.38.81L2.34 2.53l-.66 1.6 1.38 1.04A5.06 5.06 0 0 0 3 8c0 .3.03.6.06.83L1.68 9.87l.66 1.6 1.68-.38c.4.32.84.58 1.38.81L6 13.5h4l.6-1.6c.54-.23.98-.5 1.38-.81l1.68.38.66-1.6-1.38-1.04C12.97 8.6 13 8.3 13 8c0-.3-.03-.6-.06-.83l1.38-1.04z" />
    </svg>
  );
}
