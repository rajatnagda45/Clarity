'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
  listDocuments,
  listConversations,
  getDeveloperDashboard,
  getEmbeddingMetrics,
  getAnswerMetrics,
  getEvalMetrics,
} from '@/lib/api';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type {
  Conversation,
  Document,
  DeveloperDashboard,
  EmbeddingMetrics,
  AnswerMetrics,
  EvalMetrics,
} from '@/types/clarity';

export interface DashboardData {
  documents: Document[];
  conversations: Conversation[];
  devDashboard: DeveloperDashboard | null;
  embeddingMetrics: EmbeddingMetrics | null;
  answerMetrics: AnswerMetrics | null;
  evalMetrics: EvalMetrics | null;
}

export interface DashboardLoadState {
  data: DashboardData;
  isLoading: boolean;
  errors: Record<string, string>;
  refresh: () => void;
}

const EMPTY: DashboardData = {
  documents: [],
  conversations: [],
  devDashboard: null,
  embeddingMetrics: null,
  answerMetrics: null,
  evalMetrics: null,
};

export function useDashboardData(): DashboardLoadState {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const abortRef = useRef<AbortController | null>(null);
  const hasFetched = useRef(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsLoading(true);
    setErrors({});

    try {
      const token = await getToken();
      if (!token) return;

      const auth = { token, workspaceId: activeWorkspace.id };

      // Fetch all data in parallel, isolating failures per source
      const [docsResult, convsResult, devResult, embResult, ansResult, evalResult] =
        await Promise.allSettled([
          listDocuments(auth),
          listConversations(auth),
          getDeveloperDashboard(auth),
          getEmbeddingMetrics(auth),
          getAnswerMetrics(auth),
          getEvalMetrics(auth, 'golden'),
        ]);

      const errs: Record<string, string> = {};

      setData({
        documents:
          docsResult.status === 'fulfilled'
            ? docsResult.value
            : (errs.documents = docsResult.reason?.message ?? 'Failed to load documents', []),
        conversations:
          convsResult.status === 'fulfilled'
            ? convsResult.value
            : (errs.conversations = convsResult.reason?.message ?? 'Failed', []),
        devDashboard:
          devResult.status === 'fulfilled' ? devResult.value : (errs.dev = devResult.reason?.message ?? 'Failed', null),
        embeddingMetrics:
          embResult.status === 'fulfilled' ? embResult.value : (errs.embeddings = embResult.reason?.message ?? 'Failed', null),
        answerMetrics:
          ansResult.status === 'fulfilled' ? ansResult.value : (errs.answers = ansResult.reason?.message ?? 'Failed', null),
        evalMetrics:
          evalResult.status === 'fulfilled' && Array.isArray(evalResult.value) && evalResult.value.length > 0
            ? evalResult.value[0]
            : null,
      });
      setErrors(errs);
    } finally {
      setIsLoading(false);
    }
  }, [getToken, activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace && !hasFetched.current) {
      hasFetched.current = true;
      void load();
    }
  }, [activeWorkspace, load]);

  // Reset hasFetched when workspace changes
  useEffect(() => {
    hasFetched.current = false;
  }, [activeWorkspace?.id]);

  return { data, isLoading, errors, refresh: load };
}
