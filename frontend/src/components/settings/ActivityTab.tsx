'use client';

import { useNotifications } from '@/contexts/NotificationContext';
import { Activity, Clock } from 'lucide-react';
import { formatRelativeTime } from '@/lib/time';

export function ActivityTab() {
  const { notifications } = useNotifications();

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Activity size={24} className="text-purple-400" />
          Activity Timeline
        </h1>
        <p className="text-sm text-[#8892AA] mt-1">A unified history of your workspace events, document uploads, and AI usage.</p>
      </div>

      <div className="bg-[#0F1117] border border-white/[0.08] rounded-2xl p-8">
        {notifications.length > 0 ? (
          <div className="relative border-l border-white/[0.08] ml-4 space-y-8 py-4">
            {notifications.map((n) => (
              <div key={n.id} className="relative pl-8">
                {/* Timeline Dot */}
                <div className={`absolute -left-[17px] top-1 w-[34px] h-[34px] rounded-full border-[4px] border-[#0F1117] flex items-center justify-center ${
                  n.priority === 'high' 
                    ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.3)]' 
                    : 'bg-white/[0.08] text-[#8892AA]'
                }`}>
                  <n.icon size={14} />
                </div>
                
                {/* Content */}
                <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-5 hover:bg-white/[0.04] transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className="text-sm font-semibold text-white">{n.title}</h3>
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-[#4A5168] whitespace-nowrap">
                      <Clock size={12} />
                      {formatRelativeTime(n.createdAt)}
                    </div>
                  </div>
                  <p className="text-xs text-[#8892AA] leading-relaxed">
                    {n.description}
                  </p>
                  
                  {n.actionUrl && (
                    <button className="mt-4 text-[10px] font-bold text-purple-400 uppercase tracking-wider hover:text-purple-300 transition-colors">
                      View Details &rarr;
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-6">
              <Activity size={32} className="text-[#4A5168]" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No Activity Yet</h3>
            <p className="text-sm text-[#8892AA] max-w-md mx-auto">
              Your recent events will appear here once you start using Clarity.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
