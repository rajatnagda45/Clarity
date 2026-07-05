'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Search, Upload, Bell } from 'lucide-react';
import { useUI } from '@/contexts/UIContext';
import { useCommand } from '@/contexts/CommandContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useGlobalUpload } from '@/hooks/useGlobalUpload';

function getPageTitle(pathname: string): string {
  if (pathname === '/dashboard') return 'Dashboard';
  if (pathname === '/documents') return 'Documents';
  if (pathname.startsWith('/documents/')) return 'Document';
  if (pathname === '/chat') return 'AI Chat';
  if (pathname === '/eval') return 'Analytics';
  if (pathname.startsWith('/eval/benchmarks')) return 'Benchmarks';
  if (pathname === '/conversations') return 'Conversations';
  if (pathname.startsWith('/settings')) return 'Settings';
  if (pathname.startsWith('/contradictions')) return 'Contradictions';
  if (pathname === '/agents') return 'Agents';
  if (pathname.startsWith('/agents/')) return 'Agent';
  if (pathname === '/collections') return 'Collections';
  if (pathname === '/workspace') return 'Workspace';
  if (pathname === '/help') return 'Help';
  if (pathname.startsWith('/developer')) return 'Developer';
  if (pathname === '/onboarding') return 'Onboarding';
  if (pathname === '/provenance') return 'Provenance';
  return 'Clarity';
}

export function DarkTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { toggleSidebar, sidebarCollapsed } = useUI();
  const { toggle: toggleCommand } = useCommand();
  const { toggle: toggleNotifications, unreadCount } = useNotifications();
  const { user } = useUser();
  const { triggerUpload, isUploading } = useGlobalUpload();

  const title = getPageTitle(pathname);
  const showUpload = pathname === '/dashboard' || pathname === '/documents';

  const initials =
    (user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? '');

  const leftOffset = sidebarCollapsed ? 'md:left-[80px]' : 'md:left-[288px]';

  return (
    <header className={`fixed left-0 right-0 top-0 z-30 flex h-14 items-center border-b border-[rgba(255,255,255,0.06)] bg-[rgba(5,7,11,0.8)] px-4 backdrop-blur-xl transition-all duration-300 ease-in-out ${leftOffset}`}>
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={toggleSidebar}
        className="mr-3 rounded-lg p-1.5 text-[#8892AA] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#F1F3F9] transition-colors md:hidden"
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      <span className="text-sm font-semibold text-[#F1F3F9]">{title}</span>

      {/* Spacer */}
      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Search */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          id="topbar-command-center"
          type="button"
          onClick={toggleCommand}
          className="hidden items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0F1117] px-3 text-sm text-[#4A5168] transition-colors hover:border-[rgba(255,255,255,0.1)] hover:text-[#8892AA] sm:flex"
          style={{ height: 32, width: 200 }}
        >
          <Search size={14} />
          <span className="flex-1 text-left text-xs">Search...</span>
          <span className="rounded bg-[#1A1F2E] px-1.5 py-0.5 text-[10px] text-[#4A5168]">⌘K</span>
        </motion.button>

        {/* Upload button — only on relevant pages */}
        {showUpload && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            id="topbar-upload-btn"
            type="button"
            onClick={triggerUpload}
            disabled={isUploading}
            className="hidden items-center gap-1.5 rounded-lg bg-[#5B6EF0] px-3 text-xs font-medium text-white transition-colors hover:bg-[#6B7EF5] disabled:opacity-50 disabled:cursor-not-allowed sm:flex shadow-[0_0_12px_rgba(91,110,240,0.3)]"
            style={{ height: 32 }}
          >
            <Upload size={14} className={isUploading ? 'animate-bounce' : ''} />
            {isUploading ? 'Uploading...' : 'Upload'}
          </motion.button>
        )}

        {/* Notifications */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          id="topbar-notifications"
          type="button"
          onClick={toggleNotifications}
          className="relative rounded-lg p-1.5 text-[#4A5168] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#8892AA] transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute right-1 top-1 flex h-3 w-3 items-center justify-center rounded-full bg-purple-500 text-[8px] font-bold text-white shadow-[0_0_10px_rgba(168,85,247,0.5)]"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Avatar — navigates to Settings */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={() => router.push('/settings')}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(91,110,240,0.2)] text-xs font-semibold uppercase text-[#5B6EF0]"
          aria-label="Open settings"
        >
          {initials || '?'}
        </motion.button>
      </div>
    </header>
  );
}
