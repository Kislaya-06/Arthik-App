import { describe, it, expect } from 'vitest';
import {
  calculateSavingsMetrics,
  DailyRecord,
  evaluateDayStatus,
  computeSpentByDate,
  computeSpentForDate,
  buildDefaultTodayRecord,
  filterPastRecords,
} from '../src/lib/budgetCalculations';

describe('calculateSavingsMetrics - Unit Tests', () => {
  // We pass a fixed reference date to avoid any dependency on wall-clock time
  const FIXED_REF_DATE = new Date(2026, 8, 18, 12, 0, 0); // 2026-09-18 12:00:00 local time
  const TODAY_STR = '2026-09-18';
  const USER_CREATED = '2026-09-01';

  describe('Gullak (totalAccumulatedSavings)', () => {
    it('only finalized past days count; today and unfinalized days do not', () => {
      const records: Record<string, DailyRecord> = {
        '2026-09-16': {
          date: '2026-09-16',
          budget: 500,
          spent: 300,
          saved: 200,
          isFinalized: true,
          status: 'saved',
        },
        '2026-09-17': {
          date: '2026-09-17',
          budget: 500,
          spent: 200,
          saved: 300,
          isFinalized: false, // unfinalized past day
          status: 'saved',
        },
        '2026-09-18': {
          date: '2026-09-18',
          budget: 500,
          spent: 100,
          saved: 400,
          isFinalized: false, // today
          status: 'active',
        },
      };

      const metrics = calculateSavingsMetrics(records, TODAY_STR, USER_CREATED, FIXED_REF_DATE);
      expect(metrics.totalAccumulatedSavings).toBe(200);
    });

    it('days before userCreatedAt are excluded', () => {
      const records: Record<string, DailyRecord> = {
        '2026-08-30': {
          date: '2026-08-30',
          budget: 500,
          spent: 100,
          saved: 400,
          isFinalized: true,
          status: 'saved',
        },
        '2026-09-02': {
          date: '2026-09-02',
          budget: 500,
          spent: 200,
          saved: 300,
          isFinalized: true,
          status: 'saved',
        },
      };

      const metrics = calculateSavingsMetrics(records, TODAY_STR, USER_CREATED, FIXED_REF_DATE);
      expect(metrics.totalAccumulatedSavings).toBe(300);
    });

    it("'unknown' days contribute nothing", () => {
      const records: Record<string, DailyRecord> = {
        '2026-09-15': {
          date: '2026-09-15',
          budget: 0,
          spent: 0,
          saved: 0,
          isFinalized: true,
          status: 'unknown',
        },
        '2026-09-16': {
          date: '2026-09-16',
          budget: 500,
          spent: 100,
          saved: 400,
          isFinalized: true,
          status: 'unknown', // even if saved amount is nonzero, unknown status contributes nothing
        },
      };

      const metrics = calculateSavingsMetrics(records, TODAY_STR, USER_CREATED, FIXED_REF_DATE);
      expect(metrics.totalAccumulatedSavings).toBe(0);
    });

    it('past overspend subtracts', () => {
      const records: Record<string, DailyRecord> = {
        '2026-09-15': {
          date: '2026-09-15',
          budget: 500,
          spent: 200,
          saved: 300,
          isFinalized: true,
          status: 'saved',
        },
        '2026-09-16': {
          date: '2026-09-16',
          budget: 500,
          spent: 650,
          saved: 0,
          isFinalized: true,
          status: 'exceeded',
        },
      };

      const metrics = calculateSavingsMetrics(records, TODAY_STR, USER_CREATED, FIXED_REF_DATE);
      // 300 saved - 150 overspent = 150
      expect(metrics.totalAccumulatedSavings).toBe(150);
    });

    it("today's live overspend subtracts even though today's saving does not add", () => {
      const recordsWithLiveOverspend: Record<string, DailyRecord> = {
        '2026-09-17': {
          date: '2026-09-17',
          budget: 500,
          spent: 200,
          saved: 300,
          isFinalized: true,
          status: 'saved',
        },
        '2026-09-18': {
          date: '2026-09-18',
          budget: 500,
          spent: 700,
          saved: 0,
          isFinalized: false,
          status: 'exceeded',
        },
      };

      const metricsOverspend = calculateSavingsMetrics(recordsWithLiveOverspend, TODAY_STR, USER_CREATED, FIXED_REF_DATE);
      // 300 saved yesterday - 200 today live overspent = 100
      expect(metricsOverspend.totalAccumulatedSavings).toBe(100);

      const recordsWithLiveSaving: Record<string, DailyRecord> = {
        '2026-09-17': {
          date: '2026-09-17',
          budget: 500,
          spent: 200,
          saved: 300,
          isFinalized: true,
          status: 'saved',
        },
        '2026-09-18': {
          date: '2026-09-18',
          budget: 500,
          spent: 100,
          saved: 400,
          isFinalized: false,
          status: 'active',
        },
      };

      const metricsSaving = calculateSavingsMetrics(recordsWithLiveSaving, TODAY_STR, USER_CREATED, FIXED_REF_DATE);
      // today's saving does not add until finalized; remains 300
      expect(metricsSaving.totalAccumulatedSavings).toBe(300);
    });

    it('the floor at zero holds when overspend exceeds savings', () => {
      const records: Record<string, DailyRecord> = {
        '2026-09-16': {
          date: '2026-09-16',
          budget: 500,
          spent: 400,
          saved: 100,
          isFinalized: true,
          status: 'saved',
        },
        '2026-09-17': {
          date: '2026-09-17',
          budget: 500,
          spent: 900,
          saved: 0,
          isFinalized: true,
          status: 'exceeded',
        },
      };

      const metrics = calculateSavingsMetrics(records, TODAY_STR, USER_CREATED, FIXED_REF_DATE);
      // 100 saved - 400 overspent = -300 -> clamped to 0
      expect(metrics.totalAccumulatedSavings).toBe(0);
    });
  });

  describe('Current streak', () => {
    it('three consecutive saved days ending yesterday', () => {
      const records: Record<string, DailyRecord> = {
        '2026-09-15': { date: '2026-09-15', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
        '2026-09-16': { date: '2026-09-16', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
        '2026-09-17': { date: '2026-09-17', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
      };

      const metrics = calculateSavingsMetrics(records, TODAY_STR, USER_CREATED, FIXED_REF_DATE);
      expect(metrics.savingsStreak).toBe(3);
    });

    it("an 'exceeded' day breaks it", () => {
      const records: Record<string, DailyRecord> = {
        '2026-09-15': { date: '2026-09-15', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
        '2026-09-16': { date: '2026-09-16', budget: 500, spent: 600, saved: 0, isFinalized: true, status: 'exceeded' },
        '2026-09-17': { date: '2026-09-17', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
      };

      const metrics = calculateSavingsMetrics(records, TODAY_STR, USER_CREATED, FIXED_REF_DATE);
      expect(metrics.savingsStreak).toBe(1);
    });

    it("an 'even' day breaks it (pinning ticket 3 behaviour)", () => {
      const records: Record<string, DailyRecord> = {
        '2026-09-15': { date: '2026-09-15', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
        '2026-09-16': { date: '2026-09-16', budget: 0, spent: 0, saved: 0, isFinalized: true, status: 'even' },
        '2026-09-17': { date: '2026-09-17', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
      };

      const metrics = calculateSavingsMetrics(records, TODAY_STR, USER_CREATED, FIXED_REF_DATE);
      expect(metrics.savingsStreak).toBe(1);
    });

    it("an 'unknown' day is neutral and the streak continues across it", () => {
      const records: Record<string, DailyRecord> = {
        '2026-09-15': { date: '2026-09-15', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
        '2026-09-16': { date: '2026-09-16', budget: 0, spent: 0, saved: 0, isFinalized: true, status: 'unknown' },
        '2026-09-17': { date: '2026-09-17', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
      };

      const metrics = calculateSavingsMetrics(records, TODAY_STR, USER_CREATED, FIXED_REF_DATE);
      expect(metrics.savingsStreak).toBe(2);
    });

    it('a missing day breaks it', () => {
      const records: Record<string, DailyRecord> = {
        '2026-09-15': { date: '2026-09-15', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
        // 2026-09-16 is missing
        '2026-09-17': { date: '2026-09-17', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
      };

      const metrics = calculateSavingsMetrics(records, TODAY_STR, USER_CREATED, FIXED_REF_DATE);
      expect(metrics.savingsStreak).toBe(1);
    });

    it('an unfinalized past day breaks it', () => {
      const records: Record<string, DailyRecord> = {
        '2026-09-15': { date: '2026-09-15', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
        '2026-09-16': { date: '2026-09-16', budget: 500, spent: 200, saved: 300, isFinalized: false, status: 'saved' },
        '2026-09-17': { date: '2026-09-17', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
      };

      const metrics = calculateSavingsMetrics(records, TODAY_STR, USER_CREATED, FIXED_REF_DATE);
      expect(metrics.savingsStreak).toBe(1);
    });

    it('the streak stops at userCreatedAt', () => {
      const records: Record<string, DailyRecord> = {
        '2026-09-15': { date: '2026-09-15', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
        '2026-09-16': { date: '2026-09-16', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
        '2026-09-17': { date: '2026-09-17', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
      };

      // Registration on 2026-09-16 means 2026-09-15 is pre-registration
      const metrics = calculateSavingsMetrics(records, TODAY_STR, '2026-09-16', FIXED_REF_DATE);
      expect(metrics.savingsStreak).toBe(2);
    });

    it('the confirmedSavedDays clamp at lines 144-149 actually clamps', () => {
      // When referenceDate looks at days >= todayStr, streak loop can count days not in confirmedSavedDays
      const refDate = new Date(2026, 8, 19, 12, 0, 0); // reference date is Sept 19, so subDays(refDate, 1) starts at Sept 18
      const todayStr = '2026-09-18'; // todayStr is Sept 18

      const records: Record<string, DailyRecord> = {
        '2026-09-17': { date: '2026-09-17', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
        '2026-09-18': { date: '2026-09-18', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
      };

      // confirmedSavedDays only counts r.date < todayStr ('2026-09-17'), so confirmedSavedDays === 1.
      // However, the backward loop starting from subDays(refDate, 1) ('2026-09-18') encounters both Sept 18 and Sept 17 (streak = 2).
      // The clamp at lines 148-150 clamps streak to confirmedSavedDays (1).
      const metrics = calculateSavingsMetrics(records, todayStr, USER_CREATED, refDate);
      expect(metrics.savingsStreak).toBe(1);
    });
  });

  describe('Best streak', () => {
    it('a longer past run beats the current streak', () => {
      const records: Record<string, DailyRecord> = {
        // Run 1: 4 days (Sept 10 to 13)
        '2026-09-10': { date: '2026-09-10', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
        '2026-09-11': { date: '2026-09-11', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
        '2026-09-12': { date: '2026-09-12', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
        '2026-09-13': { date: '2026-09-13', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
        // Interruption on Sept 14
        '2026-09-14': { date: '2026-09-14', budget: 500, spent: 700, saved: 0, isFinalized: true, status: 'exceeded' },
        // Run 2: 2 days (Sept 16 and 17)
        '2026-09-16': { date: '2026-09-16', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
        '2026-09-17': { date: '2026-09-17', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
      };

      const metrics = calculateSavingsMetrics(records, TODAY_STR, USER_CREATED, FIXED_REF_DATE);
      expect(metrics.savingsStreak).toBe(2);
      expect(metrics.bestStreak).toBe(4);
    });

    it("'unknown' days bridge a gap", () => {
      const records: Record<string, DailyRecord> = {
        '2026-09-10': { date: '2026-09-10', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
        '2026-09-11': { date: '2026-09-11', budget: 0, spent: 0, saved: 0, isFinalized: true, status: 'unknown' },
        '2026-09-12': { date: '2026-09-12', budget: 0, spent: 0, saved: 0, isFinalized: true, status: 'unknown' },
        '2026-09-13': { date: '2026-09-13', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
      };

      const metrics = calculateSavingsMetrics(records, TODAY_STR, USER_CREATED, FIXED_REF_DATE);
      expect(metrics.bestStreak).toBe(2);
    });

    it('a non-unknown gap does not bridge', () => {
      const records: Record<string, DailyRecord> = {
        '2026-09-10': { date: '2026-09-10', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
        '2026-09-11': { date: '2026-09-11', budget: 0, spent: 0, saved: 0, isFinalized: true, status: 'even' },
        '2026-09-12': { date: '2026-09-12', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
      };

      const metrics = calculateSavingsMetrics(records, TODAY_STR, USER_CREATED, FIXED_REF_DATE);
      // Because Sept 11 is 'even' (not 'unknown'), the gap does not bridge; both runs are of length 1
      expect(metrics.bestStreak).toBe(1);
    });
  });

  describe('Full 10-day mixed-status scenario', () => {
    it('accurately computes Gullak savings, current streak, and best streak in one go', () => {
      const scenarioToday = '2026-09-11';
      const scenarioRefDate = new Date(2026, 8, 11, 12, 0, 0);
      const scenarioUserCreated = '2026-09-01';

      const records: Record<string, DailyRecord> = {
        // Day 01: saved 300 (Gullak +300, run: 1)
        '2026-09-01': { date: '2026-09-01', budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' },
        // Day 02: saved 400 (Gullak +400, run: 2)
        '2026-09-02': { date: '2026-09-02', budget: 500, spent: 100, saved: 400, isFinalized: true, status: 'saved' },
        // Day 03: saved 200 (Gullak +200, run: 3)
        '2026-09-03': { date: '2026-09-03', budget: 500, spent: 300, saved: 200, isFinalized: true, status: 'saved' },
        // Day 04: exceeded by 300 (Gullak -300, breaks run 1)
        '2026-09-04': { date: '2026-09-04', budget: 500, spent: 800, saved: 0, isFinalized: true, status: 'exceeded' },
        // Day 05: unknown (Gullak 0, neutral)
        '2026-09-05': { date: '2026-09-05', budget: 0, spent: 0, saved: 0, isFinalized: true, status: 'unknown' },
        // Day 06: even (Gullak 0, streak breaker)
        '2026-09-06': { date: '2026-09-06', budget: 0, spent: 0, saved: 0, isFinalized: true, status: 'even' },
        // Day 07: exceeded by 200 (Gullak -200, streak breaker)
        '2026-09-07': { date: '2026-09-07', budget: 500, spent: 700, saved: 0, isFinalized: true, status: 'exceeded' },
        // Day 08: saved 250 (Gullak +250, current streak run)
        '2026-09-08': { date: '2026-09-08', budget: 500, spent: 250, saved: 250, isFinalized: true, status: 'saved' },
        // Day 09: unknown (Gullak 0, bridges current streak!)
        '2026-09-09': { date: '2026-09-09', budget: 0, spent: 0, saved: 0, isFinalized: true, status: 'unknown' },
        // Day 10: saved 400 (Gullak +400, yesterday!)
        '2026-09-10': { date: '2026-09-10', budget: 500, spent: 100, saved: 400, isFinalized: true, status: 'saved' },
        // Day 11 (Today): live overspent by 100 (Gullak live penalty -100, unfinalized)
        '2026-09-11': { date: '2026-09-11', budget: 500, spent: 600, saved: 0, isFinalized: false, status: 'exceeded' },
      };

      const metrics = calculateSavingsMetrics(
        records,
        scenarioToday,
        scenarioUserCreated,
        scenarioRefDate
      );

      // Gullak:
      // Saved: 300 (Day 1) + 400 (Day 2) + 200 (Day 3) + 250 (Day 8) + 400 (Day 10) = 1550
      // Overspent: 300 (Day 4) + 200 (Day 7) + 100 (Day 11 live) = 600
      // Net: 1550 - 600 = 950
      expect(metrics.totalAccumulatedSavings).toBe(950);

      // Current streak:
      // Backward from Day 10 (yesterday):
      // Day 10: saved -> streak 1
      // Day 09: unknown -> bridge
      // Day 08: saved -> streak 2
      // Day 07: exceeded -> breaks
      expect(metrics.savingsStreak).toBe(2);

      // Best streak:
      // Run 1 (Day 1 -> 2 -> 3) has length 3.
      // Gap to Day 8 has non-unknown days (exceeded, even), so bridge is broken.
      // Run 2 (Day 8 -> Day 10 with Day 9 unknown bridge) has length 2.
      // Max run = 3.
      expect(metrics.bestStreak).toBe(3);
    });
  });
});

describe('evaluateDayStatus', () => {
  it('budget 0 with spend returns status unknown and saved 0 (regardless of zeroBudgetZeroSpendStatus)', () => {
    const resUnknown = evaluateDayStatus(0, 150, 'unknown');
    expect(resUnknown).toEqual({ saved: 0, status: 'unknown' });

    const resEven = evaluateDayStatus(0, 150, 'even');
    expect(resEven).toEqual({ saved: 0, status: 'unknown' });
  });

  it("budget 0 without spend returns 'unknown' when zeroBudgetZeroSpendStatus is 'unknown' (checkAndRollover)", () => {
    const res = evaluateDayStatus(0, 0, 'unknown');
    expect(res).toEqual({ saved: 0, status: 'unknown' });
  });

  it("budget 0 without spend returns 'even' when zeroBudgetZeroSpendStatus is 'even' (hydrateFromSupabase - ticket 03)", () => {
    const res = evaluateDayStatus(0, 0, 'even');
    expect(res).toEqual({ saved: 0, status: 'even' });
  });

  it('spent < budget returns status saved and saved = budget - spent', () => {
    const res = evaluateDayStatus(500, 300, 'unknown');
    expect(res).toEqual({ saved: 200, status: 'saved' });
  });

  it('spent === budget returns status even and saved = 0', () => {
    const res = evaluateDayStatus(500, 500, 'unknown');
    expect(res).toEqual({ saved: 0, status: 'even' });
  });

  it('spent > budget returns status exceeded and saved = 0', () => {
    const res = evaluateDayStatus(500, 650, 'unknown');
    expect(res).toEqual({ saved: 0, status: 'exceeded' });
  });

  it('negative budget inputs are treated as budget <= 0', () => {
    const resWithSpend = evaluateDayStatus(-100, 50, 'unknown');
    expect(resWithSpend).toEqual({ saved: 0, status: 'unknown' });

    const resZeroSpend = evaluateDayStatus(-100, 0, 'even');
    expect(resZeroSpend).toEqual({ saved: 0, status: 'even' });
  });
});

describe('computeSpentByDate & computeSpentForDate', () => {
  const isIncome = (e: { type?: 'expense' | 'income'; category_id?: string | null }) =>
    e.type === 'income' || (e.type !== 'expense' && e.category_id === 'cat_income');

  it('income is excluded both ways: via type field and via category classifier', () => {
    const expenses = [
      { amount: 100, type: 'income' as const, expense_date: '2026-09-18' },
      { amount: 200, type: undefined, category_id: 'cat_income', expense_date: '2026-09-18' },
      { amount: 300, type: 'expense' as const, category_id: 'cat_food', expense_date: '2026-09-18' },
    ];

    const spentByDate = computeSpentByDate(expenses, isIncome);
    expect(spentByDate['2026-09-18']).toBe(300);

    const spentForDate = computeSpentForDate(expenses, '2026-09-18', isIncome);
    expect(spentForDate).toBe(300);
  });

  it('date mismatch is excluded from target date', () => {
    const expenses = [
      { amount: 250, type: 'expense' as const, expense_date: '2026-09-17' },
      { amount: 400, type: 'expense' as const, expense_date: '2026-09-18' },
    ];

    expect(computeSpentForDate(expenses, '2026-09-18', isIncome)).toBe(400);
    expect(computeSpentForDate(expenses, '2026-09-19', isIncome)).toBe(0);
  });

  it('handles ISO timestamp vs date-only string by splitting on T', () => {
    const expenses = [
      { amount: 150, type: 'expense' as const, expense_date: '2026-09-18T14:30:00.000Z' },
      { amount: 250, type: 'expense' as const, expense_date: '2026-09-18' },
    ];

    expect(computeSpentForDate(expenses, '2026-09-18', isIncome)).toBe(400);
  });

  it('handles NaN amount gracefully as 0', () => {
    const expenses = [
      { amount: NaN, type: 'expense' as const, expense_date: '2026-09-18' },
      { amount: 'invalid-amount' as any, type: 'expense' as const, expense_date: '2026-09-18' },
      { amount: 100, type: 'expense' as const, expense_date: '2026-09-18' },
    ];

    expect(computeSpentForDate(expenses, '2026-09-18', isIncome)).toBe(100);
  });

  it('empty list returns empty record and 0 spent', () => {
    expect(computeSpentByDate([], isIncome)).toEqual({});
    expect(computeSpentForDate([], '2026-09-18', isIncome)).toBe(0);
  });

  it('computeSpentForDate strictly matches computeSpentByDate(...)[targetDate] ?? 0', () => {
    const expenses = [
      { amount: 100, type: 'expense' as const, expense_date: '2026-09-16' },
      { amount: 200, type: 'expense' as const, expense_date: '2026-09-17' },
    ];
    const target = '2026-09-17';
    expect(computeSpentForDate(expenses, target, isIncome)).toBe(
      computeSpentByDate(expenses, isIncome)[target] ?? 0
    );

    const nonExistentTarget = '2026-09-25';
    expect(computeSpentForDate(expenses, nonExistentTarget, isIncome)).toBe(
      computeSpentByDate(expenses, isIncome)[nonExistentTarget] ?? 0
    );
  });

  it('computeSpentForDate and computeSpentByDate[date] agree on a list with several dates, income rows, a NaN amount and an ISO-timestamp date', () => {
    const expenses = [
      { amount: 150, type: 'expense' as const, expense_date: '2026-09-15' },
      { amount: 200, type: 'income' as const, expense_date: '2026-09-15' },
      { amount: 50, type: undefined, category_id: 'cat_income', expense_date: '2026-09-16' },
      { amount: 320, type: 'expense' as const, expense_date: '2026-09-16T18:45:00.000Z' },
      { amount: 180, type: 'expense' as const, expense_date: '2026-09-16' },
      { amount: NaN, type: 'expense' as const, expense_date: '2026-09-17' },
      { amount: 'corrupt-number' as any, type: 'expense' as const, expense_date: '2026-09-17' },
      { amount: 450, type: 'expense' as const, expense_date: '2026-09-17' },
      { amount: 100, type: 'expense' as const, expense_date: '2026-09-18' },
    ];

    const spentByDate = computeSpentByDate(expenses, isIncome);
    const testDates = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19'];

    for (const d of testDates) {
      expect(computeSpentForDate(expenses, d, isIncome)).toBe(spentByDate[d] ?? 0);
    }

    // Explicit check on the aggregated values
    expect(computeSpentForDate(expenses, '2026-09-15', isIncome)).toBe(150);
    expect(computeSpentForDate(expenses, '2026-09-16', isIncome)).toBe(500); // 320 (ISO) + 180
    expect(computeSpentForDate(expenses, '2026-09-17', isIncome)).toBe(450); // NaN and corrupt ignored, 450 counted
    expect(computeSpentForDate(expenses, '2026-09-18', isIncome)).toBe(100);
    expect(computeSpentForDate(expenses, '2026-09-14', isIncome)).toBe(0); // non-existent date
  });
});

describe('buildDefaultTodayRecord', () => {
  it('auto-renew on with a budget', () => {
    const rec = buildDefaultTodayRecord('2026-09-18', true, 500);
    expect(rec).toEqual({
      date: '2026-09-18',
      budget: 500,
      spent: 0,
      saved: 500,
      isFinalized: false,
      status: 'active',
    });
  });

  it('auto-renew on with zero budget', () => {
    const rec = buildDefaultTodayRecord('2026-09-18', true, 0);
    expect(rec).toEqual({
      date: '2026-09-18',
      budget: 0,
      spent: 0,
      saved: 0,
      isFinalized: false,
      status: 'active',
    });
  });

  it('auto-renew off', () => {
    const rec = buildDefaultTodayRecord('2026-09-18', false, 500);
    expect(rec).toEqual({
      date: '2026-09-18',
      budget: 0,
      spent: 0,
      saved: 0,
      isFinalized: false,
      status: 'active',
    });
  });
});

describe('filterPastRecords', () => {
  it('sorts records in descending order by date and excludes today', () => {
    const records: Record<string, DailyRecord> = {
      '2026-09-15': { date: '2026-09-15', budget: 500, spent: 100, saved: 400, isFinalized: true, status: 'saved' },
      '2026-09-17': { date: '2026-09-17', budget: 500, spent: 100, saved: 400, isFinalized: true, status: 'saved' },
      '2026-09-16': { date: '2026-09-16', budget: 500, spent: 100, saved: 400, isFinalized: true, status: 'saved' },
      '2026-09-18': { date: '2026-09-18', budget: 500, spent: 100, saved: 400, isFinalized: false, status: 'active' }, // today
    };

    const past = filterPastRecords(records, '2026-09-18');
    expect(past.map((r) => r.date)).toEqual(['2026-09-17', '2026-09-16', '2026-09-15']);
  });

  it('future dates if present are not excluded by date !== todayStr and sort to the top', () => {
    const records: Record<string, DailyRecord> = {
      '2026-09-16': { date: '2026-09-16', budget: 500, spent: 100, saved: 400, isFinalized: true, status: 'saved' },
      '2026-09-18': { date: '2026-09-18', budget: 500, spent: 100, saved: 400, isFinalized: false, status: 'active' }, // today
      '2026-09-19': { date: '2026-09-19', budget: 500, spent: 0, saved: 500, isFinalized: false, status: 'active' }, // tomorrow
    };

    const result = filterPastRecords(records, '2026-09-18');
    expect(result.map((r) => r.date)).toEqual(['2026-09-19', '2026-09-16']);
  });
});

