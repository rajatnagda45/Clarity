'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@clerk/nextjs';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { AbstentionCard } from '@/components/chat/AbstentionCard';
import { TrustBadge } from '@/components/chat/TrustBadge';
import { TrustBreakdown } from '@/components/chat/TrustBreakdown';
import { VerifiedClaimChip } from '@/components/chat/VerifiedClaimChip';
import { applyStreamEvent, createStreamingAnswerState, type StreamingAnswerState } from '@/lib/chatStream';
import { getConversation, listContradictions, listConversations, resumeAnswerStream, streamQuery } from '@/lib/api';
import { parseMarkdownBlocks } from '@/lib/markdown';
import { buildProvenanceHref, buildVerificationTimeline, getRelatedContradictions } from '@/lib/verifiedAnswer';
import type { Citation, Contradiction, Conversation, Message, StreamEvent } from '@/types/clarity';


const DebatePanel = dynamic(
  () => import('@/components/chat/DebatePanel').then((module) => module.DebatePanel),
  { ssr: false },
);

const VerificationTimeline = dynamic(
  () => import('@/components/chat/VerificationTimeline').then((module) => module.VerificationTimeline),
  { ssr: false },
);

const ContradictionViewer = dynamic(
  () => import('@/components/chat/ContradictionViewer').then((module) => module.ContradictionViewer),
  { ssr: false },
);

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';


function CitationChip({
  citation,
  workspaceId,
  claimId,
  claimText,
  criticStatus,
  confidence,
  supportProbability,
}: {
  citation: Citation;
  workspaceId: string;
  claimId?: string | null;
  claimText?: string | null;
  criticStatus?: string | null;
  confidence?: number | null;
  supportProbability?: number | null;
}) {
  return (
    <Link
      href={buildProvenanceHref({
        workspaceId,
        documentId: citation.documentId,
        claimId,
        chunkId: citation.chunkId,
        citationKey: citation.citationKey,
        claimText,
        criticStatus,
        confidence,
        supportProbability,
      })}
      className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
      title={`${citation.sectionTitle ?? 'Evidence'} • pages ${citation.pageStart}-${citation.pageEnd}`}
    >
      {citation.citationKey} · p{citation.pageStart}
    </Link>
  );
}


function MessageBody({ content }: { content: string }) {
  const blocks = useMemo(() => parseMarkdownBlocks(content), [content]);

  return (
    <div className="space-y-3 text-sm leading-7 text-slate-800">
      {blocks.map((block, index) => {
        if (block.type === 'list') {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
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


function AssistantAnswerCard({
  message,
  workspaceId,
  contradictions,
  onRefineQuestion,
}: {
  message: Message;
  workspaceId: string;
  contradictions: Contradiction[];
  onRefineQuestion?: (question: string) => void;
}) {
  const relatedContradictions = getRelatedContradictions(message, contradictions);
  const timeline = buildVerificationTimeline(message, false);

  return (
    <article className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-slate-900">
      {message.trust ? (
        <TrustBadge trust={message.trust} claims={message.claims} debateTurns={message.debateTurns} />
      ) : null}

      {message.abstention ? (
        <AbstentionCard abstention={message.abstention} trust={message.trust} onRefineQuestion={onRefineQuestion} />
      ) : (
        <MessageBody content={message.content} />
      )}

      {message.claims.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Verified Claims</h3>
          <div className="grid gap-3">
            {message.claims.map((claim) => (
              <VerifiedClaimChip
                key={claim.id}
                claim={claim}
                citations={message.citations}
                workspaceId={workspaceId}
              />
            ))}
          </div>
        </section>
      ) : null}

      {message.citations.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {message.citations.map((citation) => (
            <CitationChip key={`${message.id}-${citation.citationKey}`} citation={citation} workspaceId={workspaceId} />
          ))}
        </div>
      ) : null}

      <VerificationTimeline steps={timeline} />
      <TrustBreakdown trust={message.trust} claims={message.claims} retrievedEvidence={message.retrievedEvidence} />
      <DebatePanel debateTurns={message.debateTurns} />
      <ContradictionViewer contradictions={relatedContradictions} workspaceId={workspaceId} />
    </article>
  );
}


function streamingMessageFromState(workspaceId: string, state: StreamingAnswerState): Message {
  return {
    id: state.assistantMessageId ?? 'streaming',
    workspaceId,
    conversationId: state.conversationId ?? 'streaming',
    role: 'assistant',
    content: state.content,
    createdAt: new Date().toISOString(),
    answerRunId: state.answerRunId,
    retrievalRunId: state.retrievalRunId,
    trust: state.trust,
    abstention: state.abstention,
    claims: state.claims,
    debateTurns: state.debateTurns,
    retrievedEvidence: [],
    citations: state.citations,
  };
}


export default function ChatPage() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspace') ?? '';
  const { getToken } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [composer, setComposer] = useState('');
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [streamingState, setStreamingState] = useState<StreamingAnswerState>(createStreamingAnswerState());

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaceData() {
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
        const [nextConversations, nextContradictions] = await Promise.all([
          listConversations({ token, workspaceId }),
          listContradictions({ token, workspaceId }),
        ]);
        if (cancelled) return;
        setConversations(nextConversations);
        setContradictions(nextContradictions);
        setSelectedConversationId((current) => current ?? nextConversations[0]?.id ?? null);
        setLoadState('loaded');
      } catch (error) {
        if (cancelled) return;
        setLoadState('error');
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load chat workspace.');
      }
    }

    void loadWorkspaceData();
    return () => {
      cancelled = true;
    };
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
    return () => {
      cancelled = true;
    };
  }, [getToken, selectedConversationId, workspaceId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      claims: [],
      debateTurns: [],
      retrievedEvidence: [],
      trust: null,
      abstention: null,
    };

    setMessages((current) => [...current, temporaryUserMessage]);
    setComposer('');
    setErrorMessage('');
    setStreamingState(createStreamingAnswerState());
    setIsStreaming(true);

    const token = await getToken();
    if (!token) {
      setErrorMessage('Clerk session token unavailable.');
      setIsStreaming(false);
      return;
    }

    const streamState = createStreamingAnswerState();
    let resumed = false;
    const requestId = crypto.randomUUID();

    const handleStreamEvent = async (streamEvent: StreamEvent) => {
      const next = applyStreamEvent(streamState, streamEvent);
      Object.assign(streamState, next);
      setStreamingState({ ...next });

      if (streamEvent.type === 'meta') {
        setSelectedConversationId(streamEvent.conversationId);
      }

      if (streamEvent.type === 'message') {
        const detail = await getConversation({ token, workspaceId }, streamEvent.message.conversationId);
        const nextConversations = await listConversations({ token, workspaceId });
        setMessages(detail.messages);
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

  const activeStreamingMessage = useMemo(
    () => streamingMessageFromState(workspaceId, streamingState),
    [streamingState, workspaceId],
  );

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-7xl gap-6 px-6 py-8">
      <aside className="flex w-80 shrink-0 flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">Phase B2</p>
          <h1 className="text-2xl font-semibold text-slate-900">Verified Conversations</h1>
          <p className="text-sm text-slate-600">
            Answers now explain why they should be trusted, not just where they came from.
          </p>
        </div>

        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          Workspace: <span className="font-mono text-slate-900">{workspaceId || 'missing'}</span>
        </div>

        <div className="mt-5 flex-1 space-y-2 overflow-y-auto">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => setSelectedConversationId(conversation.id)}
              aria-label={`Open conversation ${conversation.title || 'Untitled conversation'}`}
              className={`w-full rounded-2xl border p-4 text-left ${
                selectedConversationId === conversation.id
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">{conversation.title || 'Untitled conversation'}</p>
              <p className="mt-1 text-xs text-slate-500">{conversation.messageCount} messages</p>
            </button>
          ))}

          {conversations.length === 0 && loadState === 'loaded' ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              Start the first conversation by asking about a contract term, obligation, or contradiction.
            </div>
          ) : null}
        </div>

        <Link
          href={workspaceId ? `/developer/answers?workspace=${encodeURIComponent(workspaceId)}` : '/developer/dashboard'}
          className="mt-5 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Open Verification Explorer
        </Link>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-2xl font-semibold text-slate-900">Ask Clarity</h2>
          <p className="mt-1 text-sm text-slate-600">
            Token streaming stays live while verification, calibrated trust, debate, and abstention state update in parallel.
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
          {messages.map((message) => (
            message.role === 'assistant' ? (
              <AssistantAnswerCard
                key={message.id}
                message={message}
                workspaceId={workspaceId}
                contradictions={contradictions}
                onRefineQuestion={setComposer}
              />
            ) : (
              <article
                key={message.id}
                className="ml-auto max-w-4xl rounded-3xl bg-slate-900 px-5 py-4 text-white"
              >
                <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
              </article>
            )
          ))}

          {isStreaming ? (
            <article className="space-y-4 rounded-3xl border border-blue-200 bg-blue-50 px-5 py-4 text-slate-900">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-blue-700">
                <span className="inline-flex h-2 w-2 rounded-full bg-blue-500" />
                Streaming verified answer
              </div>
              <MessageBody content={streamingState.content || 'Thinking…'} />
              {streamingState.claims.length > 0 ? (
                <div className="grid gap-3">
                  {streamingState.claims.map((claim) => (
                    <VerifiedClaimChip
                      key={claim.id}
                      claim={claim}
                      citations={streamingState.citations}
                      workspaceId={workspaceId}
                    />
                  ))}
                </div>
              ) : null}
              {streamingState.citations.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {streamingState.citations.map((citation) => (
                    <CitationChip key={citation.citationKey} citation={citation} workspaceId={workspaceId} />
                  ))}
                </div>
              ) : null}
              <VerificationTimeline steps={buildVerificationTimeline(activeStreamingMessage, true)} />
              <TrustBreakdown
                trust={streamingState.trust}
                claims={streamingState.claims}
                retrievedEvidence={activeStreamingMessage.retrievedEvidence}
              />
              <DebatePanel debateTurns={streamingState.debateTurns} />
              {streamingState.trust ? (
                <TrustBadge trust={streamingState.trust} claims={streamingState.claims} debateTurns={streamingState.debateTurns} />
              ) : null}
              {streamingState.abstention ? (
                <AbstentionCard abstention={streamingState.abstention} trust={streamingState.trust} onRefineQuestion={setComposer} />
              ) : null}
            </article>
          ) : null}

          {loadState === 'loading' ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
              Loading conversation history…
            </div>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-slate-200 px-6 py-5" aria-label="Send a verified contract question">
          <label className="block text-sm font-medium text-slate-700" htmlFor="clarity-chat-composer">
            Ask a contract question
          </label>
          <div className="mt-3 flex gap-3">
            <textarea
              id="clarity-chat-composer"
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              placeholder="Example: Does this agreement auto-renew, and what notice is required to stop it?"
              className="min-h-[6rem] flex-1 rounded-3xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={!workspaceId || !composer.trim() || isStreaming}
              className="self-end rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isStreaming ? 'Verifying…' : 'Send'}
            </button>
          </div>
          {errorMessage ? <p className="mt-3 text-sm text-red-600">{errorMessage}</p> : null}
        </form>
      </section>
    </div>
  );
}
