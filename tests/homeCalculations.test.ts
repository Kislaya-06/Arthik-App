import { describe, it, expect } from 'vitest';
import { format, parseISO, subDays } from 'date-fns';
import {
  calculatePeriodSummary,
  PeriodCalculationParams,
  getExternalDepositsInPeriod,
  calculatePureHeroMetrics,
} from '../src/lib/homeCalculations';

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

  describe('External Gullak Deposits Integration', () => {
    it('increases totalAvailable with external deposits in Daily filter', () => {
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Daily',
        todayBudget: 500,
        totalSpent: 200,
        totalIncome: 0,
        externalDepositsInPeriod: 1000,
      });

      // budget (500) + deposits (1000) = 1500 available
      expect(result.totalAvailable).toBe(1500);
      expect(result.primaryAmount).toBe(1300); // 1500 - 200
      expect(result.primaryLabel).toBe('Remaining to Spend');
      expect(result.primarySubtext).toBe('₹500 budget + ₹1,000 deposits to Gullak');
    });

    it('displays composite subtext with budget, income, and external deposits in Weekly filter', () => {
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Weekly',
        dailyBudgetAmount: 500,
        todayBudget: 500,
        totalSpent: 1200,
        totalIncome: 500,
        externalDepositsInPeriod: 1000,
        userCreatedAtStr: '2026-09-14', // 5 days => 2500 budget
      });

      // 2500 + 500 + 1000 = 4000 available
      expect(result.totalAvailable).toBe(4000);
      expect(result.primaryAmount).toBe(2800); // 4000 - 1200
      expect(result.primarySubtext).toBe('₹2,500 budget (5 days) + ₹500 income + ₹1,000 deposits to Gullak');
    });

    it('shows Remaining when user has no budget and no income, but has external deposits', () => {
      const result = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Daily',
        dailyBudgetAmount: 0,
        isAutoRenew: false,
        todayBudget: 0,
        totalSpent: 200,
        totalIncome: 0,
        externalDepositsInPeriod: 500,
      });

      expect(result.totalAvailable).toBe(500);
      expect(result.primaryAmount).toBe(300);
      expect(result.primaryLabel).toBe('Remaining to Spend');
      expect(result.primarySubtext).toBe('₹500 deposits to Gullak');
    });

    it('getExternalDepositsInPeriod filters correctly by date and source', () => {
      const deposits = [
        { date: '2026-09-18', amount: 500, source: 'external' as const },
        { date: '2026-09-18', amount: 300, source: 'income' as const }, // from income -> ignore
        { date: '2026-09-16', amount: 700, source: 'external' as const }, // same week (Wed 16th)
        { date: '2026-09-02', amount: 1200, source: 'external' as const }, // earlier this month
      ];

      // Daily: only 2026-09-18 external = 500
      const dailySum = getExternalDepositsInPeriod(deposits, 'Daily', REF_DATE, USER_CREATED);
      expect(dailySum).toBe(500);

      // Weekly: 18th (500) + 16th (700) = 1200 (both in week of 14-18 Sept)
      const weeklySum = getExternalDepositsInPeriod(deposits, 'Weekly', REF_DATE, USER_CREATED);
      expect(weeklySum).toBe(1200);

      // Monthly: 18th (500) + 16th (700) + 2nd (1200) = 2400 (all in Sept)
      const monthlySum = getExternalDepositsInPeriod(deposits, 'Monthly', REF_DATE, '2026-09-01');
      expect(monthlySum).toBe(2400);

      // All: all external = 2400
      const allSum = getExternalDepositsInPeriod(deposits, 'All', REF_DATE, '2026-09-01');
      expect(allSum).toBe(2400);
    });
  });

  describe('Historical Active Budget Allowance Preservation (Mixed Mode)', () => {
    it('preserves past 15 days of active ₹250 allowance when Budget Mode is turned OFF on Day 16', () => {
      // 15 days: 2026-09-01 to 2026-09-15 had active daily records with budget: 250
      const dailyRecords: Record<string, any> = {};
      for (let day = 1; day <= 15; day++) {
        const dStr = `2026-09-${String(day).padStart(2, '0')}`;
        dailyRecords[dStr] = {
          date: dStr,
          budget: 250,
          spent: 100,
          saved: 150,
          isFinalized: true,
          status: 'saved',
        };
      }

      // Day 16 (Today): User toggles Budget Mode OFF (isAutoRenew: false, todayBudget: 0)
      const refDate = parseISO('2026-09-16');
      const monthlyResult = calculatePeriodSummary({
        activeFilter: 'Monthly',
        dailyBudgetAmount: 250,
        isAutoRenew: false, // Mode is OFF
        todayBudget: 0,     // Today has no budget allowance
        dailyRecords,
        totalIncome: 500,   // ₹500 transaction income
        totalSpent: 1600,   // Total spent across the month so far
        filtered: [{ expense_date: '2026-09-01' }],
        userCreatedAtStr: '2026-09-01',
        referenceDate: refDate,
      });

      // 15 days * ₹250 = ₹3,750 historical funded allowance + ₹500 transaction income = ₹4,250
      expect(monthlyResult.totalAvailable).toBe(4250);
      expect(monthlyResult.displaySpent).toBe(1600);
      expect(monthlyResult.periodSpent).toBe(1600);

      // On Daily filter for Day 16 (Today), mode is OFF so today allowance is 0
      const dailyResult = calculatePeriodSummary({
        activeFilter: 'Daily',
        dailyBudgetAmount: 250,
        isAutoRenew: false, // Mode is OFF
        todayBudget: 0,
        dailyRecords,
        totalIncome: 100,   // ₹100 income today
        totalSpent: 50,     // ₹50 spent today
        filtered: [{ expense_date: '2026-09-16' }],
        userCreatedAtStr: '2026-09-01',
        referenceDate: refDate,
      });

      // Daily Inflow today is only today's income (₹100), no daily budget allowance for today
      expect(dailyResult.totalAvailable).toBe(100);
      expect(dailyResult.displaySpent).toBe(50);
    });

    it('preserves ₹20,000 active budget pool on All filter when mode is OFF (Screenshot 2 scenario)', () => {
      // 40 days of ₹500 budget = ₹20,000
      const dailyRecords: Record<string, any> = {};
      for (let day = 1; day <= 40; day++) {
        const d = format(subDays(parseISO('2026-09-30'), day), 'yyyy-MM-dd');
        dailyRecords[d] = {
          date: d,
          budget: 500,
          spent: 50,
          saved: 450,
          isFinalized: true,
          status: 'saved',
        };
      }

      // Mode is OFF today (2026-09-30)
      const refDate = parseISO('2026-09-30');
      const allResult = calculatePeriodSummary({
        activeFilter: 'All',
        dailyBudgetAmount: 500,
        isAutoRenew: false, // Mode is OFF
        todayBudget: 0,
        dailyRecords,
        totalIncome: 2823.8, // User's transaction income
        totalSpent: 2204,    // User's expense
        filtered: [{ expense_date: '2026-08-20' }],
        userCreatedAtStr: '2026-08-20',
        referenceDate: refDate,
      });

      // Total Available (Inflow) MUST include the ₹20,000 funded in real life + ₹2,823.8 income
      expect(allResult.totalAvailable).toBe(22823.8);
      expect(allResult.periodSpent).toBe(2204);

      // Verify Pure Hero Metrics projection
      const pureMetrics = calculatePureHeroMetrics('All', allResult.totalAvailable, allResult.periodSpent);
      expect(pureMetrics.title).toBe('Total Remaining');
      expect(pureMetrics.totalRemaining).toBe(20619.8);
      expect(pureMetrics.totalExpense).toBe(2204);
      expect(pureMetrics.inflow).toBe(22823.8);
      expect(pureMetrics.outflow).toBe(2204);
      expect(pureMetrics.net).toBe(20619.8);
    });

    it('accumulates historical budget from planChanges when past days have no explicit dailyRecords', () => {
      // Plan was active daily ₹300 from 2026-09-01, disabled on 2026-09-11
      const planChanges: any[] = [
        {
          id: 'p1',
          cadence: 'daily',
          amount: 300,
          isEnabled: true,
          effectiveFrom: '2026-09-01',
          createdAt: '2026-09-01T00:00:00Z',
        },
        {
          id: 'p2',
          cadence: 'daily',
          amount: 300,
          isEnabled: false, // disabled
          effectiveFrom: '2026-09-11',
          createdAt: '2026-09-11T00:00:00Z',
        },
      ];

      const refDate = parseISO('2026-09-15');
      const result = calculatePeriodSummary({
        activeFilter: 'Monthly',
        dailyBudgetAmount: 300,
        isAutoRenew: false,
        todayBudget: 0,
        dailyRecords: {}, // No stored records
        totalIncome: 0,
        totalSpent: 500,
        filtered: [],
        userCreatedAtStr: '2026-09-01',
        referenceDate: refDate,
        planChanges,
      });

      // 10 active days (Sept 1 to Sept 10) * ₹300 = ₹3,000. Sept 11-15 are disabled (0).
      expect(result.totalAvailable).toBe(3000);
      expect(result.periodSpent).toBe(500);
    });
  });
});

