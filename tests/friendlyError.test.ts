import { describe, it, expect } from 'vitest';
import { toFriendlyMessage } from '../src/lib/friendlyError';

const FALLBACK = 'Could not save. Please try again.';

describe('toFriendlyMessage', () => {
  it('maps network failures to one offline line', () => {
    expect(toFriendlyMessage(new Error('Network request failed'), FALLBACK)).toMatch(/No internet/);
    expect(toFriendlyMessage({ name: 'AbortError', message: 'aborted' }, FALLBACK)).toMatch(/No internet/);
    expect(toFriendlyMessage({ message: 'x', status: 503 }, FALLBACK)).toMatch(/No internet/);
  });
  it('hides database and code errors', () => {
    expect(toFriendlyMessage(new Error('new row violates row-level security policy for table "expenses"'), FALLBACK)).toBe(FALLBACK);
    expect(toFriendlyMessage(new Error('duplicate key value violates unique constraint'), FALLBACK)).toBe(FALLBACK);
    expect(toFriendlyMessage(new TypeError("Cannot read property 'id' of undefined"), FALLBACK)).toBe(FALLBACK);
    expect(toFriendlyMessage(new Error('{"code":"23505"}'), FALLBACK)).toBe(FALLBACK);
  });
  it('keeps short messages written for people', () => {
    expect(toFriendlyMessage(new Error('Could not log this payment. Please try again.'), FALLBACK)).toBe('Could not log this payment. Please try again.');
  });
  it('uses the fallback for empty, long or unknown values', () => {
    expect(toFriendlyMessage(undefined, FALLBACK)).toBe(FALLBACK);
    expect(toFriendlyMessage(new Error(''), FALLBACK)).toBe(FALLBACK);
    expect(toFriendlyMessage(new Error('a'.repeat(200)), FALLBACK)).toBe(FALLBACK);
  });
});
