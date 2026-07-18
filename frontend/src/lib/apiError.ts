/**
 * ApiError — typed error with status, code, and actionable hint.
 *
 * Replaces the plain `Error` thrown by the apiFetch wrapper. Callers can
 * inspect `e.status` to render targeted recovery UI (sign in, switch
 * workspace, wait + retry, etc.).
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly hint: string;
  public readonly retryAfter: number | null;
  public readonly payload: unknown;

  constructor(args: {
    status: number;
    code: string;
    message: string;
    hint?: string;
    retryAfter?: number | null;
    payload?: unknown;
  }) {
    super(args.message);
    this.name = 'ApiError';
    this.status = args.status;
    this.code = args.code;
    this.hint = args.hint ?? ApiError.defaultHint(args.status, args.code);
    this.retryAfter = args.retryAfter ?? null;
    this.payload = args.payload;
  }

  static defaultHint(status: number, code: string): string {
    if (status === 401) return 'Please sign in again.';
    if (status === 403) return 'You do not have permission for this action.';
    if (status === 404) return 'The resource was not found. It may have been deleted.';
    if (status === 409) return 'A conflict occurred. Refresh and try again.';
    if (status === 422) return 'The request was invalid. Check the form values.';
    if (status === 429) return 'Too many requests. Please slow down.';
    if (status >= 500) return 'The server encountered an error. Try again in a moment.';
    if (code === 'network_error') return 'Network unreachable. Check your connection.';
    return 'Something went wrong. Please try again.';
  }

  /** Whether the operation is safe to retry automatically. */
  isRetryable(): boolean {
    return this.status === 429 || this.status >= 500 || this.code === 'network_error';
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/**
 * Normalize any thrown value into an ApiError. Useful at the boundary
 * (React Query onError) so UI code can always read `e.status`, `e.code`,
 * `e.hint`, `e.isRetryable()`.
 */
export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof Error) {
    // Network failure (fetch throw, no response)
    if (e.name === 'TypeError' && /fetch|network/i.test(e.message)) {
      return new ApiError({
        status: 0,
        code: 'network_error',
        message: 'Network unreachable',
        hint: 'Network unreachable. Check your connection.',
      });
    }
    return new ApiError({
      status: 0,
      code: 'unknown_error',
      message: e.message || 'Unknown error',
    });
  }
  return new ApiError({ status: 0, code: 'unknown_error', message: String(e) });
}
