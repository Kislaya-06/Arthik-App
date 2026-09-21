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

    it("computes 'All' filter combining lifetime budget pool and income", () => {
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        dailyBudgetAmount: 500,
        isAutoRenew: true,
        todayBudget: 500,
        totalSpent: 1200,
        totalIncome: 1000,
        userCreatedAtStr: '2026-09-14', // 5 days to 2026-09-18: 14, 15, 16, 17, 18
      });

      // 5 days * 500 = 2500 budget pool + 1000 income = 3500 available
      expect(result.totalAvailable).toBe(3500);
      expect(result.displaySpent).toBe(1200);
      expect(result.primaryAmount).toBe(2300); // 3500 - 1200
      expect(result.primaryLabel).toBe('Total Remaining');
      expect(result.primarySubtext).toBe('₹2,500 budget + ₹1,000 income');
    });

    it("computes 'All' filter as Total Spent when user has no budget and zero income", () => {
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        dailyBudgetAmount: 0,
        isAutoRenew: false,
        todayBudget: 0,
        totalSpent: 1000,
        totalIncome: 0,
      });

      expect(result.primaryLabel).toBe('Total Spent');
      expect(result.primaryAmount).toBe(1000);
      expect(result.totalAvailable).toBe(0);
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

  describe('All Filter - Lifetime Cashflow (Budget Pool + Income vs Spent)', () => {
    it('handles surplus (Total Remaining) when budget and income exceed expenses', () => {
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        dailyBudgetAmount: 500,
        isAutoRenew: true,
        todayBudget: 500,
        userCreatedAtStr: '2026-09-14', // 5 days * 500 = 2500
        totalIncome: 1000,
        totalSpent: 1500,
      });

      expect(result.primaryLabel).toBe('Total Remaining');
      expect(result.primaryAmount).toBe(2000); // 3500 - 1500
      expect(result.isOverBudgetPeriod).toBe(false);
      expect(result.primarySubtext).toBe('₹2,500 budget + ₹1,000 income');
      expect(result.totalAvailable).toBe(3500);
      expect(result.displaySpent).toBe(1500);
    });

    it('handles deficit (Total Budget Exceeded) when expenses exceed available', () => {
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        dailyBudgetAmount: 500,
        isAutoRenew: true,
        todayBudget: 500,
        userCreatedAtStr: '2026-09-14', // 5 days * 500 = 2500
        totalIncome: 0,
        totalSpent: 3000,
      });

      expect(result.primaryLabel).toBe('Total Budget Exceeded');
      expect(result.primaryAmount).toBe(500); // 3000 - 2500
      expect(result.isOverBudgetPeriod).toBe(true);
      expect(result.primarySubtext).toBe('Exceeded total limit by ₹500');
      expect(result.totalAvailable).toBe(2500);
      expect(result.displaySpent).toBe(3000);
    });

    it('handles non-budget user with income as Total Remaining', () => {
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        dailyBudgetAmount: 0,
        isAutoRenew: false,
        todayBudget: 0,
        totalIncome: 50000,
        totalSpent: 20000,
      });

      expect(result.primaryLabel).toBe('Total Remaining');
      expect(result.primaryAmount).toBe(30000);
      expect(result.isOverBudgetPeriod).toBe(false);
      expect(result.primarySubtext).toBeNull();
      expect(result.totalAvailable).toBe(50000);
      expect(result.displaySpent).toBe(20000);
    });

    it('handles non-budget user with zero income as Total Spent', () => {
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        dailyBudgetAmount: 0,
        isAutoRenew: false,
        todayBudget: 0,
        totalIncome: 0,
        totalSpent: 0,
      });

      expect(result.primaryLabel).toBe('Total Spent');
      expect(result.primaryAmount).toBe(0);
      expect(result.totalAvailable).toBe(0);
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

  describe('Floating Point Decimal Support Across Filters', () => {
    it('supports decimal amounts on Daily filter without float drift', () => {
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Daily',
        todayBudget: 100,
        totalSpent: 82.5,
        totalIncome: 0,
      });

      expect(result.primaryLabel).toBe('Remaining to Spend');
      expect(result.primaryAmount).toBe(17.5);
      expect(result.displaySpent).toBe(82.5);
      expect(result.totalAvailable).toBe(100);
      expect(result.isOverBudgetPeriod).toBe(false);
    });

    it('supports decimal amounts on All filter with income and spent', () => {
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        dailyBudgetAmount: 100.5,
        todayBudget: 100.5,
        totalSpent: 82.75,
        totalIncome: 50.25,
        userCreatedAtStr: '2026-09-18', // 1 day
      });

      // budgetPool = 100.5, income = 50.25 => totalAvailable = 150.75
      expect(result.totalAvailable).toBe(150.75);
      expect(result.displaySpent).toBe(82.75);
      // remaining = 150.75 - 82.75 = 68
      expect(result.primaryAmount).toBe(68);
      expect(result.periodIncome).toBe(50.25);
      expect(result.periodSpent).toBe(82.75);
    });

    it('supports decimal amounts on Weekly and Monthly filters', () => {
      const weeklyResult = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Weekly',
        dailyBudgetAmount: 50.25,
        todayBudget: 50.25,
        totalSpent: 120.5,
        totalIncome: 10.25,
        userCreatedAtStr: '2026-09-14', // 5 days: 5 * 50.25 = 251.25
      });

      // available = 251.25 + 10.25 = 261.5
      expect(weeklyResult.totalAvailable).toBe(261.5);
      expect(weeklyResult.displaySpent).toBe(120.5);
      // remaining = 261.5 - 120.5 = 141
      expect(weeklyResult.primaryAmount).toBe(141);
    });
  });
});
