"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck } from "lucide-react";

const pipelineSteps = [
  { id: "upload", label: "PDF Upload", desc: "Securely ingest multi-modal documents." },
  { id: "ocr", label: "OCR & Vision", desc: "Extract text from scanned images and complex layouts." },
  { id: "parsing", label: "Semantic Parsing", desc: "Identify headers, tables, and clause boundaries." },
  { id: "chunking", label: "Smart Chunking", desc: "Break documents into context-aware chunks." },
  { id: "embedding", label: "Vector Embedding", desc: "Convert text to high-dimensional vectors." },
  { id: "search", label: "Hybrid Search", desc: "Dense + Sparse retrieval for maximum recall." },
  { id: "verification", label: "NLI Verification", desc: "Cross-check retrieved context against claims." },
  { id: "answer", label: "Answer Gen", desc: "Synthesize the final verified response." }
];

export function PipelineCostAnimation() {
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);

  return (
    <section className="py-32 relative z-10 max-w-7xl mx-auto px-6 overflow-hidden">
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        
        {/* Left: Copy */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          <div className="inline-block px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold uppercase tracking-wider mb-6">
            Compute Efficiency
          </div>
          <h3 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-6">
            Only pay for <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">intelligence.</span>
          </h3>
          <p className="text-lg text-gray-400 leading-relaxed mb-8">
            Unlike generic LLM wrappers, Clarity runs a massive 8-stage pipeline for every single query. You only pay for the verified answers you generate, while we abstract away the immense underlying compute required to synthesize them.
          </p>
          
          <ul className="space-y-4">
            {["Free indexing for first 100k vectors", "No hidden storage or bandwidth costs", "Volume discounts applied automatically"].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-gray-300">
                <ShieldCheck className="w-5 h-5 text-orange-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Right: The Pipeline Visualization */}
        <motion.div 
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="bg-[#0C0F16]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 relative shadow-2xl min-h-[500px] flex items-center justify-center"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/5 to-purple-500/5 z-0" />
          
          <div className="relative z-10 w-full max-w-md mx-auto">
            {pipelineSteps.map((step, i) => {
              const isHovered = hoveredStep === step.id;
              
              return (
                <div 
                  key={step.id} 
                  className="flex items-center gap-6 relative group mb-6 last:mb-0 cursor-default"
                  onMouseEnter={() => setHoveredStep(step.id)}
                  onMouseLeave={() => setHoveredStep(null)}
                >
                  {/* Node */}
                  <motion.div 
                    animate={{ 
                      scale: isHovered ? 1.2 : [1, 1.05, 1], 
                      boxShadow: isHovered 
                        ? "0 0 20px rgba(245,158,11,0.6)" 
                        : "0 0 0px rgba(245,158,11,0)" 
                    }}
                    transition={{ duration: isHovered ? 0.3 : 2, repeat: isHovered ? 0 : Infinity, delay: i * 0.2 }}
                    className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 z-10 transition-colors duration-300
                      ${isHovered ? "bg-orange-500/20 border-orange-400" : "bg-white/5 border-white/10"}`}
                  >
                    <div className={`w-3 h-3 rounded-full transition-colors duration-300 ${isHovered ? "bg-orange-400" : "bg-white/30"}`} />
                  </motion.div>
                  
                  {/* Label & Description */}
                  <div className="flex-1 relative">
                    <span className={`text-sm font-semibold transition-colors duration-300 ${isHovered ? "text-orange-400" : "text-gray-300"}`}>
                      {step.label}
                    </span>
                    
                    <AnimatePresence>
                      {isHovered && (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="absolute top-6 left-0 text-xs text-gray-400 whitespace-nowrap bg-black/80 px-3 py-1.5 rounded border border-white/10 z-20"
                        >
                          {step.desc}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Connecting Line */}
                  {i < pipelineSteps.length - 1 && (
                    <div className="absolute left-[23px] top-[48px] bottom-[-24px] w-[2px] bg-white/5 z-0" />
                  )}

                  {/* Traveling Particle */}
                  {i < pipelineSteps.length - 1 && (
                    <motion.div 
                      className="absolute left-[23px] top-[48px] w-[2px] h-6 bg-gradient-to-b from-transparent via-orange-400 to-transparent shadow-[0_0_10px_rgba(245,158,11,0.8)] z-0 rounded-full"
                      animate={{ top: ["48px", "72px", "48px"], opacity: [0, 1, 0] }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.3, ease: "linear" }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
