"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AnimatedCounter } from "./AnimatedCounter";

export function UsageCalculator() {
  const [docs, setDocs] = useState(5000);
  const [users, setUsers] = useState(10);
  const [queries, setQueries] = useState(1000);
  const [apiCalls, setApiCalls] = useState(5000);
  const [storage, setStorage] = useState(10); // GB

  // Fake frontend calculation based on inputs
  const estimatedVectors = docs * 125;
  const priceBase = 19; // Pro
  const priceDocs = (docs / 1000) * 5;
  const priceUsers = users * 10;
  const priceQueries = (queries / 1000) * 2;
  const priceApi = (apiCalls / 1000) * 0.5;
  const priceStorage = storage * 0.5;
  
  const totalPrice = Math.floor(priceBase + priceDocs + priceUsers + priceQueries + priceApi + priceStorage);

  let suggestedPlan = "Starter";
  if (totalPrice > 19) suggestedPlan = "Pro";
  if (totalPrice > 200) suggestedPlan = "Business";
  if (totalPrice > 1000) suggestedPlan = "Enterprise";

  // Dynamic confidence score drops slightly if ratio of docs to queries is weird, just for fun
  const confidenceScore = Math.max(85, 99 - (queries / (docs + 1)) * 0.1);
  const processingTime = Math.max(150, 400 - (totalPrice * 0.1));

  return (
    <div className="w-full mx-auto mt-32 relative z-10">
      <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/10 to-purple-500/10 rounded-3xl blur-[100px] -z-10 pointer-events-none" />
      
      <div className="bg-[#0C0F16]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 md:p-14 shadow-2xl relative overflow-hidden">
        
        <div className="text-center mb-16">
          <h3 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">Estimate your usage</h3>
          <p className="text-gray-400 text-lg">Drag the sliders to see how Clarity scales perfectly with your demands.</p>
        </div>

        <div className="grid lg:grid-cols-5 gap-16">
          {/* Left: Sliders */}
          <div className="lg:col-span-3 space-y-10">
            <SliderRow 
              label="Documents Indexed" 
              value={docs} 
              setValue={setDocs} 
              min={100} 
              max={100000} 
              step={100}
              format={(v: number) => `${(v/1000).toFixed(1)}k`}
            />
            <SliderRow 
              label="Storage Required (GB)" 
              value={storage} 
              setValue={setStorage} 
              min={1} 
              max={1000} 
              step={1}
            />
            <SliderRow 
              label="Active Team Members" 
              value={users} 
              setValue={setUsers} 
              min={1} 
              max={500} 
              step={1}
            />
            <SliderRow 
              label="Questions per Day" 
              value={queries} 
              setValue={setQueries} 
              min={100} 
              max={50000} 
              step={100}
              format={(v: number) => `${(v/1000).toFixed(1)}k`}
            />
            <SliderRow 
              label="API Calls / Month" 
              value={apiCalls} 
              setValue={setApiCalls} 
              min={1000} 
              max={1000000} 
              step={1000}
              format={(v: number) => `${(v/1000).toFixed(1)}k`}
            />
          </div>

          {/* Right: Results Panel */}
          <div className="lg:col-span-2">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-10 h-full flex flex-col relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 to-purple-500/0 group-hover:from-orange-500/10 group-hover:to-purple-500/10 transition-colors duration-700" />
              
              <div className="relative z-10">
                <div className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-2">Estimated Monthly Cost</div>
                <div className="flex items-end gap-1 mb-10">
                  <span className="text-4xl text-white font-bold mb-2">$</span>
                  <span className="text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600 tracking-tight">
                    <AnimatedCounter value={totalPrice} duration={300} />
                  </span>
                </div>

                <div className="space-y-6 pt-8 border-t border-white/10">
                  <ResultRow label="Suggested Plan" value={suggestedPlan} isText />
                  <ResultRow label="Estimated Vectors" value={estimatedVectors} format={(v: number) => `${(v/1000000).toFixed(2)}M`} />
                  <ResultRow label="Avg. Latency" value={processingTime} format={(v: number) => `${v.toFixed(0)}ms`} />
                  <ResultRow label="Avg. Trust Score" value={confidenceScore} format={(v: number) => `${v.toFixed(1)}%`} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultRow({ label, value, isText, format }: any) {
  return (
    <div className="flex justify-between items-center text-sm md:text-base">
      <span className="text-gray-400">{label}</span>
      <span className={`font-semibold ${isText ? "text-white" : "text-orange-400 font-mono"}`}>
        {isText ? value : <AnimatedCounter value={value} duration={300} decimals={format ? undefined : 0} />}
        {!isText && format && <span className="ml-1">{format(value).replace(/[\d.]/g, '')}</span>}
        {/* Hack for format suffix handling: AnimatedCounter only does raw numbers currently, 
            so if format outputs "1.2M", we just render the raw AnimatedCounter and append "M" */}
      </span>
    </div>
  );
}

function SliderRow({ label, value, setValue, min, max, step, format }: any) {
  const percentage = ((value - min) / (max - min)) * 100;
  
  return (
    <div className="group">
      <div className="flex justify-between items-center mb-4">
        <label className="text-white font-semibold text-sm md:text-base">{label}</label>
        <span className="text-orange-400 font-mono text-sm bg-orange-500/10 px-3 py-1 rounded-md border border-orange-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]">
          {format ? format(value) : value}
        </span>
      </div>
      <div className="relative h-3 bg-white/5 border border-white/10 rounded-full cursor-pointer">
        <motion.div 
          className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-orange-600 to-orange-400 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.4)]"
          animate={{ width: `${percentage}%` }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
        />
        <input 
          type="range" 
          min={min} 
          max={max} 
          step={step} 
          value={value} 
          onChange={(e) => setValue(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <motion.div 
          className="absolute top-1/2 w-6 h-6 bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.8)] border-4 border-orange-500 z-0 group-hover:scale-110 transition-transform"
          animate={{ left: `calc(${percentage}% - 12px)`, y: "-50%" }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
        />
      </div>
    </div>
  );
}
