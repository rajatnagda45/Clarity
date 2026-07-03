'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useDocuments } from '@/hooks/useDocuments';
import { FileText, Building2, CheckCircle2, AlertTriangle, CloudUpload } from 'lucide-react';

export type NotificationCategory = 'Documents' | 'Workspace' | 'AI' | 'Billing' | 'Security' | 'System';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  category: NotificationCategory;
  icon: any;
  createdAt: string;
  isRead: boolean;
  priority: 'normal' | 'high' | 'urgent';
  workspaceId: string;
  actionUrl?: string;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  toggle: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { activeWorkspace } = useWorkspace();
  const { data: documents = [] } = useDocuments();
  
  const [isOpen, setIsOpen] = useState(false);
  const [readState, setReadState] = useState<Record<string, boolean>>({});

  const toggle = () => setIsOpen(prev => !prev);

  // Load read state from localStorage
  useEffect(() => {
    if (activeWorkspace) {
      const stored = localStorage.getItem(`clarity_notifications_${activeWorkspace.id}`);
      if (stored) {
        try {
          setReadState(JSON.parse(stored));
        } catch (e) {}
      }
    }
  }, [activeWorkspace]);

  // Persist read state to localStorage
  const saveReadState = (newState: Record<string, boolean>) => {
    setReadState(newState);
    if (activeWorkspace) {
      localStorage.setItem(`clarity_notifications_${activeWorkspace.id}`, JSON.stringify(newState));
    }
  };

  const markAsRead = (id: string) => {
    saveReadState({ ...readState, [id]: true });
  };

  const markAllAsRead = () => {
    const newState = { ...readState };
    notifications.forEach(n => {
      newState[n.id] = true;
    });
    saveReadState(newState);
  };

  // Derive notifications from actual backend data
  const notifications = useMemo(() => {
    if (!activeWorkspace) return [];

    const items: NotificationItem[] = [];

    // 1. Workspace Event
    items.push({
      id: `ws-${activeWorkspace.id}`,
      title: 'Workspace Provisioned',
      description: `Welcome to ${activeWorkspace.name}. Your ${activeWorkspace.plan} plan is active.`,
      category: 'Workspace',
      icon: Building2,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Fake 1 week ago for demo since ws doesn't have createdAt
      isRead: readState[`ws-${activeWorkspace.id}`] || false,
      priority: 'normal',
      workspaceId: activeWorkspace.id,
      actionUrl: '/settings'
    });

    // 2. Document Events
    documents.forEach(doc => {
      if (doc.status === 'indexed') {
        items.push({
          id: `doc-idx-${doc.id}`,
          title: 'Document Indexing Complete',
          description: `${doc.filename} has been fully vectorized and is ready for AI retrieval.`,
          category: 'Documents',
          icon: CheckCircle2,
          createdAt: doc.createdAt,
          isRead: readState[`doc-idx-${doc.id}`] || false,
          priority: 'normal',
          workspaceId: activeWorkspace.id,
          actionUrl: '/documents'
        });
      } else if (doc.status === 'failed') {
        items.push({
          id: `doc-fail-${doc.id}`,
          title: 'Processing Failed',
          description: `Failed to process ${doc.filename}. Click to view error logs.`,
          category: 'System',
          icon: AlertTriangle,
          createdAt: doc.createdAt,
          isRead: readState[`doc-fail-${doc.id}`] || false,
          priority: 'high',
          workspaceId: activeWorkspace.id,
          actionUrl: '/dashboard'
        });
      } else if (doc.status === 'uploaded') {
        items.push({
          id: `doc-up-${doc.id}`,
          title: 'Document Uploaded',
          description: `${doc.filename} was successfully uploaded to vector storage.`,
          category: 'Documents',
          icon: CloudUpload,
          createdAt: doc.createdAt,
          isRead: readState[`doc-up-${doc.id}`] || false,
          priority: 'normal',
          workspaceId: activeWorkspace.id,
          actionUrl: '/documents'
        });
      }
    });

    // Sort by newest first
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activeWorkspace, documents, readState]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Global Keyboard Shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'N' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, isOpen, setIsOpen, toggle, markAsRead, markAllAsRead
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
