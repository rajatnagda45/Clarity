"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { CheckCircle2, FileText, Search, Loader2 } from "lucide-react";

export function FloatingDashboardPreview() {
  const [step, setStep] = useState(0);

  // Sequence:
  // 0: Idle (Searching)
  // 1: Processing Document
  // 2: AI Typing Response
  // 3: Toast Indexed / Complete
  
  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.5, type: "spring", bounce: 0.2 }}
      className="relative w-full max-w-[480px] h-[320px] rounded-2xl overflow-hidden border border-white/10 bg-[#0F1117]/80 backdrop-blur-xl shadow-2xl shadow-blue-900/20 mt-12"
    >
      {/* Top Bar */}
      <div className="h-10 border-b border-white/5 flex items-center px-4 gap-2">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
          <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
          <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
        </div>
        <div className="mx-auto w-1/2 h-5 rounded-md bg-[#05070B] border border-white/5 flex items-center px-2">
          <Search className="w-3 h-3 text-gray-500 mr-2" />
          <div className="w-20 h-1.5 bg-gray-600 rounded-full" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-5 flex gap-4 h-[calc(100%-40px)] relative">
        {/* Sidebar */}
        <div className="w-36 flex flex-col gap-3 border-r border-white/5 pr-4 shrink-0">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Knowledge Base</div>
          <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-500/10 px-2 py-1.5 rounded border border-blue-500/20">
            <FileText className="w-3 h-3" />
            <span className="truncate">Master_MSA_2024.pdf</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-300 px-2 py-1.5 transition-colors">
            <FileText className="w-3 h-3" />
            <span className="truncate">Q3_Financials.xlsx</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-300 px-2 py-1.5 transition-colors">
            <FileText className="w-3 h-3" />
            <span className="truncate">SOC2_Audit_Report.pdf</span>
          </div>
        </div>

        {/* Main View */}
        <div className="flex-1 flex flex-col gap-4 relative">
          
          {/* Document Section */}
          <div className="flex gap-3 items-start bg-white/[0.02] p-3 rounded-lg border border-white/5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-blue-400" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="text-xs font-semibold text-gray-200">Clause 4.2: Termination Notice</div>
              <div className="text-[10px] text-gray-400 leading-relaxed">
                Either party may terminate this Agreement without cause upon providing ninety (90) days prior written notice to the other party...
              </div>
            </div>
          </div>

          {/* AI Response Area */}
          <div className="mt-auto bg-[#05070B] rounded-xl p-4 border border-white/5 shadow-inner">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-[9px] font-bold text-white">C</span>
              </div>
              <span className="text-xs font-medium text-gray-300">Clarity AI</span>
            </div>
            
            <div className="space-y-2">
              <AnimatePresence mode="wait">
                {step === 0 && (
                  <motion.div key="searching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-xs text-gray-500 font-medium">Analyzing query...</span>
                  </motion.div>
                )}
                {step === 1 && (
                  <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />
                    <span className="text-xs text-gray-400 font-medium">Scanning Master_MSA_2024.pdf...</span>
                  </motion.div>
                )}
                {(step === 2 || step === 3) && (
                  <motion.div key="response" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                    <p className="text-xs text-gray-300 leading-relaxed">
                      According to the MSA, the required termination notice is <span className="text-white font-semibold">90 days</span> without cause.
                    </p>
                    <div className="flex gap-2 mt-2">
                      {/* Citation Badges */}
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-sm cursor-pointer hover:bg-blue-500/20 transition-colors">
                        Clause 4.2
                      </span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-sm cursor-pointer hover:bg-purple-500/20 transition-colors">
                        pg 12
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Tiny Toast */}
        <AnimatePresence>
          {step === 3 && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute top-2 right-2 bg-[#05070B] border border-green-500/20 rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-lg"
            >
              <CheckCircle2 className="w-3 h-3 text-green-400" />
              <span className="text-[10px] font-medium text-gray-300">Indexed 12 documents</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating ambient glow specifically for the dashboard */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] bg-blue-500/10 blur-[60px] rounded-full pointer-events-none z-[-1]" />
    </motion.div>
  );
}
