import { describe, it, expect } from 'vitest';
import {
  selectRecentTransactions,
  UnifiedTxItem,
} from '../src/lib/homeCalculations';
import type { Expense } from '../src/store/expenseStore';
import type { GullakDeposit } from '../src/store/dailyBudgetStore';

/**
 * Reference Oracle: The exact original implementation from HomeScreen.tsx
 */
function referenceRecentTx(
  expenses: readonly Expense[],
  gullakDeposits: readonly GullakDeposit[]
): UnifiedTxItem[] {
  const items: UnifiedTxItem[] = [
    ...expenses.map((e) => ({
      kind: 'expense' as const,
      data: e,
      date: e.expense_date,
      created_at: e.created_at || '',
    })),
    ...gullakDeposits.map((d) => ({
      kind: 'gullak' as const,
      data: d,
      date: d.date,
      created_at: d.created_at || '',
    })),
  ];
  return items
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)
    )
    .slice(0, 5);
}

const makeExpense = (
  id: string,
  date: string,
  createdAt?: string
): Expense => ({
  id,
  user_id: 'user-1',
  amount: 100,
  category_id: null,
  note: `Expense ${id}`,
  payment_mode: 'upi',
  expense_date: date,
  type: 'expense',
  created_at: createdAt,
});

const makeDeposit = (
  id: string,
  date: string,
  createdAt?: string
): GullakDeposit => ({
  id,
  amount: 50,
  date,
  source: 'external',
  note: `Deposit ${id}`,
  created_at: createdAt || '',
});

describe('selectRecentTransactions - Top-5 Bounded Scan (Candidate 1)', () => {
  it('1. handles more than five transactions in reverse chronological order', () => {
    const expenses: Expense[] = [
      makeExpense('e1', '2026-10-10', '2026-10-10T10:00:00Z'),
      makeExpense('e2', '2026-10-09', '2026-10-09T10:00:00Z'),
      makeExpense('e3', '2026-10-08', '2026-10-08T10:00:00Z'),
      makeExpense('e4', '2026-10-07', '2026-10-07T10:00:00Z'),
      makeExpense('e5', '2026-10-06', '2026-10-06T10:00:00Z'),
      makeExpense('e6', '2026-10-05', '2026-10-05T10:00:00Z'),
      makeExpense('e7', '2026-10-04', '2026-10-04T10:00:00Z'),
    ];
    const deposits: GullakDeposit[] = [];

    const result = selectRecentTransactions(expenses, deposits, 5);
    const expected = referenceRecentTx(expenses, deposits);

    expect(result).toHaveLength(5);
    expect(result.map((r) => r.data.id)).toEqual(['e1', 'e2', 'e3', 'e4', 'e5']);
    expect(result).toEqual(expected);
  });

  it('2. handles optimistically inserted past-dated expenses correctly', () => {
    // Expense e_past with date 2026-10-01 was optimistically prepended at index 0
    const expenses: Expense[] = [
      makeExpense('e_past', '2026-10-01', '2026-10-18T12:00:00Z'),
      makeExpense('e1', '2026-10-18', '2026-10-18T10:00:00Z'),
      makeExpense('e2', '2026-10-17', '2026-10-17T10:00:00Z'),
      makeExpense('e3', '2026-10-16', '2026-10-16T10:00:00Z'),
      makeExpense('e4', '2026-10-15', '2026-10-15T10:00:00Z'),
      makeExpense('e5', '2026-10-14', '2026-10-14T10:00:00Z'),
    ];
    const deposits: GullakDeposit[] = [];

    const result = selectRecentTransactions(expenses, deposits, 5);
    const expected = referenceRecentTx(expenses, deposits);

    // e_past must NOT be in top 5 because its date (2026-10-01) is older than e1..e5
    expect(result.map((r) => r.data.id)).toEqual(['e1', 'e2', 'e3', 'e4', 'e5']);
    expect(result).toEqual(expected);
  });

  it('3. handles interleaved expense and Gullak deposit dates', () => {
    const expenses: Expense[] = [
      makeExpense('e1', '2026-10-09', '2026-10-09T10:00:00Z'),
      makeExpense('e2', '2026-10-07', '2026-10-07T10:00:00Z'),
      makeExpense('e3', '2026-10-05', '2026-10-05T10:00:00Z'),
    ];
    const deposits: GullakDeposit[] = [
      makeDeposit('d1', '2026-10-10', '2026-10-10T10:00:00Z'),
      makeDeposit('d2', '2026-10-08', '2026-10-08T10:00:00Z'),
      makeDeposit('d3', '2026-10-06', '2026-10-06T10:00:00Z'),
    ];

    const result = selectRecentTransactions(expenses, deposits, 5);
    const expected = referenceRecentTx(expenses, deposits);

    expect(result.map((r) => `${r.kind}-${r.data.id}`)).toEqual([
      'gullak-d1',
      'expense-e1',
      'gullak-d2',
      'expense-e2',
      'gullak-d3',
    ]);
    expect(result).toEqual(expected);
  });

  it('4. handles equal dates with different created_at values', () => {
    const expenses: Expense[] = [
      makeExpense('e1', '2026-10-18', '2026-10-18T09:00:00Z'),
      makeExpense('e2', '2026-10-18', '2026-10-18T14:00:00Z'),
      makeExpense('e3', '2026-10-18', '2026-10-18T11:00:00Z'),
    ];
    const deposits: GullakDeposit[] = [
      makeDeposit('d1', '2026-10-18', '2026-10-18T16:00:00Z'),
    ];

    const result = selectRecentTransactions(expenses, deposits, 5);
    const expected = referenceRecentTx(expenses, deposits);

    expect(result.map((r) => r.data.id)).toEqual(['d1', 'e2', 'e3', 'e1']);
    expect(result).toEqual(expected);
  });

  it('5. preserves stable ordering for equal dates and equal created_at values', () => {
    const expenses: Expense[] = [
      makeExpense('e1', '2026-10-18', '2026-10-18T10:00:00Z'),
      makeExpense('e2', '2026-10-18', '2026-10-18T10:00:00Z'),
    ];
    const deposits: GullakDeposit[] = [
      makeDeposit('d1', '2026-10-18', '2026-10-18T10:00:00Z'),
    ];

    const result = selectRecentTransactions(expenses, deposits, 5);
    const expected = referenceRecentTx(expenses, deposits);

    expect(result.map((r) => r.data.id)).toEqual(['e1', 'e2', 'd1']);
    expect(result).toEqual(expected);
  });

  it('6. handles missing or empty created_at values gracefully', () => {
    const expenses: Expense[] = [
      makeExpense('e1', '2026-10-18', undefined),
      makeExpense('e2', '2026-10-18', ''),
      makeExpense('e3', '2026-10-18', '2026-10-18T05:00:00Z'),
    ];
    const deposits: GullakDeposit[] = [
      makeDeposit('d1', '2026-10-18', undefined),
    ];

    const result = selectRecentTransactions(expenses, deposits, 5);
    const expected = referenceRecentTx(expenses, deposits);

    expect(result).toEqual(expected);
    // e3 has non-empty timestamp, so it comes first; others follow in stable encounter order
    expect(result[0].data.id).toBe('e3');
  });

  it('7. handles empty inputs and fewer than five total transactions', () => {
    expect(selectRecentTransactions([], [], 5)).toEqual([]);

    const singleExp = [makeExpense('e1', '2026-10-18', '2026-10-18T10:00:00Z')];
    const resultSingle = selectRecentTransactions(singleExp, [], 5);
    expect(resultSingle).toHaveLength(1);
    expect(resultSingle[0].data.id).toBe('e1');

    const twoItems = [
      makeExpense('e1', '2026-10-17', '2026-10-17T10:00:00Z'),
    ];
    const twoDeps = [
      makeDeposit('d1', '2026-10-18', '2026-10-18T10:00:00Z'),
    ];
    const resultTwo = selectRecentTransactions(twoItems, twoDeps, 5);
    expect(resultTwo.map((r) => r.data.id)).toEqual(['d1', 'e1']);
  });

  it('8. handles more than five records with identical timestamps stably', () => {
    const expenses: Expense[] = [
      makeExpense('e1', '2026-10-18', '2026-10-18T10:00:00Z'),
      makeExpense('e2', '2026-10-18', '2026-10-18T10:00:00Z'),
      makeExpense('e3', '2026-10-18', '2026-10-18T10:00:00Z'),
      makeExpense('e4', '2026-10-18', '2026-10-18T10:00:00Z'),
      makeExpense('e5', '2026-10-18', '2026-10-18T10:00:00Z'),
      makeExpense('e6', '2026-10-18', '2026-10-18T10:00:00Z'),
      makeExpense('e7', '2026-10-18', '2026-10-18T10:00:00Z'),
    ];
    const deposits: GullakDeposit[] = [
      makeDeposit('d1', '2026-10-18', '2026-10-18T10:00:00Z'),
    ];

    const result = selectRecentTransactions(expenses, deposits, 5);
    const expected = referenceRecentTx(expenses, deposits);

    expect(result).toHaveLength(5);
    expect(result.map((r) => r.data.id)).toEqual(['e1', 'e2', 'e3', 'e4', 'e5']);
    expect(result).toEqual(expected);
  });

  it('9. strictly matches reference oracle on 50 randomized iterations', () => {
    const dates = [
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ];
    const times = [
      '2026-10-18T08:00:00Z',
      '2026-10-18T12:00:00Z',
      '2026-10-18T16:00:00Z',
      '2026-10-18T20:00:00Z',
      '',
      undefined,
    ];

    for (let iter = 0; iter < 50; iter++) {
      const expCount = Math.floor(Math.random() * 40) + 1;
      const depCount = Math.floor(Math.random() * 20);

      const expList: Expense[] = [];
      for (let i = 0; i < expCount; i++) {
        const d = dates[Math.floor(Math.random() * dates.length)];
        const t = times[Math.floor(Math.random() * times.length)];
        expList.push(makeExpense(`exp_${iter}_${i}`, d, t));
      }

      const depList: GullakDeposit[] = [];
      for (let j = 0; j < depCount; j++) {
        const d = dates[Math.floor(Math.random() * dates.length)];
        const t = times[Math.floor(Math.random() * times.length)];
        depList.push(makeDeposit(`dep_${iter}_${j}`, d, t));
      }

      const optimized = selectRecentTransactions(expList, depList, 5);
      const oracle = referenceRecentTx(expList, depList);

      expect(optimized).toEqual(oracle);
    }
  });
});
