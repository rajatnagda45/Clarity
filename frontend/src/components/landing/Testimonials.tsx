"use client";

import { motion } from "framer-motion";
import { SpotlightCard } from "./ui/SpotlightCard";

const testimonials = [
  {
    quote: "Clarity caught a non-standard auto-renewal clause that our previous AI tool completely hallucinated over. It's not just a time-saver, it's a liability saver.",
    author: "Sarah Jenkins",
    title: "VP Operations, LexTrust"
  },
  {
    quote: "The ability to click a claim and instantly see the exact highlighted text in the original PDF is the feature we didn't know we needed. Incredible trust factor.",
    author: "Michael Chang",
    title: "Procurement Lead, Acme Corp"
  },
  {
    quote: "We ran their adversarial eval suite on our own dataset. The two-signal verifier caught 94% of planted hallucinations. Nothing else on the market does this.",
    author: "Dr. Elena Rostova",
    title: "Head of AI, PactFlow"
  }
];

export function Testimonials() {
  return (
    <section id="customers" className="py-32 relative overflow-hidden bg-[#05070B]">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-20">
          <h2 className="text-orange-500 font-semibold tracking-widest uppercase text-sm mb-4">Testimonials</h2>
          <h3 className="text-4xl md:text-5xl font-bold text-white tracking-tight">Don&apos;t just take our word for it.</h3>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 50, filter: "blur(10px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, delay: i * 0.2, type: "spring", bounce: 0.2 }}
              className="h-full"
            >
              <SpotlightCard className="h-full bg-[#0C0F16]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8 flex flex-col justify-between">
                <div className="mb-8 relative">
                  <span className="text-6xl text-orange-500/20 absolute -top-4 -left-2 leading-none font-serif">&quot;</span>
                  <p className="text-gray-300 leading-relaxed relative z-10 text-lg">
                    {t.quote}
                  </p>
                </div>
                <div className="flex items-center gap-4 border-t border-white/10 pt-6">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border border-white/20" />
                  <div>
                    <div className="text-white font-semibold">{t.author}</div>
                    <div className="text-sm text-gray-500">{t.title}</div>
                  </div>
                </div>
              </SpotlightCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
