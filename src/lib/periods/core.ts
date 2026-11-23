import { WEEK_OPTIONS } from '../../money/dateKeys';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { startOfWeek } from 'date-fns/startOfWeek';
import { endOfWeek } from 'date-fns/endOfWeek';
import { startOfMonth } from 'date-fns/startOfMonth';
import { endOfMonth } from 'date-fns/endOfMonth';
import { addDays } from 'date-fns/addDays';
import { addMonths } from 'date-fns/addMonths';
import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays';
import { BudgetCadence, BudgetPlanChange } from '../../types';

export interface PeriodBounds {
  start: string; // 'yyyy-MM-dd'
  end: string;   // 'yyyy-MM-dd'
  totalDays: number;
}

export type DateOwner = 'paused' | 'daily' | 'weekly' | 'monthly';

export type EffectiveFromKind =
  | 'cadence_switch'
  | 'weekly_amount'
  | 'monthly_amount'
  | 'disable'
  | 'enable';

/**
 * 1. Returns calendar start date, end date, and total days for a given date and cadence.
 * - daily: same day (totalDays: 1)
 * - weekly: Monday to Sunday (totalDays: 7)
 * - monthly: 1st of month to last of month (totalDays: 28, 29, 30, or 31)
 */
export function getPeriodBounds(cadence: BudgetCadence, dateStr: string): PeriodBounds {
  const d = parseISO(dateStr);
  if (cadence === 'daily') {
    return { start: dateStr, end: dateStr, totalDays: 1 };
  }
  if (cadence === 'weekly') {
    const s = startOfWeek(d, WEEK_OPTIONS);
    const e = endOfWeek(d, WEEK_OPTIONS);
    return {
      start: format(s, 'yyyy-MM-dd'),
      end: format(e, 'yyyy-MM-dd'),
      totalDays: 7,
    };
  }
  // monthly
  const s = startOfMonth(d);
  const e = endOfMonth(d);
  const totalDays = differenceInCalendarDays(e, s) + 1;
  return {
    start: format(s, 'yyyy-MM-dd'),
    end: format(e, 'yyyy-MM-dd'),
    totalDays,
  };
}

/**
 * Additive carry-over belongs to the FIRST period of the plan only (the one that contains the plan's
 * effectiveFrom). Later weeks / months must not get it again: a one-time carry of ₹300 used to be added to
 * EVERY following period (budget ₹2400 instead of ₹2100, every week).
 */
export function carryForPeriod(
  plan: Pick<BudgetPlanChange, 'cadence' | 'carryMode' | 'carriedOverAmount' | 'effectiveFrom'> | null | undefined,
  periodStart: string
): number {
  if (!plan || plan.cadence === 'daily' || plan.carryMode !== 'additive') return 0;
  const carry = Number(plan.carriedOverAmount) || 0;
  if (carry <= 0) return 0;
  return getPeriodBounds(plan.cadence, plan.effectiveFrom).start === periodStart ? carry : 0;
}

/**
 * 2. Resolves the active BudgetPlanChange in effect on dateStr.
 * Returns the change with the greatest effectiveFrom <= dateStr, or null if none.
 */
export function resolvePlanForDate(
  changes: BudgetPlanChange[],
  dateStr: string
): BudgetPlanChange | null {
  if (!changes || changes.length === 0) return null;
  const eligible = changes.filter((c) => c.effectiveFrom <= dateStr);
  if (eligible.length === 0) return null;
  // Sort descending by effectiveFrom
  eligible.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return eligible[0];
}

/**
 * 3. Returns the sole owner of dateStr: 'paused' | 'daily' | 'weekly' | 'monthly'.
 * D2 invariant: Every calendar date has exactly one owner.
 */
export function getDateOwner(changes: BudgetPlanChange[], dateStr: string): DateOwner {
  const plan = resolvePlanForDate(changes, dateStr);
  if (!plan || !plan.isEnabled) {
    return 'paused';
  }
  return plan.cadence;
}

/**
 * True when no plan change has EVER turned Budget Mode on (empty history, or only the "Pure Mode" row every new
 * account is created with).
 */
export function hasNeverEnabledBudgetMode(changes?: BudgetPlanChange[] | null): boolean {
  return !changes || !changes.some((c) => c.isEnabled);
}

/**
 * The onboarding exception (BPR-002 #3): a NEW account turning Budget Mode on for the first time on its first day
 * (the day it was created) starts immediately. Existing accounts are never affected: after day one, or once
 * Budget Mode was ever on, a switch takes effect tomorrow as before.
 */
export function isFirstDayFirstEnable(
  changes: BudgetPlanChange[] | null | undefined,
  todayStr: string,
  userCreatedAtStr?: string | null,
  totalExpenseCount?: number
): boolean {
  if (!hasNeverEnabledBudgetMode(changes)) {
    return false;
  }
  if (totalExpenseCount !== undefined) {
    return totalExpenseCount === 0;
  }
  return !!userCreatedAtStr && userCreatedAtStr === todayStr;
}

/**
 * 4a. Computes the effectiveFrom date for a plan change according to D3 rules:
 * - 'cadence_switch' -> tomorrow, EXCEPT when today's owner is 'paused' (first enable/re-enable) -> today
 * - 'weekly_amount'  -> next Monday
 * - 'monthly_amount' -> next 1st of month
 * - 'disable'        -> tomorrow (protects running-day budget & Gullak savings), except fresh onboarding (today)
 * - 'enable'         -> tomorrow (user sets fresh budget), except a NEW account or 0-expense account's first-ever enable (today, BPR-002 #3)
 */
export function computeEffectiveFrom(
  kind: EffectiveFromKind,
  todayStr: string,
  context?: {
    currentOwner?: DateOwner;
    changes?: BudgetPlanChange[];
    userCreatedAtStr?: string | null;
    totalExpenseCount?: number;
  }
): string {
  const d = parseISO(todayStr);

  if (kind === 'enable') {
    // No plan history at all: starts today (as before).
    if (!context?.changes || context.changes.length === 0) {
      return todayStr;
    }
    // New account, first day, or 0 expenses logged: starts today (BPR-002 #3). Every account gets a "Pure Mode"
    // signup row, so that row is not "history". Existing accounts keep the tomorrow rule.
    if (isFirstDayFirstEnable(context.changes, todayStr, context.userCreatedAtStr, context.totalExpenseCount)) {
      return todayStr;
    }
    return format(addDays(d, 1), 'yyyy-MM-dd');
  }

  if (kind === 'disable') {
    // Fresh user without any prior plan history starts immediately today.
    // Existing users toggle modes for the NEXT day so today's running budget and savings complete normally.
    const hasHistory = context?.changes && context.changes.length > 0;
    if (!hasHistory) {
      return todayStr;
    }
    return format(addDays(d, 1), 'yyyy-MM-dd');
  }

  if (kind === 'cadence_switch') {
    const owner =
      context?.currentOwner ??
      (context?.changes ? getDateOwner(context.changes, todayStr) : undefined);
    if (owner === 'paused') {
      return todayStr;
    }
    return format(addDays(d, 1), 'yyyy-MM-dd');
  }

  if (kind === 'weekly_amount') {
    const currentMonday = startOfWeek(d, WEEK_OPTIONS);
    const nextMonday = addDays(currentMonday, 7);
    return format(nextMonday, 'yyyy-MM-dd');
  }

  if (kind === 'monthly_amount') {
    const nextMonth = addMonths(d, 1);
    const nextFirst = startOfMonth(nextMonth);
    return format(nextFirst, 'yyyy-MM-dd');
  }

  return todayStr;
}

/**
 * 4b. Replaces any change with the same effectiveFrom and drops any change with
 * effectiveFrom > newChange.effectiveFrom that has become obsolete.
 * Only one pending future change may exist at any time.
 */
export function upsertPendingChange(
  changes: BudgetPlanChange[],
  newChange: BudgetPlanChange
): BudgetPlanChange[] {
  const filtered = (changes || []).filter((c) => c.effectiveFrom < newChange.effectiveFrom);
  const result = [...filtered, newChange];
  result.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  return result;
}

/**
 * 7. Helper for the store: checks if a date is governed by 'daily'.
 * Ensures the daily finalization loop ONLY touches dates owned by 'daily' (D2).
 */
export function isDailyGovernedDate(changes: BudgetPlanChange[], dateStr: string): boolean {
  return getDateOwner(changes, dateStr) === 'daily';
}

// ─────────────────────────────────────────────────────────────────────────────
// Budget pools: ONE budget per calendar period (ADR 0012)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The "one budget per calendar period" rules (ADR 0012) apply from this date on.
 * Anything that started earlier keeps the old numbers: nobody's past Gullak / income is rewritten.
 */
export const BUDGET_RULES_V2_FROM = '2026-10-14';

export function getNextPeriodStart(cadence: 'weekly' | 'monthly', currentStartStr: string): string {
  if (cadence === 'weekly') {
    return format(addDays(parseISO(currentStartStr), 7), 'yyyy-MM-dd');
  }
  return format(startOfMonth(addMonths(parseISO(currentStartStr), 1)), 'yyyy-MM-dd');
}
