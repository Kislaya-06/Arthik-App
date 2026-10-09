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
    it('shows full income and deposits when spent is within budget pool', () => {
      // 18 days * 500 = 9000 budget, 2823.8 income, 3630 deposits, 2227 spent (within 9000 budget)
      const summary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        totalSpent: 2227,
      });

      expect(summary.primarySubtext).toContain('₹2,823.8 income');
      expect(summary.primarySubtext).toContain('₹3,630 deposits to Gullak');
    });
  });

  describe('Income Deduction on Overspending Budget', () => {
    it('deducts overspent amount from income chip in real time when spend exceeds budget', () => {
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

    it('deducts from income in Weekly and Monthly filters in real time', () => {
      // Weekly filter: 5 days * 500 = 2500 budget. Income = 1000. Deposits = 500.
      // Spent = 2800 (overspent by 300).
      // Income chip should show 700 income (1000 - 300).
      const summaryWeekly = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Weekly',
        userCreatedAtStr: '2026-09-14',
        todayBudget: 500,
        totalIncome: 1000,
        externalDepositsInPeriod: 500,
        totalSpent: 2800,
      });

      expect(summaryWeekly.primarySubtext).toContain('₹700 income');
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
