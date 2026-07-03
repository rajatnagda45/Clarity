'use client';

import { usePathname } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Menu, Search, Upload, Bell } from 'lucide-react';
import { useUI } from '@/contexts/UIContext';
import { useCommand } from '@/contexts/CommandContext';
import { useNotifications } from '@/contexts/NotificationContext';

function getPageTitle(pathname: string): string {
  if (pathname === '/dashboard') return 'Dashboard';
  if (pathname === '/documents') return 'Documents';
  if (pathname === '/chat') return 'AI Chat';
  if (pathname === '/eval') return 'Analytics';
  if (pathname === '/conversations') return 'Conversations';
  if (pathname.startsWith('/settings')) return 'Settings';
  if (pathname.startsWith('/contradictions')) return 'Contradictions';
  return 'Clarity';
}

export function DarkTopbar() {
  const pathname = usePathname();
  const { toggleSidebar, sidebarCollapsed } = useUI();
  const { toggle: toggleCommand } = useCommand();
  const { toggle: toggleNotifications, unreadCount } = useNotifications();
  const { user } = useUser();

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

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button
          id="topbar-command-center"
          type="button"
          onClick={toggleCommand}
          className="hidden items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0F1117] px-3 text-sm text-[#4A5168] transition-colors hover:border-[rgba(255,255,255,0.1)] hover:text-[#8892AA] sm:flex"
          style={{ height: 32, width: 200 }}
        >
          <Search size={14} />
          <span className="flex-1 text-left text-xs">Search...</span>
          <span className="rounded bg-[#1A1F2E] px-1.5 py-0.5 text-[10px] text-[#4A5168]">⌘K</span>
        </button>

        {/* Upload button — only on relevant pages */}
        {showUpload && (
          <button
            id="topbar-upload-btn"
            type="button"
            className="hidden items-center gap-1.5 rounded-lg bg-[#5B6EF0] px-3 text-xs font-medium text-white transition-colors hover:bg-[#6B7EF5] sm:flex"
            style={{ height: 32 }}
          >
            <Upload size={14} />
            Upload
          </button>
        )}

        {/* Notifications */}
        <button
          id="topbar-notifications"
          type="button"
          onClick={toggleNotifications}
          className="relative rounded-lg p-1.5 text-[#4A5168] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#8892AA] transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-3 w-3 items-center justify-center rounded-full bg-purple-500 text-[8px] font-bold text-white shadow-[0_0_10px_rgba(168,85,247,0.5)]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Avatar */}
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(91,110,240,0.2)] text-xs font-semibold uppercase text-[#5B6EF0]"
          aria-label="Profile"
        >
          {initials || '?'}
        </button>
      </div>
    </header>
  );
}
