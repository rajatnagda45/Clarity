'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  openDocumentEventStream,
  type PipelineEvent,
  type SSEMessage,
} from '@/lib/documentEvents';
import {
  DocumentEventsContext,
} from '@/hooks/useDocumentEvents';
import type { Document, DocumentStatus } from '@/types/clarity';

const TERMINAL = new Set<string>(['indexed', 'failed']);

export function DocumentEventsProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  const cancelRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayRef = useRef(1_000);

  useEffect(() => {
    if (!activeWorkspace) return;
    const workspaceId = activeWorkspace.id;
    let active = true;

    const connect = async () => {
      if (!active) return;
      const token = await getToken();
      if (!token || !active) return;

      cancelRef.current = openDocumentEventStream(workspaceId, token, {
        onEvent(msg: SSEMessage) {
          if (!active) return;

          // History replay frame → derive the most recent event per document
          // and patch the cached document list with those statuses
          if ('type' in msg && msg.type === 'history') {
            const history = (msg as { type: 'history'; events: PipelineEvent[] }).events;
            // Most recent event per document_id (array is newest-last from backend)
            const latest = new Map<string, PipelineEvent>();
            for (const ev of history) {
              latest.set(ev.document_id, ev);
            }
            if (latest.size > 0) {
              queryClient.setQueryData(
                ['documents', workspaceId],
                (old: Document[] | undefined) => {
                  if (!old) return old;
                  return old.map((doc) => {
                    const ev = latest.get(doc.id);
                    return ev ? { ...doc, status: ev.status as DocumentStatus } : doc;
                  });
                },
              );
            }
            return;
          }

          // Connected snapshot → refresh the full document list once
          if ('type' in msg && msg.type === 'connected') {
            queryClient.invalidateQueries({
              queryKey: ['documents', workspaceId],
            });
            return;
          }

          const ev = msg as PipelineEvent;

          // Optimistically patch the cached document list in place
          queryClient.setQueryData(
            ['documents', workspaceId],
            (old: Document[] | undefined) => {
              if (!old) return old;
              return old.map((doc) =>
                doc.id === ev.document_id
                  ? { ...doc, status: ev.status as DocumentStatus }
                  : doc,
              );
            },
          );

          // On completion or failure, refresh aggregate metrics so dashboards
          // and the developer console reflect the final state immediately
          if (TERMINAL.has(ev.status)) {
            queryClient.invalidateQueries({
              queryKey: ['dev-dashboard', workspaceId],
            });
            queryClient.invalidateQueries({
              queryKey: ['answer-metrics', workspaceId],
            });
            queryClient.invalidateQueries({
              queryKey: ['embedding-metrics', workspaceId],
            });
            queryClient.invalidateQueries({ queryKey: ['live-metrics'] });
          }
        },

        onConnect() {
          if (!active) return;
          setConnected(true);
          delayRef.current = 1_000;
        },

        onDisconnect() {
          if (!active) return;
          setConnected(false);
          // Exponential backoff reconnect: 1s → 2s → 4s → … → 30s
          timerRef.current = setTimeout(() => {
            delayRef.current = Math.min(delayRef.current * 2, 30_000);
            connect();
          }, delayRef.current);
        },
      });
    };

    connect();

    return () => {
      active = false;
      cancelRef.current?.();
      cancelRef.current = null;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setConnected(false);
    };
  }, [activeWorkspace?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <DocumentEventsContext.Provider value={{ connected }}>
      {children}
    </DocumentEventsContext.Provider>
  );
}
