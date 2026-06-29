import type {
  Abstention,
  Claim,
  Contradiction,
  DebateTurn,
  Message,
  RetrievalEvidence,
  TrustScore,
} from '@/types/clarity';


export type ClaimStatusTone = 'verified' | 'partial' | 'unsupported' | 'uncertain';
export type TrustTone = 'green' | 'amber' | 'red';
export type VerificationStepStatus = 'completed' | 'running' | 'failed' | 'skipped';

export interface VerificationTimelineStep {
  id: string;
  label: string;
  status: VerificationStepStatus;
  summary: string;
}

export interface TrustBreakdownItem {
  id: string;
  label: string;
  value: number | null;
  description: string;
}


export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Math.round(value * 100)}%`;
}


export function getTrustTone(trust: TrustScore | null | undefined): TrustTone {
  const confidence = trust?.confidence ?? 0;
  if (confidence >= 0.8) return 'green';
  if (confidence >= 0.55) return 'amber';
  return 'red';
}


export function getClaimTone(claim: Claim): ClaimStatusTone {
  if (claim.uncertain) return 'uncertain';
  if (claim.criticStatus === 'partial') return 'partial';
  if (claim.supported) return 'verified';
  if (claim.criticStatus === 'unsupported') return 'unsupported';
  return 'uncertain';
}


export function getClaimLabel(claim: Claim): string {
  switch (getClaimTone(claim)) {
    case 'verified':
      return 'Verified';
    case 'partial':
      return 'Partial';
    case 'unsupported':
      return 'Unsupported';
    default:
      return 'Uncertain';
  }
}


export function getSupportRate(claims: Claim[]): number {
  if (claims.length === 0) return 0;
  return claims.filter((claim) => claim.supported).length / claims.length;
}


export function getVerificationPasses(claims: Claim[], debateTurns: DebateTurn[]): number {
  const claimPass = Math.max(0, ...claims.map((claim) => claim.verificationPass || 0));
  const debatePass = Math.max(0, ...debateTurns.map((turn) => turn.round + 1));
  return Math.max(claimPass, debatePass, 1);
}


export function getCitationCoverage(claims: Claim[]): number {
  if (claims.length === 0) return 0;
  return claims.filter((claim) => claim.citationKeys.length > 0).length / claims.length;
}


export function getClaimCoverage(claims: Claim[]): number {
  if (claims.length === 0) return 0;
  return claims.filter((claim) => claim.spanIds.length > 0).length / claims.length;
}


export function getRetrievalConfidence(
  claims: Claim[],
  retrievedEvidence: RetrievalEvidence[],
): number | null {
  if (retrievedEvidence.length === 0 || claims.length === 0) return null;
  const citedChunkIds = new Set(claims.flatMap((claim) => claim.spanIds));
  const citedEvidence = retrievedEvidence.filter((evidence) => citedChunkIds.has(evidence.chunkId));
  const relevantEvidence = citedEvidence.length > 0 ? citedEvidence : retrievedEvidence;
  const scores = relevantEvidence.map((evidence) => evidence.rerankScore ?? evidence.finalScore);
  if (scores.length === 0) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}


export function getCriticConfidence(claims: Claim[]): number | null {
  if (claims.length === 0) return null;
  const values: number[] = claims.map((claim) => {
    if (claim.criticStatus === 'supported') return 1;
    if (claim.criticStatus === 'partial') return 0.6;
    if (claim.criticStatus === 'unsupported') return 0;
    return claim.supported ? 1 : 0.35;
  });
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}


export function getNliConfidence(claims: Claim[]): number | null {
  const values = claims
    .map((claim) => claim.supportProbability ?? claim.entailmentScore ?? null)
    .filter((value): value is number => value != null);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}


export function buildTrustBreakdown(
  trust: TrustScore | null | undefined,
  claims: Claim[],
  retrievedEvidence: RetrievalEvidence[],
): TrustBreakdownItem[] {
  return [
    {
      id: 'retrieval',
      label: 'Retrieval Confidence',
      value: getRetrievalConfidence(claims, retrievedEvidence),
      description: 'Average confidence of the cited retrieval evidence that fed the answer.',
    },
    {
      id: 'critic',
      label: 'Critic Confidence',
      value: getCriticConfidence(claims),
      description: 'How strongly the critic runtime judged the extracted claims as supported.',
    },
    {
      id: 'nli',
      label: 'NLI Confidence',
      value: getNliConfidence(claims),
      description: 'Average entailment support probability from the independent NLI check.',
    },
    {
      id: 'citations',
      label: 'Citation Coverage',
      value: getCitationCoverage(claims),
      description: 'Share of claims that retained explicit citation keys.',
    },
    {
      id: 'claims',
      label: 'Claim Coverage',
      value: getClaimCoverage(claims),
      description: 'Share of claims that remained anchored to stored chunk ids.',
    },
    {
      id: 'calibration',
      label: 'Calibration',
      value: trust?.calibrated ? 1 : 0,
      description: 'Whether the final confidence came from the calibrated runtime trust model.',
    },
    {
      id: 'final',
      label: 'Final Trust Score',
      value: trust?.confidence ?? null,
      description: 'Calibrated answer-level trust score exposed to the user.',
    },
  ];
}


export function buildVerificationTimeline(
  message: Pick<Message, 'claims' | 'debateTurns' | 'trust' | 'abstention' | 'retrievedEvidence'>,
  isStreaming: boolean,
): VerificationTimelineStep[] {
  const claims = message.claims ?? [];
  const debateTurns = message.debateTurns ?? [];
  const hasClaims = claims.length > 0;
  const hasCritic = debateTurns.some((turn) => turn.actor === 'critic');
  const hasRevision = debateTurns.some((turn) => turn.action === 'revise');
  const hasNli = claims.some((claim) => claim.entailmentLabel || claim.supportProbability != null);
  const hasTrust = message.trust != null;
  const hasAbstention = message.abstention != null;

  return [
    {
      id: 'claims',
      label: 'Claim Extraction',
      status: hasClaims ? 'completed' : isStreaming ? 'running' : 'skipped',
      summary: hasClaims ? `${claims.length} claim(s) extracted.` : 'Waiting for claims.',
    },
    {
      id: 'critic',
      label: 'Critic',
      status: hasCritic ? 'completed' : hasClaims && isStreaming ? 'running' : 'skipped',
      summary: hasCritic ? 'Critic verdicts attached to the answer claims.' : 'No critic verdict yet.',
    },
    {
      id: 'nli',
      label: 'NLI',
      status: hasNli ? 'completed' : hasCritic && isStreaming ? 'running' : 'skipped',
      summary: hasNli ? 'Independent entailment checks completed.' : 'NLI results not available yet.',
    },
    {
      id: 'calibration',
      label: 'Calibration',
      status: hasTrust ? 'completed' : hasNli && isStreaming ? 'running' : 'skipped',
      summary: hasTrust ? `Confidence band: ${message.trust?.confidenceBand ?? 'unknown'}.` : 'Awaiting trust score.',
    },
    {
      id: 'trust',
      label: 'Trust',
      status: hasTrust ? 'completed' : isStreaming ? 'running' : 'skipped',
      summary: hasTrust ? `Final trust score ${formatPercent(message.trust?.confidence)}.` : 'Trust not finalized.',
    },
    {
      id: 'final',
      label: 'Finalization',
      status: hasAbstention || hasTrust ? 'completed' : isStreaming ? 'running' : 'skipped',
      summary: hasAbstention ? 'The runtime abstained instead of asserting an unsupported answer.' : 'Verified answer finalized.',
    },
  ];
}


export function buildProvenanceHref(options: {
  workspaceId: string;
  documentId: string;
  claimId?: string | null;
  chunkId?: string | null;
  citationKey?: string | null;
  claimText?: string | null;
  criticStatus?: string | null;
  confidence?: number | null;
  supportProbability?: number | null;
}): string {
  const targetId = options.claimId || options.chunkId || '';
  const params = new URLSearchParams({ workspace: options.workspaceId });
  if (options.citationKey) params.set('citationKey', options.citationKey);
  if (options.claimText) params.set('claimText', options.claimText);
  if (options.criticStatus) params.set('criticStatus', options.criticStatus);
  if (options.confidence != null) params.set('confidence', String(options.confidence));
  if (options.supportProbability != null) params.set('supportProbability', String(options.supportProbability));
  return `/documents/${options.documentId}/provenance/${targetId}?${params.toString()}`;
}


export function getRelatedContradictions(message: Message, contradictions: Contradiction[]): Contradiction[] {
  const relatedDocumentIds = new Set([
    ...message.citations.map((citation) => citation.documentId),
    ...(message.retrievedEvidence ?? []).map((evidence) => evidence.documentId),
  ]);
  return contradictions.filter(
    (contradiction) => relatedDocumentIds.has(contradiction.docA) || relatedDocumentIds.has(contradiction.docB),
  );
}


export function getAbstentionFollowUp(abstention: Abstention | null | undefined): string | null {
  if (!abstention) return null;
  return abstention.suggestedFollowUp ?? abstention.missingEvidenceQuery ?? null;
}
