import { describe, it, expect } from 'vitest';
import { isNetworkFailure } from '../src/lib/networkUtils';

describe('networkUtils (Seam: isNetworkFailure)', () => {
  it('returns false for null or undefined error', () => {
    expect(isNetworkFailure(null)).toBe(false);
    expect(isNetworkFailure(undefined)).toBe(false);
  });

  it('detects AbortError or aborted message', () => {
    expect(isNetworkFailure({ name: 'AbortError' })).toBe(true);
    expect(isNetworkFailure({ message: 'The user aborted a request.' })).toBe(true);
  });

  it('detects Supabase AuthRetryableFetchError', () => {
    expect(isNetworkFailure({ name: 'AuthRetryableFetchError' })).toBe(true);
    expect(isNetworkFailure({ __isAuthRetryableFetchError: true })).toBe(true);
  });

  it('detects TypeError network request failed', () => {
    expect(isNetworkFailure({ name: 'TypeError', message: 'Network request failed' })).toBe(true);
  });

  it('detects status 0 or 5xx server errors', () => {
    expect(isNetworkFailure({ status: 0 })).toBe(true);
    expect(isNetworkFailure({ statusCode: 500 })).toBe(true);
    expect(isNetworkFailure({ status: 502 })).toBe(true);
    expect(isNetworkFailure({ code: '503' })).toBe(true);
  });

  it('returns false for standard client 4xx errors', () => {
    expect(isNetworkFailure({ status: 400, message: 'check constraint failed' })).toBe(false);
    expect(isNetworkFailure({ status: 404, message: 'Not found' })).toBe(false);
    expect(isNetworkFailure({ status: 401, message: 'Unauthorized' })).toBe(false);
  });
});
