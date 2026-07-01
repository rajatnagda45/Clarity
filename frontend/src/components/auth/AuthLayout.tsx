"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import { useEffect } from "react";
import { CheckCircle2, ShieldCheck, Zap } from "lucide-react";
import { FloatingDashboardPreview } from "./FloatingDashboardPreview";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  // Mouse Parallax Logic
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 30, stiffness: 100, mass: 1 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  const parallaxX = useTransform(smoothX, [-1, 1], [-10, 10]);
  const parallaxY = useTransform(smoothY, [-1, 1], [-10, 10]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      const x = (e.clientX / innerWidth) * 2 - 1;
      const y = (e.clientY / innerHeight) * 2 - 1;
      mouseX.set(x);
      mouseY.set(y);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <div className="min-h-screen bg-[#05070B] flex font-sans text-white overflow-hidden selection:bg-blue-500/30 selection:text-white relative">
      {/* 
        ========================================
        7-LAYER AMBIENT BACKGROUND SYSTEM
        ========================================
      */}
      {/* Layer 1: Solid Base (handled by bg-[#05070B] on wrapper) */}

      {/* Layer 2: Subtle Radial Gradients */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-900/20 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      {/* Layer 3: Ultra-fine Animated Grid */}
      <div 
        className="absolute inset-0 z-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
          backgroundPosition: 'center center'
        }}
      />

      {/* Layer 4: Animated Grain Texture */}
      <div className="absolute inset-0 z-10 opacity-[0.03] pointer-events-none mix-blend-overlay">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <filter id="noiseFilter">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/>
          </filter>
          <rect width="100%" height="100%" filter="url(#noiseFilter)"/>
        </svg>
      </div>

      {/* Layer 5: Moving Ambient Light */}
      <motion.div 
        style={{ x: parallaxX, y: parallaxY }}
        className="absolute inset-0 z-0 pointer-events-none"
      >
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/3 left-1/4 w-[600px] h-[600px] bg-blue-500/5 blur-[150px] rounded-full mix-blend-screen"
        />
      </motion.div>

      {/* Layer 6: Soft purple-blue volumetric glow (Behind Auth Card - applied to right panel) */}

      {/* Layer 7: Tiny floating particles */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              y: [0, -20, 0],
              x: [0, Math.random() * 20 - 10, 0],
              opacity: [0.1, 0.4, 0.1]
            }}
            transition={{
              duration: 10 + Math.random() * 10,
              repeat: Infinity,
              delay: Math.random() * 5,
              ease: "easeInOut"
            }}
            className="absolute rounded-full bg-white blur-[1px]"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: Math.random() * 2 + 1 + 'px',
              height: Math.random() * 2 + 1 + 'px',
            }}
          />
        ))}
      </div>


      {/* 
        ========================================
        MAIN LAYOUT
        ========================================
      */}

      {/* LEFT SIDE - Brand & Marketing (Hidden on Mobile) */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] xl:w-[50%] p-12 relative z-20 border-r border-white/[0.02]">
        
        {/* Content Top: Logo */}
        <div>
          <Link href="/" className="flex items-center gap-3 w-max group">
            <div className="w-8 h-8 rounded bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
              <span className="font-bold text-white text-sm">C</span>
            </div>
            <span className="font-bold text-xl tracking-tight text-white">Clarity</span>
          </Link>
        </div>

        {/* Content Middle: Headline & Features & Dashboard */}
        <div className="max-w-xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} // Custom spring ease
          >
            <h1 className="text-4xl xl:text-5xl font-bold tracking-tight mb-6 leading-[1.15]">
              Chat with documents.<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                Trust every answer.
              </span>
            </h1>
            
            <p className="text-gray-400 text-lg mb-8 leading-relaxed max-w-md">
              Enterprise AI workspace built for teams. Grounded responses. Source citations. Secure knowledge retrieval.
            </p>

            <div className="space-y-4 mb-10">
              {[
                { icon: Zap, text: "AI Powered Context" },
                { icon: CheckCircle2, text: "Source Verified Citations" },
                { icon: ShieldCheck, text: "Enterprise Grade Security" }
              ].map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + (i * 0.1), duration: 0.6 }}
                  className="flex items-center gap-4 text-gray-300 group"
                >
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-blue-500/10 group-hover:border-blue-500/30 transition-colors">
                    <item.icon className="w-4 h-4 text-gray-400 group-hover:text-blue-400 transition-colors" />
                  </div>
                  <span className="font-medium">{item.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <FloatingDashboardPreview />
        </div>

        {/* Content Bottom: Social Proof */}
        <div>
          <p className="text-xs text-gray-500 mb-6 uppercase tracking-[0.2em] font-semibold">Security & Scale</p>
          <div className="grid grid-cols-4 gap-6">
            <div>
              <div className="text-2xl font-bold text-white mb-1">10M+</div>
              <div className="text-xs text-gray-500 font-medium">Documents Indexed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white mb-1">99.9%</div>
              <div className="text-xs text-gray-500 font-medium">Retrieval Accuracy</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white mb-1">SOC2</div>
              <div className="text-xs text-gray-500 font-medium">Type II Compliant</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white mb-1">AES</div>
              <div className="text-xs text-gray-500 font-medium">256-bit Encryption</div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - Auth Container */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 relative z-20">
        
        {/* Layer 6: Soft purple-blue volumetric glow behind Auth Card */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[60%] max-w-[600px] bg-gradient-to-tr from-blue-900/20 to-purple-900/20 blur-[100px] rounded-full pointer-events-none z-0 mix-blend-screen" />

        {/* Mobile Logo */}
        <div className="lg:hidden absolute top-8 left-6 z-30">
          <Link href="/" className="flex items-center gap-2 w-max">
            <div className="w-6 h-6 rounded bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="font-bold text-white text-xs">C</span>
            </div>
            <span className="font-bold text-lg tracking-tight text-white">Clarity</span>
          </Link>
        </div>

        {/* The Auth Component */}
        <motion.div
          style={{ x: parallaxX, y: parallaxY }} // Subtle card reaction to mouse
          className="w-full max-w-[420px] relative z-20"
        >
          {/* Card Entrance Animation */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ 
              duration: 0.7, 
              type: "spring", 
              bounce: 0.3,
              delayChildren: 0.1,
              staggerChildren: 0.06
            }}
            className="w-full"
          >
            {children}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
