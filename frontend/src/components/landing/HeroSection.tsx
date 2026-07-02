"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import { MagneticButton } from "./ui/MagneticButton";
import { PremiumBackground } from "./PremiumBackground";

const pipelineStages = ["Upload", "Extract", "Chunk", "Embed", "Retrieve", "Verify", "Answer"];

export function HeroSection() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const springConfig = { damping: 20, stiffness: 100, mass: 0.5 };
  const mouseX = useSpring(x, springConfig);
  const mouseY = useSpring(y, springConfig);

  const rotateX = useTransform(mouseY, [-0.5, 0.5], [3, -3]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-3, 3]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <section 
      className="relative pt-40 pb-20 px-6 min-h-screen flex items-center w-full overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <PremiumBackground glowOpacity={1} />
      <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-center w-full max-w-[1200px] mx-auto relative z-10">
        {/* Left: Copy & CTAs */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-start text-left z-10"
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold uppercase tracking-wider mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-[pulse_2s_ease-in-out_infinite]" />
            AI Document Intelligence Platform
          </motion.div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-[1.05] tracking-tight mb-6">
            Understand any <br /> document. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">
              Trust
            </span> every <br /> answer.
          </h1>
          
          <p className="text-xl text-gray-400 mb-10 max-w-lg leading-relaxed">
            Clarity combines advanced RAG, verification, and evaluations to turn your documents into verified, cited, and audit-ready answers.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <MagneticButton intensity={0.2}>
              <Link href="/signup" className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-[0_0_30px_rgba(245,158,11,0.25)] hover:shadow-[0_0_40px_rgba(245,158,11,0.5)] transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden group block">
                <div className="absolute inset-0 bg-white/20 translate-y-[100%] group-hover:translate-y-[0%] transition-transform duration-300 ease-out" />
                <span className="relative z-10">Get started for free</span>
                <span className="relative z-10 ml-1 opacity-70 group-hover:translate-x-1 transition-transform">→</span>
              </Link>
            </MagneticButton>
            
            <MagneticButton intensity={0.1}>
              <button className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-white bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center gap-2 group">
                <Play className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" /> Watch demo
              </button>
            </MagneticButton>
          </div>

          {/* Trust Indicators */}
          <div className="mt-16 grid grid-cols-2 gap-8 text-sm text-gray-400 border-t border-white/10 pt-8 w-full max-w-lg">
            {[
              { icon: "🛡️", title: "Verified answers", desc: "Two-signal verification" },
              { icon: "📄", title: "Cited sources", desc: "PDF span highlighting" },
              { icon: "🏢", title: "Enterprise ready", desc: "Secure & compliant" },
              { icon: "⚡", title: "Built for scale", desc: "From docs to millions" },
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + (i * 0.1) }}
              >
                <div className="flex items-center gap-2 text-white font-semibold mb-1">
                  <span className="text-orange-500">{feature.icon}</span> {feature.title}
                </div>
                {feature.desc}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Right: Dashboard Mock Animation */}
        <motion.div 
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
          className="relative z-10 hidden lg:block perspective-1000"
          style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        >
          {/* Outer Glow */}
          <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/20 to-purple-600/20 rounded-2xl blur-3xl" />
          
          <div 
            className="relative w-full aspect-[4/3] bg-[#0C0F16]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-gradient-to-tr from-orange-500 to-purple-600 flex items-center justify-center">
                  <span className="font-bold text-white text-xs">C</span>
                </div>
                <span className="font-bold text-white text-sm">Clarity AI Docs</span>
              </div>
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-md text-xs text-gray-400">
                Active workspace
                <span className="text-white font-medium ml-1">Acme Legal</span>
                <span className="ml-2 text-[10px]">▼</span>
              </div>
            </div>

            {/* Content: Pipeline Monitor */}
            <DashboardLoopAnimation />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function DashboardLoopAnimation() {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % pipelineStages.length);
    }, 2000); // 2s per stage = 14s total loop
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-white font-medium">Pipeline Monitor</h3>
        <div className="flex items-center gap-2 text-xs text-orange-400 bg-orange-500/10 px-2 py-1 rounded">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
          Processing Document
        </div>
      </div>
      
      {/* Pipeline Nodes Animation */}
      <div className="relative flex justify-between items-center mb-10 px-4">
        <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-white/5 -z-10 -translate-y-1/2" />
        
        {/* Animated Progress Line */}
        <motion.div 
          className="absolute top-1/2 left-4 h-0.5 bg-gradient-to-r from-orange-500 to-purple-500 -z-10 -translate-y-1/2"
          animate={{ width: `${(activeStage / (pipelineStages.length - 1)) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          style={{ width: "0%" }}
        />
        
        {pipelineStages.map((step, i) => {
          const isActive = i === activeStage;
          const isPast = i < activeStage;
          
          return (
            <div key={step} className="flex flex-col items-center gap-2 relative">
              <motion.div 
                animate={{
                  scale: isActive ? 1.2 : 1,
                  boxShadow: isActive ? "0 0 15px rgba(245,158,11,0.5)" : "none",
                }}
                className={`w-6 h-6 rounded-full flex items-center justify-center border text-[10px] bg-[#0C0F16] transition-colors duration-500
                  ${isPast ? "border-green-500 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.3)]" : 
                    isActive ? "border-orange-500 text-orange-400" : 
                    "border-white/20 text-gray-600"}`}
              >
                {isPast ? "✓" : isActive ? <span className="w-1 h-1 bg-orange-400 rounded-full animate-ping" /> : "·"}
              </motion.div>
              <span className={`absolute top-8 text-[9px] whitespace-nowrap transition-colors duration-500 ${isActive ? "text-orange-400 font-medium" : isPast ? "text-gray-400" : "text-gray-600"}`}>
                {step}
              </span>
            </div>
          );
        })}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-8 mt-4">
        {[
          { label: "Chunks Generated", val: isNaN(activeStage) ? 0 : activeStage >= 2 ? "124" : "0", color: "text-white" },
          { label: "Vectors Indexed", val: activeStage >= 3 ? "124" : "0", color: "text-purple-400" },
          { label: "Confidence", val: activeStage >= 5 ? "96.3%" : "-", color: "text-green-400" },
          { label: "Status", val: activeStage === pipelineStages.length - 1 ? "Complete" : "Running", color: activeStage === pipelineStages.length - 1 ? "text-green-400" : "text-orange-400" },
        ].map((stat, i) => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-3">
            <div className="text-[10px] text-gray-500 mb-1 whitespace-nowrap">{stat.label}</div>
            <div className={`text-lg font-bold mb-0.5 ${stat.color}`}>{stat.val}</div>
          </div>
        ))}
      </div>

      {/* Activity Log Simulation */}
      <div className="flex-1 bg-white/5 border border-white/10 rounded-lg p-4 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0C0F16] pointer-events-none z-10" />
        <div className="space-y-3">
          <motion.div 
            key={activeStage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 text-xs"
          >
            <span className="text-orange-400">[{new Date().toISOString().split('T')[1].substring(0,8)}]</span>
            <span className="text-gray-300">
              {activeStage === 0 && "Initiating secure document upload..."}
              {activeStage === 1 && "Extracting text and structural metadata..."}
              {activeStage === 2 && "Splitting text into semantic chunks..."}
              {activeStage === 3 && "Generating vector embeddings (Cohere-V3)..."}
              {activeStage === 4 && "Performing hybrid retrieval (BM25 + Dense)..."}
              {activeStage === 5 && "Cross-checking claims with NLI model..."}
              {activeStage === 6 && "Answer generated successfully. Trust score: 96.3%."}
            </span>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
