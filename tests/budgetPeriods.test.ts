import { describe, it, expect } from 'vitest';
import {
  getPeriodBounds,
  resolvePlanForDate,
  getDateOwner,
  computeEffectiveFrom,
  upsertPendingChange,
  buildPeriodsToFinalize,
  getCurrentPeriodSummary,
  isDailyGovernedDate,
  computeCadenceStreak,
  StreakUnit,
} from '../src/lib/budgetPeriods';
import { BudgetPlanChange } from '../src/types';
import { eachDayOfInterval, parseISO, format, differenceInCalendarDays } from 'date-fns';

describe('budgetPeriods - Pure Cadence Period Engine Tests', () => {
  // =========================================================================
  // 1. getPeriodBounds
  // =========================================================================
  describe('1. getPeriodBounds', () => {
    it('daily cadence returns start and end as the same date, totalDays = 1', () => {
      const bounds = getPeriodBounds('daily', '2026-10-05');
      expect(bounds).toEqual({
        start: '2026-10-05',
        end: '2026-10-05',
        totalDays: 1,
      });
    });

    it('weekly cadence returns Monday to Sunday bounds (7 days)', () => {
      // Wednesday 2026-10-07 belongs to Mon 2026-10-05 .. Sun 2026-10-11
      const bounds = getPeriodBounds('weekly', '2026-10-07');
      expect(bounds).toEqual({
        start: '2026-10-05',
        end: '2026-10-11',
        totalDays: 7,
      });
    });

    it('weekly cadence when input date is already Monday', () => {
      const bounds = getPeriodBounds('weekly', '2026-10-05');
      expect(bounds.start).toBe('2026-10-05');
      expect(bounds.end).toBe('2026-10-11');
      expect(bounds.totalDays).toBe(7);
    });

    it('weekly cadence when input date is Sunday', () => {
      const bounds = getPeriodBounds('weekly', '2026-10-11');
      expect(bounds.start).toBe('2026-10-05');
      expect(bounds.end).toBe('2026-10-11');
      expect(bounds.totalDays).toBe(7);
    });

    it('weekly cadence crossing month boundary (Mon 28 Apr 2025 - Sun 4 May 2025)', () => {
      const bounds = getPeriodBounds('weekly', '2025-04-30'); // Wednesday
      expect(bounds).toEqual({
        start: '2025-04-28',
        end: '2025-05-04',
        totalDays: 7,
      });
    });

    it('weekly cadence crossing year boundary (Mon 29 Dec 2025 - Sun 4 Jan 2026)', () => {
      const bounds = getPeriodBounds('weekly', '2025-12-31'); // Wednesday
      expect(bounds).toEqual({
        start: '2025-12-29',
        end: '2026-01-04',
        totalDays: 7,
      });
    });

    it('monthly cadence for 28-day February in non-leap year (2025)', () => {
      const bounds = getPeriodBounds('monthly', '2025-02-14');
      expect(bounds).toEqual({
        start: '2025-02-01',
        end: '2025-02-28',
        totalDays: 28,
      });
    });

    it('monthly cadence for 29-day February in leap year (2028)', () => {
      const bounds = getPeriodBounds('monthly', '2028-02-15');
      expect(bounds).toEqual({
        start: '2028-02-01',
        end: '2028-02-29',
        totalDays: 29,
      });
    });

    it('monthly cadence for 30-day month (April 2026)', () => {
      const bounds = getPeriodBounds('monthly', '2026-04-18');
      expect(bounds).toEqual({
        start: '2026-04-01',
        end: '2026-04-30',
        totalDays: 30,
      });
    });

    it('monthly cadence for 31-day month (October 2026)', () => {
      const bounds = getPeriodBounds('monthly', '2026-10-01');
      expect(bounds).toEqual({
        start: '2026-10-01',
        end: '2026-10-31',
        totalDays: 31,
      });
    });
  });

  // =========================================================================
  // 2. resolvePlanForDate
  // =========================================================================
  describe('2. resolvePlanForDate', () => {
    it('returns null when changes list is empty', () => {
      expect(resolvePlanForDate([], '2026-10-01')).toBeNull();
    });

    it('returns null when all changes are strictly in future', () => {
      const changes: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-10-05',
          isEnabled: true,
          cadence: 'daily',
          amount: 500,
        },
      ];
      expect(resolvePlanForDate(changes, '2026-10-01')).toBeNull();
    });

    it('matches change when date exactly equals effectiveFrom', () => {
      const changes: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-10-05',
          isEnabled: true,
          cadence: 'daily',
          amount: 500,
        },
      ];
      const match = resolvePlanForDate(changes, '2026-10-05');
      expect(match).not.toBeNull();
      expect(match?.id).toBe('1');
    });

    it('picks the latest change with effectiveFrom <= dateStr among multiple changes', () => {
      const changes: BudgetPlanChange[] = [
        {
          id: 'c1',
          userId: 'u1',
          effectiveFrom: '2026-09-01',
          isEnabled: true,
          cadence: 'daily',
          amount: 400,
        },
        {
          id: 'c2',
          userId: 'u1',
          effectiveFrom: '2026-09-15',
          isEnabled: true,
          cadence: 'weekly',
          amount: 2800,
        },
        {
          id: 'c3',
          userId: 'u1',
          effectiveFrom: '2026-10-01',
          isEnabled: false,
          cadence: 'weekly',
          amount: 0,
        },
      ];

      // On 2026-09-10 -> c1 (daily 400)
      expect(resolvePlanForDate(changes, '2026-09-10')?.id).toBe('c1');
      // On 2026-09-15 -> c2 (weekly 2800)
      expect(resolvePlanForDate(changes, '2026-09-15')?.id).toBe('c2');
      // On 2026-09-30 -> c2 (weekly 2800)
      expect(resolvePlanForDate(changes, '2026-09-30')?.id).toBe('c2');
      // On 2026-10-01 -> c3 (disabled)
      expect(resolvePlanForDate(changes, '2026-10-01')?.id).toBe('c3');
      // On 2026-10-05 -> c3 (disabled)
      expect(resolvePlanForDate(changes, '2026-10-05')?.id).toBe('c3');
    });
  });

  // =========================================================================
  // 3. getDateOwner (D2 single-owner invariant)
  // =========================================================================
  describe('3. getDateOwner', () => {
    it('returns "paused" when changes is empty or no plan has taken effect', () => {
      expect(getDateOwner([], '2026-10-01')).toBe('paused');
    });

    it('returns "paused" when plan has isEnabled = false', () => {
      const changes: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-10-01',
          isEnabled: false,
          cadence: 'monthly',
          amount: 0,
        },
      ];
      expect(getDateOwner(changes, '2026-10-05')).toBe('paused');
    });

    it('returns "daily" when plan is enabled with daily cadence', () => {
      const changes: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-10-01',
          isEnabled: true,
          cadence: 'daily',
          amount: 500,
        },
      ];
      expect(getDateOwner(changes, '2026-10-05')).toBe('daily');
    });

    it('returns "weekly" when plan is enabled with weekly cadence', () => {
      const changes: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-10-01',
          isEnabled: true,
          cadence: 'weekly',
          amount: 3500,
        },
      ];
      expect(getDateOwner(changes, '2026-10-05')).toBe('weekly');
    });

    it('returns "monthly" when plan is enabled with monthly cadence', () => {
      const changes: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-10-01',
          isEnabled: true,
          cadence: 'monthly',
          amount: 15000,
        },
      ];
      expect(getDateOwner(changes, '2026-10-05')).toBe('monthly');
    });
  });

  // =========================================================================
  // 4. computeEffectiveFrom & upsertPendingChange (D3)
  // =========================================================================
  describe('4. computeEffectiveFrom & upsertPendingChange (D3 rules)', () => {
    it('"disable" applies today', () => {
      expect(computeEffectiveFrom('disable', '2026-10-05')).toBe('2026-10-05');
    });

    it('"enable" applies today', () => {
      expect(computeEffectiveFrom('enable', '2026-10-05')).toBe('2026-10-05');
    });

    it('"cadence_switch" when current owner is active applies tomorrow', () => {
      expect(
        computeEffectiveFrom('cadence_switch', '2026-10-05', { currentOwner: 'daily' })
      ).toBe('2026-10-06');
      expect(
        computeEffectiveFrom('cadence_switch', '2026-10-05', { currentOwner: 'weekly' })
      ).toBe('2026-10-06');
      expect(
        computeEffectiveFrom('cadence_switch', '2026-10-05', { currentOwner: 'monthly' })
      ).toBe('2026-10-06');
    });

    it('"cadence_switch" when current owner is "paused" applies today (first enable / re-enable)', () => {
      expect(
        computeEffectiveFrom('cadence_switch', '2026-10-05', { currentOwner: 'paused' })
      ).toBe('2026-10-05');
    });

    it('"weekly_amount" applies next Monday when changing on Wednesday', () => {
      // 2026-10-07 is Wednesday -> next Monday is 2026-10-12
      expect(computeEffectiveFrom('weekly_amount', '2026-10-07')).toBe('2026-10-12');
    });

    it('"weekly_amount" applies next Monday even when changing on Monday itself', () => {
      // 2026-10-05 is Monday -> next Monday is 2026-10-12
      expect(computeEffectiveFrom('weekly_amount', '2026-10-05')).toBe('2026-10-12');
    });

    it('"monthly_amount" applies next 1st of month when changing mid-month', () => {
      // 2026-10-15 -> 2026-11-01
      expect(computeEffectiveFrom('monthly_amount', '2026-10-15')).toBe('2026-11-01');
    });

    it('"monthly_amount" applies next 1st of month even when changing on the 1st', () => {
      // 2026-10-01 -> 2026-11-01
      expect(computeEffectiveFrom('monthly_amount', '2026-10-01')).toBe('2026-11-01');
    });

    it('upsertPendingChange replaces pending change with same effectiveFrom', () => {
      const initial: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-10-01',
          isEnabled: true,
          cadence: 'daily',
          amount: 500,
        },
        {
          id: '2',
          userId: 'u1',
          effectiveFrom: '2026-10-06',
          isEnabled: true,
          cadence: 'weekly',
          amount: 3500,
        },
      ];

      // User changes mind before midnight on 2026-10-05, switches to monthly for 2026-10-06
      const replacement: BudgetPlanChange = {
        id: '3',
        userId: 'u1',
        effectiveFrom: '2026-10-06',
        isEnabled: true,
        cadence: 'monthly',
        amount: 15000,
      };

      const updated = upsertPendingChange(initial, replacement);
      expect(updated.length).toBe(2);
      expect(updated[1].id).toBe('3');
      expect(updated[1].cadence).toBe('monthly');
    });

    it('upsertPendingChange drops obsolete future changes beyond the new change', () => {
      const initial: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-10-01',
          isEnabled: true,
          cadence: 'daily',
          amount: 500,
        },
        {
          id: '2',
          userId: 'u1',
          effectiveFrom: '2026-10-12',
          isEnabled: true,
          cadence: 'weekly',
          amount: 4000,
        },
      ];

      // User on 2026-10-05 disables budget mode today
      const disableToday: BudgetPlanChange = {
        id: '3',
        userId: 'u1',
        effectiveFrom: '2026-10-05',
        isEnabled: false,
        cadence: 'daily',
        amount: 0,
      };

      const updated = upsertPendingChange(initial, disableToday);
      expect(updated.length).toBe(2);
      expect(updated.map((c) => c.effectiveFrom)).toEqual(['2026-10-01', '2026-10-05']);
      expect(updated[1].isEnabled).toBe(false);
    });
  });

  // =========================================================================
  // 5. All 6 Cadence Transitions (NO date counted twice / Single-Owner Invariant)
  // =========================================================================
  describe('5. All 6 Cadence Transitions - Strict Invariants', () => {
    // Helper to verify interval ownership exhaustiveness and exclusivity
    const verifyOwnershipExclusivity = (
      changes: BudgetPlanChange[],
      startDateStr: string,
      endDateStr: string
    ) => {
      const days = eachDayOfInterval({
        start: parseISO(startDateStr),
        end: parseISO(endDateStr),
      });
      const totalCalendarDays = differenceInCalendarDays(parseISO(endDateStr), parseISO(startDateStr)) + 1;

      let dailyCount = 0;
      let weeklyCount = 0;
      let monthlyCount = 0;
      let pausedCount = 0;

      for (const d of days) {
        const dStr = format(d, 'yyyy-MM-dd');
        const owner = getDateOwner(changes, dStr);
        if (owner === 'daily') dailyCount++;
        else if (owner === 'weekly') weeklyCount++;
        else if (owner === 'monthly') monthlyCount++;
        else if (owner === 'paused') pausedCount++;
      }

      // CRITICAL ASSERTION: Exactly one owner per day, sum equals total days
      expect(dailyCount + weeklyCount + monthlyCount + pausedCount).toBe(totalCalendarDays);
      return { dailyCount, weeklyCount, monthlyCount, pausedCount, totalCalendarDays };
    };

    it('Transition 1: Monthly -> Weekly (M -> W)', () => {
      // Monthly 15000 started 2026-10-01.
      // On 2026-10-14 (Wednesday), user switches to Weekly 3500 (effective tomorrow, 2026-10-15).
      const changes: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-10-01',
          isEnabled: true,
          cadence: 'monthly',
          amount: 15500, // 15500 / 31 = 500/day
        },
        {
          id: '2',
          userId: 'u1',
          effectiveFrom: '2026-10-15',
          isEnabled: true,
          cadence: 'weekly',
          amount: 3500, // 3500 / 7 = 500/day
        },
      ];

      const counts = verifyOwnershipExclusivity(changes, '2026-10-01', '2026-10-31');
      expect(counts.monthlyCount).toBe(14); // 2026-10-01 to 2026-10-14 (14 days)
      expect(counts.weeklyCount).toBe(17);  // 2026-10-15 to 2026-10-31 (17 days)
      expect(counts.dailyCount).toBe(0);
      expect(counts.pausedCount).toBe(0);

      // On 2026-10-16, monthly slice 2026-10-01..2026-10-14 ended early and is finalizable
      const spentByDate = {
        '2026-10-01': 300,
        '2026-10-02': 400,
      };
      const periods = buildPeriodsToFinalize(changes, spentByDate, '2026-10-16');
      expect(periods.length).toBe(1);
      const monthlySlice = periods[0];
      expect(monthlySlice.cadence).toBe('monthly');
      expect(monthlySlice.activeStart).toBe('2026-10-01');
      expect(monthlySlice.activeEnd).toBe('2026-10-14');
      expect(monthlySlice.isProrated).toBe(true);
      // Prorated budget: 15500 * 14 / 31 = 7000
      expect(monthlySlice.budgetAmount).toBe(7000);
      expect(monthlySlice.spentAmount).toBe(700);
      expect(monthlySlice.amountSaved).toBe(6300);
      expect(monthlySlice.status).toBe('saved');
    });

    it('Transition 2: Monthly -> Daily (M -> D)', () => {
      // Monthly 31000 started 2026-10-01.
      // On 2026-10-10, user switches to Daily 1000 (effective tomorrow, 2026-10-11).
      const changes: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-10-01',
          isEnabled: true,
          cadence: 'monthly',
          amount: 31000,
        },
        {
          id: '2',
          userId: 'u1',
          effectiveFrom: '2026-10-11',
          isEnabled: true,
          cadence: 'daily',
          amount: 1000,
        },
      ];

      const counts = verifyOwnershipExclusivity(changes, '2026-10-01', '2026-10-31');
      expect(counts.monthlyCount).toBe(10); // 2026-10-01 to 2026-10-10
      expect(counts.dailyCount).toBe(21);   // 2026-10-11 to 2026-10-31
      expect(counts.weeklyCount).toBe(0);

      // On 2026-10-12, the monthly slice ended early and is finalized
      const periods = buildPeriodsToFinalize(changes, { '2026-10-01': 5000 }, '2026-10-12');
      expect(periods.length).toBe(1);
      expect(periods[0].cadence).toBe('monthly');
      expect(periods[0].activeStart).toBe('2026-10-01');
      expect(periods[0].activeEnd).toBe('2026-10-10');
      // Prorated budget: 31000 * 10 / 31 = 10000
      expect(periods[0].budgetAmount).toBe(10000);
      expect(periods[0].spentAmount).toBe(5000);
      expect(periods[0].amountSaved).toBe(5000);
    });

    it('Transition 3: Weekly -> Monthly (W -> M)', () => {
      // Weekly 7000 starts Monday 2026-10-05.
      // On Wednesday 2026-10-07, user switches to Monthly 31000 (effective Thu 2026-10-08).
      const changes: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-10-05',
          isEnabled: true,
          cadence: 'weekly',
          amount: 7000,
        },
        {
          id: '2',
          userId: 'u1',
          effectiveFrom: '2026-10-08',
          isEnabled: true,
          cadence: 'monthly',
          amount: 31000,
        },
      ];

      const counts = verifyOwnershipExclusivity(changes, '2026-10-05', '2026-10-18');
      expect(counts.weeklyCount).toBe(3);   // Mon 10-05, Tue 10-06, Wed 10-07
      expect(counts.monthlyCount).toBe(11); // Thu 10-08 to Sun 10-18
      expect(counts.dailyCount).toBe(0);

      // Finalize weekly slice on 2026-10-09
      const periods = buildPeriodsToFinalize(changes, { '2026-10-05': 1000 }, '2026-10-09');
      expect(periods.length).toBe(1);
      expect(periods[0].cadence).toBe('weekly');
      expect(periods[0].activeStart).toBe('2026-10-05');
      expect(periods[0].activeEnd).toBe('2026-10-07');
      // Prorated: 7000 * 3 / 7 = 3000
      expect(periods[0].budgetAmount).toBe(3000);
      expect(periods[0].spentAmount).toBe(1000);
      expect(periods[0].amountSaved).toBe(2000);
    });

    it('Transition 4: Weekly -> Daily (W -> D)', () => {
      // Weekly 7000 starts Monday 2026-10-05.
      // On Friday 2026-10-09, user switches to Daily 500 (effective Sat 2026-10-10).
      const changes: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-10-05',
          isEnabled: true,
          cadence: 'weekly',
          amount: 7000,
        },
        {
          id: '2',
          userId: 'u1',
          effectiveFrom: '2026-10-10',
          isEnabled: true,
          cadence: 'daily',
          amount: 500,
        },
      ];

      const counts = verifyOwnershipExclusivity(changes, '2026-10-05', '2026-10-11');
      expect(counts.weeklyCount).toBe(5); // Mon-Fri (5 days)
      expect(counts.dailyCount).toBe(2);  // Sat-Sun (2 days)

      const periods = buildPeriodsToFinalize(changes, {}, '2026-10-11');
      expect(periods.length).toBe(1);
      expect(periods[0].cadence).toBe('weekly');
      expect(periods[0].activeStart).toBe('2026-10-05');
      expect(periods[0].activeEnd).toBe('2026-10-09');
      // Prorated: 7000 * 5 / 7 = 5000
      expect(periods[0].budgetAmount).toBe(5000);
      expect(periods[0].isProrated).toBe(true);
    });

    it('Transition 5: Daily -> Weekly (D -> W)', () => {
      // Daily 500 starts 2026-10-01.
      // On Wednesday 2026-10-07, user switches to Weekly 3500 (effective Thu 2026-10-08).
      const changes: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-10-01',
          isEnabled: true,
          cadence: 'daily',
          amount: 500,
        },
        {
          id: '2',
          userId: 'u1',
          effectiveFrom: '2026-10-08',
          isEnabled: true,
          cadence: 'weekly',
          amount: 3500,
        },
      ];

      const counts = verifyOwnershipExclusivity(changes, '2026-10-01', '2026-10-11');
      expect(counts.dailyCount).toBe(7);  // 10-01 to 10-07 (7 days)
      expect(counts.weeklyCount).toBe(4); // Thu 10-08 to Sun 10-11 (4 days)

      // On Monday 2026-10-12, the week of 10-05..10-11 has completed
      const periods = buildPeriodsToFinalize(changes, { '2026-10-08': 1000 }, '2026-10-12');
      expect(periods.length).toBe(1);
      expect(periods[0].cadence).toBe('weekly');
      expect(periods[0].activeStart).toBe('2026-10-08');
      expect(periods[0].activeEnd).toBe('2026-10-11');
      // Prorated: 3500 * 4 / 7 = 2000
      expect(periods[0].budgetAmount).toBe(2000);
      expect(periods[0].spentAmount).toBe(1000);
      expect(periods[0].amountSaved).toBe(1000);
      expect(periods[0].isProrated).toBe(true);
    });

    it('Transition 6: Daily -> Monthly (D -> M)', () => {
      // Daily 500 starts 2026-10-01.
      // On 2026-10-10, user switches to Monthly 31000 (effective 2026-10-11).
      const changes: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-10-01',
          isEnabled: true,
          cadence: 'daily',
          amount: 500,
        },
        {
          id: '2',
          userId: 'u1',
          effectiveFrom: '2026-10-11',
          isEnabled: true,
          cadence: 'monthly',
          amount: 31000,
        },
      ];

      const counts = verifyOwnershipExclusivity(changes, '2026-10-01', '2026-10-31');
      expect(counts.dailyCount).toBe(10);  // 10-01 to 10-10
      expect(counts.monthlyCount).toBe(21); // 10-11 to 10-31

      // On 2026-11-01, October month completes
      const periods = buildPeriodsToFinalize(changes, {}, '2026-11-01');
      expect(periods.length).toBe(1);
      expect(periods[0].cadence).toBe('monthly');
      expect(periods[0].activeStart).toBe('2026-10-11');
      expect(periods[0].activeEnd).toBe('2026-10-31');
      // Prorated: 31000 * 21 / 31 = 21000
      expect(periods[0].budgetAmount).toBe(21000);
      expect(periods[0].isProrated).toBe(true);
    });
  });

  // =========================================================================
  // 6. Disable today & Re-enable (Pause Bridging)
  // =========================================================================
  describe('6. Disable today & Re-enable after 10 days', () => {
    it('disabling today makes today paused; re-enabling after 10 days leaves gap paused', () => {
      const changes: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-10-01',
          isEnabled: true,
          cadence: 'daily',
          amount: 500,
        },
        {
          id: '2',
          userId: 'u1',
          effectiveFrom: '2026-10-05',
          isEnabled: false,
          cadence: 'daily',
          amount: 0,
        },
        {
          id: '3',
          userId: 'u1',
          effectiveFrom: '2026-10-15',
          isEnabled: true,
          cadence: 'daily',
          amount: 500,
        },
      ];

      // 10-01 .. 10-04: daily
      expect(getDateOwner(changes, '2026-10-04')).toBe('daily');
      // 10-05 .. 10-14: paused
      expect(getDateOwner(changes, '2026-10-05')).toBe('paused');
      expect(getDateOwner(changes, '2026-10-10')).toBe('paused');
      expect(getDateOwner(changes, '2026-10-14')).toBe('paused');
      // 10-15 onwards: daily
      expect(getDateOwner(changes, '2026-10-15')).toBe('daily');
    });
  });

  // =========================================================================
  // 7. Mid-week weekly amount change
  // =========================================================================
  describe('7. Mid-week weekly amount change', () => {
    it('weekly amount change mid-week takes effect on next Monday only', () => {
      // User has weekly 3500 from Mon 2026-10-05.
      // On Wednesday 2026-10-07, user changes weekly budget to 7000.
      const effectiveDate = computeEffectiveFrom('weekly_amount', '2026-10-07');
      expect(effectiveDate).toBe('2026-10-12'); // Next Monday

      const changes: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-10-05',
          isEnabled: true,
          cadence: 'weekly',
          amount: 3500,
        },
        {
          id: '2',
          userId: 'u1',
          effectiveFrom: effectiveDate,
          isEnabled: true,
          cadence: 'weekly',
          amount: 7000,
        },
      ];

      // On Thursday 2026-10-08, plan amount is still 3500
      expect(resolvePlanForDate(changes, '2026-10-08')?.amount).toBe(3500);
      // On Sunday 2026-10-11, plan amount is still 3500
      expect(resolvePlanForDate(changes, '2026-10-11')?.amount).toBe(3500);
      // On Monday 2026-10-12, plan amount is 7000
      expect(resolvePlanForDate(changes, '2026-10-12')?.amount).toBe(7000);
    });
  });

  // =========================================================================
  // 8. User created mid-week
  // =========================================================================
  describe('8. User created mid-week (proration from registration)', () => {
    it('prorates the first weekly period from user registration date', () => {
      // User registered on Wednesday 2026-10-07 with weekly budget 7000.
      const changes: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-10-07',
          isEnabled: true,
          cadence: 'weekly',
          amount: 7000,
        },
      ];

      // Checked on Monday 2026-10-12 after the week ended
      const periods = buildPeriodsToFinalize(
        changes,
        { '2026-10-07': 1000 },
        '2026-10-12',
        new Set<string>(),
        '2026-10-07' // userCreatedAtStr
      );

      expect(periods.length).toBe(1);
      expect(periods[0].periodStart).toBe('2026-10-05');
      expect(periods[0].periodEnd).toBe('2026-10-11');
      expect(periods[0].activeStart).toBe('2026-10-07');
      expect(periods[0].activeEnd).toBe('2026-10-11');
      expect(periods[0].isProrated).toBe(true);
      // 5 active days (Wed, Thu, Fri, Sat, Sun): 7000 * 5 / 7 = 5000
      expect(periods[0].budgetAmount).toBe(5000);
      expect(periods[0].spentAmount).toBe(1000);
      expect(periods[0].amountSaved).toBe(4000);
      expect(periods[0].status).toBe('saved');
    });
  });

  // =========================================================================
  // 9. buildPeriodsToFinalize (Status evaluation & idempotency)
  // =========================================================================
  describe('9. buildPeriodsToFinalize - Status and Idempotency', () => {
    it('evaluates status correctly: saved, even, missed, zero-spend, zero-budget', () => {
      // Monthly periods for testing statuses
      const changesSaved: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-09-01',
          isEnabled: true,
          cadence: 'monthly',
          amount: 10000,
        },
      ];

      // 1. Saved: spent 6000 < budget 10000
      const recSaved = buildPeriodsToFinalize(
        changesSaved,
        { '2026-09-10': 6000 },
        '2026-10-01'
      );
      expect(recSaved[0].status).toBe('saved');
      expect(recSaved[0].amountSaved).toBe(4000);

      // 2. Even: spent 10000 === budget 10000
      const recEven = buildPeriodsToFinalize(
        changesSaved,
        { '2026-09-10': 10000 },
        '2026-10-01'
      );
      expect(recEven[0].status).toBe('even');
      expect(recEven[0].amountSaved).toBe(0);

      // 3. Missed: spent 12000 > budget 10000
      const recMissed = buildPeriodsToFinalize(
        changesSaved,
        { '2026-09-10': 12000 },
        '2026-10-01'
      );
      expect(recMissed[0].status).toBe('missed');
      expect(recMissed[0].amountSaved).toBe(0);

      // 4. Zero-spend: spent 0
      const recZeroSpend = buildPeriodsToFinalize(changesSaved, {}, '2026-10-01');
      expect(recZeroSpend[0].status).toBe('saved');
      expect(recZeroSpend[0].amountSaved).toBe(10000);

      // 5. Zero-budget: budgetAmount 0 -> status unknown, amountSaved 0
      const changesZeroBudget: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-09-01',
          isEnabled: true,
          cadence: 'monthly',
          amount: 0,
        },
      ];
      const recZeroBudget = buildPeriodsToFinalize(changesZeroBudget, {}, '2026-10-01');
      expect(recZeroBudget[0].status).toBe('unknown');
      expect(recZeroBudget[0].amountSaved).toBe(0);
    });

    it('is completely idempotent when alreadyFinalizedKeys is passed', () => {
      const changes: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-09-01',
          isEnabled: true,
          cadence: 'monthly',
          amount: 10000,
        },
      ];

      const firstRun = buildPeriodsToFinalize(changes, {}, '2026-10-01');
      expect(firstRun.length).toBe(1);

      // Second run passing the key from the first run
      const alreadyDone = new Set([firstRun[0].id]);
      const secondRun = buildPeriodsToFinalize(changes, {}, '2026-10-01', alreadyDone);
      expect(secondRun.length).toBe(0);
    });

    it('does not finalize an active period before it ends', () => {
      // Month of October 2026: on 2026-10-15, October is still ongoing
      const changes: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-10-01',
          isEnabled: true,
          cadence: 'monthly',
          amount: 10000,
        },
      ];

      const records = buildPeriodsToFinalize(changes, {}, '2026-10-15');
      expect(records.length).toBe(0);
    });
  });

  // =========================================================================
  // 10. getCurrentPeriodSummary (D8 Live Hero Card)
  // =========================================================================
  describe('10. getCurrentPeriodSummary (D8)', () => {
    it('returns null if today is paused', () => {
      expect(getCurrentPeriodSummary([], {}, '2026-10-15')).toBeNull();
    });

    it('returns null if today is governed by daily', () => {
      const changes: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-10-01',
          isEnabled: true,
          cadence: 'daily',
          amount: 500,
        },
      ];
      expect(getCurrentPeriodSummary(changes, {}, '2026-10-15')).toBeNull();
    });

    it('returns live weekly period summary', () => {
      // Week of Mon 2026-10-05 .. Sun 2026-10-11, weekly budget 7000
      const changes: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-10-05',
          isEnabled: true,
          cadence: 'weekly',
          amount: 7000,
        },
      ];

      const spent = {
        '2026-10-05': 500,
        '2026-10-06': 1500,
      };

      const summary = getCurrentPeriodSummary(changes, spent, '2026-10-07');
      expect(summary).not.toBeNull();
      expect(summary?.cadence).toBe('weekly');
      expect(summary?.periodStart).toBe('2026-10-05');
      expect(summary?.periodEnd).toBe('2026-10-11');
      expect(summary?.activeStart).toBe('2026-10-05');
      expect(summary?.activeEnd).toBe('2026-10-11');
      expect(summary?.budget).toBe(7000);
      expect(summary?.spent).toBe(2000);
      expect(summary?.remaining).toBe(5000);
      expect(summary?.isOver).toBe(false);
      expect(summary?.overBy).toBe(0);
      expect(summary?.rolloverLabelDate).toBe('2026-10-11');
    });

    it('handles over-budget state in live summary', () => {
      const changes: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-10-05',
          isEnabled: true,
          cadence: 'weekly',
          amount: 2000,
        },
      ];

      const spent = {
        '2026-10-05': 1500,
        '2026-10-06': 1000, // Total 2500 > 2000
      };

      const summary = getCurrentPeriodSummary(changes, spent, '2026-10-06');
      expect(summary).not.toBeNull();
      expect(summary?.spent).toBe(2500);
      expect(summary?.remaining).toBe(0);
      expect(summary?.isOver).toBe(true);
      expect(summary?.overBy).toBe(500);
    });

    it('correctly bounds active slice if a future plan change terminates it early', () => {
      // User is weekly 7000 Mon 2026-10-05 .. Sun 2026-10-11.
      // But has a plan change to monthly on Friday 2026-10-09.
      const changes: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-10-05',
          isEnabled: true,
          cadence: 'weekly',
          amount: 7000,
        },
        {
          id: '2',
          userId: 'u1',
          effectiveFrom: '2026-10-09',
          isEnabled: true,
          cadence: 'monthly',
          amount: 30000,
        },
      ];

      // On Wednesday 2026-10-07
      const summary = getCurrentPeriodSummary(changes, {}, '2026-10-07');
      expect(summary).not.toBeNull();
      expect(summary?.activeStart).toBe('2026-10-05');
      expect(summary?.activeEnd).toBe('2026-10-08'); // Truncated to Thursday
      // Prorated: 4 days (Mon..Thu) out of 7: 7000 * 4 / 7 = 4000
      expect(summary?.budget).toBe(4000);
      expect(summary?.rolloverLabelDate).toBe('2026-10-08');
    });
  });

  // =========================================================================
  // 11. isDailyGovernedDate
  // =========================================================================
  describe('11. isDailyGovernedDate', () => {
    it('returns true only when date owner is daily', () => {
      const changes: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-10-01',
          isEnabled: true,
          cadence: 'daily',
          amount: 500,
        },
        {
          id: '2',
          userId: 'u1',
          effectiveFrom: '2026-10-10',
          isEnabled: true,
          cadence: 'weekly',
          amount: 3500,
        },
      ];

      expect(isDailyGovernedDate(changes, '2026-10-05')).toBe(true);
      expect(isDailyGovernedDate(changes, '2026-10-10')).toBe(false);
      expect(isDailyGovernedDate([], '2026-10-05')).toBe(false); // paused
    });
  });

  // =========================================================================
  // 12. computeCadenceStreak (D6)
  // =========================================================================
  describe('12. computeCadenceStreak (D6)', () => {
    it('returns 0 for empty units', () => {
      const res = computeCadenceStreak([], 'daily');
      expect(res.currentStreak).toBe(0);
      expect(res.bestByCadence).toEqual({ daily: 0, weekly: 0, monthly: 0 });
    });

    it('counts consecutive saved units for the current cadence', () => {
      const units: StreakUnit[] = [
        { cadence: 'daily', status: 'saved', key: 'd1', amountSaved: 100 },
        { cadence: 'daily', status: 'saved', key: 'd2', amountSaved: 200 },
        { cadence: 'daily', status: 'saved', key: 'd3', amountSaved: 150 },
      ];

      const res = computeCadenceStreak(units, 'daily');
      expect(res.currentStreak).toBe(3);
      expect(res.bestByCadence.daily).toBe(3);
    });

    it('missed unit breaks current streak', () => {
      const units: StreakUnit[] = [
        { cadence: 'daily', status: 'saved', key: 'd1', amountSaved: 100 },
        { cadence: 'daily', status: 'saved', key: 'd2', amountSaved: 200 },
        { cadence: 'daily', status: 'missed', key: 'd3', amountSaved: 0 },
      ];

      const res = computeCadenceStreak(units, 'daily');
      expect(res.currentStreak).toBe(0);
      expect(res.bestByCadence.daily).toBe(2);
    });

    it('even unit breaks current streak', () => {
      const units: StreakUnit[] = [
        { cadence: 'daily', status: 'saved', key: 'd1', amountSaved: 100 },
        { cadence: 'daily', status: 'even', key: 'd2', amountSaved: 0 },
      ];

      const res = computeCadenceStreak(units, 'daily');
      expect(res.currentStreak).toBe(0);
      expect(res.bestByCadence.daily).toBe(1);
    });

    it('unknown unit neither extends nor breaks streak', () => {
      const units: StreakUnit[] = [
        { cadence: 'daily', status: 'saved', key: 'd1', amountSaved: 100 },
        { cadence: 'daily', status: 'unknown', key: 'd2', amountSaved: 0 },
        { cadence: 'daily', status: 'saved', key: 'd3', amountSaved: 150 },
      ];

      const res = computeCadenceStreak(units, 'daily');
      expect(res.currentStreak).toBe(2);
      expect(res.bestByCadence.daily).toBe(2);
    });

    it('cadence switch resets current streak to 0 until new cadence units are finalized', () => {
      // User had 5 daily saved days, then switched to weekly.
      // No weekly period has finalized yet.
      const units: StreakUnit[] = [
        { cadence: 'daily', status: 'saved', key: 'd1', amountSaved: 100 },
        { cadence: 'daily', status: 'saved', key: 'd2', amountSaved: 100 },
        { cadence: 'daily', status: 'saved', key: 'd3', amountSaved: 100 },
        { cadence: 'daily', status: 'saved', key: 'd4', amountSaved: 100 },
        { cadence: 'daily', status: 'saved', key: 'd5', amountSaved: 100 },
      ];

      const res = computeCadenceStreak(units, 'weekly');
      expect(res.currentStreak).toBe(0); // Reset on switch!
      expect(res.bestByCadence.daily).toBe(5);
      expect(res.bestByCadence.weekly).toBe(0);
    });

    it('switching cadence and then saving new units tracks current streak in new cadence', () => {
      const units: StreakUnit[] = [
        { cadence: 'daily', status: 'saved', key: 'd1', amountSaved: 100 },
        { cadence: 'daily', status: 'saved', key: 'd2', amountSaved: 100 },
        // Switched to weekly, completed 2 weeks saved
        { cadence: 'weekly', status: 'saved', key: 'w1', amountSaved: 500 },
        { cadence: 'weekly', status: 'saved', key: 'w2', amountSaved: 600 },
      ];

      const res = computeCadenceStreak(units, 'weekly');
      expect(res.currentStreak).toBe(2);
      expect(res.bestByCadence.daily).toBe(2);
      expect(res.bestByCadence.weekly).toBe(2);
    });

    it('paused ranges are absent from units and bridge the streak across gaps', () => {
      // User saved week 1 and week 2, then paused for 3 weeks (no units recorded), then saved week 6
      const units: StreakUnit[] = [
        { cadence: 'weekly', status: 'saved', key: 'w1', amountSaved: 500 },
        { cadence: 'weekly', status: 'saved', key: 'w2', amountSaved: 600 },
        // paused weeks have no units
        { cadence: 'weekly', status: 'saved', key: 'w6', amountSaved: 700 },
      ];

      const res = computeCadenceStreak(units, 'weekly');
      // Streak continues across the paused gap!
      expect(res.currentStreak).toBe(3);
      expect(res.bestByCadence.weekly).toBe(3);
    });

    it('tracks bestByCadence separately across all 3 cadences', () => {
      const units: StreakUnit[] = [
        // Daily run of 4
        { cadence: 'daily', status: 'saved', key: 'd1', amountSaved: 50 },
        { cadence: 'daily', status: 'saved', key: 'd2', amountSaved: 50 },
        { cadence: 'daily', status: 'saved', key: 'd3', amountSaved: 50 },
        { cadence: 'daily', status: 'saved', key: 'd4', amountSaved: 50 },
        { cadence: 'daily', status: 'missed', key: 'd5', amountSaved: 0 },
        // Weekly run of 3
        { cadence: 'weekly', status: 'saved', key: 'w1', amountSaved: 200 },
        { cadence: 'weekly', status: 'saved', key: 'w2', amountSaved: 200 },
        { cadence: 'weekly', status: 'saved', key: 'w3', amountSaved: 200 },
        // Monthly run of 2
        { cadence: 'monthly', status: 'saved', key: 'm1', amountSaved: 1000 },
        { cadence: 'monthly', status: 'saved', key: 'm2', amountSaved: 1000 },
      ];

      const res = computeCadenceStreak(units, 'monthly');
      expect(res.currentStreak).toBe(2);
      expect(res.bestByCadence.daily).toBe(4);
      expect(res.bestByCadence.weekly).toBe(3);
      expect(res.bestByCadence.monthly).toBe(2);
    });
  });
});
