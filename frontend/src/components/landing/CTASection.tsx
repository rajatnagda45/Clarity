"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { MagneticButton } from "./ui/MagneticButton";

export function CTASection() {
  return (
    <section className="py-32 relative overflow-hidden bg-[#05070B] border-t border-white/5">
      {/* Massive Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-[400px] bg-gradient-to-tr from-orange-600/20 to-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.3 }}
        >
          <h2 className="text-5xl md:text-6xl font-extrabold text-white tracking-tight mb-6">
            Stop guessing.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">
              Start verifying.
            </span>
          </h2>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Join the forward-thinking legal, procurement, and risk teams using Clarity to safely chat with their most critical documents.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <MagneticButton intensity={0.2}>
              <Link href="/signup" className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-[0_0_30px_rgba(245,158,11,0.25)] hover:shadow-[0_0_50px_rgba(245,158,11,0.6)] transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden group block">
                <div className="absolute inset-0 bg-white/20 translate-y-[100%] group-hover:translate-y-[0%] transition-transform duration-300 ease-out" />
                <span className="relative z-10">Start free trial</span>
                <span className="relative z-10 ml-1 group-hover:translate-x-1 transition-transform">→</span>
              </Link>
            </MagneticButton>
            
            <MagneticButton intensity={0.1}>
              <button className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-white bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
                Contact sales
              </button>
            </MagneticButton>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
