'use client';

import { Lock } from 'lucide-react';

export function PlaceholderTab({ title, description, icon: Icon }: { title: string, description: string, icon: any }) {
  return (
    <div className="flex flex-col animate-in fade-in duration-500 min-h-[500px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#F1F3F9] tracking-tight">{title}</h1>
          <p className="text-sm text-[#8892AA] mt-1">{description}</p>
        </div>
      </div>

      <div className="flex-1 bg-[#0F1117] border border-white/[0.06] rounded-[32px] flex flex-col items-center justify-center p-12 text-center relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/5 blur-[80px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-6 shadow-xl">
            <Icon size={24} className="text-[#4A5168]" />
          </div>
          
          <h2 className="text-xl font-bold text-[#F1F3F9] mb-3 flex items-center gap-2">
            <Lock size={18} className="text-purple-400" /> Awaiting API Integration
          </h2>
          
          <p className="text-sm text-[#8892AA] max-w-[400px] mb-8 leading-relaxed">
            The frontend UI for the <strong className="text-[#F1F3F9]">{title}</strong> module is ready, but the required backend endpoints are currently being provisioned. This section will automatically unlock once the API is available.
          </p>

          <div className="flex items-center gap-4">
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-mono text-[#4A5168] uppercase tracking-wider">Status: Provisioning</span>
          </div>
        </div>
      </div>
    </div>
  );
}
