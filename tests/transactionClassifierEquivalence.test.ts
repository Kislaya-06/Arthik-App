/**
 * ADR 0023: the transaction classifier no longer takes categories (TXN-002 retired).
 * The OLD classifier and the OLD spent / income helpers are copied below verbatim (before ADR 0023).
 * For every row that has a `type` (every row the database can hold: `type` is NOT NULL), the new code gives
 * exactly the same answer and the same totals, whatever the category is called.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyTransaction,
  isCountedIncome,
  isCountedExpense,
  isIncomeTransaction,
  getTransactionClass,
  isExcludedFromTotals,
} from '../src/lib/transactionUtils';
import { computeSpentByDate, computeIncomeByDate, computeSpentForDate, computeIncomeForDate } from '../src/lib/budgetCalculations';
import { calculateExpenseTotals } from '../src/lib/homeCalculations';
import { buildLedgerEntries } from '../src/money/ledger';
import { classifyForWaterfall } from '../src/lib/moneyWaterfall';
import { round2 } from '../src/lib/formatters';

// ─── OLD code (src/lib/transactionUtils.ts + incomeClassifier.ts before ADR 0023, verbatim) ───
const DEFAULT_INCOME_KEYWORDS = ['salary', 'income', 'freelance', 'business', 'dividend', 'stipend', 'rental', 'bonus', 'interest', 'cashback', 'refund', 'pocket money', 'gift', 'sales'];
const oldIsIncomeTransaction = (item?: { type?: string } | null, category?: { name?: string } | null): boolean => {
  if (item?.type === 'income') return true;
  if (item?.type === 'expense') return false;
  if (!category?.name) return false;
  const lower = category.name.toLowerCase();
  return DEFAULT_INCOME_KEYWORDS.some((kw) => lower.includes(kw));
};
const oldIsEligibleIncome = (item?: any, category?: { name?: string } | null): boolean => {
  if (isExcludedFromTotals(item)) return false;
  return oldIsIncomeTransaction(item, category);
};
const oldClassify = (item?: any, category?: { name?: string } | null) => {
  const transactionClass = getTransactionClass(item);
  if (transactionClass === 'self_transfer') return 'selfTransfer';
  if (transactionClass === 'recovery') return 'moneyBack';
  return oldIsIncomeTransaction(item, category) ? 'income' : 'spending';
};
const oldSpentByDate = (expenses: any[], isIncomeFn: (e: any) => boolean) => {
  const out: Record<string, number> = {};
  for (const e of expenses) {
    if (isExcludedFromTotals(e)) continue;
    const d = e.expense_date?.split('T')[0]?.trim();
    if (!isIncomeFn(e) && d) out[d] = round2((out[d] || 0) + (Number(e.amount) || 0));
  }
  return out;
};
const oldIncomeByDate = (expenses: any[], isEligibleIncomeFn: (e: any) => boolean) => {
  const out: Record<string, number> = {};
  for (const e of expenses) {
    const d = e.expense_date?.split('T')[0]?.trim();
    if (isEligibleIncomeFn(e) && d) {
      const amt = Number(e.amount);
      out[d] = round2((out[d] || 0) + (Number.isFinite(amt) && amt > 0 ? amt : 0));
    }
  }
  return out;
};

// ─── Every kind of row the app stores, in categories whose NAMES look like the opposite kind ───
const categories = [
  { id: 'salary', name: 'Salary' },
  { id: 'refund', name: 'Refund & Cashback' },
  { id: 'food', name: 'Food & Drinks' },
  { id: 'gift', name: 'Gifts' },
];
const catOf = (e: any) => categories.find((c) => c.id === e.category_id);
const classes = [undefined, null, 'normal', 'self_transfer', 'recovery', 'reimbursement'];
const rows: any[] = [];
let n = 0;
for (const type of ['expense', 'income'] as const) {
  for (const transaction_class of classes) {
    for (const category_id of [null, 'salary', 'refund', 'food', 'gift', 'deleted-category']) {
      n += 1;
      rows.push({
        id: `r${n}`,
        type,
        transaction_class,
        category_id,
        amount: [250, 99.5, 1200, 0, 13834.5][n % 5],
        expense_date: `2026-10-${String((n % 28) + 1).padStart(2, '0')}${n % 3 === 0 ? 'T18:45:00.000Z' : ''}`,
        note: n % 4 === 0 ? 'Auto-balance (Pure Mode deficit)' : 'transfer to bank',
      });
    }
  }
}

describe('ADR 0023: classifier equivalence for every row with a type', () => {
  it('covers every type x class x category combination', () => {
    expect(rows.length).toBe(2 * classes.length * 6);
  });

  it('classifyTransaction / isCountedIncome / isCountedExpense / isIncomeTransaction give the old answers', () => {
    for (const r of rows) {
      const cat = catOf(r);
      expect(classifyTransaction(r), r.id).toBe(oldClassify(r, cat));
      expect(isCountedIncome(r), r.id).toBe(oldClassify(r, cat) === 'income');
      expect(isCountedIncome(r), r.id).toBe(oldIsEligibleIncome(r, cat));
      expect(isCountedExpense(r), r.id).toBe(oldClassify(r, cat) === 'spending');
      expect(isIncomeTransaction(r), r.id).toBe(oldIsIncomeTransaction(r, cat));
    }
  });

  it('spent and income per day are the same as the old store wiring', () => {
    const oldIncomeFn = (e: any) => oldIsIncomeTransaction(e, catOf(e));
    const oldEligibleFn = (e: any) => oldIsEligibleIncome(e, catOf(e));
    const spent = computeSpentByDate(rows);
    const income = computeIncomeByDate(rows);
    expect(spent).toEqual(oldSpentByDate(rows, oldIncomeFn));
    expect(income).toEqual(oldIncomeByDate(rows, oldEligibleFn));
    expect(Object.keys(spent).length).toBeGreaterThan(5);
    expect(Object.keys(income).length).toBeGreaterThan(5);
    for (const d of Object.keys(spent)) expect(computeSpentForDate(rows, d)).toBe(spent[d]);
    for (const d of Object.keys(income)) expect(computeIncomeForDate(rows, d)).toBe(income[d]);
  });

  it('Home totals, the ledger and the waterfall classify every row as before', () => {
    let oldIncome = 0;
    let oldSpent = 0;
    for (const r of rows) {
      const k = oldClassify(r, catOf(r));
      if (k === 'income') oldIncome += Number(r.amount) || 0;
      else if (k === 'spending') oldSpent += Number(r.amount) || 0;
    }
    expect(calculateExpenseTotals(rows)).toEqual({ totalIncome: round2(oldIncome), totalSpent: round2(oldSpent) });

    const entries = buildLedgerEntries(rows);
    rows.forEach((r, i) => expect(entries[i].kind, r.id).toBe(oldClassify(r, catOf(r))));

    const oldWaterfall = rows
      .filter((r) => Number(r.amount) > 0 && ['income', 'spending'].includes(oldClassify(r, catOf(r))))
      .map((r) => [r.id, oldClassify(r, catOf(r)) === 'income' ? 'income' : 'expense']);
    expect(classifyForWaterfall(rows).map((t) => [t.id, t.kind])).toEqual(oldWaterfall);
  });

  it('TXN-002 retired: only a row with NO type changes, and it now counts as spending (the database default)', () => {
    const untyped: any = { id: 'old', amount: 500, category_id: 'salary', expense_date: '2026-10-01' };
    expect(oldClassify(untyped, catOf(untyped))).toBe('income');
    expect(classifyTransaction(untyped)).toBe('spending');
  });
});
