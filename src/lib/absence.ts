/**
 * Days the app was not opened (spec 2026-11-28 rules 27-31).
 *  - 1 to 6 days, or any expense logged in them: every budget counts.
 *  - 7 or more with no expense at all: the user chooses whether the fully empty periods count.
 */
import { addDaysToDateKey, countDaysInclusive, DateKey } from '../money/dateKeys';
import { getDateOwner, getPeriodBounds, resolvePlanForDate } from './periods/core';
import { buildBudgetPools } from './periods/pools';
import { dailyCarryForDate } from './periods/carry';
import type { BudgetPlanChange } from '../types';

export const ABSENCE_CHOICE_DAYS = 7;

export interface AbsenceBudgets {
  /** Daily days that still need their record, with the budget each one gets. */
  dailyDays: Array<{ date: DateKey; budget: number }>;
  /** Weekly / monthly periods lying entirely inside the absence. */
  periods: Array<{ start: DateKey; end: DateKey; budget: number }>;
  total: number;
}

export function absenceBudgets(
  changes: BudgetPlanChange[],
  from: DateKey,
  to: DateKey,
  dailyBudgetAmount: number,
  hasRecord: (date: DateKey) => boolean
): AbsenceBudgets {
  const dailyDays: AbsenceBudgets['dailyDays'] = [];
  for (let d = from; d <= to; d = addDaysToDateKey(d, 1)) {
    if (changes.length > 0 && getDateOwner(changes, d) !== 'daily') continue;
    if (hasRecord(d)) continue;
    const planned = Number(resolvePlanForDate(changes, d)?.amount) || dailyBudgetAmount;
    const extra = dailyCarryForDate(changes, () => undefined, planned, d)?.extraBudget ?? 0;
    const budget = planned + extra;
    if (budget > 0) dailyDays.push({ date: d, budget });
  }
  const periods = Object.values(buildBudgetPools(changes, to))
    .filter((p) => p.periodStart >= from && p.periodEnd <= to)
    .map((p) => ({ start: p.periodStart, end: p.periodEnd, budget: p.budget }));
  const total = [...dailyDays, ...periods].reduce((sum, x) => sum + x.budget, 0);
  return { dailyDays, periods, total: Math.round(total * 100) / 100 };
}

/** True when the user must choose: 7+ absent days, not one expense in them, and something to decide about. */
export function needsAbsenceChoice(from: DateKey, to: DateKey, expenseDates: ReadonlySet<DateKey>, budgets: AbsenceBudgets): boolean {
  if (countDaysInclusive(from, to) < ABSENCE_CHOICE_DAYS) return false;
  for (const d of expenseDates) if (d >= from && d <= to) return false;
  return budgets.dailyDays.length + budgets.periods.length > 0;
}

/** Rule 25: the info line when a weekly / monthly budget starts close to the period's end, else null. */
export function fewDaysLeftNotice(cadence: 'daily' | 'weekly' | 'monthly', startDate: DateKey): string | null {
  if (cadence === 'daily') return null;
  const { end } = getPeriodBounds(cadence, startDate);
  const left = countDaysInclusive(startDate, end);
  const limit = cadence === 'weekly' ? 2 : 5;
  if (left > limit) return null;
  const unit = cadence === 'weekly' ? 'week' : 'month';
  return `Only ${left} ${left === 1 ? 'day is' : 'days are'} left in this ${unit}. You get the full budget, and any money left will go to Gullak.`;
}
