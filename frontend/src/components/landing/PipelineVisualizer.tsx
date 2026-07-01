"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";

// Grid is 10 columns x 4 rows
const nodes = [
  { id: "n1", label: "PDF Upload", col: 1, row: 2.5, desc: "Ingests PDF/DOCX" },
  { id: "n2", label: "OCR", col: 2, row: 1.5, desc: "Optical Character Recognition" },
  { id: "n3", label: "Parser", col: 2, row: 3.5, desc: "Document structure parsing" },
  { id: "n4", label: "Clause Detect", col: 3, row: 2, desc: "Identifies legal clauses" },
  { id: "n5", label: "Metadata", col: 3, row: 4, desc: "Extracts dates, parties" },
  { id: "n6", label: "Chunking", col: 4, row: 2.5, desc: "Semantic splitting" },
  { id: "n7", label: "Embeddings", col: 5, row: 1.5, desc: "Cohere-V3 vectorization" },
  { id: "n8", label: "BM25", col: 5, row: 3.5, desc: "Lexical search index" },
  { id: "n9", label: "Vector Search", col: 6, row: 1.5, desc: "Pinecone ANN search" },
  { id: "n10", label: "Hybrid Retrieve", col: 7, row: 2.5, desc: "Reciprocal Rank Fusion" },
  { id: "n11", label: "Reranker", col: 8, row: 2.5, desc: "Cross-encoder reranking" },
  { id: "n12", label: "Verifier", col: 9, row: 1.5, desc: "NLI entailment check" },
  { id: "n13", label: "Evidence", col: 9, row: 3.5, desc: "Bounding box mapping" },
  { id: "n14", label: "Citation", col: 10, row: 2, desc: "Inline text citations" },
  { id: "n15", label: "Trust Score", col: 10, row: 4, desc: "Confidence calibration" },
  { id: "n16", label: "Final Answer", col: 11, row: 3, desc: "Verified output" },
];

const paths = [
  { from: "n1", to: "n2" }, { from: "n1", to: "n3" },
  { from: "n2", to: "n4" }, { from: "n3", to: "n4" }, { from: "n3", to: "n5" },
  { from: "n4", to: "n6" }, { from: "n5", to: "n6" },
  { from: "n6", to: "n7" }, { from: "n6", to: "n8" },
  { from: "n7", to: "n9" },
  { from: "n9", to: "n10" }, { from: "n8", to: "n10" },
  { from: "n10", to: "n11" },
  { from: "n11", to: "n12" }, { from: "n11", to: "n13" },
  { from: "n12", to: "n14" }, { from: "n13", to: "n14" },
  { from: "n12", to: "n15" }, { from: "n13", to: "n15" },
  { from: "n14", to: "n16" }, { from: "n15", to: "n16" }
];

export function PipelineVisualizer() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [activeNodes, setActiveNodes] = useState<string[]>([]);

  // Simulation loop: sequentially activate nodes
  useEffect(() => {
    let currentStep = 0;
    const stages = [
      ["n1"], 
      ["n2", "n3"], 
      ["n4", "n5"], 
      ["n6"], 
      ["n7", "n8"], 
      ["n9"], 
      ["n10"], 
      ["n11"], 
      ["n12", "n13"], 
      ["n14", "n15"], 
      ["n16"]
    ];
    
    const interval = setInterval(() => {
      setActiveNodes(stages[currentStep]);
      currentStep = (currentStep + 1) % stages.length;
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  const getPos = (col: number, row: number) => {
    return {
      x: `${(col - 1) * (100 / 10)}%`,
      y: `${(row - 1) * (100 / 3)}%`
    };
  };

  return (
    <section className="py-32 relative bg-[#05070B] overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-900/5 to-transparent pointer-events-none" />
      
      <div className="text-center mb-16 relative z-10">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Interactive AI Pipeline</h2>
        <p className="text-gray-400 text-lg">Watch data flow through our proprietary 16-node reasoning architecture.</p>
      </div>

      <div className="w-full relative z-10 px-4 md:px-12">
        <div className="relative w-full aspect-[2/1] min-h-[600px] max-h-[800px] border border-white/10 rounded-3xl bg-[#0C0F16]/50 backdrop-blur-3xl p-4 md:p-12 shadow-2xl overflow-x-auto">
          {/* Animated Grid Background */}
          <motion.div 
            animate={{ backgroundPositionX: ["0px", "-48px"], backgroundPositionY: ["0px", "48px"] }}
            transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
            className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px] rounded-2xl" 
          />
          
          <div className="relative w-full h-full">
            {/* Draw abstract SVG connections */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" preserveAspectRatio="none">
              <defs>
                <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(245, 158, 11, 0.3)" />
                  <stop offset="50%" stopColor="rgba(168, 85, 247, 0.5)" />
                  <stop offset="100%" stopColor="rgba(34, 197, 94, 0.5)" />
                </linearGradient>
              </defs>
              
              {paths.map((path, i) => {
                const fromNode = nodes.find(n => n.id === path.from)!;
                const toNode = nodes.find(n => n.id === path.to)!;
                
                const x1 = (fromNode.col - 1) * (100 / 10);
                const y1 = (fromNode.row - 1) * (100 / 3);
                const x2 = (toNode.col - 1) * (100 / 10);
                const y2 = (toNode.row - 1) * (100 / 3);
                
                // Draw bezier curve
                const cx1 = x1 + (x2 - x1) / 2;
                const cy1 = y1;
                const cx2 = x1 + (x2 - x1) / 2;
                const cy2 = y2;
                
                const d = `M ${x1}% ${y1}% C ${cx1}% ${cy1}%, ${cx2}% ${cy2}%, ${x2}% ${y2}%`;
                
                const isActive = activeNodes.includes(path.to) || activeNodes.includes(path.from);

                return (
                  <g key={i}>
                    <path 
                      d={d} 
                      fill="none" 
                      stroke="rgba(255,255,255,0.05)" 
                      strokeWidth="2"
                    />
                    <motion.path 
                      d={d} 
                      fill="none" 
                      stroke={isActive ? "url(#lineGrad)" : "transparent"} 
                      strokeWidth="2"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ 
                        pathLength: isActive ? 1 : 0, 
                        opacity: isActive ? 1 : 0 
                      }}
                      transition={{ duration: 1 }}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Nodes */}
            {nodes.map((node, i) => {
              const pos = getPos(node.col, node.row);
              const isHovered = hoveredNode === node.id;
              const isActive = activeNodes.includes(node.id);
              
              return (
                <div key={node.id} className="absolute -translate-x-1/2 -translate-y-1/2 z-10" style={{ left: pos.x, top: pos.y }}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.05, type: "spring" }}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="relative cursor-pointer"
                  >
                    <motion.div 
                      animate={{
                        borderColor: isActive ? "rgba(245, 158, 11, 0.8)" : "rgba(255, 255, 255, 0.1)",
                        backgroundColor: isActive ? "rgba(245, 158, 11, 0.15)" : "#000",
                        boxShadow: isActive ? "0 0 20px rgba(245, 158, 11, 0.4)" : "none",
                        scale: isActive ? 1.1 : 1
                      }}
                      className="px-3 py-1.5 rounded-lg border flex items-center gap-2 transition-colors duration-300 backdrop-blur-md"
                    >
                      {/* Processing Pulse Indicator */}
                      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-orange-500 animate-ping' : 'bg-gray-600'}`} />
                      <span className={`text-[11px] font-medium whitespace-nowrap transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-400'}`}>
                        {node.label}
                      </span>
                    </motion.div>

                    {/* Tooltip */}
                    {isHovered && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 bg-white text-black text-[10px] rounded shadow-xl whitespace-nowrap z-50 font-medium"
                      >
                        {node.desc}
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-white" />
                      </motion.div>
                    )}
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
