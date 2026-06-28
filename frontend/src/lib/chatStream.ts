import type { Citation, Message, StreamEvent } from '@/types/clarity';


export interface StreamingAnswerState {
  answerRunId: string | null;
  retrievalRunId: string | null;
  conversationId: string | null;
  assistantMessageId: string | null;
  content: string;
  citations: Citation[];
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
    case 'message':
      return {
        ...state,
        finishedMessage: event.message,
        assistantMessageId: event.message.id,
        content: event.message.content,
        citations: event.message.citations,
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
