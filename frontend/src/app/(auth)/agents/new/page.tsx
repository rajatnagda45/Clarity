'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Bot, ArrowLeft, ChevronRight, Check, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { PremiumBackground } from '@/components/landing/PremiumBackground';
import { useCreateAgent, useAvailableTools } from '@/hooks/useAgents';
import { useToast } from '@/contexts/ToastContext';
import { useCollections } from '@/hooks/useCollections';
import type { AgentCategory, AgentBehavior } from '@/types/clarity';

const AGENT_TEMPLATES = [
  { category: 'legal' as AgentCategory, avatar: '⚖️', color: '#7C3AED', name: 'Legal Review Agent', description: 'Reviews contracts and legal documents for risks, ambiguities, and compliance issues.', systemPrompt: 'You are an expert legal reviewer. Analyze documents for legal risks, ambiguous clauses, and compliance issues. Always cite specific sections and provide actionable recommendations.' },
  { category: 'research' as AgentCategory, avatar: '🔬', color: '#2563EB', name: 'Research Agent', description: 'Synthesizes information from multiple documents to answer complex research questions.', systemPrompt: 'You are a thorough research analyst. Search the knowledge base comprehensively, synthesize findings from multiple sources, and provide well-cited, balanced analyses.' },
  { category: 'compliance' as AgentCategory, avatar: '🛡️', color: '#059669', name: 'Compliance Agent', description: 'Checks documents and processes against regulatory requirements and internal policies.', systemPrompt: 'You are a compliance expert. Evaluate documents against regulatory standards and internal policies. Flag violations, near-misses, and areas requiring attention.' },
  { category: 'knowledge' as AgentCategory, avatar: '📚', color: '#7C3AED', name: 'Knowledge Assistant', description: 'Answers questions from your workspace knowledge base with citations.', systemPrompt: 'You are a helpful knowledge assistant. Answer questions using the workspace knowledge base. Always cite your sources and acknowledge when information is unavailable.' },
  { category: 'sales' as AgentCategory, avatar: '💼', color: '#D97706', name: 'Sales Agent', description: 'Helps analyze proposals, contracts, and customer communications for sales teams.', systemPrompt: 'You are a sales intelligence agent. Analyze proposals, contracts, and communications to identify opportunities, risks, and key terms for the sales team.' },
  { category: 'hr' as AgentCategory, avatar: '👥', color: '#DB2777', name: 'HR Agent', description: 'Handles HR document analysis, policy lookups, and employee query routing.', systemPrompt: 'You are an HR assistant. Help analyze HR documents, answer policy questions, and provide guidance based on company policies and best practices.' },
  { category: 'custom' as AgentCategory, avatar: '🤖', color: '#6366F1', name: 'Custom Agent', description: 'Start from scratch with a fully custom agent configuration.', systemPrompt: '' },
];

const MODELS = [
  { id: 'gpt-4o-mini', label: 'gpt-4o-mini', desc: 'Fast and cost-effective. Default.' },
  { id: 'gpt-4o', label: 'gpt-4o', desc: 'Higher quality. Best for complex tasks.' },
];
const BEHAVIORS: { value: AgentBehavior; label: string; desc: string }[] = [
  { value: 'precise', label: 'Precise', desc: 'Low creativity, high accuracy. Best for legal and compliance.' },
  { value: 'balanced', label: 'Balanced', desc: 'Default mix of accuracy and creativity.' },
  { value: 'creative', label: 'Creative', desc: 'Higher creativity for research and brainstorming.' },
  { value: 'aggressive', label: 'Aggressive', desc: 'Maximum extraction and analysis depth.' },
];

type Step = 'template' | 'configure' | 'tools' | 'review';

export default function NewAgentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const create = useCreateAgent();
  const { data: toolsData } = useAvailableTools();
  const { data: collectionsData } = useCollections();

  const [step, setStep] = useState<Step>('template');
  const [selectedTemplate, setSelectedTemplate] = useState(AGENT_TEMPLATES[0]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('🤖');
  const [color, setColor] = useState('#7C3AED');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [behavior, setBehavior] = useState<AgentBehavior>('balanced');
  const [temperature, setTemperature] = useState(0.7);
  const [model, setModel] = useState('gpt-4o-mini');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [citationRequired, setCitationRequired] = useState(true);
  const [verificationMode, setVerificationMode] = useState(false);
  const [autoRetry, setAutoRetry] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.7);

  const tools = toolsData?.tools ?? [];
  const collections = collectionsData?.collections ?? [];

  const applyTemplate = (template: typeof AGENT_TEMPLATES[0]) => {
    setSelectedTemplate(template);
    setName(template.name);
    setDescription(template.description);
    setAvatar(template.avatar);
    setColor(template.color);
    setSystemPrompt(template.systemPrompt);
  };

  const toggleTool = (t: string) => setSelectedTools(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  const toggleCollection = (id: string) => setSelectedCollections(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleCreate = () => {
    if (!name.trim()) { toast.error('Agent name is required.'); return; }
    if (!systemPrompt.trim()) { toast.error('System prompt is required.'); return; }
    create.mutate({
      name: name.trim(),
      description: description.trim(),
      avatar,
      color,
      category: selectedTemplate.category,
      systemPrompt: systemPrompt.trim(),
      behavior,
      temperature,
      model,
      allowedTools: selectedTools,
      allowedCollections: selectedCollections,
      memoryEnabled,
      citationRequired,
      verificationMode,
      autoRetry,
      confidenceThreshold,
    }, {
      onSuccess: (agent) => {
        toast.success(`${agent.name} created.`);
        router.push(`/agents/${agent.id}`);
      },
      onError: (err) => {
        const message = err instanceof Error ? err.message : 'Failed to create agent.';
        toast.error(message);
      },
    });
  };

  const STEPS: { id: Step; label: string }[] = [
    { id: 'template', label: 'Template' },
    { id: 'configure', label: 'Configure' },
    { id: 'tools', label: 'Tools & Collections' },
    { id: 'review', label: 'Review' },
  ];

  const currentStepIndex = STEPS.findIndex(s => s.id === step);

  return (
    <div className="relative min-h-screen bg-[#05070B] selection:bg-purple-500/30 pb-32">
      <PremiumBackground glowOpacity={0.08} />
      <div className="relative z-10 mx-auto max-w-4xl px-6 pt-12">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/agents" className="p-2 rounded-xl text-[#4A5168] hover:text-[#F1F3F9] hover:bg-white/[0.06] transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Create Agent</h1>
            <p className="text-sm text-[#4A5168]">Build a specialized AI agent for your workspace</p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <button
                onClick={() => i < currentStepIndex && setStep(s.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  step === s.id
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : i < currentStepIndex
                    ? 'bg-emerald-500/10 text-emerald-400 cursor-pointer hover:bg-emerald-500/20'
                    : 'bg-white/[0.03] text-[#4A5168] border border-white/[0.06] cursor-default'
                }`}
              >
                {i < currentStepIndex ? <Check size={11} /> : <span>{i + 1}</span>}
                {s.label}
              </button>
              {i < STEPS.length - 1 && <ChevronRight size={14} className="text-[#4A5168]" />}
            </div>
          ))}
        </div>

        <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">

          {/* Step 1: Template */}
          {step === 'template' && (
            <div>
              <h2 className="text-base font-bold text-[#F1F3F9] mb-1">Choose a Starting Template</h2>
              <p className="text-xs text-[#4A5168] mb-5">Select a preset or start from scratch with Custom Agent.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {AGENT_TEMPLATES.map(t => (
                  <button
                    key={t.category}
                    onClick={() => { applyTemplate(t); setStep('configure'); }}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      selectedTemplate.category === t.category
                        ? 'border-purple-500/40 bg-purple-500/10'
                        : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{t.avatar}</span>
                      <div>
                        <p className="text-sm font-semibold text-[#F1F3F9]">{t.name}</p>
                      </div>
                    </div>
                    <p className="text-xs text-[#4A5168] leading-relaxed">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Configure */}
          {step === 'configure' && (
            <div className="space-y-5">
              <h2 className="text-base font-bold text-[#F1F3F9]">Configure Agent</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#8892AA] mb-1.5">Agent Name *</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Contract Review Agent"
                    className="w-full bg-[#151923] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#8892AA] mb-1.5">Avatar</label>
                  <input value={avatar} onChange={e => setAvatar(e.target.value)} maxLength={2}
                    className="w-full bg-[#151923] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-[#F1F3F9] focus:outline-none focus:border-purple-500/50 transition-colors text-center text-2xl" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#8892AA] mb-1.5">Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-10 rounded-lg border-0 bg-transparent cursor-pointer" />
                    <span className="text-xs font-mono text-[#4A5168]">{color}</span>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#8892AA] mb-1.5">Description</label>
                  <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this agent do?"
                    className="w-full bg-[#151923] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#8892AA] mb-1.5">System Prompt *</label>
                  <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={5}
                    placeholder="Describe the agent's role, capabilities, and behavior…"
                    className="w-full bg-[#151923] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none focus:border-purple-500/50 transition-colors resize-none font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#8892AA] mb-2">Model</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {MODELS.map(m => (
                      <button key={m.id} onClick={() => setModel(m.id)}
                        className={`text-left px-3 py-2 rounded-lg transition-colors border ${model === m.id ? 'bg-purple-500/15 border-purple-500/30 text-purple-300' : 'bg-white/[0.02] border-white/[0.06] text-[#4A5168] hover:text-[#8892AA]'}`}>
                        <p className="text-[11px] font-mono font-semibold">{m.label}</p>
                        <p className="text-[10px] opacity-70">{m.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#8892AA] mb-2">Behavior</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {BEHAVIORS.map(b => (
                      <button key={b.value} onClick={() => setBehavior(b.value)}
                        className={`text-left px-3 py-2 rounded-lg transition-colors border ${behavior === b.value ? 'bg-purple-500/15 border-purple-500/30 text-purple-300' : 'bg-white/[0.02] border-white/[0.06] text-[#4A5168] hover:text-[#8892AA]'}`}>
                        <p className="text-[11px] font-semibold">{b.label}</p>
                        <p className="text-[10px] opacity-70">{b.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#8892AA] mb-2">Temperature: {temperature.toFixed(1)}</label>
                  <input type="range" min="0" max="2" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-purple-500" />
                  <div className="flex justify-between text-[10px] text-[#4A5168] mt-1">
                    <span>Precise (0)</span><span>Creative (2)</span>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#8892AA] mb-2">Confidence Threshold for Human Review: {confidenceThreshold.toFixed(2)}</label>
                  <input type="range" min="0" max="1" step="0.05" value={confidenceThreshold} onChange={e => setConfidenceThreshold(parseFloat(e.target.value))}
                    className="w-full accent-purple-500" />
                  <p className="text-[10px] text-[#4A5168] mt-1">Runs below this confidence will be routed to human review queue.</p>
                </div>
                {/* Toggles */}
                <div className="col-span-2 grid grid-cols-2 gap-3">
                  {[
                    { label: 'Memory Enabled', desc: 'Persistent conversation memory', value: memoryEnabled, setter: setMemoryEnabled },
                    { label: 'Citation Required', desc: 'Must cite sources in responses', value: citationRequired, setter: setCitationRequired },
                    { label: 'Verification Mode', desc: 'Run trust verification on outputs', value: verificationMode, setter: setVerificationMode },
                    { label: 'Auto Retry', desc: 'Automatically retry on failure', value: autoRetry, setter: setAutoRetry },
                  ].map(({ label, desc, value, setter }) => (
                    <button key={label} onClick={() => setter(v => !v)}
                      className={`text-left p-3 rounded-xl border transition-colors ${value ? 'border-purple-500/30 bg-purple-500/10' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]'}`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs font-semibold text-[#F1F3F9]">{label}</p>
                        <div className={`w-8 h-4 rounded-full transition-colors relative ${value ? 'bg-purple-500' : 'bg-white/[0.1]'}`}>
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </div>
                      </div>
                      <p className="text-[10px] text-[#4A5168]">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Tools & Collections */}
          {step === 'tools' && (
            <div className="space-y-6">
              <h2 className="text-base font-bold text-[#F1F3F9]">Tools & Collections</h2>
              <div>
                <label className="block text-xs font-semibold text-[#8892AA] mb-2">Allowed Tools</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {tools.map(t => (
                    <button key={t.name} onClick={() => toggleTool(t.name)}
                      className={`text-left px-3 py-2 rounded-lg border transition-colors ${selectedTools.includes(t.name) ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/[0.02] border-white/[0.06] text-[#4A5168] hover:text-[#8892AA]'}`}>
                      <p className="text-[11px] font-semibold">{t.name}</p>
                      <p className="text-[9px] opacity-70 mt-0.5">{t.description}</p>
                    </button>
                  ))}
                </div>
                {tools.length === 0 && <p className="text-xs text-[#4A5168] py-4 text-center">Loading available tools…</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8892AA] mb-2">Allowed Collections</label>
                {collections.length === 0 ? (
                  <p className="text-xs text-[#4A5168] py-4 text-center">No collections in this workspace yet.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {collections.map(c => (
                      <button key={c.id} onClick={() => toggleCollection(c.id)}
                        className={`text-left px-3 py-2 rounded-lg border transition-colors ${selectedCollections.includes(c.id) ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-white/[0.02] border-white/[0.06] text-[#4A5168] hover:text-[#8892AA]'}`}>
                        <p className="text-[11px] font-semibold">{c.name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 'review' && (
            <div>
              <h2 className="text-base font-bold text-[#F1F3F9] mb-5">Review Configuration</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ backgroundColor: `${color}20` }}>{avatar}</div>
                  <div>
                    <p className="text-base font-bold text-[#F1F3F9]">{name}</p>
                    <p className="text-xs text-[#4A5168]">{description}</p>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1 inline-block" style={{ backgroundColor: `${color}20`, color }}>
                      {selectedTemplate.category}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Model', value: model },
                    { label: 'Behavior', value: behavior },
                    { label: 'Temperature', value: temperature.toFixed(1) },
                    { label: 'Tools', value: `${selectedTools.length} enabled` },
                    { label: 'Collections', value: selectedCollections.length > 0 ? `${selectedCollections.length} linked` : 'All' },
                    { label: 'Review Threshold', value: `${confidenceThreshold.toFixed(2)}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                      <p className="text-[10px] text-[#4A5168] font-bold uppercase tracking-wide">{label}</p>
                      <p className="text-sm font-semibold text-[#F1F3F9] mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-[#090B11] border border-white/[0.04] rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#4A5168] mb-2">System Prompt</p>
                  <p className="text-xs text-[#8892AA] font-mono leading-relaxed whitespace-pre-wrap">{systemPrompt || '(empty)'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-8 pt-6 border-t border-white/[0.04]">
            {currentStepIndex > 0 && (
              <button onClick={() => setStep(STEPS[currentStepIndex - 1].id)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#8892AA] bg-white/[0.04] hover:bg-white/[0.08] transition-colors">
                Back
              </button>
            )}
            {currentStepIndex < STEPS.length - 1 ? (
              <button
                onClick={() => {
                  if (step === 'configure' && (!name.trim() || !systemPrompt.trim())) {
                    toast.error('Name and system prompt are required.');
                    return;
                  }
                  setStep(STEPS[currentStepIndex + 1].id);
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors">
                Continue
              </button>
            ) : (
              <button onClick={handleCreate} disabled={create.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 transition-colors">
                {create.isPending ? 'Creating…' : 'Create Agent'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
