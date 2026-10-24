import { describe, it, expect } from 'vitest';
import { sameExpenseList } from '../src/lib/expenseListEquality';
import type { Expense } from '../src/store/expense/types';

const base = (id: string, extra: Record<string, unknown> = {}): Expense =>
  ({
    id,
    user_id: 'u1',
    amount: 100,
    expense_date: '2026-10-01',
    payment_mode: 'upi',
    type: 'expense',
    ...extra,
  }) as unknown as Expense;

describe('OPT-20: sameExpenseList', () => {
  it('is true for the very same array', () => {
    const a = [base('a')];
    expect(sameExpenseList(a, a)).toBe(true);
  });

  it('is true for two equal lists with different object identities', () => {
    expect(sameExpenseList([base('a'), base('b')], [base('a'), base('b')])).toBe(true);
  });

  it('is true for two empty lists', () => {
    expect(sameExpenseList([], [])).toBe(true);
  });

  it('is false when one field changed', () => {
    expect(sameExpenseList([base('a')], [base('a', { amount: 101 })])).toBe(false);
  });

  it('is false when a row is added or removed', () => {
    expect(sameExpenseList([base('a')], [base('a'), base('b')])).toBe(false);
    expect(sameExpenseList([base('a'), base('b')], [base('a')])).toBe(false);
  });

  it('is false when the order changed', () => {
    expect(sameExpenseList([base('a'), base('b')], [base('b'), base('a')])).toBe(false);
  });

  it('is false when a key exists on one side only', () => {
    expect(sameExpenseList([base('a')], [base('a', { note: 'x' })])).toBe(false);
    expect(sameExpenseList([base('a', { note: 'x' })], [base('a')])).toBe(false);
  });

  it('compares nested split_allocations by value', () => {
    const one = base('a', { split_allocations: [{ person: 'p1', share: 50 }] });
    const same = base('a', { split_allocations: [{ person: 'p1', share: 50 }] });
    const changed = base('a', { split_allocations: [{ person: 'p1', share: 60 }] });
    expect(sameExpenseList([one], [same])).toBe(true);
    expect(sameExpenseList([one], [changed])).toBe(false);
  });

  it('treats null vs a value as different', () => {
    expect(sameExpenseList([base('a', { note: null })], [base('a', { note: 'x' })])).toBe(false);
  });
});
