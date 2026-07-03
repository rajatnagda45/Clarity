'use client';

import { motion } from 'framer-motion';
import { MessageSquare, Mail, Bug, ShieldAlert, Video, Ticket } from 'lucide-react';

const SUPPORT_CHANNELS = [
  {
    title: 'Submit a Ticket',
    desc: 'Get help with your workspace or billing. Typical response time: < 2 hours.',
    icon: Ticket,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10'
  },
  {
    title: 'Report a Bug',
    desc: 'Found something broken? Let our engineering team know.',
    icon: Bug,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10'
  },
  {
    title: 'Security Vulnerability',
    desc: 'Report security issues directly to our security team.',
    icon: ShieldAlert,
    color: 'text-rose-400',
    bg: 'bg-rose-400/10'
  },
  {
    title: 'Request a Demo',
    desc: 'Schedule a call with sales to learn about Enterprise plans.',
    icon: Video,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10'
  },
  {
    title: 'Email Support',
    desc: 'Reach out to support@clarity.ai for general inquiries.',
    icon: Mail,
    color: 'text-purple-400',
    bg: 'bg-purple-400/10'
  },
  {
    title: 'Live Chat',
    desc: 'Available 9AM - 5PM EST for Pro and Enterprise plans.',
    icon: MessageSquare,
    color: 'text-[#8892AA]',
    bg: 'bg-white/[0.04]',
    disabled: true
  }
];

export function SupportTab() {
  return (
    <div className="flex flex-col animate-in fade-in duration-500 max-w-4xl">
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#F1F3F9] tracking-tight flex items-center gap-3">
            <MessageSquare className="text-purple-400" size={28} />
            Support Center
          </h1>
          <p className="text-[#8892AA] mt-2 text-lg">We are here to help. Choose the right channel for your request.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SUPPORT_CHANNELS.map((channel, i) => (
          <motion.button
            key={channel.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            disabled={channel.disabled}
            whileHover={!channel.disabled ? { y: -2, scale: 1.01 } : {}}
            whileTap={!channel.disabled ? { scale: 0.99 } : {}}
            className={`flex items-start gap-4 p-5 rounded-[24px] border text-left transition-all group ${
              channel.disabled 
                ? 'bg-white/[0.01] border-white/[0.02] opacity-50 cursor-not-allowed' 
                : 'bg-[#0F1117] border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.02]'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${channel.bg}`}>
              <channel.icon size={20} className={channel.color} />
            </div>
            <div className="flex-1 mt-0.5">
              <div className="flex items-center gap-2 mb-1">
                <h3 className={`font-semibold ${channel.disabled ? 'text-[#8892AA]' : 'text-[#F1F3F9] group-hover:text-purple-400'} transition-colors`}>
                  {channel.title}
                </h3>
                {channel.disabled && (
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-white/[0.06] text-[#8892AA] px-1.5 py-0.5 rounded">Coming Soon</span>
                )}
              </div>
              <p className="text-[#8892AA] text-sm">{channel.desc}</p>
            </div>
          </motion.button>
        ))}
      </div>

    </div>
  );
}
