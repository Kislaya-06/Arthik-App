/**
 * Budget allowance: how much budget money a stretch of days is worth. ONE formula for every screen
 * (canonical rule BUD-009).
 *
 * THE RULE
 * Every budget is turned into "money per day", and a stretch of days is worth (days x money per day):
 *  - daily cadence   : the daily amount, as is.
 *  - weekly cadence  : weekly amount / 7.
 *  - monthly cadence : monthly amount / the number of days of the ACTUAL calendar month of that day
 *                      (October = 31, November = 30, February = 28 or 29).
 * So a full calendar month is always worth exactly the monthly amount, in every month, on every screen.
 * A stretch that crosses two months uses each day's own month.
 *
 * Before this file, monthly budgets were divided by 30 (weekly insights), by the actual days (charts, month insights),
 * and by 365/12 (yearly insights). The same user saw slightly different budget numbers on different screens.
 *
 * Callers round the result the way their screen needs (round2 for exact money, Math.round for chart bars).
 */
import { DateKey, addDaysToDateKey, countDaysInclusive, daysInMonthOfDateKey, monthBoundsOfDateKey } from './dateKeys';

export type BudgetCadenceName = 'daily' | 'weekly' | 'monthly';

/** The budget the user set. Only the amount of the active cadence is read. A missing cadence behaves like 'daily'. */
export interface BudgetAllowancePlan {
  cadence?: BudgetCadenceName;
  dailyBudgetAmount?: number;
  weeklyBudgetAmount?: number;
  monthlyBudgetAmount?: number;
}

/** Budget money that ONE day is worth. */
export function dailyBudgetAllowanceOnDate(plan: BudgetAllowancePlan, dateKey: DateKey): number {
  if (plan.cadence === 'monthly') {
    return (plan.monthlyBudgetAmount || 0) / daysInMonthOfDateKey(dateKey);
  }
  if (plan.cadence === 'weekly') {
    return (plan.weeklyBudgetAmount || 0) / 7;
  }
  return plan.dailyBudgetAmount || 0;
}

/** Budget money that the days from startDateKey to endDateKey (both included) are worth. Not rounded. */
export function budgetAllowedBetweenDates(
  plan: BudgetAllowancePlan,
  startDateKey: DateKey,
  endDateKey: DateKey
): number {
  const totalDays = countDaysInclusive(startDateKey, endDateKey);
  if (totalDays === 0) return 0;

  if (plan.cadence === 'weekly') {
    return ((plan.weeklyBudgetAmount || 0) * totalDays) / 7;
  }
  if (plan.cadence !== 'monthly') {
    return (plan.dailyBudgetAmount || 0) * totalDays;
  }

  // Monthly: walk month by month so each day is divided by ITS OWN month's length.
  const monthlyBudgetAmount = plan.monthlyBudgetAmount || 0;
  let allowed = 0;
  let segmentStart = startDateKey;
  while (segmentStart <= endDateKey) {
    const { lastDateKey: monthLastDateKey } = monthBoundsOfDateKey(segmentStart);
    const segmentEnd = monthLastDateKey < endDateKey ? monthLastDateKey : endDateKey;
    const daysInSegment = countDaysInclusive(segmentStart, segmentEnd);
    allowed += (monthlyBudgetAmount * daysInSegment) / daysInMonthOfDateKey(segmentStart);
    segmentStart = addDaysToDateKey(segmentEnd, 1);
  }
  return allowed;
}

/** What a weekly budget adds up to over the whole calendar month that contains `dateKey`. Not rounded. */
export function monthlyAllowanceFromWeeklyBudget(weeklyBudgetAmount: number, dateKey: DateKey): number {
  const { firstDateKey, lastDateKey } = monthBoundsOfDateKey(dateKey);
  return budgetAllowedBetweenDates({ cadence: 'weekly', weeklyBudgetAmount }, firstDateKey, lastDateKey);
}

/**
 * Budget money for the days of a range that are really "active": not before the user joined, and not after today
 * (future days have not been given any allowance yet). Pass nothing for a limit that does not apply.
 * Returns 0 when no day of the range is active. Not rounded.
 */
export function budgetAllowedForActiveDays(
  plan: BudgetAllowancePlan,
  rangeStartDateKey: DateKey,
  rangeEndDateKey: DateKey,
  limits: { userJoinedDateKey?: DateKey | null; todayDateKey?: DateKey | null } = {}
): number {
  const firstActiveDateKey =
    limits.userJoinedDateKey && limits.userJoinedDateKey > rangeStartDateKey ? limits.userJoinedDateKey : rangeStartDateKey;
  const lastActiveDateKey =
    limits.todayDateKey && limits.todayDateKey < rangeEndDateKey ? limits.todayDateKey : rangeEndDateKey;
  return budgetAllowedBetweenDates(plan, firstActiveDateKey, lastActiveDateKey);
}
