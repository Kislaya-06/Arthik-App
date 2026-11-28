import { describe, it, expect } from 'vitest';
import { computeYearlyInflow, compute12MonthCashFlow, computeAnnualBudgetDiscipline } from '../src/lib/yearlyInsightsUtils';
import { computeMonthlyCashFlowData } from '../src/lib/charts/monthlyCharts';
import { monthlyBudgetAmountOnDate, type AllowanceHistory } from '../src/money/budgetAllowance';

const TODAY = new Date('2026-04-15T12:00:00');
const YEAR = { start: new Date('2026-01-01T00:00:00'), end: new Date('2026-12-31T00:00:00') };
const JAN = { start: new Date('2026-01-01T00:00:00'), end: new Date('2026-01-31T00:00:00') };
const JOINED = '2026-01-01';

const plan = (effectiveFrom: string, amount: number, isEnabled = true, cadence: 'daily' | 'weekly' | 'monthly' = 'daily') =>
  ({ id: effectiveFrom, userId: 'u', effectiveFrom, isEnabled, cadence, amount });

const history = (planChanges: ReturnType<typeof plan>[], isAutoRenew = true): AllowanceHistory => ({
  planChanges, dailyRecords: {}, todayKey: '2026-04-15', isAutoRenew, fallbackPlan: null,
});

const bars = (cfg: any, h: AllowanceHistory) =>
  compute12MonthCashFlow(YEAR.start, YEAR.end, [], [], [], cfg, JOINED, TODAY, h);
const janChart = (cfg: any, h: AllowanceHistory) =>
  computeMonthlyCashFlowData(JAN.start, JAN.end, [], [], JOINED, cfg, TODAY, h);
const tile = (cfg: any, h: AllowanceHistory) =>
  computeYearlyInflow([], [], {}, [], cfg, YEAR, TODAY, JOINED, h);
const spend = (amount: number, expense_date: string) => ({ amount, expense_date, type: 'expense' }) as any;

describe('INS-004 / INS-006: Insights charts price past days from the plan history', () => {
  it('keeps past Budget Mode money in the bars after a switch to Pure Mode', () => {
    const h = history([plan('2026-01-01', 100), plan('2026-03-01', 100, false)], false);
    const cfg = { isBudgetMode: false, cadence: 'daily', dailyBudgetAmount: 100 };
    expect(tile(cfg, h)).toBe(5900);
    expect(bars(cfg, h).totalIncome).toBe(5900);
    expect(janChart(cfg, h).totalIncome).toBe(3100);
  });

  it('does not reprice past days when the budget is raised today', () => {
    const h = history([plan('2026-01-01', 100), plan('2026-04-15', 500)]);
    const cfg = { isBudgetMode: true, cadence: 'daily', dailyBudgetAmount: 500 };
    expect(bars(cfg, h).totalIncome).toBe(10900);
    expect(bars(cfg, h).totalIncome).toBe(tile(cfg, h));
    expect(janChart(cfg, h).totalIncome).toBe(3100);
  });

  it('gives future days nothing', () => {
    const h = history([plan('2026-01-01', 100)]);
    const months = bars({ isBudgetMode: true, cadence: 'daily', dailyBudgetAmount: 100 }, h).months;
    expect(months[3].income).toBe(1500);
    expect(months[4].income).toBe(0);
  });

  it('judges each month against the budget it really had', () => {
    const h = history([plan('2026-01-01', 100), plan('2026-04-15', 500)]);
    const result = computeAnnualBudgetDiscipline([spend(5000, '2026-01-10')], [], YEAR,
      { isBudgetMode: true, cadence: 'daily', dailyBudgetAmount: 500 }, JOINED, TODAY, h);
    expect([result.keptMonths, result.totalCompletedMonths]).toEqual([2, 3]);
  });

  it('counts only spending of budget days, and leaves out months with no budget day', () => {
    // Budget 1-15 Jan only. Feb is fully Pure Mode. March has budget again.
    const h = history([plan('2026-01-01', 100), plan('2026-01-16', 100, false), plan('2026-03-01', 100)]);
    const result = computeAnnualBudgetDiscipline(
      [spend(1000, '2026-01-05'), spend(5000, '2026-01-20'), spend(9000, '2026-02-10')], [], YEAR,
      { isBudgetMode: true, cadence: 'daily', dailyBudgetAmount: 100 }, JOINED, TODAY, h);
    expect([result.keptMonths, result.totalCompletedMonths]).toEqual([2, 2]);
  });
});

describe('INS-002: month budget share uses the monthly budget of that week', () => {
  const changes = [plan('2026-01-01', 30000, true, 'monthly'), plan('2026-04-01', 60000, true, 'monthly')];

  it('reads the plan that ruled the given day', () => {
    expect(monthlyBudgetAmountOnDate(changes, '2026-03-08', 60000)).toBe(30000);
    expect(monthlyBudgetAmountOnDate(changes, '2026-04-15', 60000)).toBe(60000);
  });

  it('keeps the current amount when that day had no monthly plan', () => {
    expect(monthlyBudgetAmountOnDate([plan('2026-01-01', 100)], '2026-03-08', 60000)).toBe(60000);
    expect(monthlyBudgetAmountOnDate([plan('2026-01-01', 30000, false, 'monthly')], '2026-03-08', 60000)).toBe(60000);
    expect(monthlyBudgetAmountOnDate([], '2026-03-08', 60000)).toBe(60000);
  });
});
