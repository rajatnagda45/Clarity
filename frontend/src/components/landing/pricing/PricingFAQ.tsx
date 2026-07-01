"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { pricingFaqs } from "./data";

export function PricingFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [showAll, setShowAll] = useState(false);
  const visibleFaqs = showAll ? pricingFaqs : pricingFaqs.slice(0, 5);

  return (
    <section className="py-32 relative z-10 max-w-4xl mx-auto px-6">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Frequently Asked Questions</h2>
        <p className="text-gray-400 text-lg">Everything you need to know about the product and billing.</p>
      </div>

      <div className="space-y-4">
        {visibleFaqs.map((faq, index) => {
          const isOpen = openIndex === index;

          return (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`border border-white/10 rounded-2xl overflow-hidden transition-colors duration-300 ${isOpen ? "bg-white/5" : "bg-transparent hover:bg-white/[0.02]"}`}
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="w-full px-6 py-6 flex items-center justify-between text-left"
              >
                <span className="text-lg font-semibold text-white">{faq.question}</span>
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0 ml-4"
                >
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                </motion.div>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  >
                    <div className="px-6 pb-6 pt-0 text-gray-400 leading-relaxed">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {!showAll && pricingFaqs.length > 5 && (
        <div className="mt-12 flex justify-center">
          <button
            onClick={() => setShowAll(true)}
            className="px-8 py-3 rounded-full border border-white/10 text-white hover:bg-white/5 transition-colors font-medium"
          >
            Load More Questions
          </button>
        </div>
      )}
    </section>
  );
}
