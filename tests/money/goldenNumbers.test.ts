/**
 * GOLDEN NUMBERS: the safety net for the "one calculation, used everywhere" refactor.
 *
 * One fixed set of transactions is run through every public calculation that the screens use. The expected values
 * were recorded from the code BEFORE the refactor. If any of them moves, a screen would show a different rupee amount.
 *
 * Exactly four numbers changed on purpose. They all belong to a MONTHLY budget (canonical rule BUD-009: a monthly
 * budget is spread over the ACTUAL days of each calendar month, the same way on every screen). Each one carries a
 * "was ..." comment below. Daily and weekly budgets, spending, income, money back and self-transfers did not move.
 */
import { describe, it, expect } from 'vitest';
import { computeWeeklySpend, computeBudgetHealth, computeEffectiveWeekBudget } from '../../src/lib/weeklyInsightsUtils';
import { computeMonthlySpend, computeMonthlyBudgetHealth, computeEffectiveMonthBudget } from '../../src/lib/monthlyInsightsUtils';
import {
  computeYearlySpend,
  computeYearlyInflow,
  compute12MonthCashFlow,
  computeAnnualBudgetDiscipline,
} from '../../src/lib/yearlyInsightsUtils';
import { computeMonthlyCashFlowData } from '../../src/lib/chartUtils';
import {
  calculateCycleFinancials,
  calculateTodayMetrics,
  computeSpentByDate,
  computeIncomeByDate,
} from '../../src/lib/budgetCalculations';
import { isIncomeTransaction, isEligibleIncome } from '../../src/lib/transactionUtils';

const row = (id: string, amount: number, date: string, extra: Record<string, unknown> = {}) => ({
  id,
  amount,
  expense_date: date,
  type: 'expense',
  ...extra,
});

const expenses: any[] = [
  row('e1', 400, '2026-10-01'),
  row('e2', 250.55, '2026-10-02'),
  row('e3', 5000, '2026-10-02', { type: 'income' }),
  row('e4', 1000, '2026-10-03', { transaction_class: 'self_transfer' }),
  row('e5', 100.1, '2026-10-05'),
  row('e6', 0.1, '2026-10-06'),
  row('e7', 0.2, '2026-10-06'),
  row('e8', 100, '2026-10-06', { type: 'income', transaction_class: 'recovery' }),
  row('e9', 900, '2026-10-10'),
  row('e10', 300, '2026-09-20'),
  row('e11', 700, '2026-11-02'),
];

const week = { start: new Date(2026, 9, 5), end: new Date(2026, 9, 11) };
const month = { start: new Date(2026, 9, 1), end: new Date(2026, 9, 31) };
const year = { start: new Date(2026, 0, 1), end: new Date(2026, 11, 31) };
const today = new Date(2026, 9, 20);

const monthlyPlan = { isBudgetMode: true, cadence: 'monthly' as const, monthlyBudgetAmount: 3100 };
const weeklyPlan = { isBudgetMode: true, cadence: 'weekly' as const, weeklyBudgetAmount: 700 };
const dailyPlan = { isBudgetMode: true, cadence: 'daily' as const, dailyBudgetAmount: 100 };

describe('golden numbers: spending totals (unchanged)', () => {
  it('weekly, monthly and yearly spend skip income, money back and self-transfers', () => {
    expect(computeWeeklySpend(expenses, [], week)).toBe(1000.4);
    expect(computeMonthlySpend(expenses, [], month)).toBe(1650.95);
    expect(computeYearlySpend(expenses, [], year)).toBe(2650.95);
  });

  it('per-day spending and income maps', () => {
    expect(computeSpentByDate(expenses, (e: any) => isIncomeTransaction(e))).toEqual({
      '2026-10-01': 400,
      '2026-10-02': 250.55,
      '2026-10-05': 100.1,
      '2026-10-06': 0.3,
      '2026-10-10': 900,
      '2026-09-20': 300,
      '2026-11-02': 700,
    });
    expect(computeIncomeByDate(expenses, (e: any) => isEligibleIncome(e))).toEqual({ '2026-10-02': 5000 });
  });
});

describe('golden numbers: left / over / ratio (unchanged)', () => {
  it('weekly and monthly budget health', () => {
    expect(computeBudgetHealth(1000, 1250.4)).toEqual({ remaining: 0, overAmount: 250.4, isOverBudget: true, ratio: 1 });
    expect(computeMonthlyBudgetHealth(3000, 2999.99)).toEqual({ remaining: 0.01, overAmount: 0, isOverBudget: false, ratio: 1 });
  });

  it('cycle engine and today metrics', () => {
    expect(calculateCycleFinancials({ scheduledBudget: 500, carriedOverAmount: 50, eligibleIncome: 0, spent: 620.5 })).toEqual({
      spendable: 550, spent: 620.5, remaining: 0, isOverBudget: true, overAmount: 70.5, gullakDeposit: 0, status: 'missed',
    });
    expect(calculateCycleFinancials({ scheduledBudget: 500, spent: 120.3333 })).toEqual({
      spendable: 500, spent: 120.33, remaining: 379.67, isOverBudget: false, overAmount: 0, gullakDeposit: 379.67, status: 'saved',
    });
    expect(
      calculateTodayMetrics({ date: '2026-10-20', budget: 500, spent: 612.504, saved: 0, isFinalized: false, status: 'active' } as any)
    ).toEqual({ budget: 500, spent: 612.5, remaining: 0, progressRatio: 1, isOverBudget: true, overAmount: 112.5, saved: 0 });
  });
});

describe('golden numbers: budget allowance for daily and weekly budgets (unchanged)', () => {
  it('weekly insights', () => {
    expect(computeEffectiveWeekBudget('daily', 100, 0, null, week)).toEqual({ effectiveBudget: 700, activeDays: 7, isPartialFirstWeek: false });
    expect(computeEffectiveWeekBudget('weekly', 0, 700, null, week)).toEqual({ effectiveBudget: 700, activeDays: 7, isPartialFirstWeek: false });
  });

  it('monthly insights', () => {
    expect(computeEffectiveMonthBudget('daily', 100, 0, 0, null, month).effectiveBudget).toBe(3100);
    expect(computeEffectiveMonthBudget('weekly', 0, 700, 0, null, month).effectiveBudget).toBe(3100);
    expect(computeEffectiveMonthBudget('monthly', 0, 0, 3100, null, month).effectiveBudget).toBe(3100);
    expect(computeEffectiveMonthBudget('monthly', 0, 0, 3100, '2026-10-16', month)).toEqual({
      effectiveBudget: 1600, activeDays: 16, totalDays: 31, isPartialFirstMonth: true,
    });
  });

  it('yearly insights for daily and weekly budgets', () => {
    expect(computeYearlyInflow(expenses, [], [], [], weeklyPlan, year, today, '2026-01-01')).toBe(34300);
    expect(computeYearlyInflow(expenses, [], [], [], dailyPlan, year, today, '2026-01-01')).toBe(34300);
  });

  it('month chart bars for a monthly budget (it already used the real days of the month)', () => {
    const data = computeMonthlyCashFlowData(month.start, month.end, expenses, [], undefined, undefined, monthlyPlan, today);
    expect(data.weeks.map((w: any) => [w.income, w.spent])).toEqual([
      [5700, 750.95],
      [700, 900],
      [600, 0],
      [0, 0],
    ]);
  });
});

describe('golden numbers: the four numbers that changed on purpose (BUD-009, monthly budget 3100)', () => {
  it('weekly insights: a week of a 31-day month is worth 700, not 723.33', () => {
    // was 723.33 (monthly / 30 * 7)
    expect(computeEffectiveWeekBudget('monthly', 0, 0, null, week, 3100)).toEqual({
      effectiveBudget: 700, activeDays: 7, isPartialFirstWeek: false,
    });
  });

  it('weekly insights: a user who joined mid-week gets 4 days x 100, not 413.33', () => {
    // was 413.33 (monthly / 30 * 4)
    expect(computeEffectiveWeekBudget('monthly', 0, 0, '2026-10-08', week, 3100)).toEqual({
      effectiveBudget: 400, activeDays: 4, isPartialFirstWeek: true,
    });
  });

  it('yearly insights: money in for the year (9 full months + 20 days of October + 5000 income)', () => {
    // was 34862 (monthly / 30.4167 per day). Now 9 x 3100 + 20 x 100 + 5000 = 34900.
    expect(computeYearlyInflow(expenses, [], [], [], monthlyPlan, year, today, '2026-01-01')).toBe(34900);
  });

  it('yearly insights: every full month of a 3100 budget is worth 3100, in 28, 30 and 31 day months', () => {
    // was [3159, 2854, 3159, 3058, ...] (it moved with the month length), now flat.
    const cashFlow = compute12MonthCashFlow(year.start, year.end, expenses, [], [], monthlyPlan, '2026-01-01', today);
    expect(cashFlow.months.map((m: any) => [m.income, m.spent])).toEqual([
      [3100, 0], [3100, 0], [3100, 0], [3100, 0], [3100, 0], [3100, 0], [3100, 0], [3100, 0],
      [3100, 300],
      [7000, 1650.95], // 20 days of October (2000) + 5000 income
      [0, 0],
      [0, 0],
    ]);
  });

  it('yearly discipline for monthly and weekly budgets (same counts as before for this data)', () => {
    const end = new Date(2026, 11, 31);
    expect(computeAnnualBudgetDiscipline(expenses, [], year, monthlyPlan, '2026-01-01', end).keptMonths).toBe(11);
    expect(computeAnnualBudgetDiscipline(expenses, [], year, weeklyPlan, '2026-01-01', end).keptMonths).toBe(11);
  });
});
