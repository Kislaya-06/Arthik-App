import { describe, it, expect } from 'vitest';
import { calculatePeriodSummary, PeriodCalculationParams } from '../src/lib/homeCalculations';
import { DailyRecord } from '../src/lib/budgetCalculations';

describe('calculatePeriodSummary - Hero Summary Card Engine', () => {
  // Reference date: Friday, 18 September 2026
  // Monday of this week: 2026-09-14
  // First of this month: 2026-09-01
  const REF_DATE = new Date(2026, 8, 18, 12, 0, 0);
  const USER_CREATED = '2026-09-14'; // Joined on Monday

  const baseParams: PeriodCalculationParams = {
    activeFilter: 'Daily',
    dailyBudgetAmount: 500,
    isAutoRenew: true,
    todayBudget: 500,
    dailyRecords: {},
    totalIncome: 0,
    totalSpent: 200,
    filtered: [],
    userCreatedAtStr: USER_CREATED,
    referenceDate: REF_DATE,
  };

  describe('All Four Filters', () => {
    it("computes 'Daily' filter within budget", () => {
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Daily',
        todayBudget: 500,
        totalSpent: 200,
        totalIncome: 0,
      });

      expect(result.primaryLabel).toBe('Remaining to Spend');
      expect(result.primaryAmount).toBe(300); // 500 - 200
      expect(result.displaySpent).toBe(200);
      expect(result.totalAvailable).toBe(500);
      expect(result.isOverBudgetPeriod).toBe(false);
      expect(result.primarySubtext).toBe('of ₹500 daily allowance');
    });

    it("computes 'Weekly' filter across elapsed days of the week", () => {
      // Monday 14 through Friday 18 = 5 days
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Weekly',
        dailyBudgetAmount: 500,
        todayBudget: 500,
        totalSpent: 1200,
        totalIncome: 500,
        userCreatedAtStr: '2026-09-14',
      });

      // 5 days elapsed * 500 = 2500 budget pool + 500 income = 3000 available
      expect(result.totalAvailable).toBe(3000);
      expect(result.displaySpent).toBe(1200);
      expect(result.primaryAmount).toBe(1800); // 3000 - 1200
      expect(result.primaryLabel).toBe('Weekly Remaining');
      expect(result.primarySubtext).toBe('₹2,500 budget (5 days) + ₹500 income');
      expect(result.isOverBudgetPeriod).toBe(false);
    });

    it("computes 'Monthly' filter across elapsed days of the month", () => {
      // 1st Sept through 18th Sept = 18 days
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Monthly',
        dailyBudgetAmount: 400,
        todayBudget: 400,
        totalSpent: 3000,
        totalIncome: 0,
        userCreatedAtStr: '2026-09-01',
      });

      // 18 days * 400 = 7200
      expect(result.totalAvailable).toBe(7200);
      expect(result.primaryAmount).toBe(4200); // 7200 - 3000
      expect(result.primaryLabel).toBe('Monthly Remaining');
      expect(result.primarySubtext).toBe('of ₹7,200 budget (18 days)');
      expect(result.isOverBudgetPeriod).toBe(false);
    });

    it("computes 'All' filter tracking lifetime net balance when user has income", () => {
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        totalSpent: 12000,
        totalIncome: 30000,
      });

      expect(result.primaryLabel).toBe('Net Balance');
      expect(result.primaryAmount).toBe(18000); // 30000 - 12000
      expect(result.primarySubtext).toBe('₹30,000 income − ₹12,000 spent');
      expect(result.displaySpent).toBe(12000);
      expect(result.totalAvailable).toBe(30000);
      expect(result.isOverBudgetPeriod).toBe(false);
      expect(result.periodIncome).toBe(30000);
      expect(result.periodSpent).toBe(12000);
    });

    it("computes 'All' filter as Total Spent when user has zero income", () => {
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        totalSpent: 1000,
        totalIncome: 0,
      });

      expect(result.primaryLabel).toBe('Total Spent');
      expect(result.primaryAmount).toBe(1000);
      expect(result.primarySubtext).toBe('Total lifetime expenses');
      expect(result.totalAvailable).toBe(1000);
      expect(result.displaySpent).toBe(1000);
      expect(result.isOverBudgetPeriod).toBe(false);
    });
  });

  describe('Over-budget paths', () => {
    it('sets exceeded label, overAmount, and danger flag when spent exceeds available in Daily', () => {
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Daily',
        todayBudget: 500,
        totalSpent: 850,
        totalIncome: 0,
      });

      expect(result.isOverBudgetPeriod).toBe(true);
      expect(result.primaryLabel).toBe('Daily Budget Exceeded');
      expect(result.primaryAmount).toBe(350); // 850 - 500
      expect(result.primarySubtext).toBe('Exceeded daily limit by ₹350');
    });

    it('sets exceeded label and calculates overAmount in Weekly', () => {
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Weekly',
        dailyBudgetAmount: 500,
        todayBudget: 500,
        totalSpent: 4000,
        totalIncome: 0,
        userCreatedAtStr: '2026-09-14',
      });

      // Available: 5 * 500 = 2500. Spent: 4000. Over: 1500.
      expect(result.isOverBudgetPeriod).toBe(true);
      expect(result.primaryLabel).toBe('Weekly Budget Exceeded');
      expect(result.primaryAmount).toBe(1500);
      expect(result.primarySubtext).toBe('Exceeded weekly limit by ₹1,500');
    });
  });

  describe('Zero-budget path (Auto-renew disabled or daily budget 0)', () => {
    it('handles zero budget with positive income', () => {
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Daily',
        dailyBudgetAmount: 0,
        isAutoRenew: false,
        todayBudget: 0,
        totalSpent: 200,
        totalIncome: 1000,
      });

      expect(result.totalAvailable).toBe(1000);
      expect(result.primaryAmount).toBe(800);
      expect(result.primaryLabel).toBe('Remaining to Spend');
      expect(result.primarySubtext).toBeNull();
    });

    it('handles zero budget and zero income (null subtext)', () => {
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Daily',
        dailyBudgetAmount: 0,
        isAutoRenew: false,
        todayBudget: 0,
        totalSpent: 0,
        totalIncome: 0,
      });

      expect(result.totalAvailable).toBe(0);
      expect(result.primaryAmount).toBe(0);
      expect(result.primarySubtext).toBeNull();
    });
  });

  describe('All Filter - Lifetime Cashflow (Income vs Spent)', () => {
    it('handles surplus (Net Balance) when income exceeds expenses', () => {
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        totalIncome: 50000,
        totalSpent: 20000,
      });

      expect(result.primaryLabel).toBe('Net Balance');
      expect(result.primaryAmount).toBe(30000);
      expect(result.isOverBudgetPeriod).toBe(false);
      expect(result.primarySubtext).toBe('₹50,000 income − ₹20,000 spent');
      expect(result.totalAvailable).toBe(50000);
      expect(result.displaySpent).toBe(20000);
    });

    it('handles deficit (Net Deficit) when expenses exceed income', () => {
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        totalIncome: 10000,
        totalSpent: 15000,
      });

      expect(result.primaryLabel).toBe('Net Deficit');
      expect(result.primaryAmount).toBe(5000);
      expect(result.isOverBudgetPeriod).toBe(true);
      expect(result.primarySubtext).toBe('Spent ₹5,000 more than total income');
      expect(result.totalAvailable).toBe(10000);
      expect(result.displaySpent).toBe(15000);
    });

    it('handles break-even (Net Balance ₹0) when income equals expenses', () => {
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        totalIncome: 10000,
        totalSpent: 10000,
      });

      expect(result.primaryLabel).toBe('Net Balance');
      expect(result.primaryAmount).toBe(0);
      expect(result.isOverBudgetPeriod).toBe(false);
      expect(result.primarySubtext).toBe('₹10,000 income − ₹10,000 spent');
    });

    it('handles zero income and zero expenses gracefully', () => {
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        totalIncome: 0,
        totalSpent: 0,
      });

      expect(result.primaryLabel).toBe('Total Spent');
      expect(result.primaryAmount).toBe(0);
      expect(result.primarySubtext).toBe('No transactions recorded yet');
      expect(result.isOverBudgetPeriod).toBe(false);
    });
  });

  describe('Registration Boundary & Elapsed Day Count', () => {
    it('clips weekly interval when user registered after Monday', () => {
      // User registered on Wednesday (2026-09-16). Reference is Friday (2026-09-18).
      // Elapsed days: Wed, Thu, Fri = 3 days.
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Weekly',
        dailyBudgetAmount: 500,
        todayBudget: 500,
        userCreatedAtStr: '2026-09-16',
        totalSpent: 0,
        totalIncome: 0,
      });

      // 3 days * 500 = 1500
      expect(result.totalAvailable).toBe(1500);
      expect(result.primarySubtext).toBe('of ₹1,500 budget (3 days)');
    });

    it('uses singular "day" in subtext when exactly 1 day has elapsed', () => {
      // User registered today (Friday 2026-09-18)
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Weekly',
        dailyBudgetAmount: 500,
        todayBudget: 500,
        userCreatedAtStr: '2026-09-18',
        totalSpent: 0,
        totalIncome: 0,
      });

      expect(result.totalAvailable).toBe(500);
      expect(result.primarySubtext).toBe('of ₹500 budget (1 day)');
    });
  });

  describe('Ticket A Bug Pinning', () => {
    it('[TICKET-A BUG ENCODED] when userCreatedAtStr is undefined, weekly budget pool inflates across the entire week', () => {
      // User actually joined on Friday (2026-09-18) with a ₹500 budget.
      // But userCreatedAtStr is passed as undefined (mimicking late authStore hydration).
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Weekly',
        dailyBudgetAmount: 500,
        todayBudget: 500,
        userCreatedAtStr: undefined, // BUG: undefined user created date
        totalSpent: 100,
        totalIncome: 0,
      });

      // Bug behavior: falls back to mondayStr (2026-09-14), accumulating 5 full days (2500)
      // instead of 1 day (500)!
      expect(result.totalAvailable).toBe(2500);
      expect(result.primaryAmount).toBe(2400); // 2500 - 100
      expect(result.primarySubtext).toBe('of ₹2,500 budget (5 days)');
    });
  });
});
