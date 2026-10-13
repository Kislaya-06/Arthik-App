import { describe, it, expect } from 'vitest';
import { calculatePeriodSummary, PeriodCalculationParams } from '../src/lib/homeCalculations';
import { calculateSavingsMetrics, DailyRecord } from '../src/lib/budgetCalculations';

describe('Real-Time Income Deduction & Gullak Absorption (Subtext Chips & Savings)', () => {
  const REF_DATE = new Date(2026, 8, 18, 12, 0, 0); // Friday, 18 Sep 2026
  const USER_CREATED = '2026-09-01';

  // "All" counts only days the app really tracked (they have a daily record) and today.
  const trackedDays = (from: string, to: string): Record<string, any> => {
    const out: Record<string, any> = {};
    for (let d = new Date(`${from}T00:00:00`); d <= new Date(`${to}T00:00:00`); d.setDate(d.getDate() + 1)) {
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      out[ds] = { date: ds, budget: 500, spent: 0, saved: 500, isFinalized: true, status: 'saved' };
    }
    return out;
  };

  const baseParams: PeriodCalculationParams = {
    activeFilter: 'All',
    dailyBudgetAmount: 500,
    isAutoRenew: true,
    todayBudget: 500,
    dailyRecords: trackedDays('2026-09-01', '2026-09-17'),
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
      expect(summary.isSpendingFromGullak).toBe(false);
      expect(summary.totalAvailable).toBe(9000 + 2823.8 + 3630);
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
      expect(summary.isSpendingFromGullak).toBe(true);
      expect(summary.totalAvailable).toBe(9000 + 2823.8 + 3630);
    });

    it('does NOT deduct past finalized days overspending from income in "All" card when today is within budget', () => {
      // Past day 2026-09-10 was finalized as exceeded in the past.
      // Today spent is 500 (within budget). Total spend 2227 is within 9000 budget pool.
      // Current/new income must remain fully visible and NOT be penalized by past closed days.
      const summary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        totalSpent: 2227,
        todaySpent: 500,
        dailyRecords: {
          ...trackedDays('2026-09-01', '2026-09-17'),
          '2026-09-10': {
            date: '2026-09-10',
            budget: 500,
            spent: 750, // past exceeded day
            saved: 0,
            isFinalized: true,
            status: 'exceeded',
          },
        },
      });

      expect(summary.primarySubtext).toContain('₹2,823.8 income');
      expect(summary.primarySubtext).toContain('₹3,630 deposits to Gullak');
      expect(summary.remainingIncome).toBe(2823.8);
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

  describe('User Specification: Filter-Specific Income Reporting & Overspend Absorption', () => {
    it('Daily filter periodIncome reflects only today\'s income', () => {
      const summary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Daily',
        todayBudget: 500,
        totalIncome: 350,
        totalSpent: 200,
      });

      expect(summary.periodIncome).toBe(350);
      expect(summary.remainingIncome).toBe(350);
    });

    it('Weekly filter periodIncome reflects this week\'s income', () => {
      const summary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Weekly',
        todayBudget: 500,
        totalIncome: 1500,
        totalSpent: 1200,
      });

      expect(summary.periodIncome).toBe(1500);
    });

    it('All filter remainingIncome reflects currently available income after deducting overspend', () => {
      // Total income is 2000. User overspent today by 300 (spent 800 on 500 budget).
      // Available remaining income must be 1700 (2000 - 300).
      const summary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        todayBudget: 500,
        todaySpent: 800,
        totalIncome: 2000,
        totalSpent: 800,
        externalDepositsInPeriod: 1000,
      });

      expect(summary.periodIncome).toBe(2000);
      expect(summary.remainingIncome).toBe(1700);
      expect(summary.remainingDeposits).toBe(1000); // Gullak untouched
    });

    it('All filter drops remainingIncome to 0 and brings Gullak into action when overspend exceeds income', () => {
      // Total income is 200. User overspent today by 500 (spent 1000 on 500 budget).
      // Income absorbs 200 -> remainingIncome = 0.
      // Remaining 300 overspend absorbs from Gullak: 1000 - 300 = 700!
      const summary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        todayBudget: 500,
        todaySpent: 1000,
        totalIncome: 200,
        totalSpent: 1000,
        externalDepositsInPeriod: 1000,
      });

      expect(summary.remainingIncome).toBe(0);
      expect(summary.remainingDeposits).toBe(700);
      expect(summary.isSpendingFromGullak).toBe(true);
      expect(summary.gullakDrawnAmount).toBe(300);
    });
  });

  describe('Reimbursement Chip Hiding in "All" Filter (Real Money Preserved)', () => {
    it('hides reimbursement chip from subtext in "All" filter while preserving the money in totalAvailable and primaryAmount', () => {
      const summary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        totalIncome: 1000,
        totalReimbursements: 500,
        totalSpent: 400,
      });

      // Reimbursement chip must be omitted in 'All' filter
      expect(summary.primarySubtext).not.toContain('reimbursed');
      expect(summary.primarySubtext).toContain('₹1,000 income');

      // BUT the money is 100% included in spendable / available / remaining
      // budget pool (9000) + income (1000) + reimbursement (500) + deposits (3630) = 14130
      expect(summary.totalAvailable).toBe(9000 + 1000 + 500 + 3630);
      expect(summary.primaryAmount).toBe(14130 - 400); // 13730
    });

    it('shows reimbursement chip in Daily, Weekly, and Monthly filters', () => {
      const dailySummary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Daily',
        todayBudget: 500,
        totalIncome: 0,
        totalReimbursements: 350,
        totalSpent: 100,
      });
      expect(dailySummary.primarySubtext).toContain('₹350 reimbursed');

      const weeklySummary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Weekly',
        dailyBudgetAmount: 500,
        todayBudget: 500,
        totalIncome: 0,
        totalReimbursements: 350,
        totalSpent: 100,
      });
      expect(weeklySummary.primarySubtext).toContain('₹350 reimbursed');

      const monthlySummary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Monthly',
        dailyBudgetAmount: 500,
        todayBudget: 500,
        totalIncome: 0,
        totalReimbursements: 350,
        totalSpent: 100,
      });
      expect(monthlySummary.primarySubtext).toContain('₹350 reimbursed');
    });
  });

  describe('Partial Income & Partial Gullak Absorption (gullakDrawnAmount)', () => {
    it('accurately computes gullakDrawnAmount when half overspend comes from income and half from Gullak', () => {
      // Income = 1000. Daily overspend = 1500 (today spent 2000 on 500 budget).
      // Income absorbs 1000 -> remainingIncome = 0.
      // Gullak absorbs remaining 500 -> gullakDrawnAmount = 500!
      const summary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        todayBudget: 500,
        todaySpent: 2000,
        totalIncome: 1000,
        totalSpent: 2000,
        externalDepositsInPeriod: 3000,
      });

      expect(summary.remainingIncome).toBe(0);
      expect(summary.remainingDeposits).toBe(2500); // 3000 - 500
      expect(summary.isSpendingFromGullak).toBe(true);
      expect(summary.gullakDrawnAmount).toBe(500);
    });
  });

  describe('User Scenario: Exact ₹5,000 overspend with ₹2,998.8 income and past saved days', () => {
    it('deducts exactly ₹2,001.2 from Gullak when ₹5,000 is overspent today with ₹2,998.8 available income and past saved day with income', () => {
      const records: Record<string, DailyRecord> = {
        // Past day with income that saved money (spent > budget, but saved > 0)
        '2026-09-19': {
          date: '2026-09-19',
          budget: 200,
          spent: 681.5,
          saved: 706.5,
          isFinalized: true,
          status: 'saved',
        },
        // Past day that had overspend and was finalized
        '2026-10-11': {
          date: '2026-10-11',
          budget: 250,
          spent: 1485,
          saved: 0,
          isFinalized: true,
          status: 'exceeded',
        },
        // Today with ₹5,000 overspend
        '2026-10-12': {
          date: '2026-10-12',
          budget: 250,
          spent: 5250, // overspent by 5000
          saved: 0,
          isFinalized: false,
          status: 'exceeded',
        },
      };

      // Before today's expense (today spent = 0):
      const recordsBeforeToday: Record<string, DailyRecord> = {
        ...records,
        '2026-10-12': {
          date: '2026-10-12',
          budget: 250,
          spent: 0,
          saved: 250,
          isFinalized: false,
          status: 'active',
        },
      };

      const metricsBefore = calculateSavingsMetrics(
        recordsBeforeToday,
        '2026-10-12',
        USER_CREATED,
        REF_DATE,
        3655,   // manual deposits
        2998.8  // available income
      );

      // Now with today's ₹5,000 overspend:
      const metricsAfter = calculateSavingsMetrics(
        records,
        '2026-10-12',
        USER_CREATED,
        REF_DATE,
        3655,   // manual deposits
        2998.8  // available income
      );

      // Today's live overspend = 5000.
      // Income absorbs 2998.8.
      // Gullak absorbs remaining: 5000 - 2998.8 = 2001.2!
      // Therefore, Gullak totalAccumulatedSavings must drop by EXACTLY 2001.2!
      const gullakDrop = Math.round((metricsBefore.totalAccumulatedSavings - metricsAfter.totalAccumulatedSavings) * 100) / 100;
      expect(gullakDrop).toBe(2001.2);
    });
  });

  describe('User Phone Scenario: Past ₹425 Income Already Spent In The Past', () => {
    it('shows ₹0 income in "All" filter subtext chip when user already spent their entire ₹425 income in the past', () => {
      // User lifetime income = 425.
      // But user already spent it in the past (availableIncomeBalance = 0).
      // 'All' card must display ₹0 income, NOT ₹425 income!
      const summary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        totalIncome: 425,
        totalSpent: 425,
        todaySpent: 0,
        availableIncomeBalance: 0,
      });

      expect(summary.remainingIncome).toBe(0);
      expect(summary.primarySubtext).toContain('₹0 income');
      expect(summary.primarySubtext).not.toContain('₹425 income');
    });

    it('shows only remaining portion (₹225) in "All" filter when ₹200 out of ₹425 was spent in the past', () => {
      // User lifetime income = 425.
      // User spent 200 in the past -> availableIncomeBalance = 225.
      const summary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        totalIncome: 425,
        totalSpent: 200,
        todaySpent: 0,
        availableIncomeBalance: 225,
      });

      expect(summary.remainingIncome).toBe(225);
      expect(summary.primarySubtext).toContain('₹225 income');
      expect(summary.primarySubtext).not.toContain('₹425 income');
    });
  });
});
