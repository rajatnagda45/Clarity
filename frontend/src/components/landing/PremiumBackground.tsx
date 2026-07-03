"use client";

import { motion, useMotionValue, useSpring, useTransform, useScroll } from "framer-motion";
import { useEffect, useState } from "react";

interface PremiumBackgroundProps {
  glowOpacity?: number; // Allows tuning per section
}

export function PremiumBackground({ glowOpacity = 1 }: PremiumBackgroundProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Mouse Parallax Logic
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 40, stiffness: 100, mass: 1 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  // Grid shift (very subtle, 2-4px max)
  const gridX = useTransform(smoothX, [-1, 1], [-3, 3]);
  const gridY = useTransform(smoothY, [-1, 1], [-3, 3]);

  // Glow shift (slightly more than grid for parallax depth)
  const glowX = useTransform(smoothX, [-1, 1], [-15, 15]);
  const glowY = useTransform(smoothY, [-1, 1], [-15, 15]);

  // Scroll Parallax (Optional, for vertical shift)
  const { scrollY } = useScroll();
  const scrollYTransform = useTransform(scrollY, [0, 1000], [0, 50]);

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
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-[#05070B]">
      
      {/* 
        LAYER 8: Animated Grain 
        (Placed early in DOM so it sits underneath glows, or on top? 
        Usually texture goes on top, but we'll put it here with mix-blend-overlay) 
      */}
      <div className="absolute inset-0 z-50 opacity-[0.015] mix-blend-overlay pointer-events-none">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <filter id="premiumNoiseFilter">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/>
          </filter>
          <rect width="100%" height="100%" filter="url(#premiumNoiseFilter)"/>
        </svg>
      </div>

      {/* 
        LAYER 2 & 3: Technical Grid & Major Divisions 
        Masked so it fades in the center (where text/glows are) and is stronger at edges.
      */}
      <motion.div 
        style={{ x: gridX, y: gridY }}
        className="absolute inset-[-10px] z-10 pointer-events-none"
      >
        <motion.div
          animate={{ opacity: [0.6, 0.9, 0.6] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0"
          style={{
            /* The mask: transparent in the very center, solid black at the edges */
            WebkitMaskImage: "radial-gradient(ellipse at center, rgba(0,0,0,0.1) 0%, rgba(0,0,0,1) 80%)",
            maskImage: "radial-gradient(ellipse at center, rgba(0,0,0,0.1) 0%, rgba(0,0,0,1) 80%)",
            
            backgroundImage: `
              linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px), 
              linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
              linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px), 
              linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px)
            `,
            backgroundSize: '240px 240px, 240px 240px, 48px 48px, 48px 48px',
            backgroundPosition: 'center center'
          }}
        />
      </motion.div>

      {/* 
        GLOW LAYERS (4, 5, 6)
      */}
      <motion.div 
        style={{ x: glowX, y: glowY }}
        className="absolute inset-0 z-20 pointer-events-none mix-blend-screen"
      >
        <motion.div style={{ y: scrollYTransform }} className="absolute inset-0">
          {/* Layer 4: Warm radial lighting (Center/Left) */}
          <div 
            className="absolute top-1/2 left-[40%] -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[280px]"
            style={{ backgroundColor: `rgba(255, 120, 40, ${0.08 * glowOpacity})` }}
          />

          {/* Layer 5: Secondary purple glow (Right, behind mockup) */}
          <div 
            className="absolute top-1/2 right-[10%] -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[300px]"
            style={{ backgroundColor: `rgba(124, 92, 255, ${0.05 * glowOpacity})` }}
          />

          {/* Layer 6: Soft blue ambient (Far Left) */}
          <div 
            className="absolute top-[20%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[250px]"
            style={{ backgroundColor: `rgba(79, 140, 255, ${0.04 * glowOpacity})` }}
          />
        </motion.div>
      </motion.div>

      {/* 
        LAYER 7: Ultra-light Vignette 
      */}
      <div 
        className="absolute inset-0 z-30 pointer-events-none"
        style={{ boxShadow: "inset 0 0 150px rgba(0,0,0,0.8)" }}
      />

      {/* 
        LAYER 9: Tiny Floating Particles 
      */}
      <div className="absolute inset-0 z-40 pointer-events-none">
        {mounted && [...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              y: [0, -30, 0],
              x: [0, Math.random() * 20 - 10, 0],
              opacity: [0.01, 0.04, 0.01]
            }}
            transition={{
              duration: 15 + Math.random() * 10,
              repeat: Infinity,
              delay: Math.random() * 10,
              ease: "easeInOut"
            }}
            className="absolute rounded-full bg-white blur-[0.5px]"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: Math.random() * 2 + 1 + 'px',
              height: Math.random() * 2 + 1 + 'px',
            }}
          />
        ))}
      </div>

    </div>
  );
}
