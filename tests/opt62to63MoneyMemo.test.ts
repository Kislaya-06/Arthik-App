import { describe, it, expect, beforeEach } from 'vitest';
import { computeWaterfallFromState, __clearWaterfallMemoForTests, computeMoneyWaterfall, classifyForWaterfall, buildPoolResolver } from '../src/lib/moneyWaterfall';
import { buildBudgetPools } from '../src/lib/budgetPeriods';
import { buildLedgerEntries, spendingTotalsByDateKey } from '../src/money/ledger';

// OPT-62 / OPT-63: memoised results must be EXACTLY what a fresh computation returns, and must never be
// reused for different inputs.

const expenses = [
  { id: 'i1', amount: 1000, expense_date: '2026-10-01', created_at: '2026-10-01T08:00:00Z', type: 'income', transaction_class: 'normal' },
  { id: 'e1', amount: 300, expense_date: '2026-10-01', created_at: '2026-10-01T09:00:00Z', type: 'expense', transaction_class: 'normal' },
  { id: 'e2', amount: 700, expense_date: '2026-10-02', created_at: '2026-10-02T09:00:00Z', type: 'expense', transaction_class: 'normal' },
  { id: 't1', amount: 50, expense_date: '2026-10-02', created_at: '2026-10-02T10:00:00Z', type: 'expense', transaction_class: 'self_transfer' },
];
const records = { '2026-10-01': { budget: 250, status: 'missed' }, '2026-10-02': { budget: 250, status: 'missed' } };
const base = () => ({
  expenses,
  categories: [] as Array<{ id: string; name?: string }>,
  deposits: [{ date: '2026-10-02', amount: 100, source: 'income' as const }],
  isBudgetModeEnabled: true,
  isAutoRenew: true,
  todayStr: '2026-10-03',
  todayBudget: undefined as number | undefined,
  dailyBudgetAmount: 250,
  records,
  planChanges: [],
});

const fresh = (p: ReturnType<typeof base>) => {
  const pools = buildBudgetPools(p.planChanges || [], p.todayStr);
  return computeMoneyWaterfall({
    txs: classifyForWaterfall(p.expenses, p.categories),
    deposits: p.deposits,
    resolvePool: buildPoolResolver(p, pools),
    pureEndPools: Object.values(pools).filter((x) => x.endsInPure),
    asOf: p.todayStr,
  });
};

describe('OPT-62 waterfall memo', () => {
  beforeEach(() => __clearWaterfallMemoForTests());

  it('returns exactly the uncached result', () => {
    const p = base();
    expect(computeWaterfallFromState(p)).toEqual(fresh(p));
  });

  it('same inputs (new params object, same references) -> the same result object', () => {
    const p = base();
    const a = computeWaterfallFromState(p);
    const b = computeWaterfallFromState({ ...p });
    expect(b).toBe(a);
  });

  it('a missing key and an undefined key are the same input', () => {
    const p = base();
    const a = computeWaterfallFromState(p);
    const b = computeWaterfallFromState({ ...p, excludeExpensesFrom: undefined, ungovernedAsOverspend: undefined });
    expect(b).toBe(a);
  });

  it('any changed input recomputes (new list, new scalar, new records, new flag)', () => {
    const p = base();
    const a = computeWaterfallFromState(p);
    expect(computeWaterfallFromState({ ...p, expenses: [...expenses] })).not.toBe(a);
    expect(computeWaterfallFromState({ ...p, dailyBudgetAmount: 251 })).not.toBe(a);
    expect(computeWaterfallFromState({ ...p, records: { ...records } })).not.toBe(a);
    expect(computeWaterfallFromState({ ...p, excludeExpensesFrom: '2026-10-02' })).not.toBe(a);
    expect(computeWaterfallFromState({ ...p, ungovernedAsOverspend: true })).not.toBe(a);
    const changed = { ...p, todayStr: '2026-10-04' };
    expect(computeWaterfallFromState(changed)).toEqual(fresh(changed));
  });

  it('an array appended to in place is never treated as the same input', () => {
    const list = [...expenses];
    const p = { ...base(), expenses: list };
    const a = computeWaterfallFromState(p);
    list.push({ id: 'e3', amount: 999, expense_date: '2026-10-02', created_at: '2026-10-02T11:00:00Z', type: 'expense', transaction_class: 'normal' });
    const b = computeWaterfallFromState(p);
    expect(b).not.toBe(a);
    expect(b).toEqual(fresh(p));
  });

  it('keeps several recent results (Home pills, store metrics and the prior balance alternate)', () => {
    const p = base();
    const a = computeWaterfallFromState(p);
    const prior = computeWaterfallFromState({ ...p, excludeExpensesFrom: '2026-10-03' });
    expect(computeWaterfallFromState(p)).toBe(a);
    expect(computeWaterfallFromState({ ...p, excludeExpensesFrom: '2026-10-03' })).toBe(prior);
  });
});

describe('OPT-63 ledger memo', () => {
  const cats = [{ id: 'c1', name: 'Food', kind: 'expense' }];

  it('returns exactly the uncached entries and reuses them for the same arrays', () => {
    const rows = [...expenses];
    const a = buildLedgerEntries(rows, cats);
    const b = buildLedgerEntries(rows, cats);
    expect(b).toBe(a);
    expect(a).toEqual(buildLedgerEntries([...rows], cats));
    expect(spendingTotalsByDateKey(a)).toEqual(spendingTotalsByDateKey(buildLedgerEntries([...rows], [...cats])));
  });

  it('different categories, no categories, or an appended row -> recomputed', () => {
    const rows = [...expenses];
    const a = buildLedgerEntries(rows, cats);
    expect(buildLedgerEntries(rows, [...cats])).not.toBe(a);
    const none = buildLedgerEntries(rows);
    expect(buildLedgerEntries(rows)).toBe(none);
    expect(none).toEqual(buildLedgerEntries([...rows], []));
    rows.push({ id: 'e9', amount: 5, expense_date: '2026-10-05', created_at: '2026-10-05T09:00:00Z', type: 'expense', transaction_class: 'normal' });
    const after = buildLedgerEntries(rows);
    expect(after).not.toBe(none);
    expect(after.length).toBe(5);
  });
});
