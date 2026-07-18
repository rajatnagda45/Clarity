'use client';

/**
 * ApiErrorView — actionable error recovery UI.
 *
 * Renders a status-coded message, an actionable hint, and a retry button
 * (when safe). Use this anywhere an `ApiError` is surfaced.
 */
import { useState, useCallback } from 'react';
import { AlertCircle, RefreshCw, ExternalLink, LogIn, Building2 } from 'lucide-react';
import { ApiError, isApiError, toApiError } from '@/lib/apiError';
import { cn } from '@/lib/cn';

interface ApiErrorViewProps {
  error: unknown;
  onRetry?: () => void;
  onSignIn?: () => void;
  onSwitchWorkspace?: () => void;
  className?: string;
  title?: string;
  compact?: boolean;
}

export function ApiErrorView({
  error,
  onRetry,
  onSignIn,
  onSwitchWorkspace,
  className,
  title,
  compact = false,
}: ApiErrorViewProps) {
  const e = toApiError(error);
  const Icon = statusIcon(e.status);
  const colorClass = statusColor(e.status);

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border p-4',
        colorClass,
        compact ? 'text-xs' : 'text-sm',
        className,
      )}
    >
      <Icon className={cn('shrink-0', compact ? 'h-3.5 w-3.5 mt-0.5' : 'h-5 w-5 mt-0.5')} />
      <div className="flex-1 min-w-0">
        <div className={cn('font-semibold text-fg-primary', compact ? 'text-xs' : 'text-sm')}>
          {title ?? e.message}
        </div>
        <div className="mt-1 text-xs text-fg-muted leading-relaxed">{e.hint}</div>
        {e.retryAfter !== null && (
          <div className="mt-1 text-[10px] font-mono uppercase tracking-wider text-fg-muted">
            Retry after {e.retryAfter}s
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {e.isRetryable() && onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-fg-primary hover:bg-white/[0.1] transition-colors"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          )}
          {e.status === 401 && onSignIn && (
            <button
              onClick={onSignIn}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-500/15 px-2.5 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-500/25 transition-colors"
            >
              <LogIn className="h-3 w-3" /> Sign in
            </button>
          )}
          {e.code === 'no_workspace' && onSwitchWorkspace && (
            <button
              onClick={onSwitchWorkspace}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/15 px-2.5 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/25 transition-colors"
            >
              <Building2 className="h-3 w-3" /> Switch workspace
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function statusIcon(status: number) {
  if (status === 0) return AlertCircle;
  if (status === 401 || status === 403) return LogIn;
  if (status === 429) return RefreshCw;
  return AlertCircle;
}

function statusColor(status: number): string {
  if (status === 0) return 'border-amber-500/30 bg-amber-500/5 text-amber-400';
  if (status === 401) return 'border-amber-500/30 bg-amber-500/5 text-amber-400';
  if (status === 403) return 'border-red-500/30 bg-red-500/5 text-red-400';
  if (status === 404) return 'border-blue-500/30 bg-blue-500/5 text-blue-400';
  if (status === 409) return 'border-amber-500/30 bg-amber-500/5 text-amber-400';
  if (status === 422) return 'border-amber-500/30 bg-amber-500/5 text-amber-400';
  if (status === 429) return 'border-amber-500/30 bg-amber-500/5 text-amber-400';
  if (status >= 500) return 'border-red-500/30 bg-red-500/5 text-red-400';
  return 'border-white/[0.08] bg-white/[0.02] text-fg-secondary';
}

/**
 * Inline error banner — narrower version for list-page empty states.
 */
export function ErrorBanner({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const e = toApiError(error);
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs',
        statusColor(e.status),
        className,
      )}
    >
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 truncate">{e.message}</span>
      {e.isRetryable() && onRetry && (
        <button
          onClick={onRetry}
          className="rounded p-1 hover:bg-white/[0.06] transition-colors"
          title="Retry"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
