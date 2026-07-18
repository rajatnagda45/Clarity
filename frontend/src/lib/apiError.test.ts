import { describe, it, expect } from 'vitest';
import { ApiError, isApiError, toApiError } from './apiError';

describe('ApiError', () => {
  it('captures status, code, message, hint', () => {
    const e = new ApiError({ status: 401, code: 'unauthorized', message: 'No token' });
    expect(e.status).toBe(401);
    expect(e.code).toBe('unauthorized');
    expect(e.message).toBe('No token');
    expect(e.hint).toContain('sign in');
  });

  it('uses default hint for known status codes', () => {
    expect(new ApiError({ status: 403, code: 'x', message: 'x' }).hint).toContain('permission');
    expect(new ApiError({ status: 404, code: 'x', message: 'x' }).hint).toContain('not found');
    expect(new ApiError({ status: 422, code: 'x', message: 'x' }).hint).toContain('invalid');
    expect(new ApiError({ status: 429, code: 'x', message: 'x' }).hint).toContain('Too many');
    expect(new ApiError({ status: 500, code: 'x', message: 'x' }).hint).toContain('server');
  });

  it('isRetryable returns true for 429, 5xx, network_error', () => {
    expect(new ApiError({ status: 429, code: 'x', message: 'x' }).isRetryable()).toBe(true);
    expect(new ApiError({ status: 503, code: 'x', message: 'x' }).isRetryable()).toBe(true);
    expect(new ApiError({ status: 0, code: 'network_error', message: 'x' }).isRetryable()).toBe(true);
    expect(new ApiError({ status: 404, code: 'x', message: 'x' }).isRetryable()).toBe(false);
    expect(new ApiError({ status: 422, code: 'x', message: 'x' }).isRetryable()).toBe(false);
  });

  it('captures retryAfter', () => {
    const e = new ApiError({ status: 429, code: 'rl', message: 'm', retryAfter: 60 });
    expect(e.retryAfter).toBe(60);
  });
});

describe('isApiError', () => {
  it('returns true for ApiError', () => {
    const e = new ApiError({ status: 500, code: 'x', message: 'x' });
    expect(isApiError(e)).toBe(true);
  });
  it('returns false for plain Error', () => {
    expect(isApiError(new Error('x'))).toBe(false);
  });
  it('returns false for non-error', () => {
    expect(isApiError('string')).toBe(false);
    expect(isApiError(null)).toBe(false);
    expect(isApiError(undefined)).toBe(false);
  });
});

describe('toApiError', () => {
  it('passes ApiError through', () => {
    const e = new ApiError({ status: 401, code: 'x', message: 'x' });
    expect(toApiError(e)).toBe(e);
  });
  it('wraps network TypeError as network_error', () => {
    const err = new TypeError('fetch failed');
    const out = toApiError(err);
    expect(out.status).toBe(0);
    expect(out.code).toBe('network_error');
  });
  it('wraps plain Error', () => {
    const out = toApiError(new Error('boom'));
    expect(out.status).toBe(0);
    expect(out.message).toBe('boom');
  });
  it('wraps unknown', () => {
    const out = toApiError('oops');
    expect(out.status).toBe(0);
    expect(out.message).toBe('oops');
  });
});
