/**
 * budgetPeriods.ts
 *
 * Pure, framework-free calculation engine for budget cadences (Daily, Weekly, Monthly),
 * date ownership, proration, period finalization slices, and cadence streaks.
 *
 * ARCHITECTURAL INVARIANTS:
 * - Pure functions only: NO React, NO Zustand, NO Supabase, NO Date.now() / new Date().
 * - Every function takes explicit inputs (including todayStr in 'yyyy-MM-dd' format).
 * - Dates are manipulated strictly with date-fns using yyyy-MM-dd strings and parseISO.
 * - Week strictly starts on Monday (weekStartsOn: 1).
 * - Financial amounts rounded via round2 from formatters.
 * - Single-owner principle (D2): every date belongs to exactly one owner ('paused' | 'daily' | 'weekly' | 'monthly').
 * - Zero-Proration Policy: budget is 100% active immediately without fractional day scaling.
 */

import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  subDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  getDaysInMonth,
} from 'date-fns';
import { round2 } from './formatters';
import {
  BudgetCadence,
  BudgetPlanChange,
  BudgetPeriodRecord,
  BudgetPeriodStatus,
} from '../types';

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

export interface PeriodSummaryInfo {
  cadence: 'weekly' | 'monthly';
  periodStart: string;
  periodEnd: string;
  activeStart: string;
  activeEnd: string;
  budget: number;
  spent: number;
  remaining: number;
  isOver: boolean;
  overBy: number;
  rolloverLabelDate: string;
  // Dynamic Non-Binding Pace Suggestions & Calendar-Month Projections:
  remainingDays: number;
  suggestedDailyPace: number;
  suggestedWeeklyPace?: number;
  projectedMonthlyBudget?: number;
  baseBudget?: number;
  carriedOverAmount?: number;
  carryMode?: 'additive' | 'allocation';
}

export interface StreakUnit {
  cadence: BudgetCadence;
  status: BudgetPeriodStatus;
  key: string;
  date?: string;
  amountSaved?: number;
}

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
    const s = startOfWeek(d, { weekStartsOn: 1 });
    const e = endOfWeek(d, { weekStartsOn: 1 });
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
 * 4a. Computes the effectiveFrom date for a plan change according to D3 rules:
 * - 'cadence_switch' -> tomorrow, EXCEPT when today's owner is 'paused' (first enable/re-enable) -> today
 * - 'weekly_amount'  -> next Monday
 * - 'monthly_amount' -> next 1st of month
 * - 'disable'        -> today
 * - 'enable'         -> today
 */
export function computeEffectiveFrom(
  kind: EffectiveFromKind,
  todayStr: string,
  context?: { currentOwner?: DateOwner; changes?: BudgetPlanChange[] }
): string {
  const d = parseISO(todayStr);

  if (kind === 'disable' || kind === 'enable') {
    return todayStr;
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
    const currentMonday = startOfWeek(d, { weekStartsOn: 1 });
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

interface PeriodSlice {
  owner: 'weekly' | 'monthly';
  periodStart: string;
  periodEnd: string;
  totalDays: number;
  activeStart: string;
  activeEnd: string;
  amount: number;
}

/**
 * 5. Builds weekly and monthly periods to finalize up to yesterday.
 * - Walks from the earliest non-daily/non-paused governed date to yesterday.
 * - Groups consecutive dates with the same owner AND same calendar period AND same amount into an active slice.
 * - Finalizable if: todayStr > periodEnd OR (slice ended early due to switch/disable AND todayStr > activeEnd).
 * - Zero-Proration Policy: budget = full user-entered amount (+ additive carry-over if any).
 * - Skips already finalized keys and dates before userCreatedAtStr.
 */
export function buildPeriodsToFinalize(
  changes: BudgetPlanChange[],
  spentByDate: Record<string, number>,
  todayStr: string,
  alreadyFinalizedKeys?: Set<string> | string[],
  userCreatedAtStr?: string
): BudgetPeriodRecord[] {
  const today = parseISO(todayStr);
  const yesterday = subDays(today, 1);
  const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

  const finalizedSet = alreadyFinalizedKeys instanceof Set
    ? alreadyFinalizedKeys
    : new Set(alreadyFinalizedKeys || []);

  // Find all changes that could have enabled weekly or monthly
  const relevantChanges = (changes || []).filter(
    (c) => c.isEnabled && (c.cadence === 'weekly' || c.cadence === 'monthly')
  );
  if (relevantChanges.length === 0) return [];

  // Earliest date governed
  let earliestDateStr = relevantChanges.reduce((min, c) => {
    return c.effectiveFrom < min ? c.effectiveFrom : min;
  }, relevantChanges[0].effectiveFrom);

  if (userCreatedAtStr && userCreatedAtStr > earliestDateStr) {
    earliestDateStr = userCreatedAtStr;
  }

  if (earliestDateStr > yesterdayStr) {
    return [];
  }

  // Walk day-by-day from earliestDateStr to yesterdayStr
  const intervalDays = eachDayOfInterval({
    start: parseISO(earliestDateStr),
    end: yesterday,
  });

  const slices: PeriodSlice[] = [];
  let currentSlice: PeriodSlice | null = null;

  for (const d of intervalDays) {
    const dayStr = format(d, 'yyyy-MM-dd');
    const owner = getDateOwner(changes, dayStr);

    if (owner !== 'weekly' && owner !== 'monthly') {
      // Daily or paused: close active slice if any
      if (currentSlice) {
        slices.push(currentSlice);
        currentSlice = null;
      }
      continue;
    }

    const bounds = getPeriodBounds(owner, dayStr);
    const plan = resolvePlanForDate(changes, dayStr);
    const amount = plan ? plan.amount : 0;

    if (
      currentSlice &&
      currentSlice.owner === owner &&
      currentSlice.periodStart === bounds.start &&
      currentSlice.amount === amount
    ) {
      // Extend current slice
      currentSlice.activeEnd = dayStr;
    } else {
      // Close previous slice if exists
      if (currentSlice) {
        slices.push(currentSlice);
      }
      // Start new slice
      currentSlice = {
        owner,
        periodStart: bounds.start,
        periodEnd: bounds.end,
        totalDays: bounds.totalDays,
        activeStart: dayStr,
        activeEnd: dayStr,
        amount,
      };
    }
  }

  if (currentSlice) {
    slices.push(currentSlice);
  }

  // Finalize eligible slices
  const recordsToFinalize: BudgetPeriodRecord[] = [];

  for (const slice of slices) {
    // A slice is finalizable if the full period has passed (todayStr > periodEnd)
    // OR if the slice ended early because ownership/amount changed (switch/disable) and todayStr > activeEnd
    const isPeriodEnded = todayStr > slice.periodEnd;

    let isEarlySliceEnded = false;
    let isCadenceSwitchEarlyEnd = false;
    if (slice.activeEnd < slice.periodEnd && todayStr > slice.activeEnd) {
      const nextDay = addDays(parseISO(slice.activeEnd), 1);
      const nextDayStr = format(nextDay, 'yyyy-MM-dd');
      const nextDayOwner = getDateOwner(changes, nextDayStr);
      const nextDayPlan = resolvePlanForDate(changes, nextDayStr);
      const nextDayAmount = nextDayPlan ? nextDayPlan.amount : 0;
      const nextDayBounds = getPeriodBounds(slice.owner, nextDayStr);

      if (
        nextDayOwner !== slice.owner ||
        nextDayAmount !== slice.amount ||
        nextDayBounds.start !== slice.periodStart
      ) {
        isEarlySliceEnded = true;
        if (nextDayOwner !== slice.owner) {
          isCadenceSwitchEarlyEnd = true;
        }
      }
    }

    if (!isPeriodEnded && !isEarlySliceEnded) {
      continue;
    }

    const key = `${slice.owner}_${slice.activeStart}`;
    if (finalizedSet.has(key)) {
      continue;
    }

    const slicePlan = resolvePlanForDate(changes, slice.activeStart);
    const baseBudget = slice.amount;
    const carriedOver = slicePlan?.carriedOverAmount || 0;
    const carryMode = slicePlan?.carryMode;
    const budgetAmount =
      carryMode === 'additive' ? round2(baseBudget + carriedOver) : baseBudget;
    const isProrated = false;

    // Sum spend in active slice
    let spentAmount = 0;
    const sliceDays = eachDayOfInterval({
      start: parseISO(slice.activeStart),
      end: parseISO(slice.activeEnd),
    });
    for (const sd of sliceDays) {
      const sdStr = format(sd, 'yyyy-MM-dd');
      spentAmount += Number(spentByDate[sdStr]) || 0;
    }
    spentAmount = round2(spentAmount);

    const unspentInSlice = round2(Math.max(0, budgetAmount - spentAmount));
    // GOLDEN INVARIANT (Audio Clips 1 & 3):
    // Gullak deposits ONLY happen when a period ends naturally!
    // If a period slice ends early due to a cadence switch, amountSaved = 0 (Gullak gets 0).
    const amountSaved = isCadenceSwitchEarlyEnd
      ? 0
      : budgetAmount <= 0
      ? 0
      : unspentInSlice;

    let status: BudgetPeriodStatus;
    if (budgetAmount <= 0) {
      status = 'unknown';
    } else if (spentAmount > budgetAmount) {
      status = 'missed';
    } else if (spentAmount === budgetAmount) {
      status = 'even';
    } else {
      status = 'saved';
    }

    recordsToFinalize.push({
      id: key,
      userId: '',
      cadence: slice.owner,
      periodStart: slice.periodStart,
      periodEnd: slice.periodEnd,
      activeStart: slice.activeStart,
      activeEnd: slice.activeEnd,
      budgetAmount,
      spentAmount,
      amountSaved,
      status,
      isProrated,
      carriedOverAmount: isCadenceSwitchEarlyEnd ? unspentInSlice : carriedOver,
      carryMode,
      createdAt: todayStr,
    });
  }

  return recordsToFinalize;
}

/**
 * 6. Returns the live period summary for the hero card (D8).
 * Returns null if the current owner is 'paused' or 'daily'.
 */
export function getCurrentPeriodSummary(
  changes: BudgetPlanChange[],
  spentByDate: Record<string, number>,
  todayStr: string
): PeriodSummaryInfo | null {
  const owner = getDateOwner(changes, todayStr);
  if (owner === 'paused' || owner === 'daily') {
    return null;
  }

  const bounds = getPeriodBounds(owner, todayStr);
  const plan = resolvePlanForDate(changes, todayStr);
  const fullAmount = plan ? plan.amount : 0;

  // Walk backwards from todayStr within [bounds.start, todayStr] to find activeStart
  let activeStart = todayStr;
  const startLimit = parseISO(bounds.start);
  let cur = parseISO(todayStr);
  while (cur >= startLimit) {
    const curStr = format(cur, 'yyyy-MM-dd');
    const curOwner = getDateOwner(changes, curStr);
    const curPlan = resolvePlanForDate(changes, curStr);
    const curAmount = curPlan ? curPlan.amount : 0;
    if (curOwner === owner && curAmount === fullAmount) {
      activeStart = curStr;
      cur = subDays(cur, 1);
    } else {
      break;
    }
  }

  // Walk forward from todayStr up to bounds.end to check if a scheduled change terminates this slice early
  let activeEnd = bounds.end;
  const endLimit = parseISO(bounds.end);
  let fwd = addDays(parseISO(todayStr), 1);
  while (fwd <= endLimit) {
    const fwdStr = format(fwd, 'yyyy-MM-dd');
    const fwdOwner = getDateOwner(changes, fwdStr);
    const fwdPlan = resolvePlanForDate(changes, fwdStr);
    const fwdAmount = fwdPlan ? fwdPlan.amount : 0;
    if (fwdOwner !== owner || fwdAmount !== fullAmount) {
      activeEnd = format(subDays(fwd, 1), 'yyyy-MM-dd');
      break;
    }
    fwd = addDays(fwd, 1);
  }

  // 100% Real Money Invariant: Budget pool is fully intact without proration
  const carryMode = plan?.carryMode;
  const carriedOverAmount = plan?.carriedOverAmount || 0;
  const budget =
    carryMode === 'additive' ? round2(fullAmount + carriedOverAmount) : fullAmount;

  // Sum spend from activeStart to todayStr
  let spent = 0;
  const daysSoFar = eachDayOfInterval({
    start: parseISO(activeStart),
    end: parseISO(todayStr),
  });
  for (const d of daysSoFar) {
    const dStr = format(d, 'yyyy-MM-dd');
    spent += Number(spentByDate[dStr]) || 0;
  }
  spent = round2(spent);

  const remaining = round2(Math.max(0, budget - spent));
  const isOver = spent > budget && budget > 0;
  const overBy = round2(isOver ? spent - budget : 0);

  // Dynamic Pace Suggestions (Non-binding guidance):
  const today = parseISO(todayStr);
  const periodEndDate = parseISO(bounds.end);
  const remainingDays = Math.max(1, differenceInCalendarDays(periodEndDate, today) + 1);

  // Suggested Daily Pace to stay within budget
  const suggestedDailyPace = Math.round(remaining / remainingDays);

  // If Monthly mode: Suggested Weekly Pace
  let suggestedWeeklyPace: number | undefined;
  if (owner === 'monthly') {
    suggestedWeeklyPace = Math.round((remaining / remainingDays) * 7);
  }

  // If Weekly mode: Projected Monthly Budget based on actual calendar days in current month (28, 29, 30, or 31 days)
  let projectedMonthlyBudget: number | undefined;
  if (owner === 'weekly') {
    const daysInMonth = getDaysInMonth(today);
    const dailyAvg = fullAmount / 7;
    projectedMonthlyBudget = Math.round(dailyAvg * daysInMonth);
  }

  return {
    cadence: owner,
    periodStart: bounds.start,
    periodEnd: bounds.end,
    activeStart,
    activeEnd,
    budget,
    spent,
    remaining,
    isOver,
    overBy,
    rolloverLabelDate: activeEnd,
    remainingDays,
    suggestedDailyPace,
    suggestedWeeklyPace,
    projectedMonthlyBudget,
    baseBudget: fullAmount,
    carriedOverAmount,
    carryMode,
  };
}

/**
 * 7. Helper for the store: checks if a date is governed by 'daily'.
 * Ensures the daily finalization loop ONLY touches dates owned by 'daily' (D2).
 */
export function isDailyGovernedDate(changes: BudgetPlanChange[], dateStr: string): boolean {
  return getDateOwner(changes, dateStr) === 'daily';
}

/**
 * 8. Computes current streak and best streak by cadence per D6.
 * - Units are chronological finalized units (each with cadence, status, key, amountSaved).
 * - Counts consecutive 'saved' units of the CURRENT cadence walking backwards from latest.
 * - 'unknown' status units neither extend nor break the streak.
 * - Units of a different cadence end the count (cadence switch resets current streak).
 * - Paused ranges are simply absent from units and do NOT break the chain.
 * - Returns currentStreak and bestByCadence record.
 */
export function computeCadenceStreak(
  units: StreakUnit[],
  currentCadence: BudgetCadence
): { currentStreak: number; bestByCadence: Record<BudgetCadence, number> } {
  const bestByCadence: Record<BudgetCadence, number> = {
    daily: 0,
    weekly: 0,
    monthly: 0,
  };

  if (!units || units.length === 0) {
    return { currentStreak: 0, bestByCadence };
  }

  // 1. Calculate bestByCadence for each cadence
  const cadences: BudgetCadence[] = ['daily', 'weekly', 'monthly'];
  for (const cad of cadences) {
    const cadUnits = units.filter((u) => u.cadence === cad);
    let run = 0;
    let maxRun = 0;
    for (const u of cadUnits) {
      if (u.status === 'unknown') {
        continue;
      }
      const isSaved = u.status === 'saved' && (u.amountSaved === undefined || u.amountSaved > 0);
      if (isSaved) {
        run++;
        if (run > maxRun) maxRun = run;
      } else {
        run = 0;
      }
    }
    bestByCadence[cad] = maxRun;
  }

  // 2. Current streak: walking backwards from the latest unit
  let currentStreak = 0;
  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i];
    if (u.cadence !== currentCadence) {
      break;
    }
    if (u.status === 'unknown') {
      continue;
    }
    const isSaved = u.status === 'saved' && (u.amountSaved === undefined || u.amountSaved > 0);
    if (isSaved) {
      currentStreak++;
    } else {
      break;
    }
  }

  return { currentStreak, bestByCadence };
}
