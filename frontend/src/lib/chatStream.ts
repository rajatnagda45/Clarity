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
      return {
        ...state,
        claims: [...state.claims.filter((claim) => claim.id !== event.claim.id), event.claim],
      };
    case 'debate_turn':
      return {
        ...state,
        debateTurns: [...state.debateTurns, {
          round: event.round,
          actor: event.actor,
          action: event.action,
          claimId: event.claimId,
          createdAt: null,
          note: event.note,
        }],
      };
    case 'trust':
      return {
        ...state,
        trust: event.score,
      };
    case 'abstention':
      return {
        ...state,
        abstention: {
          reason: event.reason,
          missingEvidenceQuery: event.missingEvidenceQuery,
          suggestedFollowUp: event.suggestedFollowUp,
        },
        trust: event.trust ?? state.trust,
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
        claims: event.message.claims,
        retrievedEvidence: event.message.retrievedEvidence,
        trust: event.message.trust ?? null,
        abstention: event.message.abstention ?? null,
        debateTurns: event.message.debateTurns,
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
