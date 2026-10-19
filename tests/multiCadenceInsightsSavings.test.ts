import { describe, it, expect } from 'vitest';
import { parseISO } from 'date-fns';
import {
  computeWeeklyGullakSavings,
  computeWeeklyShareOfMonthlyBudget,
  computeSmartWeeklyTakeaway,
  WeekInterval,
} from '../src/lib/weeklyInsightsUtils';
import {
  computeMonthlyGullakSavings,
  computeSmartMonthlyTakeaway,
  MonthInterval,
} from '../src/lib/monthlyInsightsUtils';
import type { DailyRecord, GullakDeposit } from '../src/store/dailyBudgetStore';
import type { BudgetPeriodRecord } from '../src/types';

describe('FIN-04: Multi-Cadence Insights Savings & Option 2 Monthly Share (INS-002, HEA-002)', () => {
  const weekInterval: WeekInterval = {
    start: parseISO('2026-10-12'), // Monday
    end: parseISO('2026-10-18'),   // Sunday
  };

  const monthInterval: MonthInterval = {
    start: parseISO('2026-10-01'),
    end: parseISO('2026-10-31'),
  };

  describe('1. Weekly Insights with Weekly Cadence', () => {
    it('picks up finalized weekly period savings when dailyRecords is empty (HEA-002)', () => {
      // Rule HEA-002: Weekly cadence has NO daily records
      const dailyRecords: Record<string, DailyRecord> = {};
      const gullakDeposits: GullakDeposit[] = [];

      const budgetPeriods: BudgetPeriodRecord[] = [
        {
          id: 'wp-1',
          userId: 'u1',
          cadence: 'weekly',
          periodStart: '2026-10-12',
          periodEnd: '2026-10-18',
          activeStart: '2026-10-12',
          activeEnd: '2026-10-18',
          budgetAmount: 5000,
          spentAmount: 3800,
          amountSaved: 1200,
          status: 'saved',
          isProrated: false,
        },
      ];

      const res = computeWeeklyGullakSavings(
        dailyRecords,
        gullakDeposits,
        weekInterval,
        budgetPeriods,
        'weekly'
      );

      expect(res.autoSaved).toBe(1200);
      expect(res.totalSaved).toBe(1200);
      expect(res.savedWeeksCount).toBe(1);
      expect(res.pillLabel).toBe('🐷 1 Saved Week');
    });

    it('seamlessly handles mid-week cadence switch without double counting', () => {
      // Mon-Wed: Daily cadence (saved 200 + 100 = 300)
      const dailyRecords: Record<string, DailyRecord> = {
        '2026-10-12': { date: '2026-10-12', budget: 500, spent: 300, saved: 200, status: 'saved', isFinalized: true },
        '2026-10-13': { date: '2026-10-13', budget: 500, spent: 400, saved: 100, status: 'saved', isFinalized: true },
        '2026-10-14': { date: '2026-10-14', budget: 500, spent: 500, saved: 0, status: 'even', isFinalized: true },
      };

      // Thu-Sun: Weekly slice (saved 400)
      const budgetPeriods: BudgetPeriodRecord[] = [
        {
          id: 'wp-slice',
          userId: 'u1',
          cadence: 'weekly',
          periodStart: '2026-10-12',
          periodEnd: '2026-10-18',
          activeStart: '2026-10-15',
          activeEnd: '2026-10-18',
          budgetAmount: 2000,
          spentAmount: 1600,
          amountSaved: 400,
          status: 'saved',
          isProrated: false,
        },
      ];

      const res = computeWeeklyGullakSavings(
        dailyRecords,
        [],
        weekInterval,
        budgetPeriods,
        'weekly'
      );

      // Auto saved must be 300 (daily) + 400 (weekly slice) = 700
      expect(res.autoSaved).toBe(700);
      expect(res.totalSaved).toBe(700);
      expect(res.savedWeeksCount).toBe(1);
      // Saved days: 2 daily + 4 slice days = 6 days
      expect(res.savedDaysCount).toBe(6);
    });

    it('triggers weekly discipline takeaway for weekly budget savers', () => {
      const takeaway = computeSmartWeeklyTakeaway({
        currentTotal: 3800,
        isBudgetMode: true,
        isOverBudget: false,
        overAmount: 0,
        savedDaysCount: 7,
        weekSavings: 1200,
        safeDailyPace: 500,
        isCurrentWeek: false,
        transactionCount: 5,
        dailyAverageBurn: 540,
        cadence: 'weekly',
        savedWeeksCount: 1,
      });

      expect(takeaway.status).toBe('mint');
      expect(takeaway.text).toContain('Stayed under weekly budget');
      expect(takeaway.text).toContain('+₹1,200 saved to Gullak');
    });
  });

  describe('2. Option 2: Monthly User on Weekly Tab (Month Budget Share %)', () => {
    it('calculates on_track status when spend is <= 25% of monthly budget', () => {
      const share = computeWeeklyShareOfMonthlyBudget(6000, 30000); // 20%
      expect(share.percentage).toBe(20);
      expect(share.status).toBe('on_track');
      expect(share.pillText).toBe('🟢 On Track');
      expect(share.subtext).toContain('₹6,000 of ₹30,000 pool');
    });

    it('calculates heavy status when spend is > 25% of monthly budget', () => {
      const share = computeWeeklyShareOfMonthlyBudget(10500, 30000); // 35%
      expect(share.percentage).toBe(35);
      expect(share.status).toBe('heavy');
      expect(share.pillText).toBe('⚠️ High Burn');
      expect(share.subtext).toContain('₹10,500 of ₹30,000 pool');
    });

    it('produces intelligent contextual takeaway for monthly users on weekly tab', () => {
      const normalShare = computeWeeklyShareOfMonthlyBudget(6000, 30000);
      const takeawayNormal = computeSmartWeeklyTakeaway({
        currentTotal: 6000,
        isBudgetMode: true,
        isOverBudget: false,
        overAmount: 0,
        savedDaysCount: 0,
        weekSavings: 0,
        safeDailyPace: 1000,
        isCurrentWeek: true,
        transactionCount: 8,
        dailyAverageBurn: 850,
        cadence: 'monthly',
        monthlyBudgetShare: normalShare,
        monthlyBudgetAmount: 30000,
      });

      expect(takeawayNormal.status).toBe('mint');
      expect(takeawayNormal.text).toContain('Healthy pacing: spent 20% of monthly budget this week');

      const heavyShare = computeWeeklyShareOfMonthlyBudget(10500, 30000);
      const takeawayHeavy = computeSmartWeeklyTakeaway({
        currentTotal: 10500,
        isBudgetMode: true,
        isOverBudget: false,
        overAmount: 0,
        savedDaysCount: 0,
        weekSavings: 0,
        safeDailyPace: 800,
        isCurrentWeek: true,
        transactionCount: 12,
        dailyAverageBurn: 1500,
        cadence: 'monthly',
        monthlyBudgetShare: heavyShare,
        monthlyBudgetAmount: 30000,
      });

      expect(takeawayHeavy.status).toBe('coral');
      expect(takeawayHeavy.text).toContain('High burn week: spent 35% of monthly budget in 1 week');
    });
  });

  describe('3. Monthly Insights with Weekly & Monthly Cadences', () => {
    it('aggregates multiple finalized weekly periods for weekly users in monthly tab', () => {
      const budgetPeriods: BudgetPeriodRecord[] = [
        // Week 1 (Oct 5 - Oct 11): saved 1000
        {
          id: 'w1',
          userId: 'u1',
          cadence: 'weekly',
          periodStart: '2026-10-05',
          periodEnd: '2026-10-11',
          activeStart: '2026-10-05',
          activeEnd: '2026-10-11',
          budgetAmount: 4000,
          spentAmount: 3000,
          amountSaved: 1000,
          status: 'saved',
          isProrated: false,
        },
        // Week 2 (Oct 12 - Oct 18): saved 800
        {
          id: 'w2',
          userId: 'u1',
          cadence: 'weekly',
          periodStart: '2026-10-12',
          periodEnd: '2026-10-18',
          activeStart: '2026-10-12',
          activeEnd: '2026-10-18',
          budgetAmount: 4000,
          spentAmount: 3200,
          amountSaved: 800,
          status: 'saved',
          isProrated: false,
        },
        // Week 3 (Oct 19 - Oct 25): overspent (saved 0)
        {
          id: 'w3',
          userId: 'u1',
          cadence: 'weekly',
          periodStart: '2026-10-19',
          periodEnd: '2026-10-25',
          activeStart: '2026-10-19',
          activeEnd: '2026-10-25',
          budgetAmount: 4000,
          spentAmount: 4500,
          amountSaved: 0,
          status: 'missed',
          isProrated: false,
        },
        // Week 4 (Oct 26 - Nov 01): activeEnd is in Nov! Belongs to Nov rollover.
        {
          id: 'w4',
          userId: 'u1',
          cadence: 'weekly',
          periodStart: '2026-10-26',
          periodEnd: '2026-11-01',
          activeStart: '2026-10-26',
          activeEnd: '2026-11-01',
          budgetAmount: 4000,
          spentAmount: 2800,
          amountSaved: 1200,
          status: 'saved',
          isProrated: false,
        },
      ];

      const res = computeMonthlyGullakSavings(
        {},
        [],
        monthInterval,
        budgetPeriods,
        'weekly'
      );

      // Weeks 1 & 2 finalized in Oct: 1000 + 800 = 1800
      expect(res.autoSaved).toBe(1800);
      expect(res.totalSaved).toBe(1800);
      expect(res.savedWeeksCount).toBe(2);
      expect(res.pillLabel).toBe('🐷 2 Saved Weeks');
    });

    it('aggregates finalized monthly period for monthly users in monthly tab', () => {
      const budgetPeriods: BudgetPeriodRecord[] = [
        {
          id: 'm1',
          userId: 'u1',
          cadence: 'monthly',
          periodStart: '2026-10-01',
          periodEnd: '2026-10-31',
          activeStart: '2026-10-01',
          activeEnd: '2026-10-31',
          budgetAmount: 30000,
          spentAmount: 24000,
          amountSaved: 6000,
          status: 'saved',
          isProrated: false,
        },
      ];

      const res = computeMonthlyGullakSavings(
        {},
        [{ id: 'd1', amount: 1000, date: '2026-10-15', source: 'external', created_at: '2026-10-15T10:00:00Z' }],
        monthInterval,
        budgetPeriods,
        'monthly'
      );

      expect(res.autoSaved).toBe(6000);
      expect(res.manualDeposits).toBe(1000);
      expect(res.totalSaved).toBe(7000);
      expect(res.savedMonthsCount).toBe(1);
      expect(res.pillLabel).toBe('🐷 1 Saved Month');
    });

    it('triggers monthly and weekly cadence-aware discipline takeaways in monthly tab', () => {
      // Monthly user takeaway
      const takeawayMonthly = computeSmartMonthlyTakeaway({
        currentTotal: 24000,
        isBudgetMode: true,
        isOverBudget: false,
        overAmount: 0,
        savedDaysCount: 30,
        totalMonthSavings: 6000,
        isCurrentMonth: false,
        safeDailyPace: 0,
        remainingDays: 0,
        remainingBudget: 6000,
        transactionCount: 25,
        monthlyDailyBurnPace: 774,
        cadence: 'monthly',
        savedMonthsCount: 1,
      });

      expect(takeawayMonthly.status).toBe('mint');
      expect(takeawayMonthly.text).toContain('Stayed under monthly budget');
      expect(takeawayMonthly.text).toContain('+₹6,000 saved to Gullak');

      // Weekly user takeaway in monthly tab
      const takeawayWeeklyInMonth = computeSmartMonthlyTakeaway({
        currentTotal: 12000,
        isBudgetMode: true,
        isOverBudget: false,
        overAmount: 0,
        savedDaysCount: 21,
        totalMonthSavings: 3000,
        isCurrentMonth: false,
        safeDailyPace: 0,
        remainingDays: 0,
        remainingBudget: 3000,
        transactionCount: 18,
        monthlyDailyBurnPace: 387,
        cadence: 'weekly',
        savedWeeksCount: 3,
      });

      expect(takeawayWeeklyInMonth.status).toBe('mint');
      expect(takeawayWeeklyInMonth.text).toContain('Stayed under budget on 3 weeks');
      expect(takeawayWeeklyInMonth.text).toContain('+₹3,000 saved to Gullak');
    });
  });
});
