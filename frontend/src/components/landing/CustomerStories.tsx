"use client";

import { motion } from "framer-motion";
import { SpotlightCard } from "./ui/SpotlightCard";
import { TrendingUp, Clock, FileText } from "lucide-react";

const stories = [
  {
    company: "Acme Corp",
    role: "Legal Operations",
    quote: "Clarity reduced our contract review time by 80%. We process thousands of MSAs a month and the verifiable citations give our lawyers complete confidence.",
    metrics: [
      { label: "Hours Saved", value: "10k+", icon: Clock },
      { label: "Accuracy", value: "99.9%", icon: TrendingUp }
    ]
  },
  {
    company: "Global Logistics",
    role: "Procurement Head",
    quote: "We ingested our entire 15-year vendor history in an afternoon. Now, finding non-standard liability clauses takes seconds instead of days.",
    metrics: [
      { label: "Docs Indexed", value: "2.5M", icon: FileText },
      { label: "Cost Reduced", value: "65%", icon: TrendingUp }
    ]
  },
  {
    company: "Fintech Startup",
    role: "Compliance Officer",
    quote: "The ability to enforce RBAC down to the document level while querying across secure silos made Clarity the only viable choice for us.",
    metrics: [
      { label: "Security", value: "SOC2", icon: Clock },
      { label: "Deployment", value: "VPC", icon: FileText }
    ]
  }
];

export function CustomerStories() {
  return (
    <section id="customers" className="py-32 relative z-10 max-w-7xl mx-auto px-6 overflow-hidden">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Trusted by the best</h2>
        <p className="text-gray-400 text-lg">See how leading teams are transforming their document workflows.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {stories.map((story, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
          >
            <SpotlightCard className="h-full bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col justify-between hover:border-white/20 transition-colors">
              
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-purple-500 flex items-center justify-center font-bold text-white shadow-lg">
                    {story.company[0]}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">{story.company}</h4>
                    <div className="text-xs text-gray-500">{story.role}</div>
                  </div>
                </div>

                <p className="text-gray-300 leading-relaxed mb-8 text-sm md:text-base">
                  &quot;{story.quote}&quot;
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/10">
                {story.metrics.map((metric, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                      <metric.icon className="w-3 h-3" />
                      {metric.label}
                    </div>
                    <div className="text-xl font-bold text-white">{metric.value}</div>
                  </div>
                ))}
              </div>

            </SpotlightCard>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
