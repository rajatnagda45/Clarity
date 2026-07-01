"use client";

import { motion } from "framer-motion";
import { Server, ShieldCheck, HeadphonesIcon, Globe, Network } from "lucide-react";
import { MagneticButton } from "../ui/MagneticButton";

export function EnterprisePanel() {
  return (
    <section className="py-32 relative z-10 max-w-7xl mx-auto px-6">
      
      <div className="relative bg-[#0C0F16]/95 backdrop-blur-2xl rounded-[3rem] border border-white/10 overflow-hidden shadow-2xl p-[1px] group">
        
        {/* Animated Gradient Border */}
        <motion.div 
          className="absolute inset-0 bg-gradient-to-r from-orange-500 via-purple-500 to-orange-500 opacity-20"
          animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          style={{ backgroundSize: "200% 200%" }}
        />

        <div className="relative bg-[#0C0F16] rounded-[3rem] p-12 md:p-20 overflow-hidden">
          
          {/* Internal Glow */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-purple-500/20 to-orange-500/5 rounded-full blur-[100px] pointer-events-none group-hover:scale-110 transition-transform duration-1000" />
          
          <div className="grid lg:grid-cols-2 gap-16 items-center relative z-10">
            
            {/* Left: Copy & Features */}
            <div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs font-semibold uppercase tracking-wider mb-6"
              >
                Enterprise
              </motion.div>
              <h3 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-6">
                Custom infrastructure for your organization.
              </h3>
              <p className="text-lg text-gray-400 mb-10 leading-relaxed">
                Deploy Clarity in your own AWS/GCP environment or use our dedicated single-tenant clusters. Fully isolated, SOC2 compliant, and backed by a 99.99% uptime SLA.
              </p>

              <div className="grid sm:grid-cols-2 gap-6 mb-12">
                {[
                  { icon: Server, title: "Dedicated Clusters" },
                  { icon: ShieldCheck, title: "SOC2 Type II & HIPAA" },
                  { icon: Network, title: "VPC Peering" },
                  { icon: Globe, title: "Data Residency" },
                  { icon: HeadphonesIcon, title: "Dedicated Support" },
                ].map((item, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                      <item.icon className="w-5 h-5 text-orange-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-300">{item.title}</span>
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <MagneticButton intensity={0.1}>
                  <button className="px-8 py-4 bg-white text-black font-semibold rounded-lg shadow-xl hover:bg-gray-200 transition-colors w-full sm:w-auto">
                    Contact Sales
                  </button>
                </MagneticButton>
                <MagneticButton intensity={0.1}>
                  <button className="px-8 py-4 bg-white/5 text-white font-semibold rounded-lg hover:bg-white/10 border border-white/10 transition-colors w-full sm:w-auto">
                    View Documentation
                  </button>
                </MagneticButton>
              </div>
            </div>

            {/* Right: Architecture Diagram Animation */}
            <div className="relative h-[500px] border border-white/10 rounded-2xl bg-black/40 backdrop-blur-sm overflow-hidden flex items-center justify-center">
              
              {/* Fake Network Grid */}
              <div 
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                  backgroundSize: "40px 40px",
                }}
              />

              {/* Animated Infrastructure Nodes */}
              <div className="relative w-[400px] h-[300px]">
                {/* User Node */}
                <motion.div 
                  className="absolute top-1/2 -left-4 -translate-y-1/2 w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.1)] z-10"
                >
                  <Globe className="w-6 h-6 text-gray-300" />
                </motion.div>

                {/* VPC Container */}
                <motion.div 
                  className="absolute inset-y-0 left-20 right-0 border-2 border-dashed border-orange-500/30 rounded-2xl bg-orange-500/5 p-6 z-0"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                >
                  <div className="absolute -top-3 left-6 px-2 bg-[#0C0F16] text-xs font-mono text-orange-400">Isolated VPC</div>
                  
                  {/* Load Balancer */}
                  <motion.div 
                    animate={{ boxShadow: ["0 0 0px rgba(245,158,11,0)", "0 0 20px rgba(245,158,11,0.3)", "0 0 0px rgba(245,158,11,0)"] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute top-1/2 left-8 -translate-y-1/2 w-12 h-24 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center z-10"
                  >
                    <Network className="w-5 h-5 text-orange-400" />
                  </motion.div>

                  {/* Worker Nodes */}
                  <div className="absolute top-1/2 right-8 -translate-y-1/2 flex flex-col gap-6 z-10">
                    {[1, 2, 3].map((node) => (
                      <motion.div 
                        key={node}
                        className="w-40 h-12 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center gap-3 relative overflow-hidden"
                      >
                        <motion.div 
                          className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/20 to-orange-500/0"
                          animate={{ x: ["-100%", "200%"] }}
                          transition={{ duration: 2, repeat: Infinity, delay: node * 0.3, ease: "linear" }}
                        />
                        <Server className="w-4 h-4 text-gray-300" />
                        <span className="text-xs font-mono text-gray-400">Worker-{node}</span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Animated Data Packets */}
                  <motion.div 
                    className="absolute top-1/2 left-0 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_white]"
                    animate={{ left: ["-10px", "70px", "70px"] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  />
                  <motion.div 
                    className="absolute top-1/2 left-24 -translate-y-[40px] w-2 h-2 bg-orange-400 rounded-full shadow-[0_0_10px_orange]"
                    animate={{ left: ["96px", "160px", "160px"], top: ["50%", "25%", "25%"], opacity: [0, 1, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.5, ease: "linear" }}
                  />
                  <motion.div 
                    className="absolute top-1/2 left-24 w-2 h-2 bg-orange-400 rounded-full shadow-[0_0_10px_orange]"
                    animate={{ left: ["96px", "160px", "160px"], opacity: [0, 1, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.7, ease: "linear" }}
                  />
                  <motion.div 
                    className="absolute top-1/2 left-24 translate-y-[40px] w-2 h-2 bg-orange-400 rounded-full shadow-[0_0_10px_orange]"
                    animate={{ left: ["96px", "160px", "160px"], top: ["50%", "75%", "75%"], opacity: [0, 1, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.9, ease: "linear" }}
                  />

                </motion.div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
