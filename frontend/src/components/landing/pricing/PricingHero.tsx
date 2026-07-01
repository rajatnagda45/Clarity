"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { pricingPlans } from "./data";
import { PricingToggle } from "./PricingToggle";
import { PricingCard } from "./PricingCard";
import { UsageCalculator } from "./UsageCalculator";

export function PricingHero() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section className="relative w-full z-10 pt-20 pb-32">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-orange-900/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-block px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold uppercase tracking-wider mb-6"
          >
            Pricing
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-6"
          >
            Simple pricing.<br />
            Scale as your AI grows.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed mb-12"
          >
            Whether you&apos;re an individual developer or an enterprise processing millions of documents, Clarity scales with you.
          </motion.p>
          
          <PricingToggle isYearly={isYearly} setIsYearly={setIsYearly} />
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10 items-end mb-24 relative">
          {pricingPlans.map((plan, i) => (
            <PricingCard key={plan.id} plan={plan} isYearly={isYearly} index={i} />
          ))}
        </div>

        {/* Usage Calculator */}
        <UsageCalculator />
      </div>
    </section>
  );
}
