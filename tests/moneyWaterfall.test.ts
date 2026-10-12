import { describe, it, expect } from 'vitest';
import {
  computeMoneyWaterfall,
  computeWaterfallFromState,
  buildPoolResolver,
  summarizeScope,
  WaterfallTx,
} from '../src/lib/moneyWaterfall';
import { calculateExpenseFunding } from '../src/lib/transactionFunding';
import { calculatePeriodSummary } from '../src/lib/homeCalculations';
import { calculateSavingsMetrics, evaluateDayStatus } from '../src/lib/budgetCalculations';

/**
 * RULES UNDER TEST (confirmed by the product owner):
 *  1. An expense is paid from the cadence BUDGET first, then INCOME, then GULLAK.
 *  2. Income NEVER moves into Gullak by itself. Only unspent BUDGET at the end of a period does.
 *  3. Chips: Daily = income of today, Weekly = income of this week, Monthly = income of this month,
 *     All = what is really left of all income. Every chip only goes down when the budget is used up.
 *  4. Home, Gullak and the expense-detail card all read the SAME waterfall, so they can never disagree.
 */

const TODAY = '2026-10-12'; // Monday
const cats = [
  { id: 'food', name: 'Food' },
  { id: 'sal', name: 'Salary' },
];
const inc = (id: string, amount: number, date: string): any => ({
  id, amount, type: 'income', expense_date: date, category_id: 'sal', created_at: `${date}T08:00:00Z`,
});
const exp = (id: string, amount: number, date: string, at = '12:00:00'): any => ({
  id, amount, type: 'expense', expense_date: date, category_id: 'food', created_at: `${date}T${at}Z`,
});
const dailyResolver = (budget: number) => buildPoolResolver({
  isBudgetModeEnabled: true, isAutoRenew: true, todayStr: TODAY, dailyBudgetAmount: budget, todayBudget: budget,
});
const run = (expenses: any[], budget = 500, extra: any = {}) =>
  computeWaterfallFromState({
    expenses, categories: cats, isBudgetModeEnabled: true, isAutoRenew: true, todayStr: TODAY,
    dailyBudgetAmount: budget, todayBudget: budget, ...extra,
  });

describe('waterfall order: budget -> income -> Gullak', () => {
  it('within budget: nothing touches income or Gullak', () => {
    const r = run([inc('i', 1000, TODAY), exp('e', 300, TODAY)]);
    expect(r.byExpense.e).toMatchObject({ fromBudget: 300, fromIncome: 0, fromGullak: 0 });
    expect(r.incomeRemaining).toBe(1000);
  });

  it('income is used only after the budget is finished', () => {
    const r = run([inc('i', 1000, TODAY), exp('e', 700, TODAY)]);
    expect(r.byExpense.e).toMatchObject({ fromBudget: 500, fromIncome: 200, fromGullak: 0 });
    expect(r.incomeRemaining).toBe(800);
  });

  it('Gullak is used only after income is finished', () => {
    const r = run([inc('i', 150, TODAY), exp('e', 800, TODAY)]);
    expect(r.byExpense.e).toMatchObject({ fromBudget: 500, fromIncome: 150, fromGullak: 150 });
    expect(r.incomeRemaining).toBe(0);
    expect(r.gullakDrawn).toBe(150);
  });

  it('half from income and half from Gullak is reported as such', () => {
    const r = run([inc('i', 300, TODAY), exp('e', 1100, TODAY)]);
    expect(r.byExpense.e.fromIncome).toBe(300);
    expect(r.byExpense.e.fromGullak).toBe(300);
  });

  it('no income at all: overspend goes straight to Gullak', () => {
    const r = run([exp('e', 650, TODAY)]);
    expect(r.byExpense.e).toMatchObject({ fromBudget: 500, fromIncome: 0, fromGullak: 150 });
  });

  it('several expenses on one day share the same budget in time order', () => {
    const r = run([
      inc('i', 200, TODAY),
      exp('a', 300, TODAY, '10:00:00'),
      exp('b', 400, TODAY, '14:00:00'),
      exp('c', 250, TODAY, '19:00:00'),
    ]);
    expect(r.byExpense.a).toMatchObject({ fromBudget: 300, fromIncome: 0, fromGullak: 0 });
    expect(r.byExpense.b).toMatchObject({ fromBudget: 200, fromIncome: 200, fromGullak: 0 });
    expect(r.byExpense.c).toMatchObject({ fromBudget: 0, fromIncome: 0, fromGullak: 250 });
  });

  it('every expense is fully accounted for: budget + income + Gullak = amount', () => {
    const list = [inc('i', 333.33, TODAY), exp('a', 777.77, TODAY, '09:00:00'), exp('b', 120.1, TODAY, '10:00:00'), exp('c', 90, '2026-10-11')];
    const r = run(list);
    for (const e of list.filter((x) => x.type === 'expense')) {
      const s = r.byExpense[e.id];
      expect(Math.round((s.fromBudget + s.fromIncome + s.fromGullak) * 100) / 100).toBe(e.amount);
    }
  });
});

describe('time order: old overspend never eats income that arrives later', () => {
  it('income received TODAY is untouched by an overspend from earlier days (All pill bug)', () => {
    const r = run([
      exp('old', 900, '2026-10-10'),   // 400 over budget, no income existed yet -> Gullak
      inc('today', 300, TODAY),        // arrives today
    ]);
    expect(r.byExpense.old.fromGullak).toBe(400);
    expect(r.incomeRemaining).toBe(300);
  });

  it('income that existed at the time IS used by an earlier overspend', () => {
    const r = run([
      inc('i', 1000, '2026-10-10'),
      exp('e1', 1000, '2026-10-10'), // 500 over -> income 500
      exp('e2', 1000, '2026-10-11'), // 500 over -> income 500, income now 0
    ]);
    expect(r.incomeRemaining).toBe(0);
    expect(r.gullakDrawn).toBe(0);
  });
});

describe('expense detail card agrees with Home (bug: "paid from income" while income is 0)', () => {
  const all = [inc('i1', 1000, '2026-10-10'), exp('e1', 1000, '2026-10-10'), exp('e2', 1000, '2026-10-11'), exp('e3', 600, TODAY)];
  const params = (expense: any) => ({
    expense, allExpenses: all, categories: cats as any, todayBudget: 500, dailyBudgetAmount: 500,
    isBudgetModeEnabled: true, isAutoRenew: true, todayStr: TODAY,
  });

  it('income is already 0 -> today overspend is paid from Gullak, not income', () => {
    const f = calculateExpenseFunding(params(all[3]));
    expect(f.coveredByBudget).toBe(500);
    expect(f.coveredByIncome).toBe(0);
    expect(f.coveredByGullak).toBe(100);
    expect(f.primarySource).toBe('split');
  });

  it('card numbers equal waterfall numbers for every expense', () => {
    const w = run(all);
    for (const e of all.filter((x) => x.type === 'expense')) {
      const f = calculateExpenseFunding(params(e));
      expect(f.coveredByBudget).toBe(w.byExpense[e.id].fromBudget);
      expect(f.coveredByIncome).toBe(w.byExpense[e.id].fromIncome);
      expect(f.coveredByGullak).toBe(w.byExpense[e.id].fromGullak);
    }
  });

  it('an expense inside its allowance says nothing was taken from income or Gullak', () => {
    const f = calculateExpenseFunding({ ...params(exp('x', 100, TODAY)), allExpenses: [exp('x', 100, TODAY)] });
    expect(f.coveredByBudget).toBe(100);
    expect(f.coveredByIncome + f.coveredByGullak).toBe(0);
    expect(f.explanation).toContain('No income or Gullak');
  });
});

describe('weekly / monthly cadence pools', () => {
  const weeklyPlan: any[] = [{ id: 'p', userId: 'u', effectiveFrom: '2026-10-05', isEnabled: true, cadence: 'weekly', amount: 1000 }];
  const resolver = buildPoolResolver({
    isBudgetModeEnabled: true, isAutoRenew: true, todayStr: TODAY, dailyBudgetAmount: 0, planChanges: weeklyPlan,
  });
  const tx = (id: string, date: string, amount: number, kind: WaterfallTx['kind'] = 'expense'): WaterfallTx => ({ id, date, amount, kind, createdAt: `${date}T10:00:00Z` });

  it('income is touched only after the WHOLE weekly budget is used', () => {
    const r = computeMoneyWaterfall({
      resolvePool: resolver,
      txs: [tx('i', '2026-10-05', 400, 'income'), tx('a', '2026-10-05', 600), tx('b', '2026-10-08', 300), tx('c', '2026-10-09', 300)],
    });
    expect(r.byExpense.a.fromBudget).toBe(600);
    expect(r.byExpense.b.fromBudget).toBe(300);
    expect(r.byExpense.c).toMatchObject({ fromBudget: 100, fromIncome: 200, fromGullak: 0 });
    expect(r.incomeRemaining).toBe(200);
  });

  it('a new week gets a fresh budget', () => {
    const r = computeMoneyWaterfall({
      resolvePool: resolver,
      txs: [tx('i', '2026-10-05', 400, 'income'), tx('a', '2026-10-06', 1500), tx('b', '2026-10-13', 900)],
    });
    expect(r.byExpense.a.fromIncome).toBe(400);
    expect(r.byExpense.b).toMatchObject({ fromBudget: 900, fromIncome: 0 });
  });

  it("weekly user's TODAY is governed by the weekly pool (not a phantom daily pool)", () => {
    const r = computeMoneyWaterfall({ resolvePool: resolver, txs: [tx('a', TODAY, 400)] });
    expect(r.byExpense.a).toMatchObject({ fromBudget: 400, governed: true });
  });
});

describe('Gullak deposits and special rows', () => {
  it("'From Income' deposits leave the income pool, 'External' deposits do not", () => {
    const r = run(
      [inc('i', 1000, '2026-10-10')],
      500,
      { deposits: [{ date: '2026-10-11', amount: 300, source: 'income' }, { date: '2026-10-11', amount: 999, source: 'external' }] }
    );
    expect(r.incomeRemaining).toBe(700);
  });

  it('reimbursements add spending power to the pool and are not income', () => {
    const r = run([
      { id: 'r', amount: 200, type: 'income', transaction_class: 'reimbursement', expense_date: TODAY, created_at: `${TODAY}T07:00:00Z` },
      exp('e', 650, TODAY),
    ]);
    expect(r.incomeReceived).toBe(0);
    expect(r.byExpense.e).toMatchObject({ fromBudget: 650, fromGullak: 0 });
  });

  it('self transfers are ignored completely', () => {
    const r = run([{ id: 't', amount: 5000, type: 'expense', transaction_class: 'self_transfer', expense_date: TODAY }, exp('e', 100, TODAY)]);
    expect(r.byExpense.t).toBeUndefined();
    expect(r.gullakDrawn).toBe(0);
  });

  it('Pure Mode / no budget: income and Gullak are left alone', () => {
    const r = run([inc('i', 1000, TODAY), exp('e', 400, TODAY)], 500, { isBudgetModeEnabled: false });
    expect(r.incomeRemaining).toBe(1000);
    expect(r.gullakDrawn).toBe(0);
  });
});

describe('Home pills: Daily / Weekly / Monthly / All income chip', () => {
  const expenses = [
    inc('inc-month', 2000, '2026-10-02'),   // earlier this month (last week)
    inc('inc-week', 600, '2026-10-12'),     // this week (today is Monday)
    exp('e-old', 700, '2026-10-02'),        // 200 over -> income
    exp('e-today', 900, TODAY),             // 400 over -> income
  ];
  const w = run(expenses);
  const inWeek = (d: string) => d >= '2026-10-12' && d <= '2026-10-18';
  const inMonth = (d: string) => d.startsWith('2026-10');
  const inDay = (d: string) => d === TODAY;

  it('Daily shows only today\'s income, reduced by today\'s overspend', () => {
    const s = summarizeScope(w, inDay);
    expect(s.incomeReceived).toBe(600);
    expect(s.incomeUsed).toBe(400);
    expect(s.incomeRemaining).toBe(200);
  });

  it('Weekly shows this week\'s income only', () => {
    expect(summarizeScope(w, inWeek).incomeReceived).toBe(600);
  });

  it('Monthly shows the whole month\'s income, reduced by the month\'s overspends', () => {
    const s = summarizeScope(w, inMonth);
    expect(s.incomeReceived).toBe(2600);
    expect(s.incomeUsed).toBe(600);
    expect(s.incomeRemaining).toBe(2000);
  });

  it('All shows exactly what is left of all income (never the overspend)', () => {
    const s = summarizeScope(w, () => true, true);
    expect(s.incomeRemaining).toBe(2000);
    expect(w.incomeRemaining).toBe(2000);
  });

  it('calculatePeriodSummary uses the waterfall for the chips (All pill shows today\'s new income)', () => {
    const base = run([exp('old', 900, '2026-10-10'), inc('today', 300, TODAY)]);
    const scope = summarizeScope(base, () => true, true);
    const r = calculatePeriodSummary({
      activeFilter: 'All', dailyBudgetAmount: 500, isAutoRenew: true, todayBudget: 500,
      dailyRecords: { '2026-10-10': { date: '2026-10-10', budget: 500, spent: 900, saved: 0, isFinalized: true, status: 'exceeded' } },
      totalIncome: 300, totalSpent: 900, filtered: [{ expense_date: '2026-10-10' }, { expense_date: TODAY }],
      referenceDate: new Date(2026, 9, 12), externalDepositsInPeriod: 0, planChanges: [],
      todaySpent: 0, spentByDate: { '2026-10-10': 900 },
      funding: { incomeRemaining: scope.incomeRemaining, gullakDrawn: scope.gullakDrawn },
    });
    expect(r.remainingIncome).toBe(300);
    expect(r.periodIncome).toBe(300);
  });

  it('income exhausted + Gullak used: chip shows 0 income and the exact Gullak amount', () => {
    const r = calculatePeriodSummary({
      activeFilter: 'Daily', dailyBudgetAmount: 500, isAutoRenew: true, todayBudget: 500, dailyRecords: {},
      totalIncome: 100, totalSpent: 800, filtered: [{ expense_date: TODAY }],
      referenceDate: new Date(2026, 9, 12), externalDepositsInPeriod: 0, planChanges: [],
      todaySpent: 800, spentByDate: { [TODAY]: 800 },
      funding: { incomeRemaining: 0, gullakDrawn: 200 },
    });
    expect(r.remainingIncome).toBe(0);
    expect(r.isSpendingFromGullak).toBe(true);
    expect(r.gullakDrawnAmount).toBe(200);
    // Everything (budget + income) is used up, so the hero says "exceeded"; the card adds the
    // "₹0 income / using ₹200 from Gullak" row from these two values.
    expect(r.isOverBudgetPeriod).toBe(true);
    expect(r.primarySubtext).toContain('Exceeded');
  });

  it('half income / half Gullak inside a pill: income chip shows what is left, Gullak shows the rest', () => {
    const r = calculatePeriodSummary({
      activeFilter: 'Daily', dailyBudgetAmount: 500, isAutoRenew: true, todayBudget: 500, dailyRecords: {},
      totalIncome: 1000, totalSpent: 1400, filtered: [{ expense_date: TODAY }],
      referenceDate: new Date(2026, 9, 12), externalDepositsInPeriod: 0, planChanges: [],
      todaySpent: 1400, spentByDate: { [TODAY]: 1400 },
      funding: { incomeRemaining: 100, gullakDrawn: 0 },
    });
    expect(r.remainingIncome).toBe(100);
    expect(r.primarySubtext).toContain('₹100 income');
  });

  it('within budget: income chip stays full and Gullak is not shown as used', () => {
    const r = calculatePeriodSummary({
      activeFilter: 'Daily', dailyBudgetAmount: 500, isAutoRenew: true, todayBudget: 500, dailyRecords: {},
      totalIncome: 300, totalSpent: 100, filtered: [{ expense_date: TODAY }],
      referenceDate: new Date(2026, 9, 12), externalDepositsInPeriod: 0, planChanges: [],
      todaySpent: 100, spentByDate: { [TODAY]: 100 },
      funding: { incomeRemaining: 300, gullakDrawn: 0 },
    });
    expect(r.remainingIncome).toBe(300);
    expect(r.isSpendingFromGullak).toBe(false);
    expect(r.primarySubtext).toContain('₹300 income');
  });
});

describe('Gullak: income never goes in, income-covered overspend never comes out', () => {
  const records: any = {
    '2026-10-10': { date: '2026-10-10', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
    '2026-10-11': { date: '2026-10-11', budget: 500, spent: 900, saved: 0, isFinalized: true, status: 'exceeded' },
  };

  it('income covered the overspend -> Gullak keeps the 300 saved', () => {
    const w = run([inc('i', 1000, '2026-10-09'), exp('a', 200, '2026-10-10'), exp('b', 900, '2026-10-11')]);
    expect(w.gullakDrawn).toBe(0);
    const m = calculateSavingsMetrics(records, TODAY, '2026-10-01', new Date(2026, 9, 12), 0, 0, undefined, w.gullakDrawn);
    expect(m.totalAccumulatedSavings).toBe(300);
  });

  it('no income -> the 400 overspend comes out of Gullak', () => {
    const w = run([exp('a', 200, '2026-10-10'), exp('b', 900, '2026-10-11')]);
    expect(w.gullakDrawn).toBe(400);
    const m = calculateSavingsMetrics(records, TODAY, '2026-10-01', new Date(2026, 9, 12), 0, 0, undefined, w.gullakDrawn);
    expect(m.totalAccumulatedSavings).toBe(0);
  });

  it('a day with big income and no spending saves only the budget', () => {
    expect(evaluateDayStatus(500, 0, 10000).saved).toBe(500);
  });

  it('Gullak never goes below zero', () => {
    const m = calculateSavingsMetrics({}, TODAY, undefined, new Date(2026, 9, 12), 0, 0, undefined, 9999);
    expect(m.totalAccumulatedSavings).toBe(0);
  });
});

describe('resolver edge cases', () => {
  it('unknown / zero-budget days are not governed', () => {
    const resolve = buildPoolResolver({
      isBudgetModeEnabled: true, isAutoRenew: true, todayStr: TODAY, dailyBudgetAmount: 500,
      records: { '2026-10-05': { budget: 0, status: 'unknown' } },
    });
    expect(resolve('2026-10-05')).toBeNull();
  });

  it('past day uses the budget saved in that day\'s record, not today\'s budget', () => {
    const resolve = buildPoolResolver({
      isBudgetModeEnabled: true, isAutoRenew: true, todayStr: TODAY, dailyBudgetAmount: 900,
      records: { '2026-10-05': { budget: 250, status: 'saved' } },
    });
    expect(resolve('2026-10-05')?.budget).toBe(250);
  });

  it('daily resolver sanity', () => {
    expect(dailyResolver(500)(TODAY)).toEqual({ key: `daily_${TODAY}`, budget: 500 });
  });
});
