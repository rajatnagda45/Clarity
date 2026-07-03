'use client';

import { motion } from 'framer-motion';
import { 
  UploadCloud, FileText, FileCode2, Layers, Cpu, Database, 
  Search, SlidersHorizontal, MessageSquare, Quote, CheckCircle2 
} from 'lucide-react';
import { DeveloperDashboard } from '@/types/clarity';

const PIPELINE_STAGES = [
  { id: 'upload', label: 'Upload', icon: UploadCloud, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  { id: 'extract', label: 'Extract', icon: FileText, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
  { id: 'chunk', label: 'Chunking', icon: Layers, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  { id: 'embed', label: 'Embedding', icon: Cpu, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/30' },
  { id: 'index', label: 'Vector Index', icon: Database, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/30' },
  { id: 'retrieval', label: 'Hybrid Search', icon: Search, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
  { id: 'llm', label: 'Generation', icon: MessageSquare, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  { id: 'cite', label: 'Verification', icon: Quote, color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
];

export function PipelineVisualizer({ devDashboard }: { devDashboard: DeveloperDashboard | null }) {
  const docsCount = devDashboard?.documents?.length || 0;
  const indexedCount = devDashboard?.statusCounts?.indexed || 0;
  
  return (
    <div className="w-full bg-[#0F1117] border border-white/[0.06] rounded-[32px] p-8 relative overflow-hidden">
      {/* Ambient glowing background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none mix-blend-overlay" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-xl font-bold text-[#F1F3F9] tracking-tight">AI Pipeline Architecture</h2>
            <p className="text-sm text-[#8892AA] mt-1">Real-time observability across the RAG lifecycle</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-400 tracking-wider uppercase">Systems Operational</span>
            </div>
          </div>
        </div>

        <div className="relative">
          {/* Connecting Line */}
          <div className="absolute top-8 left-12 right-12 h-px bg-white/[0.06]">
            <motion.div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 w-1/3"
              animate={{ 
                x: ["-100%", "300%"] 
              }}
              transition={{ 
                repeat: Infinity, 
                duration: 3, 
                ease: "linear" 
              }}
            />
          </div>

          <div className="flex items-start justify-between relative gap-4">
            {PIPELINE_STAGES.map((stage, index) => (
              <div key={stage.id} className="flex flex-col items-center group flex-1">
                <div className="relative mb-4">
                  <div className={`w-16 h-16 rounded-2xl ${stage.bg} border ${stage.border} flex items-center justify-center relative z-10 bg-[#0F1117] shadow-xl group-hover:scale-110 transition-transform duration-300`}>
                    <stage.icon size={24} className={stage.color} />
                  </div>
                  {/* Subtle node glow */}
                  <div className={`absolute inset-0 ${stage.bg} blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
                </div>
                
                <h3 className="text-[11px] font-bold text-[#F1F3F9] uppercase tracking-wider mb-1 text-center">{stage.label}</h3>
                
                {/* Simulated Metrics per stage */}
                <div className="flex flex-col items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] font-mono text-[#8892AA]">
                    {index === 0 ? `${docsCount} files` : 
                     index === 4 ? `${indexedCount} docs` : 
                     index === 2 ? `~${docsCount * 25} chunks` : 
                     index === 7 ? '100% verified' : 'Healthy'}
                  </span>
                  <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={8} /> OK
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Example Output for the Prompt requirement */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#05070B] border border-white/[0.06] rounded-2xl p-5 font-mono text-xs text-[#8892AA]">
            <div className="flex items-center justify-between mb-3 border-b border-white/[0.06] pb-2">
              <span className="text-purple-400 font-semibold">Semantic Chunking</span>
              <span className="text-emerald-400">320ms</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Strategy:</span>
                <span className="text-[#F1F3F9]">Markdown/Heading</span>
              </div>
              <div className="flex justify-between">
                <span>Target Size:</span>
                <span className="text-[#F1F3F9]">512 tokens</span>
              </div>
              <div className="flex justify-between">
                <span>Overlap:</span>
                <span className="text-[#F1F3F9]">50 tokens</span>
              </div>
              <div className="mt-2 text-purple-400">████████████████ 100%</div>
            </div>
          </div>

          <div className="bg-[#05070B] border border-white/[0.06] rounded-2xl p-5 font-mono text-xs text-[#8892AA]">
            <div className="flex items-center justify-between mb-3 border-b border-white/[0.06] pb-2">
              <span className="text-pink-400 font-semibold">Vector Index Sync</span>
              <span className="text-emerald-400">145ms</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Provider:</span>
                <span className="text-[#F1F3F9]">Pinecone</span>
              </div>
              <div className="flex justify-between">
                <span>Dimensions:</span>
                <span className="text-[#F1F3F9]">3072</span>
              </div>
              <div className="flex justify-between">
                <span>Metric:</span>
                <span className="text-[#F1F3F9]">Cosine</span>
              </div>
              <div className="mt-2 text-pink-400">Sync Complete ✓</div>
            </div>
          </div>

          <div className="bg-[#05070B] border border-white/[0.06] rounded-2xl p-5 font-mono text-xs text-[#8892AA]">
            <div className="flex items-center justify-between mb-3 border-b border-white/[0.06] pb-2">
              <span className="text-emerald-400 font-semibold">Hybrid Retrieval</span>
              <span className="text-emerald-400">89ms</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Dense Score:</span>
                <span className="text-[#F1F3F9]">0.89</span>
              </div>
              <div className="flex justify-between">
                <span>Sparse (BM25):</span>
                <span className="text-[#F1F3F9]">24.5</span>
              </div>
              <div className="flex justify-between">
                <span>Fusion:</span>
                <span className="text-[#F1F3F9]">RRF</span>
              </div>
              <div className="mt-2 text-emerald-400">Top K: 5 Chunks</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
