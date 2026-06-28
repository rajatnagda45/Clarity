import { describe, expect, it } from 'vitest';

import { applyStreamEvent, createStreamingAnswerState } from './chatStream';


describe('chat stream reducer', () => {
  it('accumulates tokens and citations into the active answer state', () => {
    let state = createStreamingAnswerState();
    state = applyStreamEvent(state, {
      type: 'meta',
      conversationId: 'conv-1',
      userMessageId: 'msg-user',
      retrievalRunId: 'retrieval-1',
      answerRunId: 'answer-1',
    });
    state = applyStreamEvent(state, { type: 'token', text: 'Hello ' });
    state = applyStreamEvent(state, { type: 'token', text: 'world' });
    state = applyStreamEvent(state, {
      type: 'citation',
      citation: {
        citationKey: 'E1',
        documentId: 'doc-1',
        chunkId: 'chunk-1',
        pageStart: 2,
        pageEnd: 2,
        sourceOffsets: [],
      },
    });

    expect(state.conversationId).toBe('conv-1');
    expect(state.answerRunId).toBe('answer-1');
    expect(state.content).toBe('Hello world');
    expect(state.citations).toHaveLength(1);
  });

  it('captures the final assistant message and error payloads', () => {
    let state = createStreamingAnswerState();
    state = applyStreamEvent(state, { type: 'error', code: 'writer_failed', message: 'boom' });
    expect(state.errorMessage).toBe('boom');

    state = applyStreamEvent(state, {
      type: 'message',
      message: {
        id: 'msg-assistant',
        workspaceId: 'ws-1',
        conversationId: 'conv-1',
        role: 'assistant',
        content: 'Final answer',
        createdAt: '2026-06-29T00:00:00Z',
        answerRunId: 'answer-1',
        retrievalRunId: 'retrieval-1',
        citations: [],
      },
    });

    expect(state.finishedMessage?.id).toBe('msg-assistant');
    expect(state.content).toBe('Final answer');
  });
});
