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
      type: 'claim',
      claim: {
        id: 'claim-1',
        text: 'It renews annually.',
        spanIds: ['chunk-1'],
        citationKeys: ['E1'],
        verificationPass: 1,
        supported: true,
        uncertain: false,
        criticStatus: 'supported',
      },
    });
    state = applyStreamEvent(state, {
      type: 'debate_turn',
      round: 0,
      actor: 'critic',
      action: 'resolve',
      note: 'Supported by the cited clause.',
    });
    state = applyStreamEvent(state, {
      type: 'trust',
      score: {
        faithfulness: 1,
        relevance: null,
        overall: 0.88,
        confidence: 0.88,
        calibrated: true,
        confidenceBand: 'high',
      },
    });

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
        trust: {
          faithfulness: 1,
          relevance: null,
          overall: 0.88,
          confidence: 0.88,
          calibrated: true,
          confidenceBand: 'high',
        },
        abstention: null,
        claims: [
          {
            id: 'claim-1',
            text: 'It renews annually.',
            spanIds: ['chunk-1'],
            citationKeys: ['E1'],
            verificationPass: 1,
            supported: true,
            uncertain: false,
            criticStatus: 'supported',
          },
        ],
        debateTurns: [{ round: 0, actor: 'critic', action: 'resolve', note: 'Supported by the cited clause.' }],
        retrievedEvidence: [
          {
            workspaceId: 'ws-1',
            documentId: 'doc-1',
            chunkId: 'chunk-1',
            chunkIndex: 0,
            text: 'The agreement renews annually.',
            sectionTitle: 'Renewal',
            clauseNumber: '9.2',
            pageStart: 4,
            pageEnd: 4,
            chunkKind: 'clause',
            crossReferences: [],
            vectorScore: 0.8,
            bm25Score: 1.2,
            rrfScore: 0.05,
            rerankScore: 0.93,
            finalScore: 0.93,
            finalRank: 1,
            retrievalReason: 'Strong semantic and sparse agreement.',
            retrievalSources: ['dense'],
            parserVersion: 'a3.v1',
            chunkVersion: 'a4.v1',
            embeddingVersion: 'a5.v1',
          },
        ],
        citations: [],
      },
    });

    expect(state.finishedMessage?.id).toBe('msg-assistant');
    expect(state.content).toBe('Final answer');
    expect(state.claims).toHaveLength(1);
    expect(state.retrievedEvidence[0]?.chunkId).toBe('chunk-1');
    expect(state.trust?.confidenceBand).toBe('high');
  });

  it('stores abstention payloads and trust during streaming', () => {
    let state = createStreamingAnswerState();
    state = applyStreamEvent(state, {
      type: 'abstention',
      reason: 'No span states a cancellation window.',
      missingEvidenceQuery: 'termination notice cancellation',
      suggestedFollowUp: 'Ask specifically about the termination clause.',
      trust: {
        faithfulness: 0.2,
        relevance: null,
        overall: 0.3,
        confidence: 0.3,
        calibrated: true,
        confidenceBand: 'low',
      },
    });

    expect(state.abstention?.reason).toContain('No span states');
    expect(state.trust?.confidenceBand).toBe('low');
  });
});
