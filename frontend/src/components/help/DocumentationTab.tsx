'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, MessageSquare, Grid3X3, BarChart2, Terminal, 
  CreditCard, Settings, Building2, Shield, Search, ChevronRight,
  Code, Copy, Check
} from 'lucide-react';

const DOC_CATEGORIES = [
  { id: 'chat', label: 'AI Chat', icon: MessageSquare, count: 12 },
  { id: 'documents', label: 'Documents', icon: FileText, count: 8 },
  { id: 'collections', label: 'Collections', icon: Grid3X3, count: 5 },
  { id: 'analytics', label: 'Analytics', icon: BarChart2, count: 3 },
  { id: 'developer', label: 'Developer Console', icon: Terminal, count: 15 },
  { id: 'billing', label: 'Billing', icon: CreditCard, count: 4 },
  { id: 'settings', label: 'Settings', icon: Settings, count: 6 },
  { id: 'workspace', label: 'Workspace', icon: Building2, count: 7 },
  { id: 'security', label: 'Security', icon: Shield, count: 9 },
];

export function DocumentationTab() {
  const [activeCategory, setActiveCategory] = useState('developer');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#F1F3F9] tracking-tight">Documentation</h1>
          <p className="text-[#8892AA] mt-2 text-lg">Detailed guides and API references for Clarity.</p>
        </div>
        <div className="relative w-64 hidden md:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5168]" />
          <input 
            type="text" 
            placeholder="Search docs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0F1117] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors"
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Categories Sidebar */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-1">
          {DOC_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all ${
                activeCategory === cat.id 
                  ? 'bg-purple-500/10 text-purple-400 font-medium' 
                  : 'text-[#8892AA] hover:bg-white/[0.04] hover:text-[#F1F3F9]'
              }`}
            >
              <div className="flex items-center gap-3">
                <cat.icon size={16} className={activeCategory === cat.id ? 'text-purple-400' : 'text-[#4A5168]'} />
                {cat.label}
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${activeCategory === cat.id ? 'bg-purple-500/20 text-purple-300' : 'bg-white/[0.06] text-[#4A5168]'}`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Main Article Content (Mock for now, ready for CMS) */}
        <div className="flex-1 min-w-0 bg-[#0F1117] border border-white/[0.06] rounded-[24px] p-8 md:p-10 shadow-lg relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="prose prose-invert prose-purple max-w-none"
            >
              <div className="flex items-center gap-2 text-sm text-purple-400 font-medium mb-4">
                <span>Documentation</span>
                <ChevronRight size={14} />
                <span className="capitalize">{activeCategory.replace('-', ' ')}</span>
              </div>
              
              <h1 className="text-3xl md:text-4xl font-bold text-[#F1F3F9] mb-4">
                {activeCategory === 'developer' ? 'Authentication API' : 'Overview Guide'}
              </h1>
              
              <p className="text-lg text-[#8892AA] mb-8 leading-relaxed">
                Learn how to authenticate your requests to the Clarity API using Bearer tokens. All API requests must be made over HTTPS. Calls made over plain HTTP will fail.
              </p>

              <h2 className="text-xl font-bold text-[#F1F3F9] mt-10 mb-4 border-b border-white/[0.06] pb-2">Obtaining an API Key</h2>
              <p className="text-[#8892AA] mb-6 leading-relaxed">
                You can generate API keys from the Developer Console in your Workspace settings. Keep your keys secure and do not expose them in client-side code.
              </p>

              <div className="bg-[#05070B] border border-white/[0.08] rounded-xl overflow-hidden mb-8">
                <div className="flex items-center justify-between px-4 py-2 bg-white/[0.02] border-b border-white/[0.08]">
                  <div className="flex items-center gap-2 text-xs font-mono text-[#8892AA]">
                    <Code size={14} /> request.sh
                  </div>
                  <button onClick={handleCopy} className="text-[#8892AA] hover:text-[#F1F3F9] transition-colors p-1">
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
                <div className="p-4 overflow-x-auto text-sm font-mono text-purple-300">
                  <pre>
                    <code>
{`curl -X GET "https://api.clarity.com/v1/documents" \\
  -H "Authorization: Bearer cl_live_xxxxxxxxxxxxx"`}
                    </code>
                  </pre>
                </div>
              </div>

              <h2 className="text-xl font-bold text-[#F1F3F9] mt-10 mb-4 border-b border-white/[0.06] pb-2">Error Responses</h2>
              <table className="w-full text-left text-sm mb-8">
                <thead>
                  <tr className="border-b border-white/[0.1] text-[#F1F3F9]">
                    <th className="pb-3 font-semibold">Status Code</th>
                    <th className="pb-3 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody className="text-[#8892AA]">
                  <tr className="border-b border-white/[0.04]">
                    <td className="py-3 font-mono text-amber-400">401 Unauthorized</td>
                    <td className="py-3">Invalid or missing API key.</td>
                  </tr>
                  <tr className="border-b border-white/[0.04]">
                    <td className="py-3 font-mono text-purple-400">403 Forbidden</td>
                    <td className="py-3">The API key doesn&apos;t have permission for this resource.</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-mono text-rose-400">429 Too Many Requests</td>
                    <td className="py-3">Rate limit exceeded.</td>
                  </tr>
                </tbody>
              </table>

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right TOC Sidebar */}
        <div className="w-48 shrink-0 hidden xl:flex flex-col gap-3 sticky top-24">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#F1F3F9] mb-2">On this page</h4>
          <a href="#" className="text-sm text-purple-400 hover:text-purple-300 transition-colors">Overview</a>
          <a href="#" className="text-sm text-[#8892AA] hover:text-[#F1F3F9] transition-colors">Obtaining an API Key</a>
          <a href="#" className="text-sm text-[#8892AA] hover:text-[#F1F3F9] transition-colors">Authentication Headers</a>
          <a href="#" className="text-sm text-[#8892AA] hover:text-[#F1F3F9] transition-colors">Error Responses</a>
          <a href="#" className="text-sm text-[#8892AA] hover:text-[#F1F3F9] transition-colors">Rate Limiting</a>
        </div>

      </div>
    </div>
  );
}
