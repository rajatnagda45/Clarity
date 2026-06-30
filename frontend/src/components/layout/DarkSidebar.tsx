'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, useClerk } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  Grid3X3,
  Search,
  BarChart2,
  Users,
  CreditCard,
  Settings,
  ChevronDown,
  MoreHorizontal,
  Sparkles,
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useUI } from '@/contexts/UIContext';
import { useDocuments } from '@/hooks/useDocuments';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

const topNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={16} /> },
  { label: 'Documents', href: '/documents', icon: <FileText size={16} /> },
  { label: 'AI Chat', href: '/chat', icon: <MessageSquare size={16} /> },
  { label: 'Collections', href: '#', icon: <Grid3X3 size={16} />, disabled: true },
  { label: 'Search', href: '#', icon: <Search size={16} />, disabled: true },
];

const bottomNavItems: NavItem[] = [
  { label: 'Analytics', href: '/eval', icon: <BarChart2 size={16} /> },
  { label: 'Team', href: '/settings/workspace', icon: <Users size={16} /> },
  { label: 'Billing', href: '/settings', icon: <CreditCard size={16} /> },
  { label: 'Settings', href: '/settings', icon: <Settings size={16} /> },
];

function NavItemRow({ item, active }: { item: NavItem; active: boolean }) {
  const baseClass =
    'flex items-center gap-3 h-9 px-3 rounded-lg text-sm transition-colors w-full text-left';

  const activeClass =
    'bg-[rgba(91,110,240,0.15)] text-[#5B6EF0] border-l-2 border-[#5B6EF0] pl-[10px]';
  const defaultClass =
    'text-[#8892AA] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F1F3F9]';
  const disabledClass = 'opacity-40 cursor-not-allowed text-[#8892AA]';

  const iconClass = active ? 'text-[#5B6EF0]' : 'text-[#4A5168]';

  if (item.disabled) {
    return (
      <span className={`${baseClass} ${disabledClass}`}>
        <span className={iconClass}>{item.icon}</span>
        {item.label}
      </span>
    );
  }

  return (
    <motion.div whileHover={{ x: 2 }}>
      <Link
        href={item.href}
        className={`${baseClass} ${active ? activeClass : defaultClass}`}
      >
        <span className={iconClass}>{item.icon}</span>
        {item.label}
      </Link>
    </motion.div>
  );
}

function SidebarContent() {
  const pathname = usePathname();
  const { activeWorkspace, workspaces, setActiveWorkspace } = useWorkspace();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { data: documents } = useDocuments();
  const { devDashboard } = useDashboardMetrics();

  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const indexedDocs = devDashboard.data?.statusCounts?.indexed ?? 0;
  const totalDocs = documents?.length ?? 0;
  const fraction = totalDocs > 0 ? Math.min(indexedDocs / totalDocs, 1) : 0;

  const initials =
    (user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? '');

  return (
    <div className="flex h-full flex-col" style={{ width: 280 }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#5B6EF0] to-[#8B5CF6]">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
            <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" />
          </svg>
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-sm font-bold text-[#F1F3F9]">Clarity</span>
          <span className="text-[10px] text-[#8892AA]">AI Docs</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-2 flex flex-col gap-0.5">
        {topNavItems.map((item) => (
          <NavItemRow
            key={item.href + item.label}
            item={item}
            active={!item.disabled && pathname === item.href}
          />
        ))}

        <div className="my-2 border-t border-[rgba(255,255,255,0.06)]" />

        {bottomNavItems.map((item) => (
          <NavItemRow
            key={item.href + item.label}
            item={item}
            active={!item.disabled && pathname === item.href}
          />
        ))}
      </nav>

      {/* Workspace switcher */}
      {activeWorkspace && (
        <div className="px-3 py-2">
          <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-[#4A5168]">
            Workspace
          </p>
          <div className="relative">
            <button
              type="button"
              onClick={() => setWsDropdownOpen((v) => !v)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#F1F3F9] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            >
              <span className="flex-1 truncate text-left">{activeWorkspace.name}</span>
              <ChevronDown size={14} className="shrink-0 text-[#4A5168]" />
            </button>
            <AnimatePresence>
              {wsDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full left-0 mb-1 w-full rounded-xl border border-[rgba(255,255,255,0.1)] bg-[#151923] py-1 shadow-xl"
                >
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => {
                        setActiveWorkspace(ws);
                        setWsDropdownOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-[rgba(255,255,255,0.04)] ${
                        ws.id === activeWorkspace.id ? 'text-[#5B6EF0]' : 'text-[#F1F3F9]'
                      }`}
                    >
                      <span className="truncate">{ws.name}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Storage card */}
      {activeWorkspace && (
        <div className="mx-3 mb-2 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#151923] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-[#8892AA]">Document Index</span>
            <span className="text-xs text-[#4A5168]">{totalDocs} docs</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
            <div
              className="h-full rounded-full bg-[#22C55E] transition-all duration-500"
              style={{ width: `${Math.round(fraction * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-[#4A5168]">
            {indexedDocs} indexed
          </p>
        </div>
      )}

      {/* Upgrade button */}
      {activeWorkspace?.plan === 'free' && (
        <div className="mx-3 mb-2">
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5B6EF0] to-[#8B5CF6] py-2 text-sm font-medium text-white"
          >
            <Sparkles size={14} />
            Upgrade Plan
          </motion.button>
        </div>
      )}

      {/* User profile */}
      <div className="relative border-t border-[rgba(255,255,255,0.06)] px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(91,110,240,0.2)] text-xs font-semibold text-[#5B6EF0] uppercase">
            {initials || '?'}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-xs font-medium text-[#F1F3F9]">
              {user?.firstName} {user?.lastName}
            </span>
            <span className="truncate text-[10px] text-[#4A5168]">
              {user?.emailAddresses?.[0]?.emailAddress}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
            className="shrink-0 rounded-md p-1 text-[#4A5168] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F1F3F9] transition-colors"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>

        <AnimatePresence>
          {userMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full right-3 mb-1 w-40 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[#151923] py-1 shadow-xl"
            >
              <button
                type="button"
                onClick={() => signOut({ redirectUrl: '/' })}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)] transition-colors"
              >
                Sign out
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function DarkSidebar() {
  const { sidebarOpen } = useUI();

  return (
    <>
      {/* Desktop: always visible */}
      <aside className="fixed left-0 top-0 z-40 hidden h-full w-[280px] flex-col border-r border-[rgba(255,255,255,0.06)] bg-[#0C0F16] md:flex">
        <SidebarContent />
      </aside>

      {/* Mobile: slide in/out */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-30 bg-black/60 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {}}
            />
            <motion.aside
              className="fixed left-0 top-0 z-40 flex h-full w-[280px] flex-col border-r border-[rgba(255,255,255,0.06)] bg-[#0C0F16] md:hidden"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
