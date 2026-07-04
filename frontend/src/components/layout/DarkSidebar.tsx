'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser, useClerk } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  Grid3X3,
  Search,
  BarChart2,
  CreditCard,
  Settings,
  ChevronDown,
  MoreHorizontal,
  Sparkles,
  Building2,
  HelpCircle,
  Terminal,
  Upload,
  FolderPlus,
  PanelLeftClose,
  PanelLeftOpen,
  CheckCircle2,
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useUI } from '@/contexts/UIContext';
import { useCommand } from '@/contexts/CommandContext';
import { useDocuments } from '@/hooks/useDocuments';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useGlobalUpload } from '@/hooks/useGlobalUpload';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  shortcut?: string;
  isAction?: boolean;
}

const workspaceNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Documents', href: '/documents', icon: <FileText size={18} /> },
  { label: 'Collections', href: '/collections', icon: <Grid3X3 size={18} /> },
  { label: 'AI Chat', href: '/chat', icon: <MessageSquare size={18} /> },
  { label: 'Search', href: '#', icon: <Search size={18} />, shortcut: '⌘K', isAction: true },
  { label: 'Analytics', href: '/eval', icon: <BarChart2 size={18} /> },
];

const toolsNavItems: NavItem[] = [
  { label: 'Developer Console', href: '/developer/dashboard', icon: <Terminal size={18} /> },
  { label: 'Workspace', href: '/workspace', icon: <Building2 size={18} /> },
  { label: 'Billing', href: '/billing', icon: <CreditCard size={18} /> },
  { label: 'Settings', href: '/settings', icon: <Settings size={18} /> },
  { label: 'Help Center', href: '/help', icon: <HelpCircle size={18} /> },
];

function Tooltip({ children, text, show }: { children: React.ReactNode; text: string; show: boolean }) {
  if (!show) return <>{children}</>;
  return (
    <div className="group relative flex items-center w-full">
      {children}
      <div className="pointer-events-none absolute left-full ml-4 whitespace-nowrap rounded-lg bg-[#1A1F2E] border border-[rgba(255,255,255,0.1)] px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-2xl transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100 z-[100]">
        {text}
      </div>
    </div>
  );
}

function NavItemRow({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const content = (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="relative w-full"
    >
      <div
        className={`group relative flex items-center gap-3 h-10 w-full rounded-xl transition-all duration-300 ease-out cursor-pointer overflow-hidden ${
          collapsed ? 'justify-center px-0' : 'px-3'
        } ${
          active
            ? 'bg-[rgba(91,110,240,0.15)] text-[#5B6EF0]'
            : 'text-[#8892AA] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#F1F3F9]'
        }`}
        onClick={onClick}
      >
        {active && (
          <motion.div
            layoutId="activeNavIndicator"
            className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-[#5B6EF0] to-[#8B5CF6] shadow-[0_0_12px_rgba(91,110,240,0.6)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        )}
        
        <span className={`relative z-10 flex shrink-0 transition-colors duration-300 ${active ? 'text-[#5B6EF0]' : 'text-[#4A5168] group-hover:text-[#F1F3F9]'}`}>
          {item.icon}
        </span>
        
        {!collapsed && (
          <span className="relative z-10 flex-1 truncate text-sm font-medium">
            {item.label}
          </span>
        )}

        {!collapsed && item.shortcut && (
          <span className="relative z-10 shrink-0 rounded-md bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-[#4A5168] transition-colors group-hover:bg-[rgba(255,255,255,0.1)] group-hover:text-[#8892AA]">
            {item.shortcut}
          </span>
        )}
      </div>
    </motion.div>
  );

  return (
    <Tooltip text={item.label} show={collapsed}>
      {item.isAction ? (
        <button
          type="button"
          aria-label={item.label}
          className="w-full text-left outline-none"
          onClick={(e) => { e.preventDefault(); onClick?.(); }}
        >
          {content}
        </button>
      ) : (
        <Link href={item.href} className="w-full block">
          {content}
        </Link>
      )}
    </Tooltip>
  );
}

function SidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeWorkspace, workspaces, setActiveWorkspace } = useWorkspace();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { data: documents } = useDocuments();
  const { devDashboard } = useDashboardMetrics();
  const { sidebarCollapsed, toggleSidebarCollapsed, toggleSidebar } = useUI();
  const { toggle: toggleCommand } = useCommand();
  const { triggerUpload, isUploading } = useGlobalUpload();

  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const indexedDocs = devDashboard.data?.statusCounts?.indexed ?? 0;
  const totalDocs = documents?.length ?? 0;
  const fraction = totalDocs > 0 ? Math.min(indexedDocs / totalDocs, 1) : 0;

  const initials =
    (user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? '');

  return (
    <div className={`relative flex h-full flex-col bg-[#090B11] transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'w-[80px]' : 'w-[288px]'}`}>
      
      {/* Premium Background Effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.02] [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-full h-[300px] bg-[radial-gradient(ellipse_at_top,rgba(91,110,240,0.05)_0%,transparent_70%)]" />
      </div>

      {/* Header / Logo Section */}
      <div className="relative z-10 flex flex-col px-4 pt-6 pb-4">
        <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B6EF0] to-[#8B5CF6] shadow-[0_0_20px_rgba(91,110,240,0.3)] cursor-pointer group"
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="white">
                <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" />
              </svg>
              <div className="absolute inset-0 rounded-xl bg-white opacity-0 transition-opacity duration-300 group-hover:opacity-10" />
            </motion.div>
            
            {!sidebarCollapsed && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex flex-col leading-tight"
              >
                <span className="text-base font-bold text-[#F1F3F9] tracking-tight">Clarity</span>
                <span className="text-[10px] font-medium tracking-widest text-[#5B6EF0] uppercase">Enterprise</span>
              </motion.div>
            )}
          </div>
          
          {/* Collapse Toggle */}
          {!sidebarCollapsed && (
            <button 
              onClick={toggleSidebarCollapsed}
              className="hidden md:flex items-center justify-center rounded-lg p-1.5 text-[#4A5168] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#F1F3F9] transition-colors"
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>

        {sidebarCollapsed && (
          <button 
            onClick={toggleSidebarCollapsed}
            className="hidden md:flex mx-auto mt-4 items-center justify-center rounded-lg p-1.5 text-[#4A5168] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#F1F3F9] transition-colors"
          >
            <PanelLeftOpen size={16} />
          </button>
        )}
      </div>

      {/* Quick Actions Dock */}
      {!sidebarCollapsed && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: <Search size={16} />, label: 'Search', action: toggleCommand },
              { 
                icon: <Upload size={16} className={isUploading ? 'animate-bounce' : ''} />, 
                label: isUploading ? 'Uploading' : 'Upload', 
                action: triggerUpload,
                disabled: isUploading 
              },
              { icon: <MessageSquare size={16} />, label: 'New Chat', action: () => router.push('/chat') },
              { icon: <FolderPlus size={16} />, label: 'Collection', action: () => router.push('/collections') },
            ].map((action, i) => (
              <Tooltip key={i} text={action.label} show={true}>
                <motion.button
                  whileHover={{ scale: action.disabled ? 1 : 1.05, y: action.disabled ? 0 : -2 }}
                  whileTap={{ scale: action.disabled ? 1 : 0.95 }}
                  onClick={action.disabled ? undefined : action.action}
                  className={`flex h-10 w-full items-center justify-center rounded-xl border border-[rgba(255,255,255,0.04)] bg-[#151923] text-[#8892AA] transition-colors shadow-sm ${
                    action.disabled 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:border-[rgba(255,255,255,0.1)] hover:bg-[#1A1F2E] hover:text-[#F1F3F9]'
                  }`}
                >
                  {action.icon}
                </motion.button>
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-2 flex flex-col gap-6 custom-scrollbar">
        
        {/* Workspace Group */}
        <div className="flex flex-col gap-1">
          {!sidebarCollapsed && (
            <span className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#4A5168] mb-1">
              Workspace
            </span>
          )}
          {workspaceNavItems.map((item) => (
            <NavItemRow
              key={item.href + item.label}
              item={item}
              active={pathname === item.href}
              collapsed={sidebarCollapsed}
              onClick={item.isAction ? toggleCommand : undefined}
            />
          ))}
        </div>

        {/* Tools Group */}
        <div className="flex flex-col gap-1">
          {!sidebarCollapsed && (
            <span className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#4A5168] mb-1">
              Tools
            </span>
          )}
          {toolsNavItems.map((item) => (
            <NavItemRow
              key={item.href + item.label}
              item={item}
              active={pathname === item.href}
              collapsed={sidebarCollapsed}
            />
          ))}
        </div>

      </nav>

      {/* Bottom Area: Workspace, Status, Profile */}
      <div className="relative z-10 mt-auto flex flex-col px-3 pb-4">
        
        {/* Document Index Card & Upgrade (Only when expanded) */}
        {!sidebarCollapsed && activeWorkspace && (
          <div className="mb-4 flex flex-col gap-3">
            {/* Indexing Card */}
            <div className="group relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#151923] p-4 transition-colors hover:border-[rgba(255,255,255,0.1)] hover:bg-[#1A1F2E]">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-[#F1F3F9]">
                  <DatabaseIcon />
                  <span>Index Status</span>
                </div>
                <span className="text-[10px] font-bold text-[#4A5168]">{totalDocs} TOTAL</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#090B11] shadow-inner">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#5B6EF0] to-[#22C55E]"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round(fraction * 100)}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-[#8892AA]">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                  <span>Healthy</span>
                </div>
                <span>{indexedDocs} / {totalDocs} indexed</span>
              </div>
            </div>

            {/* Upgrade Button */}
            {activeWorkspace.plan === 'free' && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="relative overflow-hidden group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#5B6EF0] to-[#8B5CF6] p-[1px]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
                <div className="flex w-full items-center justify-center gap-2 rounded-[15px] bg-[#090B11] py-2.5 text-sm font-semibold text-[#F1F3F9] transition-colors group-hover:bg-transparent group-hover:text-white">
                  <Sparkles size={16} className="text-[#8B5CF6] group-hover:text-white transition-colors" />
                  Upgrade to Pro
                </div>
              </motion.button>
            )}
          </div>
        )}

        {/* Profile & Workspace Switcher */}
        <div className="relative rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#151923] p-1 shadow-xl">
          
          <div className="flex items-center justify-between">
            <button
              onClick={() => !sidebarCollapsed && setUserMenuOpen(!userMenuOpen)}
              className={`flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[rgba(255,255,255,0.04)] ${sidebarCollapsed ? 'w-full justify-center' : 'flex-1'}`}
            >
              <div className="relative shrink-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#1A1F2E] to-[#2D3348] text-sm font-bold text-[#F1F3F9] shadow-inner border border-[rgba(255,255,255,0.05)]">
                  {initials || '?'}
                </div>
                <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-[#151923] bg-[#22C55E]" />
              </div>
              
              {!sidebarCollapsed && (
                <div className="flex flex-1 flex-col items-start overflow-hidden leading-tight">
                  <span className="truncate text-sm font-semibold text-[#F1F3F9] w-full text-left">
                    {user?.firstName} {user?.lastName}
                  </span>
                  <span className="truncate text-[10px] text-[#8892AA] font-medium w-full text-left">
                    {activeWorkspace?.name || 'Personal'}
                  </span>
                </div>
              )}
            </button>

            {!sidebarCollapsed && (
              <button
                onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
                className="shrink-0 rounded-xl p-2 text-[#4A5168] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F1F3F9] transition-colors mr-1"
              >
                <MoreHorizontal size={16} />
              </button>
            )}
          </div>

          {/* User Menu Dropdown */}
          <AnimatePresence>
            {userMenuOpen && !sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2, type: 'spring', bounce: 0.4 }}
                className="absolute bottom-full left-0 mb-3 w-full origin-bottom rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[#1A1F2E] p-2 shadow-2xl backdrop-blur-xl"
              >
                <div className="mb-2 px-2 pb-2 pt-1 border-b border-[rgba(255,255,255,0.06)]">
                  <p className="text-xs font-semibold text-[#F1F3F9]">Account</p>
                  <p className="text-[10px] text-[#8892AA]">{user?.emailAddresses?.[0]?.emailAddress}</p>
                </div>
                <button
                  onClick={() => signOut({ redirectUrl: '/' })}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-[#EF4444] transition-colors hover:bg-[rgba(239,68,68,0.1)]"
                >
                  <LogOutIcon size={16} />
                  Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Workspace Menu Dropdown */}
          <AnimatePresence>
            {wsDropdownOpen && !sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2, type: 'spring', bounce: 0.4 }}
                className="absolute bottom-full right-0 mb-3 w-64 origin-bottom rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[#1A1F2E] p-2 shadow-2xl backdrop-blur-xl z-50"
              >
                <div className="mb-2 px-2 pb-2 pt-1 border-b border-[rgba(255,255,255,0.06)]">
                  <p className="text-xs font-semibold text-[#F1F3F9]">Switch Workspace</p>
                </div>
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto custom-scrollbar">
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => {
                        setActiveWorkspace(ws);
                        setWsDropdownOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[rgba(255,255,255,0.04)] ${
                        ws.id === activeWorkspace?.id ? 'text-[#5B6EF0] bg-[rgba(91,110,240,0.1)]' : 'text-[#F1F3F9]'
                      }`}
                    >
                      <span className="truncate">{ws.name}</span>
                      {ws.id === activeWorkspace?.id && <CheckCircle2 size={16} />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export function DarkSidebar() {
  const { sidebarOpen, setSidebarOpen } = useUI();

  return (
    <>
      {/* Desktop: always visible (width handled in SidebarContent via flex layout) */}
      <aside className="fixed left-0 top-0 z-40 hidden h-full flex-col border-r border-[rgba(255,255,255,0.04)] bg-[#090B11] md:flex shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
        <SidebarContent />
      </aside>

      {/* Mobile: slide in/out */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-30 bg-[#05070B]/80 backdrop-blur-sm md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              className="fixed left-0 top-0 z-40 flex h-full w-[280px] flex-col border-r border-[rgba(255,255,255,0.06)] bg-[#090B11] md:hidden shadow-2xl"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.3, type: 'spring', bounce: 0 }}
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// Helper icons
function DatabaseIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  );
}

function LogOutIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
