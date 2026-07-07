'use client';

import { lazy, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { DarkSidebar } from './DarkSidebar';
import { DarkTopbar } from './DarkTopbar';
import { AIAssistantPanel } from './AIAssistantPanel';

import { CommandProvider } from '@/contexts/CommandContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { UIProvider, useUI } from '@/contexts/UIContext';
import { CommandCenter } from './CommandCenter';
import { NotificationDrawer } from './NotificationDrawer';

import { OnboardingProvider, useOnboarding } from '@/contexts/OnboardingContext';

const OnboardingWelcome    = lazy(() => import('@/components/onboarding/OnboardingWelcome').then(m => ({ default: m.OnboardingWelcome })));
const OnboardingWizard     = lazy(() => import('@/components/onboarding/OnboardingWizard').then(m => ({ default: m.OnboardingWizard })));
const OnboardingChecklist  = lazy(() => import('@/components/onboarding/OnboardingChecklist').then(m => ({ default: m.OnboardingChecklist })));
const CompletionCelebration = lazy(() => import('@/components/onboarding/CompletionCelebration').then(m => ({ default: m.CompletionCelebration })));
const Spotlight            = lazy(() => import('@/components/onboarding/Spotlight').then(m => ({ default: m.Spotlight })));
const PerformanceOverlay   = lazy(() => import('@/components/perf/PerformanceOverlay').then(m => ({ default: m.PerformanceOverlay })));

function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { showWelcome, showWizard } = useOnboarding();
  const { sidebarCollapsed } = useUI();
  const showAIPanel = pathname === '/dashboard';
  const hideDashboard = showWelcome || showWizard;

  if (hideDashboard) {
    return (
      <div className="flex h-screen w-screen bg-[#05070B]">
        <Suspense fallback={null}>
          <OnboardingWelcome />
          <OnboardingWizard />
        </Suspense>
      </div>
    );
  }

  const leftMargin = sidebarCollapsed ? 'md:ml-[80px]' : 'md:ml-[288px]';

  return (
    <CommandProvider>
      <NotificationProvider>
        <div className="flex h-screen bg-[#05070B] text-[#F1F3F9]">
          <DarkSidebar />
          <div className={`flex flex-1 flex-col min-w-0 ${showAIPanel ? 'mr-[280px]' : ''}`}>
            <DarkTopbar />
            <main className={`flex-1 overflow-y-auto pt-14 ${leftMargin} transition-all duration-300 ease-in-out`}>
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={pathname}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
                  className="min-h-full"
                >
                  <Suspense fallback={null}>
                    {children}
                  </Suspense>
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
          {showAIPanel && (
            <div className="fixed right-0 top-0 h-full w-[280px] z-20">
              <AIAssistantPanel />
            </div>
          )}
        </div>
        <CommandCenter />
        <NotificationDrawer />

        <Suspense fallback={null}>
          <OnboardingChecklist />
          <CompletionCelebration />
          {process.env.NODE_ENV === 'development' && <PerformanceOverlay />}
          <Spotlight
            id="cmd-center"
            targetId="topbar-command-center"
            title="Command Center"
            description="Hit ⌘K from anywhere to jump between documents, chats, and settings without touching the mouse."
            placement="bottom"
            condition={pathname === '/dashboard'}
          />
          <Spotlight
            id="notifications"
            targetId="topbar-notifications"
            title="Stay Updated"
            description="We'll notify you here when your documents finish indexing or when team members invite you to collections."
            placement="bottom"
            condition={pathname === '/documents'}
          />
        </Suspense>
      </NotificationProvider>
    </CommandProvider>
  );
}

export function DarkAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingProvider>
      <LayoutInner>{children}</LayoutInner>
    </OnboardingProvider>
  );
}
