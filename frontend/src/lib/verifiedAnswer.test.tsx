import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AbstentionCard } from '../components/chat/AbstentionCard';
import { DebatePanel } from '../components/chat/DebatePanel';
import { TrustBadge } from '../components/chat/TrustBadge';
import { VerificationTimeline } from '../components/chat/VerificationTimeline';
import { VerifiedClaimChip } from '../components/chat/VerifiedClaimChip';
import { buildTrustBreakdown, buildVerificationTimeline, getClaimLabel, getRelatedContradictions } from './verifiedAnswer';


const citation = {
  citationKey: 'E1',
  documentId: 'doc-1',
  chunkId: 'chunk-1',
  pageStart: 4,
  pageEnd: 4,
  sourceOffsets: [],
};

const claim = {
  id: 'claim-1',
  text: 'The agreement renews annually.',
  criticVerdict: 'supported' as const,
  nliLabel: 'entail' as const,
  nliScore: 0.97,
  ensembleVerdict: 'supported',
  evidenceSpans: ['The agreement renews annually.'],
  debateTurn: 1,
};

const trust = {
  faithfulness: 1,
  relevance: null,
  overall: 0.91,
  confidence: 0.91,
  calibrated: true,
  confidenceBand: 'high' as const,
};


describe('verified answer helpers and components', () => {
  it('renders trust badge details and verified claim chips', () => {
    const trustMarkup = renderToStaticMarkup(
      <TrustBadge calibrated={trust.confidence} raw={trust.overall} />,
    );
    const claimMarkup = renderToStaticMarkup(
      <VerifiedClaimChip claim={claim} citations={[citation]} workspaceId="ws-1" />,
    );

    expect(trustMarkup).toContain('High trust');
    expect(trustMarkup).toContain('91%');
    expect(claimMarkup).toContain('Verified');
    expect(claimMarkup).toContain('supported');
  });

  it('builds timeline and breakdown data from verification metadata', () => {
    const timeline = buildVerificationTimeline(
      {
        claims: [claim],
        debateTurns: [{ turn: 1, claim: 'It renews annually.', verdict: 'supported', reasoning: 'Verified.' }],
        trust,
        abstention: null,
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
            vectorScore: 0.7,
            bm25Score: 1.1,
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
      },
      false,
    );
    const breakdown = buildTrustBreakdown(
      trust,
      [claim],
      [
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
          vectorScore: 0.7,
          bm25Score: 1.1,
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
    );

    expect(timeline[0].status).toBe('completed');
    expect(timeline[3].summary).toContain('high');
    expect(breakdown.find((item) => item.id === 'final')?.value).toBe(0.91);
    expect(getClaimLabel(claim)).toBe('Verified');
  });

  it('renders debate, timeline, and abstention experiences', () => {
    const debateMarkup = renderToStaticMarkup(
      <DebatePanel turns={[{ turn: 1, claim: 'It renews annually.', verdict: 'supported', reasoning: 'Prepared 1 claim.' }]} />,
    );
    const timelineMarkup = renderToStaticMarkup(
      <VerificationTimeline
        steps={[
          { id: 'claims', label: 'Claim Extraction', status: 'completed', summary: '1 claim extracted.' },
        ]}
      />,
    );
    const abstentionMarkup = renderToStaticMarkup(
      <AbstentionCard
        reason="I could not verify the cancellation window."
        trustScore={0.3}
        threshold={0.6}
        missingEvidenceQuery="termination notice cancellation"
      />,
    );

    expect(debateMarkup).toContain('Critic review');
    expect(timelineMarkup).toContain('Claim Extraction');
    expect(abstentionMarkup).toContain('cancellation');
  });

  it('filters related contradictions by cited or retrieved documents', () => {
    const contradictions = getRelatedContradictions(
      {
        id: 'msg-1',
        workspaceId: 'ws-1',
        conversationId: 'conv-1',
        role: 'assistant',
        content: 'Answer',
        createdAt: '2026-06-29T00:00:00Z',
        answerRunId: 'answer-1',
        retrievalRunId: 'retrieval-1',
        trust,
        abstention: null,
        claims: [claim],
        debateTurns: [],
        retrievedEvidence: [],
        citations: [citation],
      },
      [
        {
          id: 'contr-1',
          topic: 'termination notice period',
          docA: 'doc-1',
          spanA: 'chunk-1',
          valueA: '30 days',
          docB: 'doc-2',
          spanB: 'chunk-2',
          valueB: '60 days',
          severity: 'major',
          note: 'Conflicting notice windows.',
        },
      ],
    );

    expect(contradictions).toHaveLength(1);
  });
});
