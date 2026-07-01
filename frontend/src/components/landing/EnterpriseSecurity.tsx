"use client";

import { motion } from "framer-motion";
import { Shield, Key, FileWarning, Users, Globe, Database, FileCheck, Network } from "lucide-react";

export function EnterpriseSecurity() {
  return (
    <section id="security" className="py-32 relative z-10 max-w-[1400px] mx-auto px-6 overflow-hidden">
      <div className="text-center mb-24">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Bank-grade security. <br />By design.</h2>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Clarity is built on a zero-trust architecture. Your data is encrypted at rest, in transit, and during inference. We never train models on your proprietary information.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-[250px]">
        
        {/* SOC 2 Type II */}
        <SecurityCard title="SOC 2 Type II" desc="Independently audited and certified for security, availability, and confidentiality." icon={Shield}>
          <div className="absolute right-0 bottom-0 opacity-10 w-48 h-48 translate-x-12 translate-y-12">
            <Shield className="w-full h-full text-white" />
          </div>
        </SecurityCard>

        {/* AES-256 Encryption */}
        <SecurityCard title="AES-256 Encryption" desc="All data is encrypted at rest using AES-256 and in transit via TLS 1.3." icon={Key}>
          <div className="absolute inset-0 flex items-center justify-center opacity-30 group-hover:opacity-100 transition-opacity">
            <motion.div 
              className="w-16 h-16 border-2 border-dashed border-orange-500 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            />
            <Key className="w-6 h-6 text-orange-400 absolute" />
          </div>
        </SecurityCard>

        {/* Immutable Audit Logs */}
        <SecurityCard className="lg:col-span-2" title="Immutable Audit Logs" desc="Complete visibility into every API request, query, and administrative action. Stream logs directly to Datadog or Splunk." icon={FileWarning}>
          <div className="absolute right-8 top-12 bottom-12 w-64 overflow-hidden mask-image-l opacity-50 group-hover:opacity-100 transition-opacity">
            <div className="space-y-3 font-mono text-[10px] text-green-400">
              {[1, 2, 3, 4, 5].map((i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  [{new Date().toISOString()}] REQ_ID_{i}934: <span className="text-gray-300">AUTHORIZED</span>
                </motion.div>
              ))}
            </div>
          </div>
        </SecurityCard>

        {/* SAML / SSO */}
        <SecurityCard title="Enterprise SSO" desc="Seamless integration with Okta, Azure AD, Google Workspace, and Ping Identity." icon={Network}>
          <div className="absolute inset-0 flex items-center justify-center gap-4 opacity-20 group-hover:opacity-100 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-blue-500" />
            <div className="w-2 h-2 rounded-full bg-white/50" />
            <div className="w-8 h-8 rounded-lg bg-orange-500" />
          </div>
        </SecurityCard>

        {/* Workspace Isolation */}
        <SecurityCard className="lg:col-span-2" title="Zero-Cross Contamination" desc="Multi-tenant architecture with strict logical isolation. Collections are cryptographically siloed at the database row-level." icon={Database}>
          <div className="absolute right-12 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
            {[1, 2, 3].map((i) => (
              <motion.div 
                key={i}
                className="w-32 h-6 bg-white/5 border border-white/20 rounded relative overflow-hidden"
                whileHover={{ scale: 1.05 }}
              >
                {i === 2 && <div className="absolute inset-y-0 left-0 w-full bg-orange-500/20" />}
              </motion.div>
            ))}
          </div>
        </SecurityCard>

        {/* Data Residency */}
        <SecurityCard title="Data Residency" desc="Deploy isolated clusters in US, EU, or APAC regions to meet local compliance." icon={Globe}>
          <div className="absolute -right-4 -bottom-4 w-32 h-32 opacity-20 group-hover:opacity-60 transition-opacity">
            <Globe className="w-full h-full text-blue-400" />
          </div>
        </SecurityCard>

      </div>
    </section>
  );
}

function SecurityCard({ title, desc, icon: Icon, className = "", children }: any) {
  return (
    <div className={`relative bg-[#0C0F16] border border-white/10 rounded-3xl p-8 overflow-hidden group hover:border-white/30 transition-colors ${className}`}>
      {/* Background glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 to-transparent group-hover:from-orange-500/5 transition-colors duration-500 pointer-events-none" />
      
      <div className="relative z-10 max-w-sm pointer-events-none h-full flex flex-col">
        <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:border-orange-500/30 group-hover:bg-orange-500/10 transition-all duration-300 origin-left">
          <Icon className="w-5 h-5 text-gray-400 group-hover:text-orange-400 transition-colors" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
          <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
        </div>
      </div>

      {children}
    </div>
  );
}
