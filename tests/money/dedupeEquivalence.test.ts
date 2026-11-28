/**
 * Group A dedupe (28 Nov 2026): the old loops, rewritten here, against the one shared helper that replaced them.
 * MNY-001: totals come from src/money. No figure may differ.
 */
import { describe, it, expect } from 'vitest';
import { computeSpentByDate, computeSpentForDate, computeIncomeByDate, computeIncomeForDate } from '../../src/lib/budgetCalculations';
import { buildLedgerEntries, sumKindBetweenDateKeys } from '../../src/money/ledger';
import { externalDepositsBetween } from '../../src/money/inflow';
import { isCountedExpense, isCountedIncome } from '../../src/lib/transactionUtils';
import { round2 } from '../../src/lib/formatters';

let seed = 11;
const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return Math.floor((seed / 2147483648) * n); };
const day = () => `2026-10-${String(1 + rnd(28)).padStart(2, '0')}`;
const rowDate = () => [`${day()}`, `${day()}T10:00:00Z`, `${day()} `, ''][rnd(4)];
const makeRows = () => Array.from({ length: 60 }, (_, i) => ({
  id: String(i), amount: (rnd(200000) - 100) / 100, expense_date: rowDate(),
  type: (['expense', 'income', undefined] as const)[rnd(3)], transaction_class: [undefined, 'normal', 'self_transfer', 'recovery'][rnd(4)],
}));
const SETS = Array.from({ length: 200 }, makeRows);
const clean = (d: string) => d.split('T')[0]?.trim();

const oldByDate = (rows: ReturnType<typeof makeRows>, keep: typeof isCountedExpense, positiveOnly: boolean) => {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const d = clean(r.expense_date);
    if (!keep(r) || !d) continue;
    const amt = Number(r.amount) || 0;
    out[d] = round2((out[d] || 0) + (positiveOnly && amt < 0 ? 0 : amt));
  }
  return out;
};

describe('MNY-001: one per-day total', () => {
  it('spending per day and for one day matches the old loops', () => {
    for (const rows of SETS) {
      const old = oldByDate(rows, isCountedExpense, false);
      expect(computeSpentByDate(rows)).toEqual(old);
      const target = day();
      expect(computeSpentForDate(rows, target)).toBe(old[target] || 0);
    }
  });

  it('income per day and for one day matches the old loops (a negative row adds nothing)', () => {
    for (const rows of SETS) {
      const old = oldByDate(rows, isCountedIncome, true);
      expect(computeIncomeByDate(rows)).toEqual(old);
      const target = day();
      expect(computeIncomeForDate(rows, target)).toBe(old[target] || 0);
    }
  });
});

describe('MNY-001: one range total', () => {
  it('income and spending between two dates match the old loops', () => {
    for (const rows of SETS) {
      const [start, end] = [day(), day()].sort();
      let income = 0;
      let spent = 0;
      for (const r of rows) {
        const d = clean(r.expense_date);
        if (!d || d < start || d > end) continue;
        if (isCountedIncome(r)) income += r.amount;
        else if (isCountedExpense(r)) spent += r.amount;
      }
      const entries = buildLedgerEntries(rows);
      expect(sumKindBetweenDateKeys(entries, 'income', start, end)).toBe(round2(income));
      expect(sumKindBetweenDateKeys(entries, 'spending', start, end)).toBe(round2(spent));
    }
  });

  it('outside Gullak money between two dates matches the old loops', () => {
    for (let set = 0; set < 200; set++) {
      const deposits = Array.from({ length: 20 }, () => ({ amount: rnd(100000) / 100, date: rowDate(), source: ['income', 'external', undefined][rnd(3)] }));
      const [start, end] = [day(), day()].sort();
      let sum = 0;
      for (const dep of deposits) {
        const d = clean(dep.date);
        if (d && d >= start && d <= end && dep.source === 'external') sum += dep.amount;
      }
      expect(externalDepositsBetween(deposits, start, end)).toBe(round2(sum));
    }
  });
});
