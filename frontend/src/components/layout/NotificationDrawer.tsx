'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Bell, Settings, Filter, Inbox, ArrowRight } from 'lucide-react';
import { useNotifications, NotificationItem } from '@/contexts/NotificationContext';

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function groupNotifications(notifications: NotificationItem[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: Record<string, NotificationItem[]> = {
    'Today': [],
    'Yesterday': [],
    'Earlier': []
  };

  notifications.forEach(n => {
    const d = new Date(n.createdAt);
    if (d >= today) {
      groups['Today'].push(n);
    } else if (d >= yesterday) {
      groups['Yesterday'].push(n);
    } else {
      groups['Earlier'].push(n);
    }
  });

  return groups;
}

export function NotificationDrawer() {
  const { isOpen, setIsOpen, notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const filteredNotifications = notifications.filter(n => filter === 'all' || !n.isRead);
  const grouped = groupNotifications(filteredNotifications);

  const handleAction = (n: NotificationItem) => {
    if (!n.isRead) markAsRead(n.id);
    if (n.actionUrl) {
      router.push(n.actionUrl);
      setIsOpen(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-[#05070B]/60 backdrop-blur-sm z-[100]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-[#05070B] border-l border-white/[0.06] z-[110] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] bg-[#0F1117]/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                  <Bell size={16} className="text-[#F1F3F9]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#F1F3F9] tracking-tight">Notifications</h2>
                  <p className="text-[10px] text-[#8892AA] uppercase tracking-wider">{unreadCount} Unread</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="p-2 text-[#4A5168] hover:text-[#F1F3F9] hover:bg-white/[0.06] rounded-md transition-colors"
                    title="Mark all as read"
                  >
                    <Check size={16} />
                  </button>
                )}
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-[#4A5168] hover:text-[#F1F3F9] hover:bg-white/[0.06] rounded-md transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="px-6 py-4 flex items-center gap-4 border-b border-white/[0.04]">
              <button 
                onClick={() => setFilter('all')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${filter === 'all' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-[#8892AA] hover:text-[#F1F3F9]'}`}
              >
                All
              </button>
              <button 
                onClick={() => setFilter('unread')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${filter === 'unread' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-[#8892AA] hover:text-[#F1F3F9]'}`}
              >
                Unread
                {unreadCount > 0 && <span className="bg-purple-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
              </button>
            </div>

            {/* Feed */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full px-6 text-center text-[#8892AA] opacity-50">
                  <Inbox size={48} className="mb-4 text-[#4A5168]" />
                  <p className="text-sm font-semibold text-[#F1F3F9]">All caught up!</p>
                  <p className="text-xs mt-1">You have no {filter === 'unread' ? 'unread ' : ''}notifications.</p>
                </div>
              ) : (
                <div className="py-2">
                  {['Today', 'Yesterday', 'Earlier'].map(group => {
                    if (grouped[group].length === 0) return null;
                    return (
                      <div key={group} className="mb-6">
                        <h3 className="px-6 py-2 text-[10px] font-bold text-[#4A5168] uppercase tracking-wider sticky top-0 bg-[#05070B]/90 backdrop-blur-md z-10">
                          {group}
                        </h3>
                        <div className="flex flex-col">
                          {grouped[group].map(n => {
                            const isUnread = !n.isRead;
                            return (
                              <button
                                key={n.id}
                                onClick={() => handleAction(n)}
                                className={`relative group px-6 py-4 flex items-start gap-4 text-left border-b border-white/[0.02] transition-colors hover:bg-white/[0.02] ${isUnread ? 'bg-purple-500/[0.02]' : ''}`}
                              >
                                {/* Unread indicator */}
                                {isUnread && (
                                  <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                                )}
                                
                                <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border ${
                                  n.priority === 'high' 
                                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                    : isUnread 
                                      ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' 
                                      : 'bg-white/[0.04] border-white/[0.06] text-[#8892AA]'
                                }`}>
                                  <n.icon size={14} />
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className={`text-xs font-bold truncate ${isUnread ? 'text-[#F1F3F9]' : 'text-[#8892AA]'}`}>
                                      {n.title}
                                    </span>
                                    <span className="text-[10px] font-medium text-[#4A5168] whitespace-nowrap">
                                      {formatRelativeTime(n.createdAt)}
                                    </span>
                                  </div>
                                  <p className={`text-xs leading-relaxed line-clamp-2 ${isUnread ? 'text-[#8892AA]' : 'text-[#4A5168]'}`}>
                                    {n.description}
                                  </p>
                                </div>

                                {n.actionUrl && (
                                  <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="w-6 h-6 rounded bg-white/[0.06] flex items-center justify-center text-[#F1F3F9]">
                                      <ArrowRight size={14} />
                                    </div>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/[0.06] bg-[#0F1117]/50 flex justify-center">
              <button 
                onClick={() => { setIsOpen(false); router.push('/settings'); }}
                className="text-xs font-semibold text-[#8892AA] hover:text-[#F1F3F9] flex items-center gap-2 transition-colors"
              >
                <Settings size={14} /> Notification Settings
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
