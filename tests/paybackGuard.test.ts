import { describe, it, expect } from 'vitest';
import { shouldHoldCreditForPayback } from '../src/features/autoLog/paybackGuard';

const base = { direction: 'credit' as const, prefType: 'income', creditKind: 'person' as const, hasOwingMatch: true };

describe('shouldHoldCreditForPayback (SPL-005: remembered income must not swallow a payback)', () => {
  it('remembered income from a person who owes money → hold for review', () => {
    expect(shouldHoldCreditForPayback(base)).toBe(true);
    expect(shouldHoldCreditForPayback({ ...base, creditKind: 'other' })).toBe(true);
    expect(shouldHoldCreditForPayback({ ...base, creditKind: undefined })).toBe(true);
  });

  it('remembered income from someone who owes nothing → stays automatic', () => {
    expect(shouldHoldCreditForPayback({ ...base, hasOwingMatch: false })).toBe(false);
  });

  it('salary, interest and refund credits keep their automatic behaviour', () => {
    for (const creditKind of ['salary', 'interest', 'refund'] as const) {
      expect(shouldHoldCreditForPayback({ ...base, creditKind })).toBe(false);
    }
  });

  it('only a REMEMBERED income is held: no preference, expense preference or transfer preference are untouched', () => {
    expect(shouldHoldCreditForPayback({ ...base, prefType: null })).toBe(false);
    expect(shouldHoldCreditForPayback({ ...base, prefType: undefined })).toBe(false);
    expect(shouldHoldCreditForPayback({ ...base, prefType: 'expense' })).toBe(false);
    expect(shouldHoldCreditForPayback({ ...base, prefType: 'transfer' })).toBe(false);
  });

  it('debits are never held', () => {
    expect(shouldHoldCreditForPayback({ ...base, direction: 'debit' })).toBe(false);
    expect(shouldHoldCreditForPayback({ ...base, direction: null })).toBe(false);
  });
});
