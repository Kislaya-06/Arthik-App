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

    it("computes 'All' filter tracking past recorded dates and today", () => {
      const dailyRecords: Record<string, DailyRecord> = {
        '2026-09-10': { date: '2026-09-10', budget: 500, spent: 300, saved: 200, isFinalized: true, status: 'saved' },
        '2026-09-12': { date: '2026-09-12', budget: 500, spent: 400, saved: 100, isFinalized: true, status: 'saved' },
      };
      const filtered = [
        { expense_date: '2026-09-10' },
        { expense_date: '2026-09-12' },
        { expense_date: '2026-09-18' },
      ];

      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        dailyRecords,
        filtered,
        totalSpent: 1000,
        totalIncome: 0,
        userCreatedAtStr: '2026-09-01',
      });

      // Unique dates: 2026-09-18 (today: 500) + 2026-09-10 (500) + 2026-09-12 (500) = 1500
      expect(result.totalAvailable).toBe(1500);
      expect(result.primaryAmount).toBe(500);
      expect(result.primaryLabel).toBe('Total Remaining');
      expect(result.primarySubtext).toBe('of ₹1,500 total budget');
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
      expect(result.primarySubtext).toBe('of ₹1,000 total income');
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

  describe('Sentinel 500 Handling (Preserved Behavior)', () => {
    it('skips phantom zero-spend 500 days from periodDates in All filter', () => {
      const dailyRecords: Record<string, DailyRecord> = {
        // Phantom 500 record (0 spent, 500 budget, 500 saved)
        '2026-09-10': { date: '2026-09-10', budget: 500, spent: 0, saved: 500, isFinalized: true, status: 'saved' },
        // Legitimate past record with spending
        '2026-09-12': { date: '2026-09-12', budget: 500, spent: 100, saved: 400, isFinalized: true, status: 'saved' },
      };

      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        dailyRecords,
        filtered: [], // No expenses on 2026-09-10
        totalSpent: 100,
        totalIncome: 0,
        userCreatedAtStr: '2026-09-01',
      });

      // Only today (2026-09-18: 500) and 2026-09-12 (500) are counted. 2026-09-10 is skipped!
      expect(result.totalAvailable).toBe(1000); // 500 + 500
    });

    it('rewrites past day budget 500 to dailyBudgetAmount when user changed budget', () => {
      const dailyRecords: Record<string, DailyRecord> = {
        '2026-09-12': { date: '2026-09-12', budget: 500, spent: 100, saved: 400, isFinalized: true, status: 'saved' },
      };

      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        dailyBudgetAmount: 200, // User current budget is 200
        todayBudget: 200,
        dailyRecords,
        filtered: [{ expense_date: '2026-09-12' }],
        totalSpent: 100,
        totalIncome: 0,
        userCreatedAtStr: '2026-09-01',
      });

      // Past record had budget 500, rewritten to current 200. Today is 200. Total = 400.
      expect(result.totalAvailable).toBe(400);
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
