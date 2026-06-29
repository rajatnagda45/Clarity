import type {
  Abstention,
  Citation,
  Claim,
  DebateTurn,
  Message,
  RetrievalEvidence,
  RetrievalNormalizedQuery,
  StreamEvent,
  TrustScore,
} from '@/types/clarity';


export interface StreamingAnswerState {
  answerRunId: string | null;
  retrievalRunId: string | null;
  conversationId: string | null;
  assistantMessageId: string | null;
  content: string;
  citations: Citation[];
  claims: Claim[];
  retrievedEvidence: RetrievalEvidence[];
  trust: TrustScore | null;
  abstention: Abstention | null;
  debateTurns: DebateTurn[];
  normalizedQuery: RetrievalNormalizedQuery | null;
  retrievalResultCount: number;
  finishedMessage: Message | null;
  lastSequence: number;
  errorMessage: string | null;
}


export function createStreamingAnswerState(): StreamingAnswerState {
  return {
    answerRunId: null,
    retrievalRunId: null,
    conversationId: null,
    assistantMessageId: null,
    content: '',
    citations: [],
    claims: [],
    retrievedEvidence: [],
    trust: null,
    abstention: null,
    debateTurns: [],
    normalizedQuery: null,
    retrievalResultCount: 0,
    finishedMessage: null,
    lastSequence: 0,
    errorMessage: null,
  };
}


export function applyStreamEvent(
  state: StreamingAnswerState,
  event: StreamEvent,
): StreamingAnswerState {
  switch (event.type) {
    case 'meta':
      return {
        ...state,
        conversationId: event.conversationId,
        answerRunId: event.answerRunId,
        retrievalRunId: event.retrievalRunId,
        assistantMessageId: event.assistantMessageId ?? state.assistantMessageId,
      };
    case 'token':
      return {
        ...state,
        content: `${state.content}${event.text}`,
      };
    case 'citation':
      return {
        ...state,
        citations: [...state.citations, event.citation],
      };
    case 'claim':
      // RC2: claim is a string; full Claim objects arrive via the 'message' event from DB
      return state;
    case 'debate_turn':
      // RC2: {turn, claim, verdict, reasoning}; page.tsx manages streamingDebateTurns separately
      return state;
    case 'trust':
      // RC2: {raw, calibrated, components}
      return {
        ...state,
        trust: {
          faithfulness: event.calibrated,
          relevance: null,
          overall: event.raw,
          confidence: event.calibrated,
          calibrated: true,
          confidenceBand: event.calibrated >= 0.80 ? 'high' : event.calibrated >= 0.60 ? 'medium' : 'low',
        } satisfies TrustScore,
      };
    case 'abstention':
      // RC2: {reason, trustScore, threshold, missingEvidenceQuery?}
      return {
        ...state,
        abstention: {
          reason: event.reason,
          missingEvidenceQuery: event.missingEvidenceQuery ?? null,
          suggestedFollowUp: null,
        },
      };
    case 'retrieval':
      return {
        ...state,
        normalizedQuery: event.normalizedQuery,
        retrievalResultCount: event.resultCount,
      };
    case 'message':
      return {
        ...state,
        finishedMessage: event.message,
        assistantMessageId: event.message.id,
        content: event.message.content,
        citations: event.message.citations,
        claims: event.message.claims ?? [],
        retrievedEvidence: event.message.retrievedEvidence ?? [],
        trust: event.message.trust ?? null,
        abstention: event.message.abstention ?? null,
        debateTurns: event.message.debateTurns ?? [],
      };
    case 'error':
      return {
        ...state,
        errorMessage: event.message,
      };
    default:
      return state;
  }
}
