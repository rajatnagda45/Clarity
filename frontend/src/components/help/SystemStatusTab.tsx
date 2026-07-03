'use client';

import { motion } from 'framer-motion';
import { Activity, CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';

const SERVICES = [
  { name: 'API Services', status: 'operational', uptime: '99.99%', lat: '45ms' },
  { name: 'Authentication (Clerk)', status: 'operational', uptime: '100%', lat: '12ms' },
  { name: 'AI Models (OpenAI/Anthropic)', status: 'operational', uptime: '99.95%', lat: '850ms' },
  { name: 'Vector Database (Pinecone)', status: 'operational', uptime: '99.99%', lat: '32ms' },
  { name: 'Document Parsing', status: 'degraded', uptime: '98.5%', lat: '2.4s' },
  { name: 'Storage (S3)', status: 'operational', uptime: '100%', lat: '18ms' },
];

const STATUS_CONFIG = {
  'operational': { label: 'Operational', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  'degraded': { label: 'Degraded Performance', icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  'outage': { label: 'Major Outage', icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-400/10' },
};

export function SystemStatusTab() {
  const allOperational = SERVICES.every(s => s.status === 'operational');

  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-4xl">
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#F1F3F9] tracking-tight flex items-center gap-3">
            <Activity className="text-purple-400" size={28} />
            System Status
          </h1>
          <p className="text-[#8892AA] mt-2 text-lg">Real-time status of Clarity infrastructure and services.</p>
        </div>
      </div>

      <div className={`p-6 rounded-[24px] mb-8 flex items-center justify-between border ${
        allOperational 
          ? 'bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]' 
          : 'bg-amber-500/10 border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.1)]'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
            allOperational ? 'bg-emerald-400/20 text-emerald-400' : 'bg-amber-400/20 text-amber-400'
          }`}>
            {allOperational ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
          </div>
          <div>
            <h2 className={`text-xl font-bold ${allOperational ? 'text-emerald-400' : 'text-amber-400'}`}>
              {allOperational ? 'All Systems Operational' : 'Some systems are experiencing issues'}
            </h2>
            <p className="text-[#8892AA] text-sm mt-1">Last updated just now.</p>
          </div>
        </div>
        <button className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-[#F1F3F9] text-sm font-medium rounded-xl border border-white/[0.04] transition-colors">
          <Clock size={16} className="text-[#4A5168]" />
          View History
        </button>
      </div>

      <div className="bg-[#0F1117] border border-white/[0.06] rounded-[24px] overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/[0.04]">
          {SERVICES.map((service, i) => {
            const status = STATUS_CONFIG[service.status as keyof typeof STATUS_CONFIG];
            const StatusIcon = status.icon;
            
            return (
              <motion.div 
                key={service.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="p-6 border-b border-white/[0.04]"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-semibold text-[#F1F3F9]">{service.name}</h3>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${status.bg} ${status.color}`}>
                    <StatusIcon size={12} />
                    {status.label}
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#4A5168] font-bold mb-1">Uptime (30d)</p>
                    <p className="text-[#F1F3F9] font-mono text-sm">{service.uptime}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#4A5168] font-bold mb-1">Latency</p>
                    <p className="text-[#F1F3F9] font-mono text-sm">{service.lat}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
