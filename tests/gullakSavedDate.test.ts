import { describe, it, expect } from 'vitest';
import { computeWeeklyGullakSavings } from '../src/lib/weeklyInsightsUtils';
import { computeMonthlyGullakSavings } from '../src/lib/monthlyInsightsUtils';
import { computeYearlyGullakMilestones } from '../src/lib/charts/gullakMilestones';
import { autoSavedInScope } from '../src/lib/heroDetails';

const period = (cadence: 'weekly' | 'monthly', periodStart: string, periodEnd: string, activeEnd = periodEnd): any => ({
  id: `${cadence}_${periodStart}`, cadence, periodStart, periodEnd, activeStart: periodStart, activeEnd,
  amountSaved: 300, status: 'saved',
});
const month = (y: number, m: number) => ({ start: new Date(y, m - 1, 1), end: new Date(y, m, 0) });
const year = (y: number) => ({ start: new Date(y, 0, 1), end: new Date(y, 11, 31) });
const yearly = (y: number, p: any) => computeYearlyGullakMilestones(year(y).start, year(y).end, [], [], 300, [p]);
const home = (p: any, prefix: string) => autoSavedInScope({}, { p }, (d) => d.startsWith(prefix));

describe('INS-002: period savings count on the day the budget ended', () => {
  it('a week across two years counts in the year it ended', () => {
    const p = period('weekly', '2025-12-29', '2026-01-04');
    expect(yearly(2025, p).totalSavedInYear).toBe(0);
    expect(yearly(2026, p).totalSavedInYear).toBe(300);
    expect(computeMonthlyGullakSavings({}, [], month(2026, 1), [p]).autoSaved).toBe(300);
    expect(computeMonthlyGullakSavings({}, [], month(2025, 12), [p]).autoSaved).toBe(0);
  });

  it('a budget that ended early counts in the month it really ended, on every screen', () => {
    // Week 29 Sep - 5 Oct, switched off after 30 Sep.
    const p = period('weekly', '2025-09-29', '2025-10-05', '2025-09-30');
    expect(home(p, '2025-09')).toBe(300);
    expect(home(p, '2025-10')).toBe(0);
    expect(computeMonthlyGullakSavings({}, [], month(2025, 9), [p]).autoSaved).toBe(300);
    expect(computeMonthlyGullakSavings({}, [], month(2025, 10), [p]).autoSaved).toBe(0);
  });

  it('weekly and monthly tabs ignore a period that only started inside the range', () => {
    const weekly = period('weekly', '2025-09-29', '2025-10-05');
    const week = { start: new Date(2025, 8, 22), end: new Date(2025, 8, 29) };
    expect(computeWeeklyGullakSavings({}, [], week, [weekly]).autoSaved).toBe(0);
    const monthly = period('monthly', '2025-09-01', '2025-10-31');
    expect(computeMonthlyGullakSavings({}, [], month(2025, 9), [monthly]).autoSaved).toBe(0);
  });
});
