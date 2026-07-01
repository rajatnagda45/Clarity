"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { Search, BrainCircuit, ShieldAlert, Target, Zap, CheckCircle2 } from "lucide-react";

const reasoningSteps = [
  { id: 1, title: "Query Intent Analysis", desc: "Deconstructs the user prompt into semantic requirements.", icon: BrainCircuit },
  { id: 2, title: "Hybrid Retrieval", desc: "Performs dense vector and sparse keyword search simultaneously.", icon: Search },
  { id: 3, title: "Source Ranking", desc: "Cohere Rerank re-orders the top 100 chunks by relevance.", icon: Target },
  { id: 4, title: "Cross-Check Verification", desc: "NLI model validates that the retrieved chunks contain the answer.", icon: ShieldAlert },
  { id: 5, title: "Trust Calculation", desc: "Computes final confidence score based on extraction entropy.", icon: Zap },
  { id: 6, title: "Verified Synthesis", desc: "LLM generates the final response with explicit citations.", icon: CheckCircle2 },
];

export function ReasoningTimeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"]
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <section id="reasoning" ref={containerRef} className="py-32 relative z-10 max-w-4xl mx-auto px-6">
      <div className="text-center mb-24">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Inside the black box</h2>
        <p className="text-gray-400 text-lg">Watch how Clarity processes a single query in real-time.</p>
      </div>

      <div className="relative">
        {/* The Central Line Background */}
        <div className="absolute left-[28px] md:left-1/2 top-0 bottom-0 w-[2px] bg-white/10 md:-translate-x-1/2" />
        
        {/* The Animated Fill Line */}
        <motion.div 
          className="absolute left-[28px] md:left-1/2 top-0 bottom-0 w-[2px] bg-gradient-to-b from-orange-500 via-purple-500 to-orange-500 origin-top md:-translate-x-1/2 shadow-[0_0_15px_rgba(245,158,11,0.5)]"
          style={{ scaleY: smoothProgress }}
        />

        <div className="space-y-24">
          {reasoningSteps.map((step, index) => {
            const isEven = index % 2 === 0;
            
            return (
              <motion.div 
                key={step.id}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, type: "spring", bounce: 0.3 }}
                className={`relative flex items-center md:justify-between ${isEven ? "md:flex-row-reverse" : ""}`}
              >
                
                {/* Center Node */}
                <div className="absolute left-0 md:left-1/2 w-14 h-14 rounded-full bg-[#0C0F16] border-2 border-white/20 md:-translate-x-1/2 flex items-center justify-center z-10 shadow-lg">
                  <step.icon className="w-6 h-6 text-gray-400" />
                  
                  {/* Outer pulse when active */}
                  <motion.div 
                    className="absolute inset-0 rounded-full border-2 border-orange-500/50"
                    initial={{ scale: 1, opacity: 0 }}
                    whileInView={{ scale: 1.5, opacity: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                </div>

                {/* Content Card */}
                <div className={`ml-20 md:ml-0 md:w-[calc(50%-4rem)] ${isEven ? "md:text-left" : "md:text-right"}`}>
                  <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl hover:bg-white/10 transition-colors">
                    <div className="text-orange-400 font-mono text-xs mb-2">0{step.id}</div>
                    <h4 className="text-xl font-bold text-white mb-2">{step.title}</h4>
                    <p className="text-gray-400 leading-relaxed text-sm">
                      {step.desc}
                    </p>
                  </div>
                </div>

              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
