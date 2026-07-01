"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Server, Zap, ShieldAlert, Cpu } from "lucide-react";
import { AnimatedCounter } from "./pricing/AnimatedCounter";

export function ObservabilityDashboard() {
  const [latency, setLatency] = useState(245);
  const [reqs, setReqs] = useState(1450);

  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(prev => prev + (Math.random() > 0.5 ? Math.random() * 15 : -Math.random() * 15));
      setReqs(prev => prev + Math.floor(Math.random() * 5));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="observability" className="py-32 relative z-10 max-w-[1400px] mx-auto px-6 overflow-hidden">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Complete Observability</h2>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Monitor every stage of the reasoning pipeline in real-time. Track latency, trust scores, and token usage down to the millisecond.
        </p>
      </div>

      <div className="bg-[#0C0F16] border border-white/10 rounded-3xl p-8 shadow-2xl relative">
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none rounded-3xl" />
        
        {/* Top KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <KpiCard title="Avg Latency" value={latency} format={(v: number) => `${v.toFixed(0)}ms`} icon={Zap} color="text-yellow-400" />
          <KpiCard title="Requests / min" value={reqs} format={(v: number) => v.toFixed(0)} icon={Activity} color="text-blue-400" />
          <KpiCard title="Avg Trust Score" value={98.7} format={(v: number) => `${v.toFixed(1)}%`} icon={ShieldAlert} color="text-green-400" />
          <KpiCard title="GPU Utilization" value={64} format={(v: number) => `${v.toFixed(0)}%`} icon={Cpu} color="text-purple-400" />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Main Chart: Throughput & Latency */}
          <div className="lg:col-span-2 bg-[#151921] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Real-time Streaming Output
            </h3>
            
            <div className="h-64 w-full relative flex items-end">
              {/* Background Grid */}
              <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 opacity-10">
                {[...Array(24)].map((_, i) => <div key={i} className="border-[0.5px] border-white/20" />)}
              </div>
              
              {/* Animated Bars */}
              <div className="flex items-end justify-between w-full h-full pb-4 px-2 relative z-10 gap-1">
                {[...Array(40)].map((_, i) => (
                  <motion.div 
                    key={i}
                    className="w-full bg-gradient-to-t from-orange-500/20 to-orange-500/80 rounded-t-sm"
                    initial={{ height: "20%" }}
                    animate={{ height: `${20 + Math.random() * 80}%` }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatType: "mirror", delay: i * 0.05 }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Events & Heatmap */}
          <div className="space-y-8">
            
            {/* Heatmap */}
            <div className="bg-[#151921] border border-white/5 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Node Activity Heatmap</h3>
              <div className="grid grid-cols-7 gap-1.5">
                {[...Array(35)].map((_, i) => (
                  <motion.div 
                    key={i}
                    className="aspect-square rounded-[3px] bg-white/5"
                    animate={{ backgroundColor: Math.random() > 0.7 ? "rgba(245,158,11,0.8)" : Math.random() > 0.4 ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.05)" }}
                    transition={{ duration: 3, repeat: Infinity, repeatType: "reverse", delay: i * 0.1 }}
                  />
                ))}
              </div>
            </div>

            {/* Event Log */}
            <div className="bg-[#151921] border border-white/5 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Server className="w-4 h-4" /> Live Events
              </h3>
              <div className="space-y-3 font-mono text-[11px]">
                {[
                  { evt: "QUERY_START", id: "req_9f8", status: "OK", color: "text-green-400" },
                  { evt: "RETRIEVAL", id: "idx_col1", status: "45ms", color: "text-blue-400" },
                  { evt: "NLI_CHECK", id: "val_sys", status: "PASS", color: "text-green-400" },
                  { evt: "WARN_LOW_CONF", id: "req_2a1", status: "0.64", color: "text-yellow-400" },
                ].map((log, i) => (
                  <div key={i} className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-gray-500">{log.evt}</span>
                    <span className="text-gray-400">{log.id}</span>
                    <span className={log.color}>{log.status}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}

function KpiCard({ title, value, format, icon: Icon, color }: any) {
  return (
    <div className="bg-[#151921] border border-white/5 rounded-2xl p-5 flex flex-col justify-between h-32">
      <div className="flex items-center gap-2 text-gray-400">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
      </div>
      <div className="text-3xl font-mono font-bold text-white tracking-tight">
        <AnimatedCounter value={value} duration={1000} />
        {format(value).replace(/[\d\.]/g, '')}
      </div>
    </div>
  );
}
