/**
 * Money with others & Gullak for Insights: split summary, INS-010 (where Gullak money came from),
 * INS-011 (best and worst month).
 */
import { describe, it, expect } from 'vitest';
import { computeSplitSummary, computeGullakSources, computeBestWorstMonth } from '../src/lib/insights/moneyFlows';
import type { AllowanceHistory } from '../src/money/budgetAllowance';
import type { BudgetPlanChange } from '../src/types';
import type { GullakDeposit } from '../src/store/dailyBudget/types';

const dep = (date: string, amount: number, source: GullakDeposit['source']): GullakDeposit => ({
  id: `${date}-${source}-${amount}`,
  date,
  amount,
  source,
  created_at: `${date}T10:00:00Z`,
});

describe('computeSplitSummary', () => {
  const range = { start: '2026-11-01', end: '2026-11-30' };
  const rows = [
    // Nov: dinner 1200, Rahul owes 400, Asha owes 400
    {
      id: 'e1', amount: 1200, gross_amount: 1200, type: 'expense', transaction_class: 'expense', expense_date: '2026-11-05',
      split_allocations: [{ person: 'Rahul', amount: 400 }, { person: 'Asha', amount: 400 }],
    },
    // Rahul pays 400 back in Nov
    {
      id: 'r1', amount: 400, type: 'income', transaction_class: 'recovery', recovery_kind: 'settlement', recovery_person: 'Rahul',
      expense_date: '2026-11-10', recovery_allocations: [{ expense_id: 'e1', amount: 400 }],
    },
    // A refund in Nov
    {
      id: 'e2', amount: 500, gross_amount: 500, type: 'expense', transaction_class: 'expense', expense_date: '2026-11-02',
    },
    {
      id: 'r2', amount: 200, type: 'income', transaction_class: 'recovery', recovery_kind: 'refund',
      expense_date: '2026-11-12', recovery_allocations: [{ expense_id: 'e2', amount: 200 }],
    },
    // October: Asha still owes 300 from an older split
    {
      id: 'e3', amount: 600, gross_amount: 600, type: 'expense', transaction_class: 'expense', expense_date: '2026-10-20',
      split_person: 'Asha', split_amount: 300,
    },
  ];

  it('period totals plus what is still owed, all time', () => {
    expect(computeSplitSummary(rows, range, '2026-11-25')).toEqual({
      paidForOthers: 800,
      cameBack: 400,
      refunds: 200,
      stillOwed: 700,
      topDebtor: { name: 'Asha', owed: 700 },
      oldestDebtDays: 36, // Oct 20 → Nov 25
    });
  });

  it('null when there is nothing to show', () => {
    const plain = [{ id: 'x', amount: 100, type: 'expense', transaction_class: 'expense', expense_date: '2026-11-03' }];
    expect(computeSplitSummary(plain, range, '2026-11-25')).toBeNull();
  });
});

describe('computeGullakSources (INS-010)', () => {
  const range = { start: '2026-11-01', end: '2026-11-30' };

  it('splits money in by source and shows overspend cover on its own line', () => {
    const deposits = [dep('2026-11-03', 1000, 'income'), dep('2026-11-04', 500, 'external'), dep('2026-10-30', 999, 'external')];
    expect(computeGullakSources(1500, deposits, 250, range)).toEqual({
      autoSaved: 1500,
      fromIncome: 1000,
      fromOutside: 500,
      total: 3000,
      coveredOverspend: 250,
    });
  });

  it('null when all four are 0', () => {
    expect(computeGullakSources(0, [], 0, range)).toBeNull();
  });
});

describe('computeBestWorstMonth (INS-011)', () => {
  const change = (effectiveFrom: string, isEnabled: boolean, amount = 100): BudgetPlanChange => ({
    id: effectiveFrom, userId: 'u1', effectiveFrom, isEnabled, cadence: 'daily', amount,
  });
  const pure: AllowanceHistory = {
    planChanges: [change('2026-01-01', false)],
    dailyRecords: {},
    todayKey: '2026-04-15',
    isAutoRenew: false,
    fallbackPlan: null,
  };
  const exp = (date: string, amount: number, category_id = 'food') => ({
    id: `${date}-${amount}-${category_id}`, amount, type: 'expense', transaction_class: 'expense', expense_date: date, category_id,
  });
  const inc = (date: string, amount: number) => ({ id: `i${date}`, amount, type: 'income', transaction_class: 'income', expense_date: date });

  it('finished months only, best = most money left, worst = least, with the reason', () => {
    const rows = [
      inc('2026-01-01', 10000), exp('2026-01-10', 4000), // Jan left 6000
      inc('2026-02-01', 10000), exp('2026-02-10', 2000), // Feb left 8000
      inc('2026-03-01', 10000), exp('2026-03-10', 9000), // Mar left 1000 (food 9000 vs avg 5000 = 1.8x)
      inc('2026-04-01', 99999), // April is the current month: never counts
    ];
    const r = computeBestWorstMonth(rows, [dep('2026-02-15', 500, 'external')], pure, 2026, '2026-04-15')!;
    expect(r.best).toEqual({ monthKey: '2026-02-01', inflow: 10500, spent: 2000, moneyLeft: 8500 });
    expect(r.worst.monthKey).toBe('2026-03-01');
    expect(r.worstReason).toEqual({ categoryId: 'food', ratio: 9000 / 5000 });
  });

  it('budget money comes from the plan history (INS-004)', () => {
    const h: AllowanceHistory = { ...pure, planChanges: [change('2026-01-01', true, 100), change('2026-02-01', false)], isAutoRenew: true };
    const r = computeBestWorstMonth([exp('2026-02-10', 100)], [], h, 2026, '2026-03-15')!;
    expect(r.best).toMatchObject({ monthKey: '2026-01-01', inflow: 3100 }); // Jan: 31 budget days
    expect(r.worst).toMatchObject({ monthKey: '2026-02-01', inflow: 0, moneyLeft: -100 });
    expect(r.worstReason).toEqual({ categoryId: 'food', ratio: 2 }); // 100 vs a 50 monthly average
  });

  it('no reason below 1.5x', () => {
    const rows = [exp('2026-01-05', 1000), exp('2026-02-05', 1200)];
    expect(computeBestWorstMonth(rows, [], pure, 2026, '2026-03-15')!.worstReason).toBeNull();
  });

  it('a tie goes to the later month; fewer than 2 finished months gives null', () => {
    const rows = [exp('2026-01-05', 100), exp('2026-02-05', 100), exp('2026-03-05', 500)];
    const r = computeBestWorstMonth(rows, [], pure, 2026, '2026-04-15')!;
    expect(r.best.monthKey).toBe('2026-02-01');
    expect(computeBestWorstMonth(rows, [], pure, 2026, '2026-02-10')).toBeNull();
  });

  it('months before sign-up are skipped', () => {
    const rows = [exp('2026-02-05', 100), exp('2026-03-05', 500)];
    const r = computeBestWorstMonth(rows, [], pure, 2026, '2026-04-15', '2026-02-10')!;
    expect(r.best.monthKey).toBe('2026-02-01');
    expect(r.worst.monthKey).toBe('2026-03-01');
  });
});
