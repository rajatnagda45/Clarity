"use client";

import { useRef, useState } from "react";
import { motion, useScroll, useTransform, useSpring, useMotionValueEvent, MotionValue, useMotionValue, useMotionTemplate, cubicBezier } from "framer-motion";
import { UploadCloud, FileCode, Layers, Database, Search, ShieldCheck, MessageSquare, TextSelect, Zap } from "lucide-react";

const STEPS = [
  { id: "01", label: "Upload Document", desc: "Ingest massive PDFs seamlessly.", icon: UploadCloud },
  { id: "02", label: "AI Parses", desc: "Vision OCR reads complex layouts.", icon: FileCode },
  { id: "03", label: "Chunking", desc: "Semantic splitting by clause boundaries.", icon: Layers },
  { id: "04", label: "Embeddings", desc: "Mathematically mapped to vector space.", icon: Database },
  { id: "05", label: "Hybrid Retrieval", desc: "Dense + Sparse rank fusion.", icon: Search },
  { id: "06", label: "Verification", desc: "NLI model proves no hallucinations.", icon: ShieldCheck },
  { id: "07", label: "Answer Gen", desc: "Verified synthesis from exact context.", icon: MessageSquare },
  { id: "08", label: "Evidence", desc: "Mapped to exact bounding boxes.", icon: TextSelect },
  { id: "09", label: "Trust Score", desc: "Final confidence calibration.", icon: Zap },
];

export function HowClarityWorks() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 1000vh pinned height for extra climax hold
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Climax Hold: 0 -> 0.85 scroll maps to 0 -> 1 progress.
  const mappedProgress = useTransform(scrollYProgress, [0, 0.85], [0, 1]);
  
  const progress = useSpring(mappedProgress, {
    stiffness: 120,
    damping: 22,
    mass: 0.8,
    restDelta: 0.001
  });

  // Cinematic Parallax
  const cameraScale = useTransform(progress, [0, 0.5, 1], [0.98, 1.0, 0.98]);
  const cameraY = useTransform(progress, [0, 1], [40, -40]);

  return (
    <section id="pipeline" ref={containerRef} className="relative h-[1000vh] bg-[#05070B] overflow-clip font-sans">
      
      {/* Pinned Cinematic Container */}
      <motion.div 
        style={{ scale: cameraScale, y: cameraY }}
        className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden origin-center"
      >
        {/* Deep Background Depth */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.1),transparent_60%)]" />
          <div className="w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
        </div>

        {/* Section Header */}
        <div className="absolute top-12 w-full text-center z-20 pointer-events-none">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">The Clarity Pipeline</h2>
          <p className="text-gray-400 text-sm md:text-base">A living visualization of the exact data journey.</p>
        </div>

        {/* Main Content Layout */}
        <div className="w-full max-w-7xl mx-auto h-full flex flex-col md:flex-row mt-12 md:mt-24">
          
          {/* Left Vertical Pipeline (30%) */}
          <div className="w-full md:w-[35%] h-[20vh] md:h-full relative shrink-0">
            {/* The Glass Tube SVG */}
            <div className="absolute left-8 md:left-12 top-[10%] bottom-[20%] w-8 z-0">
               <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 32 1000">
                  {/* Background Track */}
                  <path d="M16 0 L16 1000" stroke="rgba(255,255,255,0.05)" strokeWidth="2" fill="none" />
                  
                  {/* Glowing Energy Beam */}
                  <motion.path 
                    d="M16 0 L16 1000" 
                    stroke="url(#pipeline-grad)" 
                    strokeWidth="3" 
                    fill="none"
                    style={{ pathLength: useTransform(progress, [0, 1], [0, 1]) }}
                  />
                  
                  <defs>
                    <linearGradient id="pipeline-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F59E0B" stopOpacity="0" />
                      <stop offset="50%" stopColor="#F59E0B" stopOpacity="1" />
                      <stop offset="100%" stopColor="#EA580C" stopOpacity="0.5" />
                    </linearGradient>
                  </defs>
               </svg>

              {/* Traveling Glowing Capsule (The Data Particle) */}
              <motion.div 
                className="absolute left-1/2 -translate-x-1/2 w-[3px] h-[60px] bg-white rounded-full shadow-[0_0_20px_4px_#F59E0B] z-20"
                style={{ 
                  top: useTransform(progress, [0, 1], ["0%", "100%"]),
                  translateY: useTransform(progress, [0, 0.05, 0.95, 1], ["0%", "-50%", "-50%", "-100%"])
                }}
              />
            </div>

            {/* Pipeline Nodes */}
            <div className="absolute inset-0 top-[10%] bottom-[20%]">
              {STEPS.map((step, i) => (
                <PipelineNode key={i} i={i} progress={progress} step={step} />
              ))}
            </div>
          </div>

          {/* Right Morphing Visualization (65%) */}
          <div className="w-full md:w-[65%] h-[60vh] md:h-[80%] flex items-center justify-center p-4">
            <MorphingCanvas progress={progress} />
          </div>

        </div>
      </motion.div>
    </section>
  );
}

function PipelineNode({ i, progress, step }: any) {
  const peak = i / 8; // 0 to 1
  const top = `${peak * 100}%`;
  
  const scale = useTransform(progress, [peak - 0.1, peak, peak + 0.1], [0.8, 1.3, 1.0]);
  
  // Color: Gray (future) -> Orange (active) -> Amber (completed)
  const ringColor = useTransform(progress, [peak - 0.1, peak, peak + 0.1], ["rgba(255,255,255,0.1)", "rgba(245,158,11,1)", "rgba(245,158,11,0.5)"]);
  
  // Fill color: Transparent (future) -> Orange (active) -> Orange (completed)
  const coreOpacity = useTransform(progress, [peak - 0.1, peak], [0, 1]);
  
  // Glow: Only when active
  const glowOpacity = useTransform(progress, [peak - 0.1, peak, peak + 0.1], [0, 1, 0.3]);
  
  // Ring Expansion Pulse (only spikes when passing peak)
  const pulseScale = useTransform(progress, [peak - 0.05, peak, peak + 0.1], [1, 1.8, 2]);
  const pulseOpacity = useTransform(progress, [peak - 0.05, peak, peak + 0.1], [0, 0.5, 0]);

  const textOpacity = useTransform(progress, [peak - 0.1, peak], [0.3, 1]);
  const textX = useTransform(progress, [peak - 0.1, peak], [-10, 0]);

  return (
    <div className="absolute left-8 md:left-12 w-64 md:w-80 flex items-center group cursor-default" style={{ top, transform: "translateY(-50%)" }}>
      <div className="w-8 flex justify-center shrink-0">
        <motion.div 
          style={{ scale, borderColor: ringColor }} 
          className="relative w-4 h-4 md:w-5 md:h-5 rounded-full bg-[#05070B] border-[1.5px] z-10 flex items-center justify-center transition-colors"
        >
          {/* Explosion Pulse */}
          <motion.div 
            className="absolute inset-0 rounded-full border border-orange-500" 
            style={{ scale: pulseScale, opacity: pulseOpacity }}
          />
          {/* Soft Active Glow */}
          <motion.div 
            className="absolute inset-0 rounded-full bg-orange-500 blur-md" 
            style={{ opacity: glowOpacity }}
          />
          {/* Solid Core */}
          <motion.div 
            className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-orange-500" 
            style={{ opacity: coreOpacity }}
          />
        </motion.div>
      </div>

      <motion.div className="ml-6 md:ml-8" style={{ opacity: textOpacity, x: textX }}>
        <div className="font-bold text-white tracking-tight text-sm md:text-base group-hover:text-orange-400 transition-colors">{step.label}</div>
        <motion.div className="text-xs md:text-sm text-gray-400 mt-1">
          {step.desc}
        </motion.div>
      </motion.div>
    </div>
  )
}

const appleEase = cubicBezier(0.22, 1, 0.36, 1);

const NUM_NODES = 12;

function MorphingCanvas({ progress }: { progress: MotionValue<number> }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove(e: React.MouseEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  }

  return (
    <div 
      onMouseMove={handleMouseMove}
      className="relative w-full max-w-[700px] aspect-square md:aspect-[4/3] bg-[#0A0D14]/80 rounded-[2rem] border border-white/5 flex items-center justify-center overflow-hidden shadow-2xl backdrop-blur-xl group perspective-[1000px]"
    >
      {/* Inner glass edge */}
      <div className="absolute inset-0 rounded-[2rem] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),inset_0_2px_20px_rgba(255,255,255,0.02)] pointer-events-none z-50" />
      
      {/* Dynamic Background Environment */}
      <motion.div 
        className="absolute w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.15),transparent_50%)] pointer-events-none blur-[100px]"
        style={{
           x: useTransform(progress, [0, 1], ["-80%", "0%"]),
           y: useTransform(progress, [0, 1], ["-80%", "0%"])
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px]" />

      {/* Mouse reactive glow */}
      <motion.div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none mix-blend-screen"
        style={{ background: useMotionTemplate`radial-gradient(400px circle at ${mouseX}px ${mouseY}px, rgba(245,158,11,0.12), transparent 40%)` }}
      />

      {/* Internal Layers with Idle Breathing */}
      <motion.div 
        className="absolute inset-0 flex items-center justify-center"
        animate={{ y: [-4, 4, -4], rotateX: [-1, 1, -1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <RetrievalLines progress={progress} />
        <TrustScoreRing progress={progress} />

        {/* The 12 Physical Morphing Nodes */}
        {Array.from({ length: NUM_NODES }).map((_, i) => (
          <MorphNode key={i} index={i} progress={progress} />
        ))}
        
        <OCRLaser progress={progress} />
        <AnswerText progress={progress} />
      </motion.div>
    </div>
  );
}

function MorphNode({ index, progress }: { index: number, progress: MotionValue<number> }) {
  const row = Math.floor(index / 4); // 0, 1, 2
  const col = index % 4; // 0, 1, 2, 3

  // --- STAGE 0, 1: PDF Block ---
  const s0_w = 30;
  const s0_h = 80;
  const s0_x = (col - 1.5) * s0_w;
  const s0_y = (row - 1) * s0_h;
  const s0_br = 0;

  // --- STAGE 2: Chunking ---
  const s2_y = s0_y + (row - 1) * 20; // Spread rows apart
  const s2_br = 6;

  // --- STAGE 3, 4: Embeddings ---
  const s3_w = 16;
  const s3_h = 16;
  const s3_br = 8;
  const s3_x = (col - 1.5) * 80;
  const s3_y = (row - 1) * 80;

  // --- STAGE 5: Shield ---
  const shieldX = [ 0,  40,  80,  80,  40,   0, -40, -80, -80, -40, -20,  20];
  const shieldY = [-90,-90, -60, -10,  40,  90,  40, -10, -60, -90, -30, -30];
  const s5_x = shieldX[index];
  const s5_y = shieldY[index];

  // --- STAGE 6, 7: Answer Box ---
  const isMain = index === 0;
  const s6_w = isMain ? 340 : 0;
  const s6_h = isMain ? 180 : 0;
  const s6_x = 0;
  const s6_y = 0;
  const s6_br = 16;

  // --- STAGE 8: Trust Score Circle ---
  const s8_w = isMain ? 260 : 0;
  const s8_h = isMain ? 260 : 0;
  const s8_br = isMain ? 130 : 0;

  // Keyframes mapping exactly to 9 stages: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0]
  const pList = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0];

  const x = useTransform(progress, pList, [s0_x, s0_x, s0_x, s3_x, s3_x, s5_x, s6_x, s6_x, s6_x]);
  const y = useTransform(progress, pList, [s0_y, s0_y, s2_y, s3_y, s3_y, s5_y, s6_y, s6_y, s6_y]);
  const w = useTransform(progress, pList, [s0_w, s0_w, s0_w, s3_w, s3_w, s3_w, s6_w, s6_w, s8_w]);
  const h = useTransform(progress, pList, [s0_h, s0_h, s0_h, s3_h, s3_h, s3_h, s6_h, s6_h, s8_h]);
  const br = useTransform(progress, pList, [s0_br, s0_br, s2_br, s3_br, s3_br, s3_br, s6_br, s6_br, s8_br]);

  // Visual Styling Morphing
  const bg = useTransform(progress,
    [0, 0.25, 0.375, 0.625, 0.75, 1.0],
    ["rgba(255,255,255,0.95)", "rgba(255,255,255,0.8)", "rgba(59,130,246,0.9)", "rgba(16,185,129,0.9)", "rgba(15,23,42,0.8)", "rgba(0,0,0,0)"]
  );

  const shadow = useTransform(progress,
    [0, 0.25, 0.375, 0.625, 0.75, 1.0],
    ["0 10px 30px -10px rgba(255,255,255,0.2)", "0 5px 15px -5px rgba(255,255,255,0.1)", "0 0 15px 0px rgba(59,130,246,0.6)", "0 0 20px 0px rgba(16,185,129,0.7)", "0 20px 40px -10px rgba(0,0,0,0.8)", "0 0 0px 0px rgba(0,0,0,0)"]
  );

  const border = useTransform(progress,
    [0, 0.25, 0.375, 0.75, 1.0],
    ["rgba(255,255,255,0)", "rgba(255,255,255,0.1)", "rgba(147,197,253,0.5)", "rgba(255,255,255,0.1)", "rgba(245,158,11,0)"]
  );

  const bw = useTransform(progress, [0, 0.25, 0.375, 0.75, 1.0], [0, 1, 2, 1, 0]);

  return (
    <motion.div
      className="absolute top-1/2 left-1/2 flex items-center justify-center shadow-xl"
      style={{
        x: useTransform(x, v => `calc(${v}px - 50%)`),
        y: useTransform(y, v => `calc(${v}px - 50%)`),
        width: w,
        height: h,
        borderRadius: br,
        backgroundColor: bg,
        boxShadow: shadow,
        borderColor: border,
        borderWidth: bw,
        borderStyle: "solid"
      }}
    />
  );
}

function OCRLaser({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0.08, 0.125, 0.18, 0.22], [0, 1, 1, 0]);
  const y = useTransform(progress, [0.1, 0.2], [-140, 140]);

  return (
    <motion.div 
      className="absolute top-1/2 left-1/2 w-[140px] h-[2px] bg-orange-400 shadow-[0_0_20px_4px_rgba(245,158,11,0.8)] z-30"
      style={{ x: "-50%", y, opacity }}
    />
  )
}

function RetrievalLines({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0.45, 0.5, 0.55], [0, 1, 0]);
  const pathLength = useTransform(progress, [0.45, 0.5], [0, 1]);

  return (
    <motion.svg className="absolute inset-0 w-full h-full" style={{ opacity }}>
       <motion.path 
         d="M300 200 L250 150 L200 200 L250 250 Z M400 300 L350 250 L300 300 L350 350 Z" 
         stroke="rgba(147,197,253,0.5)"
         strokeWidth="2"
         fill="none"
         style={{ pathLength }}
       />
    </motion.svg>
  )
}

function AnswerText({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0.72, 0.75, 0.85, 0.88], [0, 1, 1, 0]);
  const clipWidth = useTransform(progress, [0.75, 0.82], ["0%", "100%"]);
  const boxOp = useTransform(progress, [0.85, 0.875, 0.9], [0, 1, 0]);

  return (
    <motion.div 
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[140px] pointer-events-none flex flex-col justify-center p-6 z-20"
      style={{ opacity }}
    >
      <div className="text-gray-500 font-mono text-xs mb-3">{">"} generating_synthesis...</div>
      <motion.div 
        className="text-white text-sm md:text-base whitespace-nowrap overflow-hidden border-r-2 border-orange-500 pr-2"
        style={{ width: clipWidth }}
      >
        Verified answer generated from exact source.
      </motion.div>
      
      {/* Evidence Bounding Box */}
      <motion.div 
        className="absolute top-[68px] left-[20px] right-[20px] h-[32px] border-2 border-orange-500 shadow-[0_0_20px_rgba(245,158,11,0.4)] bg-orange-500/10 rounded-sm"
        style={{ opacity: boxOp }}
      />
    </motion.div>
  )
}

function TrustScoreRing({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0.92, 0.98], [0, 1]);
  const pathLength = useTransform(progress, [0.94, 1.0], [0, 1]);
  const score = useTransform(progress, [0.94, 1.0], [0, 98]);

  return (
    <motion.div 
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[260px] h-[260px] flex items-center justify-center z-20"
      style={{ opacity }}
    >
      <svg className="absolute inset-0 w-full h-full -rotate-90">
        <motion.circle 
          cx="130" cy="130" r="124" 
          stroke="url(#orange-glow)" 
          strokeWidth="6" 
          fill="none" 
          style={{ pathLength }}
        />
        <defs>
          <linearGradient id="orange-glow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
        </defs>
      </svg>
      <motion.div className="text-6xl md:text-7xl font-bold text-white tracking-tighter shadow-orange-500/50 drop-shadow-2xl flex items-baseline">
        <NumberDisplay value={score} />
        <span className="text-3xl md:text-4xl text-orange-500 ml-2">%</span>
      </motion.div>
    </motion.div>
  )
}

function NumberDisplay({ value }: { value: MotionValue<number> }) {
  const [num, setNum] = useState(0);
  useMotionValueEvent(value, "change", (v) => setNum(Math.round(v)));
  return <span>{num}</span>;
}
