'use client';

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { applyStreamEvent, createStreamingAnswerState } from '@/lib/chatStream';
import { getConversation, listConversations, resumeAnswerStream, streamQuery } from '@/lib/api';
import { parseMarkdownBlocks } from '@/lib/markdown';
import type { Citation, Conversation, Message, StreamEvent } from '@/types/clarity';


type LoadState = 'idle' | 'loading' | 'loaded' | 'error';


function CitationChip({ citation, workspaceId }: { citation: Citation; workspaceId: string }) {
  return (
    <Link
      href={`/documents/${citation.documentId}/chunks?workspace=${encodeURIComponent(workspaceId)}&highlight=${encodeURIComponent(citation.chunkId)}`}
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


export default function ChatPage() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspace') ?? '';
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
    };

    setMessages((current) => [...current, temporaryUserMessage]);
    setComposer('');
    setErrorMessage('');
    setStreamingText('');
    setStreamingCitations([]);
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

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-7xl gap-6 px-6 py-8">
      <aside className="flex w-80 shrink-0 flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">Phase A8</p>
          <h1 className="text-2xl font-semibold text-slate-900">Conversations</h1>
          <p className="text-sm text-slate-600">
            Grounded answers stream from retrieval evidence only, with structured citations for every response.
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
              className={`w-full rounded-2xl border p-4 text-left ${
                selectedConversationId === conversation.id
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">{conversation.title || 'Untitled conversation'}</p>
              <p className="mt-1 text-xs text-slate-500">{conversation.messageCount} messages</p>
            </button>
          ))}

          {conversations.length === 0 && loadState === 'loaded' ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              Start the first conversation by asking about a contract term, obligation, or clause.
            </div>
          ) : null}
        </div>

        <Link
          href={workspaceId ? `/developer/answers?workspace=${encodeURIComponent(workspaceId)}` : '/developer/dashboard'}
          className="mt-5 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Open Answer Explorer
        </Link>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-2xl font-semibold text-slate-900">Ask Clarity</h2>
          <p className="mt-1 text-sm text-slate-600">
            Responses stream live and stay grounded in the retrieval evidence already indexed for this workspace.
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
          {messages.map((message) => (
            <article
              key={message.id}
              className={`max-w-4xl rounded-3xl px-5 py-4 ${
                message.role === 'user'
                  ? 'ml-auto bg-slate-900 text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-900'
              }`}
            >
              {message.role === 'assistant' ? <MessageBody content={message.content} /> : <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>}
              {message.citations.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {message.citations.map((citation) => (
                    <CitationChip key={`${message.id}-${citation.citationKey}`} citation={citation} workspaceId={workspaceId} />
                  ))}
                </div>
              ) : null}
            </article>
          ))}

          {isStreaming ? (
            <article className="max-w-4xl rounded-3xl border border-blue-200 bg-blue-50 px-5 py-4 text-slate-900">
              <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-blue-700">
                <span className="inline-flex h-2 w-2 rounded-full bg-blue-500" />
                Writing
              </div>
              <MessageBody content={streamingText || 'Thinking…'} />
              {streamingCitations.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {streamingCitations.map((citation) => (
                    <CitationChip key={citation.citationKey} citation={citation} workspaceId={workspaceId} />
                  ))}
                </div>
              ) : null}
            </article>
          ) : null}

          {!isStreaming && messages.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-600">
              Ask a focused contract question like “What are the termination notice requirements?” or “Does this agreement auto-renew?”
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-200 px-6 py-5">
          {errorMessage ? <p className="mb-3 text-sm text-red-600">{errorMessage}</p> : null}
          <form onSubmit={handleSubmit} className="flex gap-3">
            <textarea
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              placeholder="Ask about obligations, risks, termination, renewal, pricing, or any cited contract detail…"
              className="min-h-24 flex-1 rounded-3xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none ring-0"
              disabled={!workspaceId || isStreaming}
            />
            <button
              type="submit"
              disabled={!workspaceId || isStreaming || !composer.trim()}
              className="self-end rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isStreaming ? 'Streaming…' : 'Send'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
