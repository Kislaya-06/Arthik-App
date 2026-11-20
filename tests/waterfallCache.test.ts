import { describe, it, expect } from 'vitest';
import { computeWaterfallFromState, computeMoneyWaterfall, classifyForWaterfall, buildPoolResolver } from '../src/lib/moneyWaterfall';
import { buildBudgetPools } from '../src/lib/budgetPeriods';

/**
 * WAT-001 performance: computeWaterfallFromState is a pure function of its inputs, and one expense change
 * used to run it about five times (Home x2, Savings, the Gullak popup, the store sync). It now reuses a recent
 * result when EVERY input is the same reference / value. These tests prove the cache can never return a
 * different number than a fresh computation.
 */
const cats = [{ id: 'food', name: 'Food' }, { id: 'sal', name: 'Salary' }];

const base = () => ({
  expenses: [
    { id: 'i1', amount: 1000, type: 'income', category_id: 'sal', expense_date: '2026-11-01', created_at: '2026-11-01T09:00:00Z', transaction_class: 'income' },
    { id: 'e1', amount: 400, type: 'expense', category_id: 'food', expense_date: '2026-11-18', created_at: '2026-11-18T09:00:00Z', transaction_class: 'expense' },
    { id: 'e2', amount: 300, type: 'expense', category_id: 'food', expense_date: '2026-11-19', created_at: '2026-11-19T09:00:00Z', transaction_class: 'expense' },
  ] as any[],
  categories: cats,
  deposits: [] as any[],
  isBudgetModeEnabled: true,
  isAutoRenew: true,
  todayStr: '2026-11-19',
  todayBudget: 250,
  dailyBudgetAmount: 250,
  records: {
    '2026-11-18': { date: '2026-11-18', budget: 250, status: 'exceeded' },
    '2026-11-19': { date: '2026-11-19', budget: 250, status: 'unknown' },
  } as Record<string, any>,
  planChanges: [] as any[],
});

/** The same computation without the cache (what computeWaterfallFromState did before). */
const uncached = (p: ReturnType<typeof base> & { excludeExpensesFrom?: string }) => {
  const pools = buildBudgetPools(p.planChanges || [], p.todayStr);
  return computeMoneyWaterfall({
    txs: classifyForWaterfall(p.expenses, p.categories),
    deposits: p.deposits,
    resolvePool: buildPoolResolver(p, pools),
    pureEndPools: Object.values(pools).filter((x) => x.endsInPure),
    asOf: p.todayStr,
    excludeExpensesFrom: p.excludeExpensesFrom,
  });
};

describe('WAT-001: computeWaterfallFromState reuses a result only for identical inputs', () => {
  it('same inputs (same references) → the very same result object, equal to a fresh computation', () => {
    const p = base();
    const a = computeWaterfallFromState(p);
    const b = computeWaterfallFromState({ ...p }); // new params object, same input references
    expect(b).toBe(a);
    expect(a).toEqual(uncached(p));
  });

  it('a new expense list (new reference) → recomputed, and the numbers follow the new list', () => {
    const p = base();
    const before = computeWaterfallFromState(p);
    const added = { ...p, expenses: [...p.expenses, { id: 'e3', amount: 500, type: 'expense', category_id: 'food', expense_date: '2026-11-19', created_at: '2026-11-19T10:00:00Z', transaction_class: 'expense' }] };
    const after = computeWaterfallFromState(added);
    expect(after).not.toBe(before);
    expect(after).toEqual(uncached(added));
    // The new expense is in the fresh result (a stale cached result would not know it).
    expect(after.byExpense.e3).toBeDefined();
    expect(before.byExpense.e3).toBeUndefined();
  });

  it.each([
    ['records', (p: any) => ({ ...p, records: { ...p.records, '2026-11-19': { ...p.records['2026-11-19'], budget: 100 } } })],
    ['deposits', (p: any) => ({ ...p, deposits: [{ id: 'd1', amount: 200, source: 'income', date: '2026-11-10', created_at: '2026-11-10T08:00:00Z' }] })],
    ['todayStr', (p: any) => ({ ...p, todayStr: '2026-11-20' })],
    ['todayBudget', (p: any) => ({ ...p, todayBudget: 50 })],
    ['dailyBudgetAmount', (p: any) => ({ ...p, dailyBudgetAmount: 50, todayBudget: 0 })],
    ['isBudgetModeEnabled', (p: any) => ({ ...p, isBudgetModeEnabled: false })],
    ['isAutoRenew', (p: any) => ({ ...p, isAutoRenew: false })],
    ['excludeExpensesFrom', (p: any) => ({ ...p, excludeExpensesFrom: '2026-11-19' })],
    ['categories', (p: any) => ({ ...p, categories: [...p.categories] })],
    ['planChanges', (p: any) => ({ ...p, planChanges: [] })],
  ])('changing %s → a fresh result equal to an uncached computation', (_name, change) => {
    const p = base();
    const first = computeWaterfallFromState(p);
    const changed = change(p);
    const second = computeWaterfallFromState(changed);
    expect(second).not.toBe(first);
    expect(second).toEqual(uncached(changed));
  });

  it('alternating two input sets (with / without today) keeps both cached and both correct', () => {
    const p = base();
    const q = { ...p, excludeExpensesFrom: p.todayStr };
    const a1 = computeWaterfallFromState(p);
    const b1 = computeWaterfallFromState(q);
    expect(computeWaterfallFromState(p)).toBe(a1);
    expect(computeWaterfallFromState(q)).toBe(b1);
    expect(a1).toEqual(uncached(p));
    expect(b1).toEqual(uncached(q));
  });
});
