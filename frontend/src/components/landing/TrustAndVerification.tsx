"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { ShieldCheck, Target, Zap, Bot, User, FileText, ChevronLeft, ChevronRight, Search, ZoomIn, Download, Menu, ChevronDown, CheckCircle2 } from "lucide-react";


const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function TrustAndVerification() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: false, margin: "-20%" });
  
  // Phase 0: Idle / Reset
  // Phase 1: Typing question
  // Phase 2: Thinking...
  // Phase 3: Streaming "Based on the Acme Corp..."
  // Phase 4: Streaming "Termination: ... [§4.2]"
  // Phase 5: Scrolling PDF to 4.2 & Highlight
  // Phase 6: Streaming "Liability Cap: ... [§8.1]"
  // Phase 7: Scrolling PDF to 8.1 & Highlight
  // Phase 8: Verification badges fade in
  const [phase, setPhase] = useState(0);
  const [qText, setQText] = useState("");
  
  const pdfScrollRef = useRef<HTMLDivElement>(null);

  // Line drawing coordinates
  const [lineCoords, setLineCoords] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);
  
  const citation1Ref = useRef<HTMLSpanElement>(null);
  const citation2Ref = useRef<HTMLSpanElement>(null);
  const target1Ref = useRef<HTMLDivElement>(null);
  const target2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isInView) return;
    
    let isMounted = true;
    
    const runSequence = async () => {
      while (isMounted) {
        // Reset
        setPhase(0);
        setQText("");
        setLineCoords(null);
        if (pdfScrollRef.current) pdfScrollRef.current.scrollTo({ top: 0, behavior: 'auto' });
        await sleep(1000);
        
        if (!isMounted) break;

        // 1. Typing question
        setPhase(1);
        const fullQ = "What is the termination notice period and liability cap in the Acme MSA?";
        for (let i = 0; i <= fullQ.length; i++) {
          if (!isMounted) return;
          setQText(fullQ.slice(0, i));
          await sleep(30);
        }
        await sleep(500);

        // 2. Thinking
        setPhase(2);
        await sleep(1500);

        // 3. Start Streaming Answer
        setPhase(3);
        await sleep(1000);

        // 4. Citation 1
        setPhase(4);
        await sleep(500);

        // 5. PDF Scroll & Highlight Citation 1
        setPhase(5);
        if (pdfScrollRef.current) {
          pdfScrollRef.current.scrollTo({ top: 380, behavior: 'smooth' });
        }
        await sleep(1500); // Wait for scroll
        
        // Draw connecting beam for Citation 1
        if (citation1Ref.current && target1Ref.current && sectionRef.current) {
          const sectionRect = sectionRef.current.getBoundingClientRect();
          const citRect = citation1Ref.current.getBoundingClientRect();
          const targetRect = target1Ref.current.getBoundingClientRect();
          
          setLineCoords({
            x1: citRect.right - sectionRect.left,
            y1: citRect.top + citRect.height/2 - sectionRect.top,
            x2: targetRect.left - sectionRect.left,
            y2: targetRect.top + targetRect.height/2 - sectionRect.top
          });
        }
        await sleep(2000);
        setLineCoords(null);

        // 6. Streaming Citation 2
        setPhase(6);
        await sleep(1000);

        // 7. PDF Scroll & Highlight Citation 2
        setPhase(7);
        if (pdfScrollRef.current) {
          pdfScrollRef.current.scrollTo({ top: 480, behavior: 'smooth' });
        }
        await sleep(1500);
        
        if (citation2Ref.current && target2Ref.current && sectionRef.current) {
          const sectionRect = sectionRef.current.getBoundingClientRect();
          const citRect = citation2Ref.current.getBoundingClientRect();
          const targetRect = target2Ref.current.getBoundingClientRect();
          
          setLineCoords({
            x1: citRect.right - sectionRect.left,
            y1: citRect.top + citRect.height/2 - sectionRect.top,
            x2: targetRect.left - sectionRect.left,
            y2: targetRect.top + targetRect.height/2 - sectionRect.top
          });
        }
        await sleep(2000);
        setLineCoords(null);

        // 8. Verification Badges
        setPhase(8);
        await sleep(6000); // Hold final state for 6 seconds
      }
    };

    runSequence();

    return () => { isMounted = false; };
  }, [isInView]);

  return (
    <section id="trust" ref={sectionRef} className="py-32 relative z-10 max-w-[1400px] mx-auto px-6 overflow-hidden font-sans">
      
      {/* SVG Connecting Beam Overlay */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-50">
        <AnimatePresence>
          {lineCoords && (
            <motion.path 
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.5 } }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              d={`M ${lineCoords.x1} ${lineCoords.y1} C ${lineCoords.x1 + 100} ${lineCoords.y1}, ${lineCoords.x2 - 100} ${lineCoords.y2}, ${lineCoords.x2} ${lineCoords.y2}`}
              stroke="rgba(245, 158, 11, 0.8)"
              strokeWidth="2"
              fill="none"
              filter="url(#glow)"
            />
          )}
        </AnimatePresence>
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
      </svg>

      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">Verifiable evidence,<br />not just hallucinations.</h2>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Every answer generated by Clarity is explicitly linked back to the exact bounding box in the source document. If we can&apos;t find it, we abstain.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        
        {/* Left: Chat UI */}
        <div className="bg-[#0C0F16]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden h-[650px] flex flex-col group">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
          
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-4 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white tracking-tight">Clarity Engine</div>
              <div className="text-[10px] text-green-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Online
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-6 pr-4 custom-scrollbar relative z-10">
            
            {/* User Message */}
            {phase >= 1 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-4"
              >
                <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-gray-300" />
                </div>
                <div className="pt-1.5 bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm p-4 w-full">
                  <p className="text-white text-sm">
                    {qText}
                    {phase === 1 && <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="inline-block w-1.5 h-4 ml-1 bg-orange-500 align-middle" />}
                  </p>
                </div>
              </motion.div>
            )}

            {/* AI Response */}
            {phase >= 2 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-4"
              >
                <div className="w-8 h-8 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                  <Bot className="w-4 h-4 text-orange-400" />
                </div>
                <div className="flex-1 space-y-4 pt-1 w-full">
                  
                  {/* Thinking State */}
                  {phase === 2 && (
                    <div className="bg-[#111] border border-white/5 rounded-2xl rounded-tl-sm p-4 flex items-center gap-2 w-fit">
                      <motion.div className="w-1.5 h-1.5 rounded-full bg-orange-500" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                      <motion.div className="w-1.5 h-1.5 rounded-full bg-orange-500" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
                      <motion.div className="w-1.5 h-1.5 rounded-full bg-orange-500" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} />
                      <span className="text-xs text-gray-400 ml-2 font-mono">Retrieving from Acme_MSA...</span>
                    </div>
                  )}

                  {/* Streaming Answer */}
                  {phase >= 3 && (
                    <div className="bg-[#111] border border-white/5 rounded-2xl rounded-tl-sm p-5 shadow-lg">
                      <p className="text-gray-300 text-sm leading-relaxed mb-5 border-b border-white/5 pb-3">
                        Based on the Acme Corp Master Services Agreement:
                      </p>
                      
                      <ul className="space-y-5">
                        {/* Point 1 */}
                        {phase >= 4 && (
                          <motion.li 
                            initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
                            className="text-gray-300 text-sm leading-relaxed flex flex-wrap items-center"
                          >
                            <strong className="text-white font-medium mr-1">Termination:</strong> 
                            Either party may terminate for convenience with 30 days written notice.
                            
                            <span 
                              ref={citation1Ref}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 ml-2 mt-1 md:mt-0 rounded text-[10px] font-mono transition-all duration-300 ${phase === 5 ? "bg-orange-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-110" : "bg-white/10 text-orange-400"}`}
                            >
                              [§4.2]
                            </span>
                          </motion.li>
                        )}
                        
                        {/* Point 2 */}
                        {phase >= 6 && (
                          <motion.li 
                            initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
                            className="text-gray-300 text-sm leading-relaxed flex flex-wrap items-center"
                          >
                            <strong className="text-white font-medium mr-1">Liability Cap:</strong> 
                            Aggregate liability is capped at amounts paid in the preceding 12 months.
                            
                            <span 
                              ref={citation2Ref}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 ml-2 mt-1 md:mt-0 rounded text-[10px] font-mono transition-all duration-300 ${phase === 7 ? "bg-orange-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-110" : "bg-white/10 text-orange-400"}`}
                            >
                              [§8.1]
                            </span>
                          </motion.li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Verification Metadata */}
                  <AnimatePresence>
                    {phase >= 8 && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="flex flex-wrap items-center gap-3 pt-2"
                      >
                        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-md flex items-center gap-1.5 text-[10px] font-medium text-green-400">
                          <CheckCircle2 className="w-3 h-3" />
                          NLI Verified
                        </motion.div>
                        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }} className="bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-md flex items-center gap-1.5 text-[10px] font-medium text-blue-400">
                          <Target className="w-3 h-3" />
                          Dense + Sparse Match
                        </motion.div>
                        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }} className="bg-orange-500/10 border border-orange-500/30 px-2 py-1 rounded-md flex items-center gap-1.5 text-[10px] font-medium text-orange-400 shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                          <Zap className="w-3 h-3" />
                          Trust Score: 99.2%
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

          </div>
        </div>

        {/* Right: Authentic Legal PDF Viewer */}
        <div className="bg-[#1C1C1E] rounded-3xl border border-white/10 h-[650px] overflow-hidden flex flex-col shadow-2xl relative group ring-1 ring-black/50">
          
          {/* PDF Toolbar (Mac style) */}
          <div className="h-14 bg-[#2D2D30]/90 backdrop-blur-xl border-b border-black/40 flex items-center justify-between px-4 shrink-0 shadow-sm z-20">
            {/* Left Controls */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-gray-400">
                <Menu className="w-4 h-4 cursor-pointer hover:text-white transition-colors" />
              </div>
              <div className="w-[1px] h-4 bg-white/10" />
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-300" />
                <span className="text-sm font-medium text-gray-200">Acme_MSA_Executed_v2.pdf</span>
                <ChevronDown className="w-3 h-3 text-gray-500" />
              </div>
            </div>

            {/* Center Zoom */}
            <div className="hidden md:flex items-center bg-[#1E1E1E] rounded-md border border-white/5 p-1 shadow-inner">
              <div className="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center text-gray-400 cursor-pointer">-</div>
              <div className="px-3 text-xs font-mono text-gray-300">100%</div>
              <div className="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center text-gray-400 cursor-pointer">+</div>
            </div>

            {/* Right Tools */}
            <div className="flex items-center gap-3">
              <Search className="w-4 h-4 text-gray-400 hover:text-white cursor-pointer" />
              <ZoomIn className="w-4 h-4 text-gray-400 hover:text-white cursor-pointer" />
              <div className="w-[1px] h-4 bg-white/10" />
              <div className="bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-md text-xs font-medium border border-blue-500/30 flex items-center gap-1.5 cursor-pointer">
                <Download className="w-3 h-3" />
                Export
              </div>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Left Sidebar Thumbnails */}
            <div className="w-20 bg-[#252526] border-r border-black/40 shrink-0 hidden md:flex flex-col items-center py-4 gap-4 overflow-y-auto custom-scrollbar z-10 shadow-[5px_0_15px_rgba(0,0,0,0.2)]">
              {[1, 2, 3].map((num) => (
                <div key={num} className={`w-14 h-20 bg-white rounded-sm shadow-md border-2 transition-colors relative flex items-center justify-center ${num === 1 ? 'border-blue-500' : 'border-transparent'}`}>
                  <div className="w-10 h-14 bg-gray-100 rounded-sm border border-gray-200" />
                  <span className="absolute -bottom-5 text-[9px] text-gray-400 font-mono">{num}</span>
                </div>
              ))}
            </div>

            {/* PDF Page Area */}
            <div ref={pdfScrollRef} className="flex-1 bg-[#1E1E1E] overflow-y-auto custom-scrollbar relative flex justify-center py-10 px-4">
              
              {/* The Paper */}
              <div className="w-full max-w-[500px] min-h-[850px] bg-white rounded-sm shadow-[0_0_30px_rgba(0,0,0,0.5)] relative shrink-0 transition-transform origin-top group-hover:shadow-[0_0_40px_rgba(0,0,0,0.7)] border border-gray-300 p-12 text-[#222] font-serif">
                
                {/* Paper Texture/Lighting */}
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white via-[#fcfcfc] to-[#f5f5f5] z-0" />
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black/[0.03] to-transparent pointer-events-none z-0" />

                {/* Content Container */}
                <div className="relative z-10">
                  <div className="text-center border-b-2 border-black pb-4 mb-8">
                    <h1 className="font-bold text-xl tracking-tight">MASTER SERVICES AGREEMENT</h1>
                    <p className="text-[10px] text-gray-500 mt-2 font-sans font-medium tracking-widest">CONFIDENTIAL • EXECUTED COPY</p>
                  </div>

                  <p className="text-[11px] text-justify leading-relaxed mb-8">
                    This Master Services Agreement (the &quot;Agreement&quot;) is entered into as of October 1, 2023, by and between Acme Corp, a Delaware corporation (&quot;Customer&quot;), and Global Logistics Inc, a California corporation (&quot;Provider&quot;).
                  </p>

                  <h2 className="font-bold text-xs uppercase tracking-widest mt-8 mb-3">1. SERVICES AND STATEMENT OF WORK</h2>
                  <p className="text-[11px] text-justify leading-relaxed mb-8">
                    1.1 Provision of Services. Provider shall provide the services described in one or more Statements of Work (each, a &quot;SOW&quot;) executed by the parties.
                  </p>

                  <h2 className="font-bold text-xs uppercase tracking-widest mt-8 mb-3">2. FEES AND PAYMENT TERMS</h2>
                  <p className="text-[11px] text-justify leading-relaxed mb-8">
                    2.1 Fees. Customer shall pay Provider the fees set forth in each SOW.
                  </p>

                  <h2 className="font-bold text-xs uppercase tracking-widest mt-8 mb-3">3. CONFIDENTIALITY</h2>
                  <p className="text-[11px] text-justify leading-relaxed mb-8">
                    3.1 Protection. Each party shall protect the other&apos;s Confidential Information with the same degree of care it uses for its own.
                  </p>

                  <h2 className="font-bold text-xs uppercase tracking-widest mt-8 mb-3">4. TERM AND TERMINATION</h2>
                  <p className="text-[11px] text-justify leading-relaxed mb-6">
                    4.1 Term. This Agreement shall commence on the Effective Date and continue for a period of thirty-six (36) months.
                  </p>
                  
                  <div className="relative">
                    <p className="text-[11px] text-justify leading-relaxed mb-8 relative z-20 p-1">
                      4.2 Termination for Convenience. Either party may terminate this Agreement at any time, for any reason, by providing the other party with at least thirty (30) days prior written notice.
                    </p>
                    <motion.div
                      ref={target1Ref}
                      initial={false}
                      animate={{
                        backgroundColor: phase === 5 ? "rgba(245, 158, 11, 0.25)" : "rgba(245, 158, 11, 0)",
                        borderColor: phase === 5 ? "rgba(245, 158, 11, 1)" : "rgba(245, 158, 11, 0)",
                        boxShadow: phase === 5 ? "0 0 20px rgba(245, 158, 11, 0.4)" : "none",
                        scale: phase === 5 ? 1.02 : 1,
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      className="absolute -inset-1 border-2 border-transparent rounded cursor-pointer mix-blend-multiply z-10"
                    />
                  </div>

                  <h2 className="font-bold text-xs uppercase tracking-widest mt-8 mb-3">8. LIMITATION OF LIABILITY</h2>
                  <div className="relative">
                    <p className="text-[11px] text-justify leading-relaxed mb-8 relative z-20 p-1">
                      8.1 Cap on Damages. IN NO EVENT SHALL EITHER PARTY&apos;S AGGREGATE LIABILITY ARISING OUT OF OR RELATED TO THIS AGREEMENT EXCEED THE TOTAL AMOUNT PAID BY CUSTOMER HEREUNDER IN THE TWELVE (12) MONTHS PRECEDING THE LAST EVENT GIVING RISE TO LIABILITY.
                    </p>
                    <motion.div
                      ref={target2Ref}
                      initial={false}
                      animate={{
                        backgroundColor: phase === 7 ? "rgba(245, 158, 11, 0.25)" : "rgba(245, 158, 11, 0)",
                        borderColor: phase === 7 ? "rgba(245, 158, 11, 1)" : "rgba(245, 158, 11, 0)",
                        boxShadow: phase === 7 ? "0 0 20px rgba(245, 158, 11, 0.4)" : "none",
                        scale: phase === 7 ? 1.02 : 1,
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      className="absolute -inset-1 border-2 border-transparent rounded cursor-pointer mix-blend-multiply z-10"
                    />
                  </div>
                </div>

                {/* Page Number */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[9px] font-mono text-gray-400 z-10">
                  Page 1 of 12
                </div>

              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
