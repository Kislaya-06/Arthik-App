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
import { resolvePlanForDate } from '../lib/periods/core';
import type { BudgetPlanChange } from '../types';
import type { DailyRecord } from '../lib/budgetCalculations';
import { AllowancePause, isPausedOn } from '../lib/allowancePauses';

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

/**
 * What Insights needs to know about the past to price each day (INS-004 / INS-006, owner decision 2026-11-25).
 * Only the fields read here are required, so tests can pass plain objects.
 */
export interface AllowanceHistory {
  planChanges: BudgetPlanChange[];
  dailyRecords: Record<string, Pick<DailyRecord, 'budget' | 'status'>>;
  todayKey: DateKey;
  /** false = the allowance is paused right now: today and later days get nothing (pauses are not kept as history). */
  isAutoRenew: boolean;
  /** Old accounts with no plan history: the plan to use for every day. null = Pure Mode. */
  fallbackPlan: BudgetAllowancePlan | null;
  /** Days the allowance was paused (saved since 2026-11-25). A past day inside a pause is worth nothing. */
  pauses?: AllowancePause[];
}

/**
 * Budget money ONE day was really worth: the plan that ruled that day decides, never today's plan.
 *  - Pure Mode day (plan off): 0.
 *  - Daily day with a saved record: the record's budget (a paused day keeps budget 0; an 'unknown' day is 0).
 *  - Paused day (inside a saved pause, or today / later while paused now): 0.
 *  - Daily day with no record: the plan's daily amount.
 *  - Weekly / monthly day: that plan's per-day share (BUD-009).
 */
export function dayAllowanceFromHistory(h: AllowanceHistory, dateKey: DateKey): number {
  const isTodayOrLater = dateKey >= h.todayKey;
  if (isTodayOrLater && !h.isAutoRenew) return 0;
  if (!isTodayOrLater && isPausedOn(h.pauses, dateKey)) return 0;

  if (h.planChanges.length === 0) {
    return h.fallbackPlan ? dailyBudgetAllowanceOnDate(h.fallbackPlan, dateKey) : 0;
  }
  const plan = resolvePlanForDate(h.planChanges, dateKey);
  if (!plan) return h.fallbackPlan ? dailyBudgetAllowanceOnDate(h.fallbackPlan, dateKey) : 0;
  if (!plan.isEnabled) return 0;

  const amount = Number(plan.amount) || 0;
  if (plan.cadence === 'daily') {
    const rec = h.dailyRecords[dateKey];
    if (rec) return rec.status === 'unknown' ? 0 : Math.max(0, Number(rec.budget) || 0);
    return amount;
  }
  return dailyBudgetAllowanceOnDate(
    { cadence: plan.cadence, weeklyBudgetAmount: amount, monthlyBudgetAmount: amount },
    dateKey
  );
}

/** Sum of `dayAllowanceFromHistory` from startDateKey to endDateKey (both included). Not rounded. */
export function allowanceFromHistory(h: AllowanceHistory, startDateKey: DateKey, endDateKey: DateKey): number {
  let total = 0;
  for (let d = startDateKey; d <= endDateKey; d = addDaysToDateKey(d, 1)) {
    total += dayAllowanceFromHistory(h, d);
  }
  return total;
}
