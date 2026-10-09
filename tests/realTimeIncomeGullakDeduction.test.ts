import { describe, it, expect } from 'vitest';
import { calculatePeriodSummary, PeriodCalculationParams } from '../src/lib/homeCalculations';
import { calculateSavingsMetrics, DailyRecord } from '../src/lib/budgetCalculations';

describe('Real-Time Income Deduction & Gullak Absorption (Subtext Chips & Savings)', () => {
  const REF_DATE = new Date(2026, 8, 18, 12, 0, 0); // Friday, 18 Sep 2026
  const USER_CREATED = '2026-09-01';

  const baseParams: PeriodCalculationParams = {
    activeFilter: 'All',
    dailyBudgetAmount: 500,
    isAutoRenew: true,
    todayBudget: 500,
    dailyRecords: {},
    totalIncome: 2823.8,
    totalSpent: 2227,
    filtered: [],
    userCreatedAtStr: USER_CREATED,
    referenceDate: REF_DATE,
    externalDepositsInPeriod: 3630,
  };

  describe('User Screenshot Baseline (Within Budget)', () => {
    it('shows full income and deposits when spent is within budget pool and no daily overspend', () => {
      // 18 days * 500 = 9000 budget, 2823.8 income, 3630 deposits, 2227 spent (within 9000 budget)
      // Today spent is 100 (within 500 daily budget)
      const summary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        totalSpent: 2227,
        todaySpent: 100,
      });

      expect(summary.primarySubtext).toContain('₹2,823.8 income');
      expect(summary.primarySubtext).toContain('₹3,630 deposits to Gullak');
    });
  });

  describe('User Exact Bug Scenario in "All" Card: Overspending Daily Limit while Total Spend is Under Budget Pool', () => {
    it('deducts overspent amount from income chip in real time in "All" filter when today spend exceeds daily limit', () => {
      // Total budget pool is 9000 (18 days * 500). Total spent is 2227 (far below 9000).
      // BUT today user spent 700 on a 500 daily budget (overspent daily limit by 200).
      // Income MUST deduct 200 -> 2823.8 - 200 = 2623.8!
      const summary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        totalSpent: 2227,
        todayBudget: 500,
        todaySpent: 700, // overspent by 200
      });

      expect(summary.primarySubtext).toContain('₹2,623.8 income');
      expect(summary.primarySubtext).toContain('₹3,630 deposits to Gullak');
      expect(summary.remainingIncome).toBe(2623.8);
      expect(summary.remainingDeposits).toBe(3630);
    });

    it('absorbs all income and deducts remaining overspend from Gullak in "All" card when overspend exceeds income', () => {
      // Total budget pool is 9000. Total spent is 5227.
      // Today user spent 3500 on a 500 daily budget (overspent by 3000).
      // Income is 2823.8.
      // Income absorbs 2823.8 -> remaining income = 0.
      // Remaining overspend = 3000 - 2823.8 = 176.2.
      // Gullak absorbs 176.2 -> 3630 - 176.2 = 3453.8!
      const summary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        totalSpent: 5227,
        todayBudget: 500,
        todaySpent: 3500, // overspent by 3000
      });

      expect(summary.primarySubtext).toContain('₹0 income');
      expect(summary.primarySubtext).toContain('₹3,453.8 deposits to Gullak');
      expect(summary.remainingIncome).toBe(0);
      expect(summary.remainingDeposits).toBe(3453.8);
    });

    it('deducts past days overspending from income in "All" card', () => {
      // Past day 2026-09-10 had budget 500, spent 750 (overspent by 250).
      // Today spent 500 (within budget).
      const summary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        totalSpent: 2227,
        todaySpent: 500,
        dailyRecords: {
          '2026-09-10': {
            date: '2026-09-10',
            budget: 500,
            spent: 750, // overspent by 250
            saved: 0,
            isFinalized: true,
            status: 'exceeded',
          },
        },
      });

      // 2823.8 - 250 = 2573.8
      expect(summary.primarySubtext).toContain('₹2,573.8 income');
      expect(summary.primarySubtext).toContain('₹3,630 deposits to Gullak');
      expect(summary.remainingIncome).toBe(2573.8);
    });
  });

  describe('Income Deduction on Overspending Budget (Daily & Weekly)', () => {
    it('deducts overspent amount from income chip in real time when spend exceeds budget in Daily filter', () => {
      // 1 day (Daily filter): budget = 500, income = 1000, deposits = 500.
      // User spends 700 (over budget by 200).
      // Income should deduct 200 -> remaining income = 800. Deposits untouched at 500.
      const summary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Daily',
        todayBudget: 500,
        totalIncome: 1000,
        externalDepositsInPeriod: 500,
        totalSpent: 700,
      });

      expect(summary.primarySubtext).toContain('₹800 income');
      expect(summary.primarySubtext).toContain('₹500 deposits to Gullak');
    });

    it('deducts from income in Weekly filter when daily limit is exceeded even if under weekly pool', () => {
      // Weekly filter: 5 days * 500 = 2500 budget. Income = 1000. Deposits = 500.
      // Total spent this week so far is 1200 (under 2500 pool).
      // BUT today user spent 700 on a 500 daily budget (overspent by 200).
      // Income chip should show 800 income (1000 - 200).
      const summaryWeekly = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Weekly',
        userCreatedAtStr: '2026-09-14',
        todayBudget: 500,
        totalIncome: 1000,
        externalDepositsInPeriod: 500,
        totalSpent: 1200,
        todaySpent: 700,
      });

      expect(summaryWeekly.primarySubtext).toContain('₹800 income');
      expect(summaryWeekly.primarySubtext).toContain('₹500 deposits to Gullak');
    });
  });

  describe('User Exact Edge Case: ₹100 extra spent, ₹50 income -> ₹50 from income & ₹50 from Gullak', () => {
    it('absorbs ₹50 from income to reach ₹0, and deducts remaining ₹50 from Gullak deposits chip', () => {
      // Budget = 500, Income = 50, Deposits = 1000.
      // User spends 600 (over budget by 100).
      // Income absorbs 50 -> remaining income = 0.
      // Remaining 50 is deducted from Gullak -> remaining deposits = 950 (1000 - 50).
      const summary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Daily',
        todayBudget: 500,
        totalIncome: 50,
        externalDepositsInPeriod: 1000,
        totalSpent: 600,
      });

      expect(summary.primarySubtext).toContain('₹0 income');
      expect(summary.primarySubtext).toContain('₹950 deposits to Gullak');
    });

    it('deducts remaining ₹50 from Gullak accumulated savings in calculateSavingsMetrics', () => {
      // Overspend = 100, Available income = 50.
      // Gullak initial savings = 1000 manual deposit.
      const records: Record<string, DailyRecord> = {
        '2026-09-18': {
          date: '2026-09-18',
          budget: 500,
          spent: 600, // overspent by 100
          saved: 0,
          isFinalized: false,
          status: 'exceeded',
        },
      };

      const metrics = calculateSavingsMetrics(
        records,
        '2026-09-18',
        USER_CREATED,
        REF_DATE,
        1000, // manual Gullak deposits
        50    // available income
      );

      // Overspent 100 - 50 income = 50 effective overspent hitting Gullak.
      // Gullak net savings = 1000 - 50 = 950!
      expect(metrics.totalAccumulatedSavings).toBe(950);
    });
  });

  describe('Full Gullak Absorption when Income is 0', () => {
    it('deducts entire overspent amount from Gullak deposits when income is 0', () => {
      // Budget = 500, Income = 0, Deposits = 1000.
      // User spends 700 (over budget by 200).
      // Gullak deposits chip should show 800 (1000 - 200).
      const summary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Daily',
        todayBudget: 500,
        totalIncome: 0,
        externalDepositsInPeriod: 1000,
        totalSpent: 700,
      });

      expect(summary.primarySubtext).not.toContain('income');
      expect(summary.primarySubtext).toContain('₹800 deposits to Gullak');
    });
  });
});
