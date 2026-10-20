import { describe, it, expect } from 'vitest';
import {
  dailyBudgetAllowanceOnDate,
  budgetAllowedBetweenDates,
  budgetAllowedForActiveDays,
  monthlyAllowanceFromWeeklyBudget,
} from '../../src/money/budgetAllowance';

const monthly = (monthlyBudgetAmount: number) => ({ cadence: 'monthly' as const, monthlyBudgetAmount });
const weekly = (weeklyBudgetAmount: number) => ({ cadence: 'weekly' as const, weeklyBudgetAmount });
const daily = (dailyBudgetAmount: number) => ({ cadence: 'daily' as const, dailyBudgetAmount });

describe('BUD-009: one daily rate for every budget', () => {
  describe('money per day', () => {
    it('daily is as is, weekly is /7, monthly is / days of THAT month', () => {
      expect(dailyBudgetAllowanceOnDate(daily(100), '2026-10-05')).toBe(100);
      expect(dailyBudgetAllowanceOnDate(weekly(700), '2026-10-05')).toBe(100);
      expect(dailyBudgetAllowanceOnDate(monthly(3100), '2026-10-05')).toBe(100); // October: 31 days
      expect(dailyBudgetAllowanceOnDate(monthly(3000), '2026-11-05')).toBe(100); // November: 30 days
      expect(dailyBudgetAllowanceOnDate(monthly(2800), '2026-02-05')).toBe(100); // February: 28 days
    });
    it('a missing cadence behaves like daily (the old default branch)', () => {
      expect(dailyBudgetAllowanceOnDate({ dailyBudgetAmount: 80 }, '2026-10-05')).toBe(80);
    });
    it('missing amounts are 0, never NaN', () => {
      expect(dailyBudgetAllowanceOnDate({ cadence: 'monthly' }, '2026-10-05')).toBe(0);
      expect(budgetAllowedBetweenDates({ cadence: 'weekly' }, '2026-10-01', '2026-10-07')).toBe(0);
    });
  });

  describe('a full calendar month is worth EXACTLY the monthly budget, in every month', () => {
    const months: Array<[string, string, number]> = [
      ['2026-01-01', '2026-01-31', 31],
      ['2026-02-01', '2026-02-28', 28],
      ['2028-02-01', '2028-02-29', 29],
      ['2026-04-01', '2026-04-30', 30],
      ['2026-10-01', '2026-10-31', 31],
    ];
    for (const [first, last, days] of months) {
      it(`${first} (${days} days)`, () => {
        expect(Math.round(budgetAllowedBetweenDates(monthly(3100), first, last) * 100) / 100).toBe(3100);
      });
    }
  });

  it('a stretch that crosses two months uses each day\'s own month', () => {
    // Oct 28..31 = 4 days of October (31), Nov 1..3 = 3 days of November (30)
    const expected = (3000 * 4) / 31 + (3000 * 3) / 30;
    expect(budgetAllowedBetweenDates(monthly(3000), '2026-10-28', '2026-11-03')).toBeCloseTo(expected, 10);
  });

  it('weekly and daily are plain multiples', () => {
    expect(budgetAllowedBetweenDates(weekly(700), '2026-10-05', '2026-10-11')).toBe(700);
    expect(budgetAllowedBetweenDates(weekly(700), '2026-10-05', '2026-10-05')).toBe(100);
    expect(budgetAllowedBetweenDates(daily(100), '2026-10-05', '2026-10-11')).toBe(700);
  });

  it('an empty or backwards range is worth 0', () => {
    expect(budgetAllowedBetweenDates(monthly(3100), '2026-10-06', '2026-10-05')).toBe(0);
  });

  describe('the screens that used to disagree now agree', () => {
    it('a monthly 3100 budget: one week in October is worth 700 (the weekly screen used /30 and said 723.33)', () => {
      expect(budgetAllowedBetweenDates(monthly(3100), '2026-10-05', '2026-10-11')).toBeCloseTo(700, 10);
    });
    it('a weekly 700 budget over October is worth 3100, the same as monthly 3100', () => {
      expect(monthlyAllowanceFromWeeklyBudget(700, '2026-10-20')).toBeCloseTo(3100, 10);
      expect(monthlyAllowanceFromWeeklyBudget(700, '2026-11-20')).toBeCloseTo(3000, 10);
    });
  });

  describe('active days', () => {
    it('counts only days after the user joined and up to today', () => {
      const plan = monthly(3100);
      // Joined Oct 16, today Oct 20: 5 active days of 31
      expect(
        budgetAllowedForActiveDays(plan, '2026-10-01', '2026-10-31', { userJoinedDateKey: '2026-10-16', todayDateKey: '2026-10-20' })
      ).toBeCloseTo(500, 10);
    });
    it('no limit given means the whole range', () => {
      expect(budgetAllowedForActiveDays(monthly(3100), '2026-10-01', '2026-10-31')).toBeCloseTo(3100, 10);
    });
    it('a user who joined after the range, or a range still in the future, gets nothing', () => {
      expect(budgetAllowedForActiveDays(daily(100), '2026-10-01', '2026-10-07', { userJoinedDateKey: '2026-10-09' })).toBe(0);
      expect(budgetAllowedForActiveDays(daily(100), '2026-11-01', '2026-11-07', { todayDateKey: '2026-10-20' })).toBe(0);
    });
  });
});
