"use client";

import { motion, useMotionTemplate, useMotionValue, cubicBezier } from "framer-motion";
import { Search, TextSelect, ShieldCheck, Database, FileCode, Lock, Users, Briefcase } from "lucide-react";
import { useState } from "react";

const appleEase = cubicBezier(0.22, 1, 0.36, 1);

export function FeaturesBentoGrid() {
  return (
    <section id="platform" className="py-32 relative max-w-[1400px] mx-auto px-6 overflow-hidden font-sans">
      <div className="text-center mb-24 relative z-10">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Designed for scale. Built for trust.</h2>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Every component of the Clarity architecture was built from the ground up to handle massive unstructured data with zero hallucinations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-3 gap-6 auto-rows-[320px] relative z-10">
        
        {/* Hybrid Retrieval (Spans 2 cols) */}
        <BentoCard 
          className="md:col-span-2 md:row-span-1"
          title="Hybrid Retrieval"
          desc="Dense vector search combined with sparse BM25 indexing for absolute maximum recall."
          icon={Search}
        >
          <HybridRetrievalApp />
        </BentoCard>

        {/* Citation Engine (Spans 1 col, 2 rows) */}
        <BentoCard 
          className="md:col-span-1 md:row-span-2"
          title="Citation Engine"
          desc="Every answer includes exact bounding boxes mapped directly to the source PDF."
          icon={TextSelect}
        >
          <CitationEngineApp />
        </BentoCard>

        {/* Trust Score (Spans 1 col, 1 row) */}
        <BentoCard 
          className="md:col-span-1 md:row-span-1"
          title="Trust Score"
          desc="Cross-checking LLM entropy against source density."
          icon={ShieldCheck}
        >
          <TrustScoreApp />
        </BentoCard>

        {/* Document Intelligence (Spans 1 col, 1 row) */}
        <BentoCard 
          className="md:col-span-1 md:row-span-1"
          title="Document Intelligence"
          desc="Vision-based OCR parses complex layouts and tables."
          icon={FileCode}
        >
          <DocumentIntelligenceApp />
        </BentoCard>

        {/* Collections (Spans 2 cols, 1 row) */}
        <BentoCard 
          className="md:col-span-2 md:row-span-1"
          title="Isolated Collections"
          desc="Organize millions of documents into strictly isolated semantic boundary collections."
          icon={Database}
        >
          <IsolatedCollectionsApp />
        </BentoCard>

        {/* Workspace Isolation (Spans 1 col, 1 row) */}
        <BentoCard 
          className="md:col-span-1 md:row-span-1"
          title="Enterprise RBAC"
          desc="Fine-grained permissions mapped to your SSO."
          icon={Lock}
        >
          <EnterpriseRBACApp />
        </BentoCard>

      </div>
    </section>
  );
}

function BentoCard({ title, desc, icon: Icon, className = "", children }: any) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <div 
      onMouseMove={handleMouseMove}
      className={`relative bg-[#0A0D14]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-8 overflow-hidden group hover:border-white/10 transition-colors ${className}`}
    >
      {/* Interactive Ambient Lighting */}
      <motion.div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-10 mix-blend-screen"
        style={{ background: useMotionTemplate`radial-gradient(600px circle at ${mouseX}px ${mouseY}px, rgba(245,158,11,0.06), transparent 40%)` }}
      />
      
      {/* Subtle Noise Texture */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.015] mix-blend-overlay pointer-events-none" />

      {/* Glass Inner Edge */}
      <div className="absolute inset-0 rounded-3xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02),inset_0_2px_20px_rgba(255,255,255,0.02)] pointer-events-none" />

      {/* Foreground Content */}
      <div className="relative z-20 max-w-sm pointer-events-none mb-8">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4 border border-white/5 group-hover:border-orange-500/30 group-hover:bg-orange-500/10 transition-colors shadow-lg">
          <Icon className="w-5 h-5 text-gray-400 group-hover:text-orange-400 transition-colors" />
        </div>
        <h3 className="text-xl md:text-2xl font-bold text-white mb-2 tracking-tight">{title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
      </div>

      {/* Background App Visualization */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {children}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// HYBRID RETRIEVAL APP
// ----------------------------------------------------------------------
function HybridRetrievalApp() {
  // Generate random dots once
  const [dots] = useState(() => Array.from({ length: 80 }).map(() => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    active: Math.random() > 0.85
  })));

  return (
    <div className="absolute right-0 top-0 bottom-0 w-full md:w-[60%] flex items-center justify-end overflow-hidden opacity-50 group-hover:opacity-100 transition-opacity duration-700 [mask-image:linear-gradient(to_right,transparent,black_40%)]">
      
      <div className="relative w-[500px] h-[500px] perspective-[1000px] translate-x-12">
        <motion.div 
          className="absolute inset-0"
          animate={{ rotateX: [60, 60], rotateZ: [0, 360] }}
          transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Base Grid */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:24px_24px]" />
          
          {/* The Embeddings Dots */}
          {dots.map((dot, i) => (
            <div 
              key={i} 
              className={`absolute rounded-full transition-all duration-1000 ${dot.active ? "w-2 h-2 bg-orange-400 shadow-[0_0_12px_rgba(245,158,11,1)]" : "w-1 h-1 bg-blue-400/20"}`}
              style={{ left: `${dot.x}%`, top: `${dot.y}%`, transform: `translateZ(${dot.active ? '30px' : '0px'})` }}
            />
          ))}

          {/* Connections (Cluster) */}
          <svg className="absolute inset-0 w-full h-full overflow-visible" style={{ transform: "translateZ(30px)" }}>
             <motion.path 
               d="M 250 250 L 300 200 L 320 280 L 250 250 Z M 300 200 L 350 150"
               stroke="rgba(245,158,11,0.5)"
               strokeWidth="1.5"
               fill="none"
               initial={{ pathLength: 0 }}
               animate={{ pathLength: 1 }}
               transition={{ duration: 3, repeat: Infinity, repeatType: "reverse", ease: appleEase }}
             />
          </svg>
          
          {/* Ripple / Radar */}
          <motion.div 
            className="absolute left-1/2 top-1/2 rounded-full border border-orange-500/30"
            initial={{ width: 0, height: 0, opacity: 1, x: "-50%", y: "-50%" }}
            animate={{ width: 400, height: 400, opacity: 0, x: "-50%", y: "-50%" }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeOut" }}
            style={{ transform: "translateZ(10px)" }}
          />
        </motion.div>
        
        {/* Floating Labels (Outside 3D rotation so they stay upright) */}
        <motion.div 
          className="absolute right-32 top-32 bg-[#0A0D14]/90 backdrop-blur border border-white/10 rounded-md px-2 py-1.5 flex flex-col gap-1.5 shadow-2xl z-20"
          animate={{ y: [-5, 5, -5] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="text-[8px] font-mono text-gray-500 uppercase tracking-widest border-b border-white/10 pb-1">Dense + Sparse Match</div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,1)]" />
            <span className="text-[10px] text-gray-300 font-medium">Acme_MSA_v2.pdf</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(245,158,11,1)]" />
            <span className="text-[10px] text-gray-300 font-medium">Clause 4.2 Termination</span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------
// CITATION ENGINE APP
// ----------------------------------------------------------------------
function CitationEngineApp() {
  return (
    <div className="absolute inset-x-0 bottom-0 top-32 px-8 flex flex-col opacity-50 group-hover:opacity-100 transition-all duration-700 [mask-image:linear-gradient(to_bottom,transparent,black_10%)]">
      <motion.div 
        className="w-full bg-[#111] border border-white/10 rounded-t-2xl shadow-2xl p-5 flex-1 relative overflow-hidden"
        animate={{ y: [10, 0, 10] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-3">
          <div className="w-2 h-2 rounded-full bg-red-500/20" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/20" />
          <div className="w-2 h-2 rounded-full bg-green-500/20" />
          <span className="text-[9px] text-gray-600 font-mono ml-2">verification_stream.ts</span>
        </div>
        
        <div className="space-y-6">
          <div className="flex gap-3 items-start">
            <div className="w-5 h-5 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <span className="text-[9px] text-blue-400 font-bold">Q</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full w-3/4 mt-1.5" />
          </div>

          <div className="flex gap-3 items-start">
            <div className="w-5 h-5 rounded bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
              <span className="text-[9px] text-orange-400 font-bold">A</span>
            </div>
            <div className="flex-1 space-y-3">
              <div className="h-2 bg-white/20 rounded-full w-full relative overflow-hidden">
                {/* Scanning Laser */}
                <motion.div 
                  className="absolute top-0 bottom-0 w-16 bg-gradient-to-r from-transparent via-orange-500 to-transparent blur-[2px]"
                  animate={{ left: ["-50%", "150%"] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <div className="h-2 bg-white/20 rounded-full w-[85%]" />
              <div className="h-2 bg-white/20 rounded-full w-[40%]" />
            </div>
          </div>
        </div>

        {/* Live Badges Popping up */}
        <div className="absolute bottom-8 right-6 flex flex-col gap-2 items-end">
          <motion.div 
            className="bg-[#1A1A1A] border border-[#333] px-2.5 py-1.5 rounded shadow-xl flex items-center gap-2"
            animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -10] }}
            transition={{ duration: 4, repeat: Infinity, times: [0, 0.1, 0.8, 1] }}
          >
            <TextSelect className="w-3 h-3 text-gray-400" />
            <span className="text-[9px] font-mono text-gray-300">CIT_42</span>
            <span className="text-[10px] text-white font-medium">Page 8</span>
          </motion.div>
          <motion.div 
            className="bg-orange-500/10 border border-orange-500/30 px-2.5 py-1.5 rounded shadow-[0_0_15px_rgba(245,158,11,0.2)] flex items-center gap-1.5 backdrop-blur-md"
            animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -10] }}
            transition={{ duration: 4, delay: 0.5, repeat: Infinity, times: [0, 0.1, 0.8, 1] }}
          >
            <ShieldCheck className="w-3 h-3 text-orange-400" />
            <span className="text-[10px] text-orange-400 font-bold tracking-wide">98.7% Conf</span>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

// ----------------------------------------------------------------------
// TRUST SCORE APP
// ----------------------------------------------------------------------
function TrustScoreApp() {
  return (
    <div className="absolute inset-0 flex items-center justify-end pr-10 opacity-60 group-hover:opacity-100 transition-opacity duration-700">
      <div className="relative w-40 h-40 flex items-center justify-center group-hover:scale-105 transition-transform duration-700">
        
        {/* Orbital Mechanics */}
        <motion.div 
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        >
          {/* Orbiting Metrics */}
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#111]/80 backdrop-blur border border-white/10 text-[9px] px-2 py-1 rounded-full text-gray-300 font-mono flex items-center gap-1.5 whitespace-nowrap shadow-xl">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
            NLI 99%
          </div>
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-[#111]/80 backdrop-blur border border-white/10 text-[9px] px-2 py-1 rounded-full text-gray-300 font-mono flex items-center gap-1.5 whitespace-nowrap shadow-xl" style={{ rotate: '180deg' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
            OCR 98%
          </div>
          <div className="absolute top-1/2 -left-6 -translate-y-1/2 bg-[#111]/80 backdrop-blur border border-white/10 text-[9px] px-2 py-1 rounded-full text-gray-300 font-mono flex items-center gap-1.5 whitespace-nowrap shadow-xl" style={{ rotate: '90deg' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
            Semantic 97%
          </div>
          <div className="absolute top-1/2 -right-6 -translate-y-1/2 bg-[#111]/80 backdrop-blur border border-white/10 text-[9px] px-2 py-1 rounded-full text-gray-300 font-mono flex items-center gap-1.5 whitespace-nowrap shadow-xl" style={{ rotate: '-90deg' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
            Ground 100%
          </div>
        </motion.div>

        <svg className="absolute inset-0 w-full h-full -rotate-90 filter drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]">
          {/* Background Track */}
          <circle cx="80" cy="80" r="60" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="8" />
          {/* Dashed Inner Track */}
          <circle cx="80" cy="80" r="48" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="2 4" />
          
          {/* Animated Value Ring */}
          <motion.circle 
            cx="80" cy="80" r="60" 
            fill="none" 
            stroke="url(#trust-grad)" 
            strokeWidth="8" 
            strokeDasharray="377"
            strokeLinecap="round"
            initial={{ strokeDashoffset: 377 }}
            animate={{ strokeDashoffset: 377 * (1 - 0.98) }}
            transition={{ duration: 2.5, ease: appleEase, delay: 0.5 }}
          />
          <defs>
            <linearGradient id="trust-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#EA580C" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center Value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-4xl font-bold text-white tracking-tighter drop-shadow-[0_0_20px_rgba(245,158,11,0.3)]">
            98<span className="text-xl text-orange-500">%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------
// DOCUMENT INTELLIGENCE APP
// ----------------------------------------------------------------------
function DocumentIntelligenceApp() {
  return (
    <div className="absolute right-0 bottom-0 top-24 left-[35%] bg-[#0A0D14] border-l border-t border-white/10 rounded-tl-2xl shadow-2xl p-5 overflow-hidden opacity-60 group-hover:opacity-100 transition-all duration-700">
      <div className="w-full h-full relative">
        <div className="h-2 w-1/3 bg-white/10 rounded mb-5" />
        
        {/* Paragraph Block */}
        <div className="space-y-1.5 mb-5 relative p-1.5 group/block">
          <div className="h-1.5 w-full bg-white/5 rounded" />
          <div className="h-1.5 w-full bg-white/5 rounded" />
          <div className="h-1.5 w-[80%] bg-white/5 rounded" />
          
          {/* Animated Bounding Box */}
          <motion.div 
            className="absolute inset-0 border border-blue-500/40 bg-blue-500/10 rounded pointer-events-none"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
          />
          <motion.div 
            className="absolute -right-2 -top-2.5 bg-blue-500/90 backdrop-blur border border-blue-400/50 text-[8px] text-white px-1.5 py-0.5 rounded shadow-lg flex items-center gap-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            Paragraph 99%
          </motion.div>
        </div>

        {/* Table Block */}
        <div className="grid grid-cols-3 gap-1 relative p-1.5 mt-5">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-2.5 bg-white/5 rounded-sm" />)}
          <motion.div 
            className="absolute inset-0 border border-green-500/40 bg-green-500/10 rounded pointer-events-none"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, delay: 0.75, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
          />
          <motion.div 
            className="absolute -right-2 -top-2.5 bg-green-500/90 backdrop-blur border border-green-400/50 text-[8px] text-white px-1.5 py-0.5 rounded shadow-lg flex items-center gap-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.25 }}
          >
            Table 94%
          </motion.div>
        </div>

        {/* Scanning Laser */}
        <motion.div 
          className="absolute left-0 right-0 h-[2px] bg-orange-500 shadow-[0_0_15px_3px_rgba(245,158,11,0.6)] z-10"
          animate={{ top: ["-10%", "110%", "-10%"] }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        />
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------
// ENTERPRISE RBAC APP
// ----------------------------------------------------------------------
function EnterpriseRBACApp() {
  return (
    <div className="absolute inset-0 flex items-center justify-end pr-10 opacity-60 group-hover:opacity-100 transition-opacity duration-700">
      <div className="relative w-[180px] h-[200px]">
        {/* Node Graph Lines */}
        <svg className="absolute inset-0 w-full h-full">
          <path d="M 90 30 C 90 70, 40 70, 40 110" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" fill="none" />
          <path d="M 90 30 C 90 70, 140 70, 140 110" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" fill="none" />
          <path d="M 40 110 C 40 150, 20 150, 20 190" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" fill="none" />
          <path d="M 40 110 C 40 150, 60 150, 60 190" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" fill="none" />
          <path d="M 140 110 C 140 150, 120 150, 120 190" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" fill="none" />
          <path d="M 140 110 C 140 150, 160 150, 160 190" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" fill="none" />
          
          {/* Animated Data Pulses */}
          <motion.path 
            d="M 90 30 C 90 70, 40 70, 40 110" stroke="rgba(245,158,11,0.5)" strokeWidth="2" fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0, 1, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path 
            d="M 140 110 C 140 150, 160 150, 160 190" stroke="rgba(245,158,11,0.5)" strokeWidth="2" fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0, 1, 0] }}
            transition={{ duration: 2, delay: 1, repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>

        {/* Nodes */}
        {/* Root */}
        <div className="absolute top-[20px] left-1/2 -translate-x-1/2 w-7 h-7 rounded-md bg-[#1A1A1A] border border-white/20 flex items-center justify-center z-10 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
          <Briefcase className="w-3.5 h-3.5 text-white" />
        </div>
        
        {/* Level 1 */}
        <div className="absolute top-[100px] left-[30px] w-6 h-6 rounded-md bg-[#1A1A1A] border border-white/10 flex items-center justify-center z-10">
          <Users className="w-3 h-3 text-gray-400" />
        </div>
        <div className="absolute top-[100px] left-[130px] w-6 h-6 rounded-md bg-[#1A1A1A] border border-white/10 flex items-center justify-center z-10">
          <Users className="w-3 h-3 text-gray-400" />
        </div>

        {/* Level 2 (Permissions) */}
        <div className="absolute top-[182px] left-[5px] bg-orange-500/15 border border-orange-500/40 text-[8px] text-orange-400 px-1.5 py-0.5 rounded shadow-[0_0_12px_rgba(245,158,11,0.3)]">Admin</div>
        <div className="absolute top-[182px] left-[45px] bg-white/5 border border-white/10 text-[8px] text-gray-400 px-1.5 py-0.5 rounded">Editor</div>
        
        <div className="absolute top-[182px] left-[105px] bg-white/5 border border-white/10 text-[8px] text-gray-400 px-1.5 py-0.5 rounded">Viewer</div>
        <div className="absolute top-[182px] left-[145px] bg-white/5 border border-white/10 text-[8px] text-gray-400 px-1.5 py-0.5 rounded">Viewer</div>

        {/* Floating Lock Pulse */}
        <motion.div 
          className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-orange-500/5 border border-orange-500/20 flex items-center justify-center backdrop-blur-sm z-20"
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <Lock className="w-4 h-4 text-orange-500/50" />
        </motion.div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------
// ISOLATED COLLECTIONS APP
// ----------------------------------------------------------------------
function IsolatedCollectionsApp() {
  const collections = [
    { name: "Finance", count: "245K docs", color: "from-blue-500/10 to-transparent", border: "border-blue-500/20" },
    { name: "Legal", count: "421K docs", color: "from-orange-500/10 to-transparent", border: "border-orange-500/40" },
    { name: "HR", count: "52K docs", color: "from-green-500/10 to-transparent", border: "border-green-500/20" },
  ];

  return (
    <div className="absolute right-12 top-0 bottom-0 w-[50%] flex items-center justify-center opacity-60 group-hover:opacity-100 transition-all duration-700">
      <div className="relative w-[220px] h-[220px] perspective-[1200px] group-hover:scale-105 transition-transform duration-700">
        
        <motion.div 
          className="absolute inset-0"
          animate={{ rotateX: [55, 55], rotateZ: [-25, -25] }}
          style={{ transformStyle: "preserve-3d" }}
        >
          {collections.map((col, i) => {
            const yOffset = (i - 1) * 70; // Spread apart heavily in Y (3D space)
            
            return (
              <motion.div 
                key={i}
                className={`absolute inset-0 bg-gradient-to-br ${col.color} border ${col.border} rounded-2xl backdrop-blur-md shadow-2xl flex flex-col justify-between p-5 bg-[#05070A]/50`}
                initial={{ z: 0 }}
                animate={{ z: yOffset }}
                transition={{ duration: 1.5, delay: i * 0.1, ease: appleEase }}
                style={{ transformStyle: "preserve-3d" }}
              >
                <div className="flex justify-between items-start" style={{ transform: "translateZ(15px)" }}>
                  <div className="w-8 h-8 rounded-lg bg-black/60 flex items-center justify-center border border-white/10 shadow-inner">
                    <Database className="w-4 h-4 text-white/80" />
                  </div>
                </div>
                <div style={{ transform: "translateZ(25px)" }}>
                  <div className="text-white font-bold text-base tracking-tight mb-1">{col.name}</div>
                  <div className="text-gray-400 text-[11px] font-mono bg-black/40 inline-block px-2 py-0.5 rounded border border-white/5">{col.count}</div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>

      </div>
    </div>
  )
}
