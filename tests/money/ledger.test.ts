import { describe, it, expect } from 'vitest';
import {
  buildLedgerEntries,
  spendingTotalsByDateKey,
  incomeTotalsByDateKey,
  sumTotalsBetweenDateKeys,
  sumSpendingBetweenDateKeys,
  sumCountedSpending,
} from '../../src/money/ledger';
import { classifyTransaction, isCountedExpense, isCountedIncome } from '../../src/lib/transactionUtils';

const row = (id: string, amount: number, expense_date: string, extra: Record<string, unknown> = {}) => ({
  id,
  amount,
  expense_date,
  type: 'expense',
  ...extra,
});

describe('classifyTransaction (one answer per row)', () => {
  it('spending, income, moneyBack, selfTransfer', () => {
    expect(classifyTransaction({ type: 'expense' })).toBe('spending');
    expect(classifyTransaction({ type: 'income' })).toBe('income');
    expect(classifyTransaction({ type: 'income', transaction_class: 'recovery' })).toBe('moneyBack');
    expect(classifyTransaction({ type: 'expense', transaction_class: 'self_transfer' })).toBe('selfTransfer');
    expect(classifyTransaction({ type: 'income', transaction_class: 'self_transfer' })).toBe('selfTransfer');
  });

  it('the old helpers say exactly the same thing', () => {
    const samples = [
      { type: 'expense' },
      { type: 'income' },
      { type: 'income', transaction_class: 'recovery' },
      { type: 'expense', transaction_class: 'self_transfer' },
      { type: 'income', transaction_class: 'self_transfer' },
      { type: 'expense', transaction_class: 'reimbursement' },
    ];
    for (const sample of samples) {
      const kind = classifyTransaction(sample);
      expect(isCountedExpense(sample)).toBe(kind === 'spending');
      expect(isCountedIncome(sample)).toBe(kind === 'income');
    }
  });
});

describe('src/money/ledger', () => {
  const rows = [
    row('a', 400, '2026-10-01'),
    row('b', 250.55, '2026-10-02T09:00:00Z'),
    row('c', 5000, '2026-10-02', { type: 'income' }),
    row('d', 1000, '2026-10-03', { transaction_class: 'self_transfer' }),
    row('e', 0.1, '2026-10-06'),
    row('f', 0.2, '2026-10-06'),
    row('g', 100, '2026-10-06', { type: 'income', transaction_class: 'recovery' }),
    row('h', 900, '2026-10-10'),
    row('i', 50, '', {}),
  ];

  it('cleans each row once: kind, date key, both amounts', () => {
    const entries = buildLedgerEntries(rows, []);
    expect(entries[1]).toMatchObject({ transactionId: 'b', dateKey: '2026-10-02', kind: 'spending', amountPaid: 250.55 });
    expect(entries[2].kind).toBe('income');
    expect(entries[3].kind).toBe('selfTransfer');
    expect(entries[6].kind).toBe('moneyBack');
    expect(entries[8].dateKey).toBe('');
  });

  it('keeps the amount PAID and the amount COUNTED apart (SPL-003)', () => {
    // Paid 1000 for a group dinner; a friend paid back 600, so only 400 counts as my spending.
    const [entry] = buildLedgerEntries([{ id: 'dinner', amount: 400, gross_amount: 1000, expense_date: '2026-10-04', type: 'expense' }], []);
    expect(entry.amountPaid).toBe(1000);
    expect(entry.amountCountedAfterMoneyBack).toBe(400);
  });

  it('spending per day ignores income, money back, self transfers and rows without a date; no float drift', () => {
    const spending = spendingTotalsByDateKey(buildLedgerEntries(rows, []));
    expect(spending).toEqual({
      '2026-10-01': 400,
      '2026-10-02': 250.55,
      '2026-10-06': 0.3, // 0.1 + 0.2 is 0.30000000000000004 without rounding
      '2026-10-10': 900,
    });
  });

  it('income per day counts only real income; a zero or negative amount adds nothing', () => {
    const income = incomeTotalsByDateKey(
      buildLedgerEntries([...rows, row('neg', -30, '2026-10-02', { type: 'income' })], [])
    );
    expect(income).toEqual({ '2026-10-02': 5000 });
  });

  it('sums a date range with both ends included', () => {
    const spending = spendingTotalsByDateKey(buildLedgerEntries(rows, []));
    expect(sumTotalsBetweenDateKeys(spending, '2026-10-02', '2026-10-06')).toBe(250.85);
    expect(sumTotalsBetweenDateKeys(spending, '2026-11-01', '2026-11-30')).toBe(0);
  });

  it('sumSpendingBetweenDateKeys gives the same number as summing the per-day totals', () => {
    const spending = spendingTotalsByDateKey(buildLedgerEntries(rows, []));
    expect(sumSpendingBetweenDateKeys(rows, [], '2026-10-01', '2026-10-31')).toBe(
      sumTotalsBetweenDateKeys(spending, '2026-10-01', '2026-10-31')
    );
    expect(sumSpendingBetweenDateKeys(rows, [], '2026-10-01', '2026-10-31')).toBe(1550.85);
  });

  it('sumCountedSpending adds only spending rows, whatever their dates', () => {
    expect(sumCountedSpending(rows, [])).toBe(1600.85);
  });

  it('uses the category name only for old rows that have no type at all (TXN-002)', () => {
    const categories = [{ id: 'sal', name: 'Salary' }];
    const [entry] = buildLedgerEntries([{ id: 'x', amount: 10, expense_date: '2026-10-01', category_id: 'sal' }], categories);
    expect(entry.kind).toBe('income');
  });
});
