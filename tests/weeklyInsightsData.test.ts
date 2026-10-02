import { describe, it, expect } from 'vitest';
import { parseISO, startOfWeek, endOfWeek } from 'date-fns';
import {
  computeWeeklySpend,
  computeEffectiveWeekBudget,
  computeBudgetHealth,
  computeSafeDailyPace,
  computeWeeklyGullakSavings,
  computeSmartWeeklyTakeaway,
  computeLargestSingleOutflow,
  computeWeekdayVsWeekendDynamics,
  computeDayMatchedPreviousComparison,
  computePeakDaysSubtitle,
  ExpenseLike,
} from '../src/lib/weeklyInsightsUtils';
import type { Category } from '../src/store/categoryStore';
import type { DailyRecord, GullakDeposit } from '../src/store/dailyBudgetStore';

describe('Weekly Insights Pure Analytics & Engine', () => {
  const mockCategories: Category[] = [
    { id: 'cat-food', name: 'Food & Dining', color: '#F07167', icon: 'Utensils', user_id: 'test-user', is_default: false },
    { id: 'cat-grocery', name: 'Groceries', color: '#00AFB9', icon: 'ShoppingBag', user_id: 'test-user', is_default: false },
    { id: 'cat-income', name: 'Salary', color: '#10B981', icon: 'Wallet', user_id: 'test-user', is_default: false },
  ];

  const refDate = parseISO('2026-09-23T12:00:00');
  const prevRefDate = parseISO('2026-09-16T12:00:00');

  const weekInterval = {
    start: startOfWeek(refDate, { weekStartsOn: 1 }),
    end: endOfWeek(refDate, { weekStartsOn: 1 }),
  };

  const prevWeekInterval = {
    start: startOfWeek(prevRefDate, { weekStartsOn: 1 }),
    end: endOfWeek(prevRefDate, { weekStartsOn: 1 }),
  };

  describe('Ticket 01: Core Weekly Data & Budget Derivation', () => {
    it('calculates total weekly spend excluding income transactions', () => {
      const expenses: ExpenseLike[] = [
        { id: '1', amount: 500, expense_date: '2026-09-22', category_id: 'cat-food', payment_mode: 'upi' },
        { id: '2', amount: 800, expense_date: '2026-09-24', category_id: 'cat-grocery', payment_mode: 'card' },
        { id: '3', amount: 50000, expense_date: '2026-09-23', category_id: 'cat-income', payment_mode: 'bank' }, // Income
        { id: '4', amount: 200, expense_date: '2026-09-18', category_id: 'cat-food', payment_mode: 'cash' }, // Outside week
      ];

      const spend = computeWeeklySpend(expenses, mockCategories, weekInterval);
      expect(spend).toBe(1300);
    });

    it('derives standard weekly budget for daily cadence across 7 days', () => {
      const { effectiveBudget, activeDays, isPartialFirstWeek } = computeEffectiveWeekBudget(
        'daily',
        500,
        3500,
        '2026-01-01',
        weekInterval
      );
      expect(effectiveBudget).toBe(3500);
      expect(activeDays).toBe(7);
      expect(isPartialFirstWeek).toBe(false);
    });

    it('caps budget for mid-week joiner (e.g. joined on Thursday = 4 days remaining)', () => {
      // 2026-09-24 is Thursday of this week
      const { effectiveBudget, activeDays, isPartialFirstWeek } = computeEffectiveWeekBudget(
        'daily',
        500,
        3500,
        '2026-09-24',
        weekInterval
      );
      expect(activeDays).toBe(4);
      expect(effectiveBudget).toBe(2000);
      expect(isPartialFirstWeek).toBe(true);
    });

    it('correctly calculates budget health and remaining cushion', () => {
      const health = computeBudgetHealth(3500, 2000);
      expect(health.isOverBudget).toBe(false);
      expect(health.remaining).toBe(1500);
      expect(health.overAmount).toBe(0);
      expect(health.ratio).toBe(0.57);
    });

    it('correctly flags over-budget state', () => {
      const health = computeBudgetHealth(3500, 4200);
      expect(health.isOverBudget).toBe(true);
      expect(health.remaining).toBe(0);
      expect(health.overAmount).toBe(700);
      expect(health.ratio).toBe(1);
    });

    it('calculates safe daily spending pace', () => {
      // Wednesday: 3 days elapsed, 4 days left
      const pace = computeSafeDailyPace(1200, 3);
      expect(pace).toBe(300); // 1200 / 4
    });
  });

  describe('Ticket 02: Weekly Gullak Savings Aggregator', () => {
    it('aggregates daily rollover savings and manual deposits in the week', () => {
      const dailyRecords: Record<string, DailyRecord> = {
        '2026-09-21': { date: '2026-09-21', budget: 500, spent: 300, saved: 200, isFinalized: true, status: 'saved' },
        '2026-09-22': { date: '2026-09-22', budget: 500, spent: 250, saved: 250, isFinalized: true, status: 'saved' },
        '2026-09-23': { date: '2026-09-23', budget: 500, spent: 600, saved: 0, isFinalized: true, status: 'exceeded' },
        '2026-09-15': { date: '2026-09-15', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' }, // Outside week
      };

      const gullakDeposits: GullakDeposit[] = [
        { id: 'dep-1', amount: 500, date: '2026-09-24', source: 'external', created_at: '2026-09-24T10:00:00Z' },
      ];

      const savings = computeWeeklyGullakSavings(dailyRecords, gullakDeposits, weekInterval);
      expect(savings.autoSaved).toBe(450);
      expect(savings.manualDeposits).toBe(500);
      expect(savings.totalSaved).toBe(950);
      expect(savings.savedDaysCount).toBe(2);
    });
  });

  describe('Ticket 03: Smart Weekly Takeaway Engine', () => {
    it('returns zero-spend message when currentTotal is 0', () => {
      const res = computeSmartWeeklyTakeaway({
        currentTotal: 0,
        isBudgetMode: true,
        isOverBudget: false,
        overAmount: 0,
        savedDaysCount: 0,
        weekSavings: 0,
        isCurrentWeek: true,
        safeDailyPace: 500,
        transactionCount: 0,
        dailyAverageBurn: 0,
      });
      expect(res.text).toBe('No expenses logged this week.');
      expect(res.status).toBe('neutral');
    });

    it('returns over-budget alert when week exceeds budget', () => {
      const res = computeSmartWeeklyTakeaway({
        currentTotal: 4000,
        isBudgetMode: true,
        isOverBudget: true,
        overAmount: 500,
        peakDayName: 'Saturday',
        savedDaysCount: 2,
        weekSavings: 100,
        isCurrentWeek: true,
        safeDailyPace: 0,
        transactionCount: 8,
        dailyAverageBurn: 571,
      });
      expect(res.text).toContain('Weekly spend exceeded budget by ₹500.');
      expect(res.text).toContain('Saturday had the highest outflow.');
      expect(res.status).toBe('coral');
    });

    it('returns savings celebration when 5+ days saved', () => {
      const res = computeSmartWeeklyTakeaway({
        currentTotal: 1800,
        isBudgetMode: true,
        isOverBudget: false,
        overAmount: 0,
        savedDaysCount: 6,
        weekSavings: 1200,
        isCurrentWeek: false,
        safeDailyPace: 0,
        transactionCount: 6,
        dailyAverageBurn: 257,
      });
      expect(res.text).toContain('Stayed under budget on 6 of 7 days');
      expect(res.text).toContain('+₹1,200 saved to Gullak');
      expect(res.status).toBe('mint');
    });
  });

  describe('Ticket 04: Largest Single Outflow & Threshold', () => {
    it('identifies max expense and shows pill when >= 15% and >= 100', () => {
      const expenses: ExpenseLike[] = [
        { id: '1', amount: 300, expense_date: '2026-09-22', category_id: 'cat-food', payment_mode: 'upi', notes: 'Dinner' },
        { id: '2', amount: 1500, expense_date: '2026-09-25', category_id: 'cat-grocery', payment_mode: 'card', notes: 'Monthly Restock' },
      ];
      const res = computeLargestSingleOutflow(expenses, mockCategories, weekInterval, 2000);
      expect(res).not.toBeNull();
      expect(res?.expense.amount).toBe(1500);
      expect(res?.categoryName).toBe('Groceries');
      expect(res?.outflowPercent).toBe(75);
      expect(res?.shouldShowPill).toBe(true);
    });

    it('suppresses percentage pill for small trivial expenses', () => {
      const expenses: ExpenseLike[] = [
        { id: '1', amount: 20, expense_date: '2026-09-22', category_id: 'cat-food', payment_mode: 'upi', notes: 'Chai' },
      ];
      const res = computeLargestSingleOutflow(expenses, mockCategories, weekInterval, 20);
      expect(res).not.toBeNull();
      expect(res?.shouldShowPill).toBe(false); // amount < 100
    });
  });

  describe('Ticket 05: Weekday vs Weekend & Adaptive Burn', () => {
    const weeklyData = [
      { day: 'Mon', dateStr: '2026-09-21', amount: 200 },
      { day: 'Tue', dateStr: '2026-09-22', amount: 300 },
      { day: 'Wed', dateStr: '2026-09-23', amount: 250 },
      { day: 'Thu', dateStr: '2026-09-24', amount: 200 },
      { day: 'Fri', dateStr: '2026-09-25', amount: 450 },
      { day: 'Sat', dateStr: '2026-09-26', amount: 1200 },
      { day: 'Sun', dateStr: '2026-09-27', amount: 900 },
    ];

    it('computes weekend split for completed past week', () => {
      const res = computeWeekdayVsWeekendDynamics(weeklyData, 3500, -1);
      expect(res.mode).toBe('weekend_split');
      expect(res.headline).toContain('higher on weekends');
      expect(res.weekendSharePercent).toBe(60); // 2100 / 3500 = 60%
    });

    it('adapts to daily burn rate on mid-week Wednesday for current week', () => {
      const wednesday = new Date('2026-09-23T12:00:00.000Z');
      const res = computeWeekdayVsWeekendDynamics(weeklyData, 750, 0, wednesday);
      expect(res.mode).toBe('daily_burn');
      expect(res.title).toBe('DAILY AVERAGE BURN');
      expect(res.headline).toBe('₹250 / day so far'); // 750 / 3
      expect(res.pillText).toBe('4 days left');
    });
  });

  describe('Ticket 06: Day-Matched Previous Week Comparison', () => {
    it('compares Mon–Wed of this week vs Mon–Wed of last week for mid-week viewing', () => {
      const expenses: ExpenseLike[] = [
        // Prev week: Mon(400) + Tue(600) + Wed(500) + Sat(2000)
        { id: 'p1', amount: 400, expense_date: '2026-09-14', category_id: 'cat-food', payment_mode: 'upi' },
        { id: 'p2', amount: 600, expense_date: '2026-09-15', category_id: 'cat-food', payment_mode: 'upi' },
        { id: 'p3', amount: 500, expense_date: '2026-09-16', category_id: 'cat-food', payment_mode: 'upi' },
        { id: 'p4', amount: 2000, expense_date: '2026-09-19', category_id: 'cat-food', payment_mode: 'upi' }, // Sat
        // Current week: Mon(600) + Tue(600) + Wed(600) = 1800
        { id: 'c1', amount: 600, expense_date: '2026-09-21', category_id: 'cat-food', payment_mode: 'upi' },
        { id: 'c2', amount: 600, expense_date: '2026-09-22', category_id: 'cat-food', payment_mode: 'upi' },
        { id: 'c3', amount: 600, expense_date: '2026-09-23', category_id: 'cat-food', payment_mode: 'upi' },
      ];

      const wednesday = new Date('2026-09-23T12:00:00.000Z');
      const res = computeDayMatchedPreviousComparison(
        expenses,
        mockCategories,
        weekInterval,
        prevWeekInterval,
        0,
        wednesday
      );

      // Prev matched (Mon-Wed) = 1500. Curr = 1800. Diff = +300 (+20%)
      expect(res.percentageChange).toBe(20);
      expect(res.isIncrease).toBe(true);
      expect(res.trendLabel).toBe('20% vs same days last week');
    });

    it('returns first week label if no previous week data exists', () => {
      const expenses: ExpenseLike[] = [
        { id: 'c1', amount: 500, expense_date: '2026-09-21', category_id: 'cat-food', payment_mode: 'upi' },
      ];
      const res = computeDayMatchedPreviousComparison(
        expenses,
        mockCategories,
        weekInterval,
        prevWeekInterval,
        0
      );
      expect(res.percentageChange).toBeNull();
      expect(res.trendLabel).toBe('First week of tracking');
    });
  });

  describe('Peak Days Subtitle', () => {
    it('formats single peak day with currency', () => {
      const data = [
        { day: 'Mon', dateStr: '2026-09-21', amount: 100 },
        { day: 'Sat', dateStr: '2026-09-26', amount: 1450 },
      ];
      expect(computePeakDaysSubtitle(data)).toBe('Peak: Saturday (₹1,450)');
    });

    it('formats tied peak days', () => {
      const data = [
        { day: 'Tue', dateStr: '2026-09-22', amount: 500 },
        { day: 'Fri', dateStr: '2026-09-25', amount: 500 },
      ];
      expect(computePeakDaysSubtitle(data)).toBe('Peak: Tue & Fri (₹500)');
    });
  });
});
