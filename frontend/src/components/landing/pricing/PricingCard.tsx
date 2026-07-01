"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { SpotlightCard } from "../ui/SpotlightCard";
import { MagneticButton } from "../ui/MagneticButton";
import { AnimatedCounter } from "./AnimatedCounter";

interface PricingCardProps {
  plan: any;
  isYearly: boolean;
  index: number;
}

export function PricingCard({ plan, isYearly, index }: PricingCardProps) {
  const price = isYearly ? plan.priceYearly : plan.priceMonthly;
  const isPopular = plan.popular;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay: index * 0.15, type: "spring", bounce: 0.2 }}
      className={`relative h-full ${isPopular ? "z-10 -mt-4 mb-4" : "z-0"}`}
    >
      <SpotlightCard 
        className={`h-full bg-[#0C0F16]/90 backdrop-blur-xl rounded-2xl flex flex-col transition-all duration-300
          ${isPopular 
            ? "border-orange-500/50 shadow-[0_0_30px_rgba(245,158,11,0.15)]" 
            : "border-white/10 hover:border-white/20"
          }`}
        spotlightColor={isPopular ? "rgba(245, 158, 11, 0.2)" : "rgba(255, 255, 255, 0.05)"}
      >
        {isPopular && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
              className="bg-gradient-to-r from-orange-500 to-orange-600 text-white text-[10px] font-bold uppercase tracking-wider py-1 px-3 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.5)] border border-orange-400/50"
            >
              Most Popular
            </motion.div>
          </div>
        )}

        <div className="p-10 flex-1 flex flex-col">
          <h4 className="text-2xl font-bold text-white mb-3">{plan.name}</h4>
          <p className="text-sm text-gray-400 h-10 leading-relaxed">{plan.desc}</p>
          
          <div className="my-8">
            <div className="flex items-end gap-1">
              {price === null ? (
                <span className="text-4xl font-extrabold text-white tracking-tight">Custom</span>
              ) : (
                <>
                  <span className="text-2xl font-bold text-white mb-2">$</span>
                  <span className="text-6xl font-extrabold text-white tracking-tight">
                    <AnimatedCounter value={price} duration={400} />
                  </span>
                  <span className="text-gray-500 text-sm mb-2 font-medium">/mo</span>
                </>
              )}
            </div>
            {price !== null && (
              <div className="text-xs text-orange-400/80 mt-2 h-4 font-medium uppercase tracking-widest">
                {isYearly ? "Billed annually" : "Billed monthly"}
              </div>
            )}
          </div>

          <div className="mb-10 flex-1">
            <ul className="space-y-5">
              {plan.features.map((feature: string, i: number) => (
                <motion.li 
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: (index * 0.1) + (i * 0.05) }}
                  className="flex items-start gap-3 text-sm text-gray-300"
                >
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                    <Check className="w-2.5 h-2.5 text-orange-400" />
                  </div>
                  <span className="leading-tight">{feature}</span>
                </motion.li>
              ))}
            </ul>
          </div>

          <div className="mt-auto">
            <MagneticButton intensity={0.1} className="w-full">
              <button className={`w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 group relative overflow-hidden
                ${isPopular 
                  ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)]" 
                  : "bg-white/5 text-white border border-white/10 hover:bg-white/10"
                }`}
              >
                {isPopular && <div className="absolute inset-0 bg-white/20 translate-y-[100%] group-hover:translate-y-[0%] transition-transform duration-300 ease-out" />}
                <span className="relative z-10">{plan.cta}</span>
              </button>
            </MagneticButton>
          </div>
        </div>
      </SpotlightCard>
    </motion.div>
  );
}
