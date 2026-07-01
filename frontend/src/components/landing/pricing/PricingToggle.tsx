"use client";

import { motion } from "framer-motion";

interface PricingToggleProps {
  isYearly: boolean;
  setIsYearly: (v: boolean) => void;
}

export function PricingToggle({ isYearly, setIsYearly }: PricingToggleProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 mb-16">
      <div className="relative flex items-center p-1 bg-white/5 border border-white/10 rounded-full backdrop-blur-md">
        
        {/* Animated background pill */}
        <motion.div
          className="absolute top-1 bottom-1 w-[120px] bg-white/10 rounded-full border border-white/20 shadow-lg"
          animate={{ x: isYearly ? 120 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        />
        
        <button
          onClick={() => setIsYearly(false)}
          className={`relative z-10 w-[120px] py-2.5 text-sm font-medium transition-colors duration-300 ${!isYearly ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
        >
          Monthly
        </button>
        
        <button
          onClick={() => setIsYearly(true)}
          className={`relative z-10 w-[120px] py-2.5 text-sm font-medium transition-colors duration-300 ${isYearly ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
        >
          Yearly
        </button>
      </div>

      {/* Save 20% Badge */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: isYearly ? 1 : 0, y: isYearly ? 0 : -10 }}
        className="flex items-center gap-2 px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full text-orange-400 text-xs font-semibold"
      >
        <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-[pulse_2s_ease-in-out_infinite]" />
        Save 20%
      </motion.div>
    </div>
  );
}
