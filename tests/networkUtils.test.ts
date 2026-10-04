import { describe, it, expect } from 'vitest';
import { isNetworkFailure, withTimeout } from '../src/lib/networkUtils';

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

  it('detects network request timeout errors', () => {
    expect(isNetworkFailure(new Error('Network request failed: timeout'))).toBe(true);
    expect(isNetworkFailure({ message: 'Request timed out' })).toBe(true);
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

describe('networkUtils (Seam: withTimeout)', () => {
  it('resolves immediately when promise completes before timeout', async () => {
    const fastPromise = new Promise<string>((resolve) => setTimeout(() => resolve('success'), 10));
    const res = await withTimeout(fastPromise, 500);
    expect(res).toBe('success');
  });

  it('rejects when wrapped promise rejects before timeout', async () => {
    const failingPromise = new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Fetch failed')), 10));
    await expect(withTimeout(failingPromise, 500)).rejects.toThrow('Fetch failed');
  });

  it('resolves with fallback value when timeout occurs and fallback object is provided', async () => {
    const hangingPromise = new Promise<{ data: string | null; error: any }>(() => {});
    const fallback = { data: null, error: new Error('Custom timeout error') };
    const res = await withTimeout(hangingPromise, 20, fallback);
    expect(res).toEqual(fallback);
  });

  it('rejects with custom error message string on timeout', async () => {
    const hangingPromise = new Promise<string>(() => {});
    await expect(withTimeout(hangingPromise, 20, 'Version check timed out')).rejects.toThrow('Version check timed out');
  });

  it('rejects with custom Error instance on timeout', async () => {
    const hangingPromise = new Promise<string>(() => {});
    await expect(withTimeout(hangingPromise, 20, new Error('Custom error object'))).rejects.toThrow('Custom error object');
  });

  it('rejects with default message on timeout when no fallback provided', async () => {
    const hangingPromise = new Promise<string>(() => {});
    await expect(withTimeout(hangingPromise, 20)).rejects.toThrow('Operation timed out');
  });
});
