'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, BookOpen, Rocket, Keyboard, Clock, 
  ListOrdered, Lightbulb, MessageSquare, Info, AlertTriangle, FileText
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';

import { PremiumBackground } from '@/components/landing/PremiumBackground';
import { HelpOverviewTab } from '@/components/help/HelpOverviewTab';
import { GettingStartedTab } from '@/components/help/GettingStartedTab';
import { DocumentationTab } from '@/components/help/DocumentationTab';
import { ShortcutsTab } from '@/components/help/ShortcutsTab';
import { ReleaseNotesTab } from '@/components/help/ReleaseNotesTab';
import { ChangelogTab } from '@/components/help/ChangelogTab';
import { FeatureRequestsTab } from '@/components/help/FeatureRequestsTab';
import { SupportTab } from '@/components/help/SupportTab';
import { FaqTab } from '@/components/help/FaqTab';
import { SystemStatusTab } from '@/components/help/SystemStatusTab';
import { AboutTab } from '@/components/help/AboutTab';

const NAV_GROUPS = [
  {
    title: 'Discover',
    items: [
      { id: 'overview', label: 'Overview', icon: BookOpen },
      { id: 'getting-started', label: 'Getting Started', icon: Rocket },
      { id: 'documentation', label: 'Documentation', icon: FileText },
      { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard },
    ]
  },
  {
    title: 'Updates',
    items: [
      { id: 'release-notes', label: 'Release Notes', icon: AlertTriangle },
      { id: 'changelog', label: 'Changelog', icon: ListOrdered },
    ]
  },
  {
    title: 'Community & Support',
    items: [
      { id: 'feature-requests', label: 'Feature Requests', icon: Lightbulb },
      { id: 'support', label: 'Support', icon: MessageSquare },
      { id: 'faq', label: 'FAQs', icon: Info },
    ]
  },
  {
    title: 'Platform',
    items: [
      { id: 'system-status', label: 'System Status', icon: ActivityIcon },
      { id: 'about', label: 'About', icon: Info },
    ]
  }
];

// Helper to provide the right icon if missing from import list above
function ActivityIcon(props: any) {
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
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

export default function HelpHub() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const queryTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(queryTab || 'overview');
  const [search, setSearch] = useState('');

  // Update tab when URL changes
  useEffect(() => {
    if (queryTab && queryTab !== activeTab) {
      setActiveTab(queryTab);
    }
  }, [queryTab]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    router.push(`/help?tab=${tabId}`);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return <HelpOverviewTab onNavigate={handleTabChange} />;
      case 'getting-started': return <GettingStartedTab />;
      case 'documentation': return <DocumentationTab />;
      case 'shortcuts': return <ShortcutsTab />;
      case 'release-notes': return <ReleaseNotesTab />;
      case 'changelog': return <ChangelogTab />;
      case 'feature-requests': return <FeatureRequestsTab />;
      case 'support': return <SupportTab />;
      case 'faq': return <FaqTab />;
      case 'system-status': return <SystemStatusTab />;
      case 'about': return <AboutTab />;
      default: return <HelpOverviewTab onNavigate={handleTabChange} />;
    }
  };

  return (
    <div className="relative min-h-screen bg-[#05070B] selection:bg-purple-500/30 selection:text-white pb-32">
      <PremiumBackground glowOpacity={0.1} />

      <div className="mx-auto flex w-full max-w-[1400px] flex-col lg:flex-row px-6 pt-12 pb-8 relative z-10 gap-12">
        
        {/* Left Navigation Sidebar */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-8">
          
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5168]" />
            <input 
              type="text" 
              placeholder="Search help..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0F1117] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors shadow-[0_0_15px_rgba(0,0,0,0.5)]"
            />
          </div>

          <div className="flex flex-col gap-6">
            {NAV_GROUPS.map((group) => {
              const filteredItems = group.items.filter(item => item.label.toLowerCase().includes(search.toLowerCase()));
              if (filteredItems.length === 0) return null;

              return (
                <div key={group.title} className="flex flex-col gap-1">
                  <h3 className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#4A5168] mb-2">{group.title}</h3>
                  {filteredItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleTabChange(item.id)}
                        className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                          isActive 
                            ? 'text-[#F1F3F9] bg-white/[0.06] shadow-sm' 
                            : 'text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.02]'
                          }
                        `}
                      >
                        {isActive && (
                          <motion.div 
                            layoutId="helpNavBackground"
                            className="absolute inset-0 bg-white/[0.06] rounded-xl border border-white/[0.04]"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                        <item.icon size={16} className={`relative z-10 ${isActive ? 'text-purple-400' : 'text-[#4A5168]'}`} />
                        <span className="relative z-10">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 pb-32">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
