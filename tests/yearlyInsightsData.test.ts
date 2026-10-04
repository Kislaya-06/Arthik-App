import { describe, it, expect } from 'vitest';
import { parseISO } from 'date-fns';
import {
  computeActiveDaysInYear,
  computeAnnualDailyBurn,
  computeYearlySpend,
  computeYearlyComparison,
  computeYearlyInflow,
  computeAnnualNetCashFlow,
  computeAnnualSavingsRate,
  computeSmartYearlyTakeaway,
  compute12MonthCashFlow,
  computeAnnualBudgetDiscipline,
  computeAnnualCapitalOutlier,
  computeAnnualCategoryTrajectory,
  ExpenseLike,
} from '../src/lib/yearlyInsightsUtils';
import type { Category } from '../src/store/categoryStore';
import type { GullakDeposit } from '../src/store/dailyBudgetStore';

describe('Yearly Insights Pure Analytics & Engine', () => {
  const mockCategories: Category[] = [
    { id: 'cat-food', name: 'Food & Dining', color: '#F07167', icon: 'Utensils', user_id: 'test-user', is_default: false },
    { id: 'cat-shopping', name: 'Shopping', color: '#00AFB9', icon: 'ShoppingBag', user_id: 'test-user', is_default: false },
    { id: 'cat-bills', name: 'Rent & Bills', color: '#F4A261', icon: 'Home', user_id: 'test-user', is_default: false },
    { id: 'cat-flight', name: 'Travel', color: '#3A86FF', icon: 'Plane', user_id: 'test-user', is_default: false },
    { id: 'cat-income', name: 'Salary', color: '#10B981', icon: 'Wallet', user_id: 'test-user', is_default: false },
  ];

  const y2026Start = parseISO('2026-01-01');
  const y2026End = parseISO('2026-12-31');
  const y2026Interval = { start: y2026Start, end: y2026End };

  const y2025Start = parseISO('2025-01-01');
  const y2025End = parseISO('2025-12-31');
  const y2025Interval = { start: y2025Start, end: y2025End };

  const refDate = parseISO('2026-10-02'); // Day 275 of 2026

  describe('Ticket 1: Annual Spend, Active Days & Inflow Analytics', () => {
    it('calculates total yearly spend ignoring income transactions and outside dates', () => {
      const expenses: ExpenseLike[] = [
        { id: '1', amount: 50000, expense_date: '2026-02-15', category_id: 'cat-bills' },
        { id: '2', amount: 15000, expense_date: '2026-08-20', category_id: 'cat-shopping' },
        { id: '3', amount: 200000, expense_date: '2026-01-01', category_id: 'cat-income' }, // Income
        { id: '4', amount: 10000, expense_date: '2025-12-31', category_id: 'cat-food' }, // Prior year
      ];

      const spend = computeYearlySpend(expenses, mockCategories, y2026Interval);
      expect(spend).toBe(65000);
    });

    it('computes active registered days for full years, in-progress years, and mid-year joiners', () => {
      // Past completed year (2025 non-leap)
      const pastDays = computeActiveDaysInYear(y2025Start, refDate, '2024-01-01', true);
      expect(pastDays).toBe(365);

      // Past leap year (2024 leap year)
      const leapDays = computeActiveDaysInYear(parseISO('2024-01-01'), refDate, '2023-01-01', true);
      expect(leapDays).toBe(366);

      // Current in-progress year (Jan 1 to Oct 2 = 275 days)
      const currDays = computeActiveDaysInYear(y2026Start, refDate, '2025-01-01', false);
      expect(currDays).toBe(275);

      // Mid-year joiner (joined on August 15, 2026, reference Oct 2 = 49 days)
      const midYearDays = computeActiveDaysInYear(y2026Start, refDate, '2026-08-15', false);
      expect(midYearDays).toBe(49);
    });

    it('computes annual daily burn velocity accurately without diluting mid-year joiners', () => {
      // User with 275 active days spending 2,75,000 -> 1000/day
      expect(computeAnnualDailyBurn(275000, 275)).toBe(1000);

      // Mid-year joiner with 49 active days spending 49,000 -> 1000/day
      expect(computeAnnualDailyBurn(49000, 49)).toBe(1000);

      // Zero spend
      expect(computeAnnualDailyBurn(0, 275)).toBe(0);
    });

    it('derives real-money annual inflow combining operational budget allowance, direct income, and external deposits', () => {
      const expenses: ExpenseLike[] = [
        { id: '1', amount: 50000, expense_date: '2026-03-01', category_id: 'cat-income' }, // Direct income
      ];
      const deposits: GullakDeposit[] = [
        { id: 'd1', date: '2026-05-10', amount: 10000, source: 'external', created_at: '2026-05-10T10:00:00Z' },
        { id: 'd2', date: '2026-06-01', amount: 500, source: 'daily_savings' as any, created_at: '2026-06-01T10:00:00Z' },
      ];

      // Budget mode daily 500 across 275 active days = 1,37,500 budget allowance
      // Inflow = 1,37,500 + 50,000 + 10,000 = 1,97,500
      const inflow = computeYearlyInflow(
        expenses,
        mockCategories,
        [],
        deposits,
        { isBudgetMode: true, cadence: 'daily', dailyBudgetAmount: 500 },
        y2026Interval,
        refDate,
        '2025-01-01'
      );
      expect(inflow).toBe(197500);
    });

    it('evaluates net cash flow and annual savings rate with division-by-zero protection', () => {
      // Surplus: 2,00,000 Inflow, 1,50,000 Outflow, 30,000 Saved in Gullak
      const cashFlow = computeAnnualNetCashFlow(200000, 150000);
      expect(cashFlow.isSurplus).toBe(true);
      expect(cashFlow.netCashFlow).toBe(50000);

      const rate = computeAnnualSavingsRate(30000, 200000);
      expect(rate).toBe(15); // (30,000 / 2,00,000) * 100

      // Zero inflow protection
      expect(computeAnnualSavingsRate(10000, 0)).toBeNull();
      expect(computeAnnualSavingsRate(0, 100000)).toBeNull();
    });
  });

  describe('Ticket 2: Day-Matched YTD Comparison & Baseline Guards', () => {
    it('compares Day 1..275 of current year against Day 1..275 of previous year', () => {
      const expenses: ExpenseLike[] = [
        // 2026 (Jan 1..Oct 2)
        { id: '1', amount: 100000, expense_date: '2026-03-01', category_id: 'cat-bills' },
        { id: '2', amount: 50000, expense_date: '2026-09-15', category_id: 'cat-shopping' },
        // 2025 (Matched Jan 1..Oct 2)
        { id: '3', amount: 80000, expense_date: '2025-03-01', category_id: 'cat-bills' },
        { id: '4', amount: 40000, expense_date: '2025-09-15', category_id: 'cat-shopping' },
        // 2025 (Outside matched window: Nov 15)
        { id: '5', amount: 60000, expense_date: '2025-11-15', category_id: 'cat-bills' },
      ];

      // 2026 Total = 1,50,000
      // 2025 Matched = 1,20,000 (ignoring 60,000 from Nov 15)
      // Delta = +30,000 (+25%)
      const comp = computeYearlyComparison(
        expenses,
        mockCategories,
        y2026Interval,
        y2025Interval,
        0,
        refDate,
        '2024-01-01'
      );

      expect(comp.currentTotal).toBe(150000);
      expect(comp.matchedPrevTotal).toBe(120000);
      expect(comp.percentageChange).toBe(25);
      expect(comp.isIncrease).toBe(true);
      expect(comp.trendLabel).toBe('+25% vs same period in 2025');
    });

    it('suppresses misleading fake 100% for first-year users and displays First Year badge', () => {
      const expenses: ExpenseLike[] = [
        { id: '1', amount: 50000, expense_date: '2026-05-01', category_id: 'cat-bills' },
      ];

      // User registered in 2026 (first year)
      const comp = computeYearlyComparison(
        expenses,
        mockCategories,
        y2026Interval,
        y2025Interval,
        0,
        refDate,
        '2026-03-01'
      );

      expect(comp.percentageChange).toBeNull();
      expect(comp.trendLabel).toBe('First Year with Arthik');
      expect(comp.currentTotal).toBe(50000);
    });

    it('compares full 12 months when viewing past years (offset < 0)', () => {
      const expenses: ExpenseLike[] = [
        // 2025 full year: 1,80,000
        { id: '1', amount: 100000, expense_date: '2025-04-01', category_id: 'cat-bills' },
        { id: '2', amount: 80000, expense_date: '2025-12-15', category_id: 'cat-bills' },
        // 2024 full year: 2,00,000
        { id: '3', amount: 200000, expense_date: '2024-06-01', category_id: 'cat-bills' },
      ];

      const y2024Interval = { start: parseISO('2024-01-01'), end: parseISO('2024-12-31') };

      const comp = computeYearlyComparison(
        expenses,
        mockCategories,
        y2025Interval,
        y2024Interval,
        -1,
        refDate,
        '2023-01-01'
      );

      expect(comp.currentTotal).toBe(180000);
      expect(comp.matchedPrevTotal).toBe(200000);
      expect(comp.percentageChange).toBe(10);
      expect(comp.isIncrease).toBe(false);
      expect(comp.trendLabel).toBe('−10% vs 2024');
    });
  });

  describe('Ticket 3: Insight Engine (12-Month Flow, Outliers, Trajectory & Discipline)', () => {
    it('aggregates 12-month cash flow with inactive future month guards and peak month detection', () => {
      const expenses: ExpenseLike[] = [
        { id: '1', amount: 25000, expense_date: '2026-01-15', category_id: 'cat-bills' },
        { id: '2', amount: 80000, expense_date: '2026-05-10', category_id: 'cat-shopping' }, // Peak month May
        { id: '3', amount: 30000, expense_date: '2026-09-05', category_id: 'cat-food' },
      ];

      const flow = compute12MonthCashFlow(
        y2026Start,
        y2026End,
        expenses,
        mockCategories,
        [],
        { isBudgetMode: true, cadence: 'daily', dailyBudgetAmount: 1000 },
        '2025-01-01',
        refDate // Oct 2, 2026 -> Oct is index 9, Nov (10) and Dec (11) are future
      );

      expect(flow.months.length).toBe(12);
      expect(flow.peakMonthName).toBe('May');
      expect(flow.peakMonthSpent).toBe(80000);

      // Future month guards
      expect(flow.months[10].isFuture).toBe(true); // November
      expect(flow.months[11].isFuture).toBe(true); // December
      expect(flow.months[9].isCurrentMonth).toBe(true); // October (month 9)
      expect(flow.months[4].spent).toBe(80000); // May

      expect(flow.chartSubtitle).toContain('May had highest outflow');
    });

    it('evaluates annual budget discipline evaluating completed months only', () => {
      // 9 completed months (Jan..Sep). Suppose in Jan, Feb, Mar, Apr, Jun, Jul, Aug, Sep spend <= budget (8 months),
      // and in May spend was 80,000 (exceeded 31,000 budget).
      const expenses: ExpenseLike[] = [
        { id: '1', amount: 80000, expense_date: '2026-05-10', category_id: 'cat-shopping' }, // Over budget in May
      ];

      const discipline = computeAnnualBudgetDiscipline(
        expenses,
        mockCategories,
        y2026Interval,
        { isBudgetMode: true, cadence: 'daily', dailyBudgetAmount: 1000 },
        '2025-01-01',
        refDate // Oct 2 -> Jan..Sep are completed (9 completed months)
      );

      expect(discipline.canDisplay).toBe(true);
      expect(discipline.totalCompletedMonths).toBe(9);
      expect(discipline.keptMonths).toBe(8); // All except May
      expect(discipline.consistencyRatio).toBe(89); // 8/9 = 88.88% -> 89%
      expect(discipline.disciplineText).toContain('8 of 9 months kept within budget');
    });

    it('isolates annual capital outlier meeting threshold of >= ₹500 and >= 5% of year', () => {
      const expenses: ExpenseLike[] = [
        { id: '1', amount: 45000, expense_date: '2026-08-14', category_id: 'cat-flight', notes: 'Flight to London' },
        { id: '2', amount: 2000, expense_date: '2026-03-10', category_id: 'cat-food', notes: 'Dinner' },
      ];
      const annualSpend = 500000; // 45,000 / 500,000 = 9% (qualifies)

      const outlier = computeAnnualCapitalOutlier(expenses, mockCategories, annualSpend, y2026Interval);
      expect(outlier).not.toBeNull();
      expect(outlier?.expense.amount).toBe(45000);
      expect(outlier?.outflowPercent).toBe(9);
      expect(outlier?.categoryName).toBe('Travel');

      // Does not qualify if < 5%
      const smallOutlier = computeAnnualCapitalOutlier(expenses, mockCategories, 1000000, y2026Interval); // 45k/1M = 4.5% < 5%
      expect(smallOutlier).toBeNull();
    });

    it('computes H1 vs H2 category trajectory when user has >= 2 active months in each half', () => {
      const expenses: ExpenseLike[] = [
        // H1 (Dining Out high in H1: 30,000)
        { id: '1', amount: 15000, expense_date: '2026-02-10', category_id: 'cat-food' },
        { id: '2', amount: 15000, expense_date: '2026-04-10', category_id: 'cat-food' },
        // H2 (Dining Out drops to 5,000 in H2 -> delta = -25,000)
        { id: '3', amount: 5000, expense_date: '2026-08-10', category_id: 'cat-food' },
      ];

      const trajectory = computeAnnualCategoryTrajectory(
        expenses,
        mockCategories,
        y2026Interval,
        50000,
        '2025-01-01',
        refDate // Oct 2 (H1 has 6 months, H2 has July, Aug, Sep = 3 months >= 2)
      );

      expect(trajectory).not.toBeNull();
      expect(trajectory?.mode).toBe('category_shift');
      expect(trajectory?.categoryName).toBe('Food & Dining');
      expect(trajectory?.isIncrease).toBe(false);
      expect(trajectory?.absDelta).toBe(25000);
      expect(trajectory?.shiftPercent).toBe(83); // (25,000 / 30,000) * 100
    });

    it('falls back to Primary Expense Driver when user joined mid-year with < 2 months in H1', () => {
      const expenses: ExpenseLike[] = [
        { id: '1', amount: 20000, expense_date: '2026-08-10', category_id: 'cat-shopping' },
        { id: '2', amount: 10000, expense_date: '2026-09-10', category_id: 'cat-shopping' },
      ];

      // User joined August 1, 2026 -> 0 active months in H1
      const trajectory = computeAnnualCategoryTrajectory(
        expenses,
        mockCategories,
        y2026Interval,
        30000,
        '2026-08-01',
        refDate
      );

      expect(trajectory).not.toBeNull();
      expect(trajectory?.mode).toBe('primary_driver');
      expect(trajectory?.categoryName).toBe('Shopping');
      expect(trajectory?.annualAmount).toBe(30000);
      expect(trajectory?.percentageOfTotal).toBe(100);
    });

    it('generates smart annual takeaway copy accurately for surplus and deficit', () => {
      const surplus = computeSmartYearlyTakeaway(78000, 22, 10, true, 42000);
      expect(surplus.status).toBe('green');
      expect(surplus.text).toContain('net surplus of +₹78,000');
      expect(surplus.text).toContain('22% annual savings rate');

      const deficit = computeSmartYearlyTakeaway(-25000, null, 10, true, 0);
      expect(deficit.status).toBe('coral');
      expect(deficit.text).toContain('Annual outflow exceeded inflows by ₹25,000');
    });
  });
});
