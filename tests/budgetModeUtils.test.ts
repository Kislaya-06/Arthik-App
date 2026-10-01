import { describe, it, expect } from 'vitest';
import {
  getVisibleTabs,
  resolveSavingsRoute,
  formatCadenceBudgetSubtitle,
  formatEffectiveFrom,
  getProrationPreview,
  formatCadenceStreakLabel,
  formatCadenceRolloverStrip,
  buildWeeklyStreakCards,
  buildMonthlyStreakMatrix,
} from '../src/lib/budgetModeUtils';
import { BudgetPlanChange, BudgetPeriodRecord } from '../src/types';

describe('budgetModeUtils (pure helpers)', () => {
  describe('getVisibleTabs', () => {
    it('returns 3 tabs (Home, History, Insights) when mode is OFF', () => {
      const tabs = getVisibleTabs(false);
      expect(tabs).toEqual(['Home', 'History', 'Insights']);
      expect(tabs).not.toContain('Savings');
    });

    it('returns 4 tabs (Home, History, Savings, Insights) when mode is ON', () => {
      const tabs = getVisibleTabs(true);
      expect(tabs).toEqual(['Home', 'History', 'Savings', 'Insights']);
      expect(tabs).toContain('Savings');
    });
  });

  describe('resolveSavingsRoute', () => {
    it('always routes daily_reminder notification to Home, even when mode is ON', () => {
      expect(resolveSavingsRoute(true, 'daily_reminder')).toBe('Home');
      expect(resolveSavingsRoute(false, 'daily_reminder')).toBe('Home');
    });

    it('routes to Home when mode is OFF for any notification type or undefined', () => {
      expect(resolveSavingsRoute(false)).toBe('Home');
      expect(resolveSavingsRoute(false, 'budget_warning')).toBe('Home');
      expect(resolveSavingsRoute(false, 'budget_exceeded')).toBe('Home');
      expect(resolveSavingsRoute(false, 'savings_rollover')).toBe('Home');
    });

    it('routes to Savings when mode is ON for budget and savings notifications', () => {
      expect(resolveSavingsRoute(true)).toBe('Savings');
      expect(resolveSavingsRoute(true, 'budget_warning')).toBe('Savings');
      expect(resolveSavingsRoute(true, 'budget_exceeded')).toBe('Savings');
      expect(resolveSavingsRoute(true, 'savings_rollover')).toBe('Savings');
    });
  });

  describe('formatCadenceBudgetSubtitle', () => {
    it('returns explanation string when mode is OFF', () => {
      expect(formatCadenceBudgetSubtitle(false, 'daily', 500)).toBe(
        'Track expenses with no limits'
      );
    });

    it('formats cadence and amount correctly when mode is ON', () => {
      expect(formatCadenceBudgetSubtitle(true, 'daily', 500)).toBe('Daily · ₹500');
      expect(formatCadenceBudgetSubtitle(true, 'weekly', 7000)).toBe('Weekly · ₹7,000');
      expect(formatCadenceBudgetSubtitle(true, 'monthly', 30000)).toBe('Monthly · ₹30,000');
    });

    it('returns Set budget when amount is 0 or unconfigured', () => {
      expect(formatCadenceBudgetSubtitle(true, 'weekly', 0)).toBe('Weekly · Set budget');
    });
  });

  describe('formatEffectiveFrom', () => {
    it('returns "Takes effect today" if isFirstEnable or effective date is today', () => {
      expect(formatEffectiveFrom('2026-10-01', '2026-10-01', 'daily', true)).toBe('Takes effect today');
      expect(formatEffectiveFrom('2026-10-01', '2026-10-01', 'weekly', false)).toBe('Takes effect today');
    });

    it('returns tomorrow label for next day change', () => {
      // 2026-10-02 is Friday
      expect(formatEffectiveFrom('2026-10-02', '2026-10-01', 'daily')).toBe('Takes effect tomorrow (Fri, 2 Oct)');
    });

    it('returns next Monday copy for weekly amount changes', () => {
      // 2026-10-05 is Monday
      expect(formatEffectiveFrom('2026-10-05', '2026-10-01', 'weekly')).toBe('Takes effect next Monday (5 Oct)');
    });

    it('returns 1st of month copy for monthly amount changes', () => {
      expect(formatEffectiveFrom('2026-11-01', '2026-10-15', 'monthly')).toBe('Takes effect on 1 Nov');
    });
  });

  describe('getProrationPreview', () => {
    it('returns null for daily cadence or zero amount', () => {
      expect(getProrationPreview('daily', 500, '2026-10-02', '2026-10-01')).toBeNull();
      expect(getProrationPreview('weekly', 0, '2026-10-02', '2026-10-01')).toBeNull();
    });

    it('returns null when effective date is the start of the week (Monday)', () => {
      // 2026-10-05 is Monday
      expect(getProrationPreview('weekly', 7000, '2026-10-05', '2026-10-04')).toBeNull();
    });

    it('calculates unprorated weekly budget and English preview with pace guidance for partial week', () => {
      // 2026-10-02 is Friday; week ends Sunday 2026-10-04 (3 days remaining: Fri, Sat, Sun)
      const preview = getProrationPreview('weekly', 7000, '2026-10-02', '2026-10-01');
      expect(preview).not.toBeNull();
      expect(preview?.isProrated).toBe(false);
      expect(preview?.remainingDays).toBe(3);
      expect(preview?.proratedAmount).toBe(7000); // 100% real money intact
      expect(preview?.previewText).toBe('Full ₹7,000 budget active for remaining 3 days');
      expect(preview?.explanationText).toBe(
        'Your full ₹7,000/week budget is 100% active until Sunday without proration. Suggested daily pace: ~₹2,333/day.'
      );
    });

    it('calculates unprorated weekly budget with singular day when 1 day remains', () => {
      // 2026-10-04 is Sunday; week ends Sunday 2026-10-04 (1 day remaining: Sun)
      const preview = getProrationPreview('weekly', 700, '2026-10-04', '2026-10-03');
      expect(preview).not.toBeNull();
      expect(preview?.isProrated).toBe(false);
      expect(preview?.remainingDays).toBe(1);
      expect(preview?.proratedAmount).toBe(700); // 100% real money intact
      expect(preview?.previewText).toBe('Full ₹700 budget active for remaining 1 day');
      expect(preview?.explanationText).toBe(
        'Your full ₹700/week budget is 100% active until Sunday without proration. Suggested daily pace: ~₹700/day.'
      );
    });

    it('calculates unprorated monthly budget for mid-month switch with pace guidance', () => {
      // 2026-10-16: October has 31 days. Remaining from 16 to 31 = 16 days.
      const preview = getProrationPreview('monthly', 31000, '2026-10-16', '2026-10-15');
      expect(preview).not.toBeNull();
      expect(preview?.isProrated).toBe(false);
      expect(preview?.remainingDays).toBe(16);
      expect(preview?.proratedAmount).toBe(31000); // 100% real money intact
      expect(preview?.previewText).toBe('Full ₹31,000 budget active for remaining 16 days');
      expect(preview?.explanationText).toBe(
        'Your full ₹31,000/month budget is 100% active until month-end without proration. Suggested daily pace: ~₹1,938/day.'
      );
    });
  });

  describe('formatCadenceStreakLabel', () => {
    it('formats days, weeks, months with correct plurals per D6', () => {
      expect(formatCadenceStreakLabel(1, 'daily')).toBe('1 day');
      expect(formatCadenceStreakLabel(5, 'daily')).toBe('5 days');
      expect(formatCadenceStreakLabel(1, 'weekly')).toBe('1 week');
      expect(formatCadenceStreakLabel(3, 'weekly')).toBe('3 weeks');
      expect(formatCadenceStreakLabel(1, 'monthly')).toBe('1 month');
      expect(formatCadenceStreakLabel(2, 'monthly')).toBe('2 months');
    });
  });

  describe('formatCadenceRolloverStrip', () => {
    it('returns empty string for daily cadence or null summary', () => {
      expect(formatCadenceRolloverStrip(null, 'weekly')).toBe('');
      expect(formatCadenceRolloverStrip({} as any, 'daily')).toBe('');
    });

    it('formats weekly rollover copy when on track vs over', () => {
      const summaryOnTrack = {
        cadence: 'weekly' as const,
        periodStart: '2026-09-28',
        periodEnd: '2026-10-04',
        activeStart: '2026-09-28',
        activeEnd: '2026-10-04',
        budget: 7000,
        spent: 4700,
        remaining: 2300,
        isOver: false,
        overBy: 0,
        rolloverLabelDate: '2026-10-04',
        remainingDays: 3,
        suggestedDailyPace: 767,
      };
      expect(formatCadenceRolloverStrip(summaryOnTrack, 'weekly')).toBe('₹2,300 rolls over to Gullak on Sunday');

      const summaryOver = {
        ...summaryOnTrack,
        spent: 7400,
        remaining: 0,
        isOver: true,
        overBy: 400,
      };
      expect(formatCadenceRolloverStrip(summaryOver, 'weekly')).toBe('Over by ₹400 this week');
    });

    it('formats monthly rollover copy when on track vs over', () => {
      const summaryMonthly = {
        cadence: 'monthly' as const,
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
        activeStart: '2026-10-01',
        activeEnd: '2026-10-31',
        budget: 30000,
        spent: 20000,
        remaining: 10000,
        isOver: false,
        overBy: 0,
        rolloverLabelDate: '2026-10-31',
        remainingDays: 15,
        suggestedDailyPace: 667,
      };
      expect(formatCadenceRolloverStrip(summaryMonthly, 'monthly')).toBe('₹10,000 rolls over to Gullak at month end');
    });
  });

  describe('buildWeeklyStreakCards', () => {
    it('generates vertical cards for last 4 weeks with current week live status', () => {
      const todayStr = '2026-10-01'; // Thursday
      const changes: BudgetPlanChange[] = [
        {
          id: 'c1',
          userId: 'u1',
          effectiveFrom: '2026-09-01',
          isEnabled: true,
          cadence: 'weekly',
          amount: 7000,
          createdAt: '2026-09-01T00:00:00Z',
        },
      ];
      const budgetPeriods: Record<string, BudgetPeriodRecord> = {
        'weekly_2026-09-21': {
          id: 'weekly_2026-09-21',
          userId: 'u1',
          cadence: 'weekly',
          periodStart: '2026-09-21',
          periodEnd: '2026-09-27',
          activeStart: '2026-09-21',
          activeEnd: '2026-09-27',
          budgetAmount: 7000,
          spentAmount: 5500,
          amountSaved: 1500,
          status: 'saved',
          isProrated: false,
        },
      };
      const spentByDate = {
        '2026-09-28': 1000,
        '2026-09-29': 1000,
        '2026-09-30': 1000,
        '2026-10-01': 1000,
      };

      const cards = buildWeeklyStreakCards(changes, budgetPeriods, spentByDate, todayStr, 3);
      expect(cards).toHaveLength(3);

      // Latest card is current week
      const current = cards[cards.length - 1];
      expect(current.isCurrentWeek).toBe(true);
      expect(current.weekLabel).toBe('This Week');
      expect(current.spent).toBe(4000);
      expect(current.badgeText).toBe('● On Track');

      // Previous week from budgetPeriods
      const prev = cards[cards.length - 2];
      expect(prev.isCurrentWeek).toBe(false);
      expect(prev.status).toBe('saved');
      expect(prev.badgeText).toBe('+₹1,500 to Gullak');
    });
  });

  describe('buildMonthlyStreakMatrix', () => {
    it('builds 12 cells for current year with past, current and future statuses', () => {
      const todayStr = '2026-10-01'; // October
      const changes: BudgetPlanChange[] = [
        {
          id: 'c1',
          userId: 'u1',
          effectiveFrom: '2026-01-01',
          isEnabled: true,
          cadence: 'monthly',
          amount: 30000,
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];
      const budgetPeriods: Record<string, BudgetPeriodRecord> = {
        'monthly_2026-09-01': {
          id: 'monthly_2026-09-01',
          userId: 'u1',
          cadence: 'monthly',
          periodStart: '2026-09-01',
          periodEnd: '2026-09-30',
          activeStart: '2026-09-01',
          activeEnd: '2026-09-30',
          budgetAmount: 30000,
          spentAmount: 22000,
          amountSaved: 8000,
          status: 'saved',
          isProrated: false,
        },
      };

      const matrix = buildMonthlyStreakMatrix(changes, budgetPeriods, {}, todayStr, 2026);
      expect(matrix).toHaveLength(12);

      // Sept (index 8) should be saved
      expect(matrix[8].monthName).toBe('Sep');
      expect(matrix[8].status).toBe('saved');
      expect(matrix[8].badgeText).toBe('+₹8,000');

      // Oct (index 9) should be current
      expect(matrix[9].monthName).toBe('Oct');
      expect(matrix[9].status).toBe('current');

      // Nov (index 10) should be future
      expect(matrix[10].monthName).toBe('Nov');
      expect(matrix[10].status).toBe('future');
    });
  });
});

