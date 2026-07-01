"use client";

import { motion } from "framer-motion";
import { Shield, Hexagon, Code2, Database, Network, Box } from "lucide-react";

const logos = [
  { name: "Acme Legal", icon: Shield },
  { name: "PactFlow", icon: Hexagon },
  { name: "LexTrust", icon: Code2 },
  { name: "DocuMind", icon: Database },
  { name: "ClauseAI", icon: Network },
  { name: "VeriContract", icon: Box },
];

export function TrustedBy() {
  return (
    <section className="py-20 overflow-hidden border-y border-white/5 bg-black/20">
      <div className="max-w-7xl mx-auto px-6 mb-10 text-center">
        <h2 className="text-sm font-semibold tracking-widest text-orange-500 uppercase">
          Trusted by teams building the future
        </h2>
      </div>
      
      {/* Marquee Container */}
      <div className="relative flex overflow-x-hidden group">
        {/* Gradient Masks for smooth fade on edges */}
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#05070B] to-transparent z-10" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#05070B] to-transparent z-10" />

        <motion.div
          className="flex whitespace-nowrap gap-16 py-4 items-center"
          animate={{ x: ["0%", "-50%"] }}
          transition={{
            ease: "linear",
            duration: 30,
            repeat: Infinity,
          }}
        >
          {/* Duplicate list for seamless looping */}
          {[...logos, ...logos, ...logos].map((company, index) => {
            const Icon = company.icon;
            return (
              <div 
                key={index}
                className="flex items-center gap-3 text-gray-500 hover:text-white transition-colors duration-300 opacity-60 hover:opacity-100 cursor-default"
              >
                <Icon className="w-8 h-8" strokeWidth={1.5} />
                <span className="text-2xl font-bold tracking-tight">{company.name}</span>
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
