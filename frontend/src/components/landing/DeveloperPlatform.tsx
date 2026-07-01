"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Copy, Check, Server, Webhook, Box, Lock, Code2 } from "lucide-react";

const codeSnippet = `import { Clarity } from '@clarity/node';

const clarity = new Clarity(process.env.CLARITY_API_KEY);

// Initiate a verified streaming query
const response = await clarity.query({
  query: "What is the termination notice period?",
  collectionId: "col_9a8b7c6d",
  options: {
    verifyClaims: true,
    stream: true,
    minimumTrustScore: 0.95
  }
});

for await (const chunk of response) {
  process.stdout.write(chunk.text);
}`;

const responseTokens = [
  "{", 
  '\n  "id": "ans_12345",',
  '\n  "object": "verified_answer.chunk",',
  '\n  "text": "Either party may terminate with 30 days written notice.",',
  '\n  "citations": [',
  '\n    {',
  '\n      "documentId": "doc_abc",',
  '\n      "text": "terminate this agreement with 30 days written notice.",',
  '\n      "bbox": [120, 450, 600, 480]',
  '\n    }',
  '\n  ],',
  '\n  "metadata": {',
  '\n    "trustScore": 0.98,',
  '\n    "latencyMs": 245',
  '\n  }',
  "\n}"
];

export function DeveloperPlatform() {
  const [copied, setCopied] = useState(false);
  const [displayedTokens, setDisplayedTokens] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(true);
  const [activeEndpoint, setActiveEndpoint] = useState("query");

  useEffect(() => {
    if (!isStreaming) return;

    let currentIndex = 0;
    setDisplayedTokens([]);

    const interval = setInterval(() => {
      if (currentIndex < responseTokens.length) {
        setDisplayedTokens(prev => [...prev, responseTokens[currentIndex]]);
        currentIndex++;
      } else {
        setIsStreaming(false);
        clearInterval(interval);
        
        setTimeout(() => {
          setIsStreaming(true);
        }, 3000);
      }
    }, 150);

    return () => clearInterval(interval);
  }, [isStreaming]);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="py-32 relative z-10 max-w-[1400px] mx-auto px-6 overflow-hidden">
      
      <div className="grid lg:grid-cols-2 gap-16 items-start">
        
        {/* Left: API Explorer (Stripe style docs) */}
        <div className="pt-10">
          <div className="inline-block px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold uppercase tracking-wider mb-6">
            Developer Platform
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            The API for <br />
            enterprise AI.
          </h2>
          <p className="text-gray-400 text-lg mb-12 leading-relaxed">
            Integrate verifiable document intelligence directly into your own products. Our SDKs for Node, Python, and Go handle the complexity of the 16-node reasoning pipeline so you don&apos;t have to.
          </p>

          <div className="grid grid-cols-2 gap-6 mb-12">
            {[
              { icon: Code2, title: "Typed SDKs", desc: "Native libraries for major languages." },
              { icon: Webhook, title: "Webhooks", desc: "Real-time pipeline events." },
              { icon: Lock, title: "Auth", desc: "Bearer token & OAuth2." },
              { icon: Box, title: "Self-Hosted", desc: "Run your own inference nodes." },
            ].map((feature, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <feature.icon className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">{feature.title}</h4>
                  <p className="text-xs text-gray-500">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Core Endpoints</h4>
            {[
              { method: "POST", path: "/v1/queries", id: "query", label: "Create a verified query" },
              { method: "POST", path: "/v1/documents", id: "doc", label: "Upload a document" },
              { method: "GET", path: "/v1/collections/:id", id: "col", label: "Retrieve collection stats" },
            ].map((endpoint) => (
              <div 
                key={endpoint.id} 
                onClick={() => setActiveEndpoint(endpoint.id)}
                className={`flex items-center justify-between p-3 rounded-lg font-mono text-sm cursor-pointer transition-colors ${activeEndpoint === endpoint.id ? "bg-white/10 border border-white/20" : "bg-transparent border border-transparent hover:bg-white/5"}`}
              >
                <div className="flex items-center gap-4">
                  <span className={`font-bold w-10 ${endpoint.method === "POST" ? "text-green-400" : "text-blue-400"}`}>{endpoint.method}</span>
                  <span className={activeEndpoint === endpoint.id ? "text-white" : "text-gray-400"}>{endpoint.path}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Code Editor (VS Code style) */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative lg:mt-0"
        >
          {/* Backing glow */}
          <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/20 to-purple-500/20 rounded-3xl blur-3xl -z-10" />
          
          <div className="bg-[#1C1C1C] rounded-2xl border border-[#333] shadow-2xl overflow-hidden font-mono text-sm relative z-10 group">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222]">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
                <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
                <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
              </div>
              <div className="flex items-center gap-2 text-[#888]">
                <Terminal className="w-4 h-4" />
                <span className="text-xs">query.ts</span>
              </div>
              <button onClick={handleCopy} className="text-[#888] hover:text-white transition-colors p-1.5 rounded hover:bg-white/10">
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Code Body */}
            <div className="p-6 text-[#E6E1DC] overflow-x-auto text-[13px] leading-loose">
              <pre>
                <span className="text-[#CC7832]">import</span> {'{ Clarity }'} <span className="text-[#CC7832]">from</span> <span className="text-[#A5C261]">&apos;@clarity/node&apos;</span>;
                <br /><br />
                <span className="text-[#CC7832]">const</span> clarity = <span className="text-[#CC7832]">new</span> <span className="text-[#FFC66D]">Clarity</span>(process.env.CLARITY_API_KEY);
                <br /><br />
                <span className="text-[#808080]">{"// Initiate a verified streaming query"}</span>
                <br />
                <span className="text-[#CC7832]">const</span> response = <span className="text-[#CC7832]">await</span> clarity.<span className="text-[#FFC66D]">query</span>({`{`}
                <br />
                {'  '}query: <span className="text-[#A5C261]">&quot;What is the termination notice period?&quot;</span>,
                <br />
                {'  '}collectionId: <span className="text-[#A5C261]">&quot;col_9a8b7c6d&quot;</span>,
                <br />
                {'  '}options: {`{`}
                <br />
                {'    '}verifyClaims: <span className="text-[#CC7832]">true</span>,
                <br />
                {'    '}stream: <span className="text-[#CC7832]">true</span>,
                <br />
                {'    '}minimumTrustScore: <span className="text-[#6897BB]">0.95</span>
                <br />
                {'  '}{`}`}
                <br />
                {`}`});
                <br /><br />
                <span className="text-[#CC7832]">for await</span> (<span className="text-[#CC7832]">const</span> chunk <span className="text-[#CC7832]">of</span> response) {`{`}
                <br />
                {'  '}process.stdout.<span className="text-[#FFC66D]">write</span>(chunk.text);
                <br />
                {`}`}
              </pre>
            </div>

            {/* Response Preview */}
            <div className="bg-[#0D0D0D] p-6 border-t border-[#333] relative">
              <div className="absolute top-0 right-6 -translate-y-1/2 px-3 py-1 bg-[#111] border border-[#333] rounded text-[10px] text-green-400 font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Live Stream
              </div>
              <div className="flex items-center gap-2 mb-4 text-[#888] text-xs uppercase tracking-widest font-sans font-semibold">
                <Server className="w-3 h-3" />
                Output
              </div>
              <pre className="text-[#A5C261] text-[13px] leading-relaxed whitespace-pre-wrap">
                {displayedTokens.join('')}
                {isStreaming && <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.8, repeat: Infinity }} className="inline-block w-2 h-4 bg-orange-400 ml-1 align-middle" />}
              </pre>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
