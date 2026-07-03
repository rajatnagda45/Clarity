'use client';

import { WorkspaceTab } from '@/components/settings/WorkspaceTab';
import { PremiumBackground } from '@/components/landing/PremiumBackground';

export default function WorkspacePage() {
  return (
    <div className="relative min-h-screen bg-[#05070B] selection:bg-purple-500/30 selection:text-white pb-32">
      <PremiumBackground glowOpacity={0.1} />
      <div className="mx-auto flex w-full max-w-[1000px] flex-col px-6 pt-12 pb-8 relative z-10">
        <WorkspaceTab />
      </div>
    </div>
  );
}
