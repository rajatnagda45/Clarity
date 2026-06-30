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

    // RC2: claim is a string in SSE; full Claim objects arrive via the message event
    state = applyStreamEvent(state, {
      type: 'claim',
      claim: 'It renews annually.',
      verdict: 'supported',
      criticVerdict: 'supported',
      nliLabel: 'entailment',
      nliScore: 0.97,
      evidenceSpans: ['chunk-1'],
    });
    // RC2: debate_turn carries turn number, claim text, verdict, reasoning
    state = applyStreamEvent(state, {
      type: 'debate_turn',
      turn: 1,
      claim: 'It renews annually.',
      verdict: 'supported',
      reasoning: 'Supported by the cited clause.',
    });
    // RC2: trust carries raw + calibrated scores
    state = applyStreamEvent(state, {
      type: 'trust',
      raw: 0.88,
      calibrated: 0.88,
      components: {},
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
            criticVerdict: 'supported',
            nliLabel: 'entail' as const,
            nliScore: 0.93,
            ensembleVerdict: 'supported',
            evidenceSpans: ['The agreement renews annually.'],
            debateTurn: 1,
          },
        ],
        debateTurns: [{ turn: 1, claim: 'It renews annually.', verdict: 'supported', reasoning: 'Supported by the cited clause.' }],
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
    // RC2: trust event sets the trust score
    state = applyStreamEvent(state, {
      type: 'trust',
      raw: 0.3,
      calibrated: 0.3,
      components: {},
    });
    // RC2: abstention event carries reason, trustScore, threshold
    state = applyStreamEvent(state, {
      type: 'abstention',
      reason: 'No span states a cancellation window.',
      trustScore: 0.3,
      threshold: 0.6,
      missingEvidenceQuery: 'termination notice cancellation',
    });

    expect(state.abstention?.reason).toContain('No span states');
    expect(state.trust?.confidenceBand).toBe('low');
  });
});
