"use client";

import { motion } from "framer-motion";
import { Check, Minus } from "lucide-react";
import { comparisonFeatures, pricingPlans } from "./data";

export function ComparisonTable() {
  return (
    <section className="py-32 relative z-10 max-w-7xl mx-auto px-6">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Compare all features</h2>
        <p className="text-gray-400 text-lg">A detailed breakdown of everything included in each plan.</p>
      </div>

      <div className="w-full overflow-x-auto pb-8">
        <div className="min-w-[800px]">
          {/* Header Row */}
          <div className="grid grid-cols-5 gap-4 mb-8 sticky top-0 bg-[#05070B]/90 backdrop-blur-md z-20 py-4 border-b border-white/10">
            <div className="col-span-1"></div>
            {pricingPlans.map((plan) => (
              <div key={plan.id} className="text-center">
                <h4 className="text-xl font-bold text-white">{plan.name}</h4>
                <div className="text-sm text-gray-500 mt-1">
                  {plan.priceMonthly !== null ? `$${plan.priceMonthly}/mo` : "Custom"}
                </div>
              </div>
            ))}
          </div>

          {/* Feature Categories */}
          {comparisonFeatures.map((category, catIdx) => (
            <div key={category.category} className="mb-12">
              <div className="col-span-5 border-b border-white/5 pb-2 mb-4">
                <h5 className="text-lg font-semibold text-orange-400">{category.category}</h5>
              </div>

              {category.features.map((feature, featIdx) => (
                <motion.div 
                  key={feature.name}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: featIdx * 0.05 }}
                  className="grid grid-cols-5 gap-4 py-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors rounded-lg group"
                >
                  <div className="col-span-1 flex items-center pl-4">
                    <span className="text-sm text-gray-300 font-medium">{feature.name}</span>
                  </div>
                  
                  {['starter', 'pro', 'business', 'enterprise'].map((planId) => {
                    // @ts-ignore
                    const val = feature[planId];
                    return (
                      <div key={planId} className="flex items-center justify-center text-sm">
                        {typeof val === 'boolean' ? (
                          val ? (
                            <Check className="w-5 h-5 text-orange-500" />
                          ) : (
                            <Minus className="w-5 h-5 text-gray-700" />
                          )
                        ) : (
                          <span className={planId === 'enterprise' ? "text-white" : "text-gray-400"}>
                            {val}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </motion.div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
