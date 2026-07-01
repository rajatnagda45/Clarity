"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { pricingPlans, trustBadges } from "./pricing/data";
import { PricingToggle } from "./pricing/PricingToggle";
import { PricingCard } from "./pricing/PricingCard";
import { UsageCalculator } from "./pricing/UsageCalculator";
import { MagneticButton } from "./ui/MagneticButton";
import { SpotlightCard } from "./ui/SpotlightCard";
import { ShieldCheck } from "lucide-react";

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section id="pricing" className="py-32 relative bg-[#05070B] overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-orange-900/10 rounded-full blur-[120px] pointer-events-none" />
      <motion.div 
        animate={{ backgroundPositionY: ["0px", "100px"] }}
        transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-block px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold uppercase tracking-wider mb-6"
          >
            Pricing
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-6"
          >
            Simple pricing.<br />
            Scale as your AI grows.
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed"
          >
            Whether you&apos;re an individual developer or an enterprise processing millions of documents, Clarity scales with you.
          </motion.p>
        </div>

        <PricingToggle isYearly={isYearly} setIsYearly={setIsYearly} />

        {/* Pricing Cards Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-end mb-16 relative">
          {pricingPlans.map((plan, i) => (
            <PricingCard key={plan.id} plan={plan} isYearly={isYearly} index={i} />
          ))}
        </div>

        {/* Usage Calculator */}
        <motion.div
          initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <UsageCalculator />
        </motion.div>

        {/* Feature Spotlight */}
        <div className="mt-40 mb-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Animated Pipeline Loop */}
            <motion.div 
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-[#0C0F16]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 relative h-[400px] overflow-hidden shadow-2xl"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/5 to-purple-500/5 z-0" />
              
              <div className="relative z-10 flex flex-col h-full justify-between">
                {["PDF Upload", "Chunking", "Embeddings", "Retrieval", "Verification", "Answer"].map((step, i) => (
                  <div key={i} className="flex items-center gap-4 relative group">
                    <motion.div 
                      animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
                      className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 shadow-lg"
                    >
                      <div className="w-2 h-2 rounded-full bg-orange-400" />
                    </motion.div>
                    
                    <span className="text-sm font-medium text-gray-300">{step}</span>

                    {/* Connecting Line */}
                    {i < 5 && (
                      <div className="absolute left-[19px] top-[40px] bottom-[-20px] w-[2px] bg-white/5 z-[-1]" />
                    )}

                    {/* Traveling Particle */}
                    {i < 5 && (
                      <motion.div 
                        className="absolute left-[19px] top-[40px] w-[2px] h-4 bg-orange-500 shadow-[0_0_10px_rgba(245,158,11,0.8)] z-0 rounded-full"
                        animate={{ top: ["40px", "80px", "40px"], opacity: [0, 1, 0] }}
                        transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.4, ease: "linear" }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right: Copy */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h3 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-6">
                Only pay for <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">intelligence.</span>
              </h3>
              <p className="text-lg text-gray-400 leading-relaxed mb-8">
                Unlike generic LLM wrappers, Clarity runs a complex 16-node pipeline for every query. You only pay for the verified answers you generate, not the underlying compute it takes to synthesize them.
              </p>
              
              <ul className="space-y-3">
                {["Free indexing for first 100k vectors", "No hidden storage costs", "Volume discounts applied automatically"].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-300">
                    <ShieldCheck className="w-5 h-5 text-orange-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>

        {/* Trust Section */}
        <div className="mb-40 text-center">
          <p className="text-sm text-gray-500 font-medium tracking-widest uppercase mb-8">Enterprise Security Standard</p>
          <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
            {trustBadges.map((badge, i) => (
              <motion.div
                key={badge}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, type: "spring" }}
              >
                <SpotlightCard className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 hover:border-white/20 transition-colors cursor-default">
                  <span className="text-sm text-gray-300 font-medium whitespace-nowrap">{badge}</span>
                </SpotlightCard>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Enterprise CTA */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-3xl overflow-hidden p-[1px] group"
        >
          {/* Animated Gradient Border */}
          <motion.div 
            className="absolute inset-0 bg-gradient-to-r from-orange-500 via-purple-500 to-orange-500 opacity-30"
            animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            style={{ backgroundSize: "200% 200%" }}
          />
          
          <div className="relative bg-[#0C0F16]/95 backdrop-blur-2xl rounded-3xl p-12 text-center overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-purple-500/10 to-orange-500/10 rounded-full blur-[80px] pointer-events-none group-hover:scale-110 transition-transform duration-700" />
            
            <div className="relative z-10 max-w-2xl mx-auto">
              <h3 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">Need custom infrastructure?</h3>
              <p className="text-gray-400 mb-8 text-lg">
                Deploy Clarity inside your own organization with dedicated infrastructure, compliance, and white-glove support.
              </p>
              
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <MagneticButton intensity={0.1}>
                  <button className="px-8 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors w-full sm:w-auto">
                    Talk to Sales
                  </button>
                </MagneticButton>
                <MagneticButton intensity={0.1}>
                  <button className="px-8 py-3 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 border border-white/10 transition-colors w-full sm:w-auto">
                    Schedule Demo
                  </button>
                </MagneticButton>
              </div>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
