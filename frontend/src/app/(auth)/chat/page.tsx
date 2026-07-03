'use client';

import { useAuth } from '@clerk/nextjs';
import { FormEvent, useEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User, Sparkles } from 'lucide-react';

import { useWorkspace } from '@/contexts/WorkspaceContext';
import { applyStreamEvent, createStreamingAnswerState } from '@/lib/chatStream';
import { getConversation, listConversations, resumeAnswerStream, streamQuery } from '@/lib/api';
import { parseMarkdownBlocks } from '@/lib/markdown';
import type { Citation, Conversation, Message, StreamEvent } from '@/types/clarity';

import { PremiumBackground } from '@/components/landing/PremiumBackground';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatContextPanel } from '@/components/chat/ChatContextPanel';
import { Composer } from '@/components/chat/Composer';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

function MessageBody({ content }: { content: string }) {
  const blocks = useMemo(() => parseMarkdownBlocks(content), [content]);

  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-[#F1F3F9]">
      {blocks.map((block, index) => {
        if (block.type === 'list') {
          return (
            <ul key={index} className="list-disc space-y-1.5 pl-5 marker:text-purple-500">
              {block.items.map((item, itemIndex) => (
                <li key={`${index}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          );
        }
        return <p key={index} className="whitespace-pre-wrap">{block.text}</p>;
      })}
    </div>
  );
}

export default function ChatPage() {
  const searchParams = useSearchParams();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = searchParams.get('workspace') || activeWorkspace?.id || '';
  const { getToken } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [composer, setComposer] = useState('');
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [streamingCitations, setStreamingCitations] = useState<Citation[]>([]);
  const [streamingTrust, setStreamingTrust] = useState<{ raw: number; calibrated: number; components: Record<string, number> } | null>(null);
  const [streamingDebateTurns, setStreamingDebateTurns] = useState<any[]>([]);
  const [streamingAbstention, setStreamingAbstention] = useState<any | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  useEffect(() => {
    let cancelled = false;

    async function loadConversations() {
      if (!workspaceId) {
        setLoadState('error');
        setErrorMessage('Choose a workspace before opening chat.');
        return;
      }

      setLoadState('loading');
      setErrorMessage('');

      try {
        const token = await getToken();
        if (!token) throw new Error('Clerk session token unavailable.');
        const nextConversations = await listConversations({ token, workspaceId });
        if (cancelled) return;
        setConversations(nextConversations);
        setSelectedConversationId((current) => current ?? nextConversations[0]?.id ?? null);
        setLoadState('loaded');
      } catch (error) {
        if (cancelled) return;
        setLoadState('error');
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load conversations.');
      }
    }

    void loadConversations();
    return () => { cancelled = true; };
  }, [getToken, workspaceId]);

  useEffect(() => {
    let cancelled = false;

    async function loadConversation() {
      if (!workspaceId || !selectedConversationId) {
        setMessages([]);
        return;
      }

      try {
        const token = await getToken();
        if (!token) throw new Error('Clerk session token unavailable.');
        const detail = await getConversation({ token, workspaceId }, selectedConversationId);
        if (cancelled) return;
        setMessages(detail.messages);
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load conversation.');
      }
    }

    void loadConversation();
    return () => { cancelled = true; };
  }, [getToken, selectedConversationId, workspaceId]);

  function handleNewChat() {
    setSelectedConversationId(null);
    setMessages([]);
    setComposer('');
    setStreamingText('');
    setStreamingCitations([]);
    setStreamingTrust(null);
    setStreamingDebateTurns([]);
    setStreamingAbstention(null);
  }

  async function handleSubmit() {
    if (!workspaceId || !composer.trim() || isStreaming) return;

    const userText = composer.trim();
    const temporaryUserMessage: Message = {
      id: `local-${Date.now()}`,
      workspaceId,
      conversationId: selectedConversationId ?? 'pending',
      role: 'user',
      content: userText,
      createdAt: new Date().toISOString(),
      citations: [],
    };

    setMessages((current) => [...current, temporaryUserMessage]);
    setComposer('');
    setErrorMessage('');
    setStreamingText('');
    setStreamingCitations([]);
    setStreamingTrust(null);
    setStreamingDebateTurns([]);
    setStreamingAbstention(null);
    setIsStreaming(true);

    const token = await getToken();
    if (!token) {
      setErrorMessage('Clerk session token unavailable.');
      setIsStreaming(false);
      return;
    }

    const streamState = createStreamingAnswerState();
    const requestId = crypto.randomUUID();
    let resumed = false;

    const handleStreamEvent = async (streamEvent: StreamEvent) => {
      const next = applyStreamEvent(streamState, streamEvent);
      Object.assign(streamState, next);

      if (streamEvent.type === 'meta') {
        setSelectedConversationId(streamEvent.conversationId);
      }

      if (streamEvent.type === 'token') {
        setStreamingText(next.content);
      }

      if (streamEvent.type === 'citation') {
        setStreamingCitations(next.citations);
      }

      if (streamEvent.type === 'debate_turn') {
        setStreamingDebateTurns((prev) => [...prev, streamEvent]);
      }

      if (streamEvent.type === 'trust') {
        setStreamingTrust({ raw: streamEvent.raw, calibrated: streamEvent.calibrated, components: streamEvent.components });
      }

      if (streamEvent.type === 'abstention') {
        setStreamingAbstention({
          reason: streamEvent.reason,
          trustScore: streamEvent.trustScore,
          threshold: streamEvent.threshold,
          missingEvidenceQuery: streamEvent.missingEvidenceQuery,
        });
      }

      if (streamEvent.type === 'message') {
        setStreamingText('');
        setStreamingCitations([]);
        const detail = await getConversation({ token, workspaceId }, streamEvent.message.conversationId);
        setMessages(detail.messages);
        const nextConversations = await listConversations({ token, workspaceId });
        setConversations(nextConversations);
      }

      if (streamEvent.type === 'error') {
        setErrorMessage(streamEvent.message);
      }

      if (streamEvent.type === 'done') {
        setIsStreaming(false);
        stop();
      }
    };

    const stop = streamQuery(
      { token, workspaceId },
      {
        query: userText,
        conversationId: selectedConversationId ?? undefined,
        requestId,
      },
      handleStreamEvent,
      (error) => {
        if (!resumed && streamState.conversationId && streamState.answerRunId) {
          resumed = true;
          resumeAnswerStream(
            { token, workspaceId },
            {
              conversationId: streamState.conversationId,
              answerRunId: streamState.answerRunId,
            },
            handleStreamEvent,
            (resumeError) => {
              setErrorMessage(resumeError.message);
              setIsStreaming(false);
            },
          );
          return;
        }
        setErrorMessage(error.message);
        setIsStreaming(false);
      },
    );
  }

  // Combine historical messages with streaming UI state
  const activeCitations = isStreaming ? streamingCitations : (messages[messages.length - 1]?.citations || []);

  const renderMessage = (msg: { role: 'user' | 'assistant', content: string, id: string }, isStreamingActive = false) => (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      key={msg.id}
      className={`flex gap-4 w-full max-w-3xl mx-auto mb-8 ${msg.role === 'user' ? 'justify-end' : ''}`}
    >
      {msg.role === 'assistant' && (
        <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0 mt-1">
          <Sparkles size={14} className="text-purple-400" />
        </div>
      )}
      
      <div className={`flex flex-col ${msg.role === 'user' ? 'items-end max-w-[80%]' : 'w-full'}`}>
        <div className={`p-4 rounded-2xl ${
          msg.role === 'user' 
            ? 'bg-purple-500 text-white rounded-br-sm' 
            : 'bg-[#0F1117] border border-white/[0.08] text-[#F1F3F9] rounded-tl-sm'
        }`}>
          <MessageBody content={msg.content} />
          {isStreamingActive && (
            <motion.span 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
              className="inline-block w-2 h-4 bg-purple-400 ml-1 translate-y-1"
            />
          )}
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="flex h-screen w-full bg-[#05070B] overflow-hidden selection:bg-purple-500/30 selection:text-white relative">
      <PremiumBackground glowOpacity={0.15} />

      {/* Left Sidebar */}
      <div className="z-10 h-full">
        <ChatSidebar 
          conversations={conversations}
          selectedId={selectedConversationId}
          onSelect={setSelectedConversationId}
          onNewChat={handleNewChat}
        />
      </div>

      {/* Center Chat Area */}
      <div className="flex-1 flex flex-col h-full relative z-10">
        
        {/* Header */}
        <div className="h-16 border-b border-white/[0.04] flex items-center px-6 justify-between flex-shrink-0 bg-[#05070B]/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Bot size={18} className="text-purple-400" />
            <h2 className="text-sm font-semibold text-[#F1F3F9]">Clarity Assistant</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-white/5 text-[#8892AA] border border-white/10">Clarity-1</span>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto px-6 pt-8 pb-32 scrollbar-hide">
          {messages.length === 0 && !isStreaming ? (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center mt-[-10vh]">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6 relative">
                <Sparkles size={32} className="text-purple-400" />
                <div className="absolute inset-0 rounded-2xl border border-purple-400/30 animate-ping opacity-20" />
              </div>
              <h1 className="text-2xl font-bold text-[#F1F3F9] mb-2 tracking-tight">How can I help you today?</h1>
              <p className="text-[#8892AA] mb-8 text-sm">I can analyze contracts, extract clauses, or answer questions grounded in your workspace documents.</p>
              
              <div className="grid grid-cols-2 gap-3 w-full">
                {['Summarize this contract', 'Find termination clauses', 'List payment obligations', 'Explain legal risks'].map((prompt) => (
                  <button 
                    key={prompt}
                    onClick={() => { setComposer(prompt); }}
                    className="p-4 rounded-xl border border-white/[0.06] bg-[#0F1117] text-left hover:border-purple-500/30 hover:bg-purple-500/5 transition-all group"
                  >
                    <p className="text-sm font-medium text-[#F1F3F9] group-hover:text-purple-400 transition-colors">{prompt}</p>
                    <p className="text-xs text-[#4A5168] mt-1">Suggested prompt</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="w-full">
              {messages.map((msg) => renderMessage(msg))}
              
              {isStreaming && streamingText && renderMessage({
                id: 'streaming',
                role: 'assistant',
                content: streamingText,
              }, true)}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Composer anchored at bottom */}
        <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-[#05070B] via-[#05070B]/90 to-transparent">
          {errorMessage && (
            <div className="max-w-3xl mx-auto mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2.5 rounded-xl text-center">
              {errorMessage}
            </div>
          )}
          <Composer 
            value={composer}
            onChange={setComposer}
            onSubmit={handleSubmit}
            isStreaming={isStreaming}
            disabled={!workspaceId}
          />
        </div>
      </div>

      {/* Right Context Sidebar */}
      <div className="z-10 h-full">
        <ChatContextPanel 
          workspaceId={workspaceId}
          activeWorkspace={activeWorkspace}
          citations={activeCitations}
          streamingTrust={streamingTrust}
          streamingDebateTurns={streamingDebateTurns}
          streamingAbstention={streamingAbstention}
        />
      </div>

    </div>
  );
}
