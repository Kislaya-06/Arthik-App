/**
 * Faster adding: "repeat a recent entry" (long-press +) and the category picked for you on the Add screen.
 */
import { describe, it, expect } from 'vitest';
import { recentRepeatables, suggestCategoryForNow, QuickAddRow } from '../src/lib/quickAdd';

const row = (id: string, createdAt: string, extra: Partial<QuickAddRow> = {}): QuickAddRow => ({
  id,
  amount: 40,
  expense_date: createdAt.slice(0, 10),
  created_at: createdAt,
  type: 'expense',
  transaction_class: 'normal',
  category_id: 'food',
  payment_mode: 'cash',
  note: 'Chai',
  ...extra,
});

describe('recentRepeatables', () => {
  it('newest plain spends first, one per (place, category, amount), at most 3', () => {
    const rows = [
      row('a', '2026-11-20T09:00:00'),
      row('b', '2026-11-24T09:00:00'), // same Chai 40 as a, newer
      row('c', '2026-11-23T13:00:00', { note: 'Swiggy', amount: 399 }),
      row('d', '2026-11-22T13:00:00', { note: 'Metro', amount: 30, category_id: 'transport' }),
      row('e', '2026-11-21T13:00:00', { note: 'Uber', amount: 120, category_id: 'transport' }),
    ];
    expect(recentRepeatables(rows).map((r) => r.id)).toEqual(['b', 'c', 'd']);
  });

  it('never offers income, money back, transfers or split expenses', () => {
    const rows = [
      row('inc', '2026-11-24T10:00:00', { type: 'income', note: 'Salary' }),
      row('back', '2026-11-24T11:00:00', { type: 'income', transaction_class: 'recovery', note: 'Rahul' }),
      row('move', '2026-11-24T12:00:00', { transaction_class: 'self_transfer', note: 'To savings' }),
      row('split', '2026-11-24T13:00:00', { note: 'Pizza', split_person: 'Neha', split_amount: 300 }),
      row('ok', '2026-11-20T13:00:00'),
    ];
    expect(recentRepeatables(rows).map((r) => r.id)).toEqual(['ok']);
  });

  it('offers the amount PAID when part of it came back (SPL-003)', () => {
    const [r] = recentRepeatables([row('x', '2026-11-24T10:00:00', { amount: 2000, gross_amount: 2499, note: 'Amazon' })]);
    expect(r.amount).toBe(2499);
  });
});

describe('suggestCategoryForNow', () => {
  const now = new Date('2026-11-25T09:30:00'); // morning
  const morningChai = (d: number) => row(`m${d}`, `2026-11-${String(d).padStart(2, '0')}T08:30:00`);

  it('picks the category you mostly use at this time of day', () => {
    const rows = [morningChai(20), morningChai(21), morningChai(22), row('t', '2026-11-23T08:00:00', { category_id: 'transport' })];
    expect(suggestCategoryForNow(rows, now)).toBe('food');
  });

  it('no pick with fewer than 3 entries at this time, or no clear favourite', () => {
    expect(suggestCategoryForNow([morningChai(20), morningChai(21)], now)).toBeNull();
    const tie = [
      morningChai(20), morningChai(21),
      row('t1', '2026-11-22T08:00:00', { category_id: 'transport' }),
      row('t2', '2026-11-23T08:00:00', { category_id: 'transport' }),
    ];
    expect(suggestCategoryForNow(tie, now)).toBeNull();
  });

  it('ignores other times of day, entries added on a later day and anything older than 60 days', () => {
    const rows = [
      row('n1', '2026-11-20T22:00:00'), row('n2', '2026-11-21T22:00:00'), row('n3', '2026-11-22T22:00:00'), // night
      row('late1', '2026-11-21T08:00:00', { expense_date: '2026-11-20' }),
      row('late2', '2026-11-22T08:00:00', { expense_date: '2026-11-21' }),
      row('old1', '2026-08-01T08:00:00'), row('old2', '2026-08-02T08:00:00'), row('old3', '2026-08-03T08:00:00'),
    ];
    expect(suggestCategoryForNow(rows, now)).toBeNull();
  });
});
