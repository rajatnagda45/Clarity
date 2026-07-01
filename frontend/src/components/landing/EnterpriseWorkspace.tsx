"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Database, ShieldCheck, MessageSquare, BarChart, Bell, Zap, Search, Settings, MoreHorizontal, User, Sparkles } from "lucide-react";
import { AnimatedCounter } from "./pricing/AnimatedCounter";

const navItems = [
  { icon: Search, label: "Search" },
  { icon: Database, label: "Collections", active: true },
  { icon: FileText, label: "Documents" },
  { icon: MessageSquare, label: "AI Chat" },
  { icon: ShieldCheck, label: "Approvals" },
  { icon: BarChart, label: "Analytics" },
  { icon: Settings, label: "Settings" },
];

export function EnterpriseWorkspace() {
  const [docsProcessed, setDocsProcessed] = useState(14502);

  useEffect(() => {
    const interval = setInterval(() => setDocsProcessed(p => p + 1), 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="workspace" className="py-32 relative z-10 max-w-[1400px] mx-auto px-6 overflow-hidden">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Your Enterprise Workspace</h2>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          A powerful, collaborative environment built for legal and procurement teams to manage millions of documents securely.
        </p>
      </div>

      <div className="bg-[#0C0F16] border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden h-[800px] flex flex-col relative group">
        
        {/* Fake Browser Chrome */}
        <div className="h-12 border-b border-white/10 flex items-center px-4 bg-black/40 shrink-0 relative z-20">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-white/20 group-hover:bg-red-500/80 transition-colors" />
            <div className="w-3 h-3 rounded-full bg-white/20 group-hover:bg-yellow-500/80 transition-colors" />
            <div className="w-3 h-3 rounded-full bg-white/20 group-hover:bg-green-500/80 transition-colors" />
          </div>
          <div className="mx-auto w-96 h-7 bg-white/5 rounded-md border border-white/10 flex items-center justify-center text-[11px] text-gray-500 font-mono">
            <LockIcon /> app.clarity.ai
          </div>
          <div className="flex items-center gap-3">
            <Bell className="w-4 h-4 text-gray-400" />
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-orange-500 to-purple-500 border border-white/20" />
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden relative z-10">
          {/* Left Navigation */}
          <div className="w-64 border-r border-white/10 bg-[#080A0E] shrink-0 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-8 px-2">
                <div className="w-6 h-6 rounded bg-orange-500 flex items-center justify-center">
                  <Zap className="w-3 h-3 text-white" />
                </div>
                <span className="font-bold text-white tracking-tight">Acme Corp</span>
              </div>
              <div className="space-y-1">
                {navItems.map((item, i) => (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${item.active ? "bg-white/10 text-white" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"}`}>
                    <item.icon className={`w-4 h-4 ${item.active ? "text-orange-400" : ""}`} />
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Storage Used</div>
              <div className="w-full h-1.5 bg-black rounded-full overflow-hidden mb-2">
                <motion.div className="h-full bg-orange-500 rounded-full" initial={{ width: 0 }} whileInView={{ width: "65%" }} transition={{ duration: 1.5 }} />
              </div>
              <div className="text-xs font-mono text-gray-500">3.2 TB / 5 TB</div>
            </div>
          </div>

          {/* Center Main Area */}
          <div className="flex-1 bg-[#0C0F16] flex flex-col relative overflow-hidden">
            {/* Top Bar */}
            <div className="h-16 border-b border-white/10 flex items-center justify-between px-8 shrink-0 bg-[#0C0F16]/90 backdrop-blur-md z-10">
              <h1 className="text-xl font-bold text-white">Vendor Contracts 2023</h1>
              <div className="flex gap-3">
                <button className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-colors flex items-center gap-2">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                <button className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-medium text-white transition-colors flex items-center gap-2 shadow-lg shadow-orange-500/20">
                  <UploadCloudIcon /> Upload Documents
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="text-sm text-gray-400 mb-2">Total Documents</div>
                  <div className="text-3xl font-mono text-white font-bold tracking-tight">
                    <AnimatedCounter value={docsProcessed} duration={500} />
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  </div>
                  <div className="text-sm text-gray-400 mb-2">Processing Pipeline</div>
                  <div className="text-3xl font-bold text-green-400 tracking-tight">Active</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="text-sm text-gray-400 mb-2">Verified Claims</div>
                  <div className="text-3xl font-mono text-white font-bold tracking-tight">2.4M</div>
                </div>
              </div>

              {/* Document List */}
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/10 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <div className="col-span-6">Name</div>
                  <div className="col-span-3">Status</div>
                  <div className="col-span-3">Date Added</div>
                </div>
                {[1, 2, 3, 4, 5].map((row, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="grid grid-cols-12 gap-4 p-4 border-b border-white/5 hover:bg-white/5 transition-colors items-center text-sm"
                  >
                    <div className="col-span-6 flex items-center gap-3">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-200">Vendor_MSA_00{row}_Executed.pdf</span>
                    </div>
                    <div className="col-span-3">
                      {i === 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20">
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full" />
                          Embedding
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 text-green-400 text-xs font-medium border border-green-500/20">
                          <ShieldCheck className="w-3 h-3" /> Indexed
                        </span>
                      )}
                    </div>
                    <div className="col-span-3 text-gray-500 font-mono text-xs">
                      Oct 14, 2023
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Right AI Assistant Panel */}
          <div className="w-80 border-l border-white/10 bg-[#080A0E] shrink-0 flex flex-col relative">
            <div className="absolute inset-0 bg-gradient-to-b from-orange-500/5 to-transparent pointer-events-none" />
            
            <div className="p-6 border-b border-white/10 relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-orange-400" />
                <h3 className="font-bold text-white">Collection Assistant</h3>
              </div>
              <p className="text-xs text-gray-400">Ask questions across all 14,502 documents in this collection.</p>
            </div>

            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-gray-300">
                Hi! I&apos;m ready to answer questions about the Vendor Contracts 2023 collection.
              </div>
              
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-4">Suggested Queries</div>
              {[
                "Which contracts expire in Q4?",
                "Find vendors with liability caps under $1M",
                "Summarize SLA penalties for Acme Corp"
              ].map((q, i) => (
                <div key={i} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/10 hover:border-orange-500/30 cursor-pointer transition-colors">
                  {q}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-white/10 relative z-10">
              <div className="relative">
                <input type="text" placeholder="Ask a question..." className="w-full bg-black/50 border border-white/20 rounded-lg pl-4 pr-10 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors" disabled />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded bg-orange-500 flex items-center justify-center">
                  <span className="text-white text-xs">↑</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}

function LockIcon() {
  return (
    <svg className="w-3 h-3 mr-1.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
  )
}
function UploadCloudIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M12 12v9"></path><path d="m16 16-4-4-4 4"></path></svg>
  )
}
