/**
 * INS-004 / INS-006 (owner decision 2026-11-25): Insights count budget money only for the days Budget Mode was really
 * on, each at that day's own rate. Pure Mode days and paused days (auto-save off) are worth nothing.
 */
import { describe, it, expect } from 'vitest';
import { allowanceFromHistory, AllowanceHistory } from '../src/money/budgetAllowance';
import { computeEffectiveWeekBudget } from '../src/lib/weeklyInsightsUtils';
import { computeEffectiveMonthBudget } from '../src/lib/monthlyInsightsUtils';
import { computeYearlyInflow } from '../src/lib/yearlyInsightsUtils';
import type { BudgetPlanChange } from '../src/types';

const change = (effectiveFrom: string, isEnabled: boolean, cadence: BudgetPlanChange['cadence'] = 'daily', amount = 100): BudgetPlanChange => ({
  id: effectiveFrom,
  userId: 'u1',
  effectiveFrom,
  isEnabled,
  cadence,
  amount,
});

const history = (over: Partial<AllowanceHistory> = {}): AllowanceHistory => ({
  planChanges: [change('2026-01-01', true)],
  dailyRecords: {},
  todayKey: '2026-11-25',
  isAutoRenew: true,
  fallbackPlan: { cadence: 'daily', dailyBudgetAmount: 100 },
  ...over,
});

describe('allowanceFromHistory (INS-004)', () => {
  it('counts every Budget Mode day at its own rate', () => {
    expect(allowanceFromHistory(history(), '2026-11-01', '2026-11-10')).toBe(1000);
  });

  it('gives nothing for Pure Mode days', () => {
    const h = history({ planChanges: [change('2026-01-01', true), change('2026-11-04', false), change('2026-11-16', true)] });
    // Nov 1-3 budget (300), Nov 4-15 Pure (0), Nov 16-20 budget (500)
    expect(allowanceFromHistory(h, '2026-11-01', '2026-11-20')).toBe(800);
  });

  it('uses the rate of the plan that ruled each day, not today\'s rate', () => {
    const h = history({ planChanges: [change('2026-01-01', true, 'daily', 100), change('2026-11-06', true, 'daily', 250)] });
    expect(allowanceFromHistory(h, '2026-11-01', '2026-11-10')).toBe(5 * 100 + 5 * 250);
  });

  it('a paused day (record with budget 0) is worth nothing', () => {
    const h = history({
      dailyRecords: {
        '2026-11-02': { budget: 0, status: 'unknown' },
        '2026-11-03': { budget: 100, status: 'saved' },
      },
    });
    expect(allowanceFromHistory(h, '2026-11-02', '2026-11-03')).toBe(100);
  });

  it('while paused, today and later days are worth nothing', () => {
    const h = history({ isAutoRenew: false });
    expect(allowanceFromHistory(h, '2026-11-23', '2026-11-29')).toBe(200); // only Nov 23 & 24
  });

  it('weekly and monthly days use the per-day share of that plan', () => {
    const h = history({ planChanges: [change('2026-11-01', true, 'monthly', 3000)] });
    expect(allowanceFromHistory(h, '2026-11-01', '2026-11-10')).toBeCloseTo(1000, 6);
    const w = history({ planChanges: [change('2026-11-01', true, 'weekly', 700)] });
    expect(allowanceFromHistory(w, '2026-11-02', '2026-11-08')).toBeCloseTo(700, 6);
  });

  it('with no plan history at all, falls back to the current plan (old accounts)', () => {
    expect(allowanceFromHistory(history({ planChanges: [] }), '2026-11-01', '2026-11-03')).toBe(300);
    expect(allowanceFromHistory(history({ planChanges: [], fallbackPlan: null }), '2026-11-01', '2026-11-03')).toBe(0);
  });
});

describe('Insights tabs read the history (INS-004 / INS-006)', () => {
  // 12 days of Pure Mode in the middle of a ₹100/day user
  const planChanges = [change('2026-01-01', true), change('2026-11-04', false), change('2026-11-16', true)];

  it('week pool skips the Pure Mode days', () => {
    const week = { start: new Date(2026, 10, 9), end: new Date(2026, 10, 15) }; // fully Pure
    const h = history({ planChanges });
    expect(computeEffectiveWeekBudget('daily', 100, 0, '2026-01-01', week, 0, h).effectiveBudget).toBe(0);
    // without history the old behaviour stays
    expect(computeEffectiveWeekBudget('daily', 100, 0, '2026-01-01', week).effectiveBudget).toBe(700);
  });

  it('month pool skips the Pure Mode days', () => {
    const month = { start: new Date(2026, 10, 1), end: new Date(2026, 10, 30) };
    const h = history({ planChanges });
    // Nov 1-3 (300) + Nov 16-30 (1500); 12 Pure days not counted
    expect(computeEffectiveMonthBudget('daily', 100, 0, 0, '2026-01-01', month, h).effectiveBudget).toBe(1800);
  });

  it('yearly inflow skips Pure Mode days, and keeps past budget days while Pure now (real money)', () => {
    const year = { start: new Date(2026, 0, 1), end: new Date(2026, 11, 31) };
    const today = new Date(2026, 10, 25);
    const h = history({ planChanges });
    const config = { isBudgetMode: true, cadence: 'daily' as const, dailyBudgetAmount: 100, weeklyBudgetAmount: 0, monthlyBudgetAmount: 0 };
    // Jan 1 - Nov 25 = 329 days, minus 12 Pure days = 317
    expect(computeYearlyInflow([], [], [], [], config, year, today, '2026-01-01', h)).toBe(31700);

    const pureNow = history({ planChanges: [change('2026-01-01', true), change('2026-11-20', false)], isAutoRenew: false, fallbackPlan: null });
    // Jan 1 - Nov 19 = 323 budget days still count even though the user is in Pure Mode today
    expect(computeYearlyInflow([], [], [], [], { ...config, isBudgetMode: false }, year, today, '2026-01-01', pureNow)).toBe(32300);
  });
});
