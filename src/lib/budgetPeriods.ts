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
} from 'date-fns';
import { round2 } from './formatters';
import { calculateCycleFinancials } from './budgetCalculations';
import { monthlyAllowanceFromWeeklyBudget } from '../money/budgetAllowance';
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
  if (totalExpenseCount !== undefined && totalExpenseCount === 0 && hasNeverEnabledBudgetMode(changes)) {
    return true;
  }
  return !!userCreatedAtStr && userCreatedAtStr === todayStr && hasNeverEnabledBudgetMode(changes);
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
  userCreatedAtStr?: string,
  incomeByDate?: Record<string, number>
): BudgetPeriodRecord[] {
  const today = parseISO(todayStr);
  const yesterday = subDays(today, 1);
  const yesterdayStr = format(yesterday, 'yyyy-MM-dd');
  const pools = buildBudgetPools(changes, todayStr);

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
    let baseBudget = slice.amount;
    // ADR 0012: a later slice of the SAME calendar period (after Pure Mode / a switch and back) does not get a
    // new full budget: it continues with what is left of the period's pool. Only for slices from the rule date on.
    let usePoolRemaining = false;
    const pool = pools[`${slice.owner}_${slice.periodStart}`];
    if (pool && slice.activeStart > pool.startedOn && slice.activeStart >= BUDGET_RULES_V2_FROM) {
      usePoolRemaining = true;
      baseBudget =
        pool.closedOn && slice.activeStart >= pool.closedOn
          ? 0
          : Math.max(0, round2(pool.budget - poolSpentBefore(pools, changes, pool, slice.activeStart, spentByDate)));
    }
    const carriedOver = slicePlan?.carriedOverAmount || 0;
    const carryMode = slicePlan?.carryMode;
    const isProrated = false;

    // Sum spend in active slice
    let spentAmount = 0;
    let sliceIncome = 0;
    const sliceDays = eachDayOfInterval({
      start: parseISO(slice.activeStart),
      end: parseISO(slice.activeEnd),
    });
    for (const sd of sliceDays) {
      const sdStr = format(sd, 'yyyy-MM-dd');
      spentAmount += Number(spentByDate[sdStr]) || 0;
      if (incomeByDate) {
        sliceIncome += Number(incomeByDate[sdStr]) || 0;
      }
    }
    spentAmount = round2(spentAmount);
    sliceIncome = round2(sliceIncome);

    const fin = calculateCycleFinancials({
      scheduledBudget: baseBudget,
      carriedOverAmount: usePoolRemaining ? 0 : carryForPeriod(slicePlan, slice.periodStart),
      // Income never rolls into Gullak: only unspent budget does.
      eligibleIncome: 0,
      spent: spentAmount,
    });

    const budgetAmount = fin.spendable;
    const unspentInSlice = fin.remaining;

    // GOLDEN INVARIANT (Audio Clips 1 & 3):
    // Gullak deposits ONLY happen when a period ends naturally!
    // If a period slice ends early due to a cadence switch, amountSaved = 0 (Gullak gets 0).
    const amountSaved = isCadenceSwitchEarlyEnd
      ? 0
      : budgetAmount <= 0
      ? 0
      : fin.gullakDeposit;

    let status: BudgetPeriodStatus = fin.status;

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
  todayStr: string,
  incomeByDate?: Record<string, number>
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

  // Sum spend and income from activeStart to todayStr
  let spent = 0;
  let income = 0;
  const daysSoFar = eachDayOfInterval({
    start: parseISO(activeStart),
    end: parseISO(todayStr),
  });
  for (const d of daysSoFar) {
    const dStr = format(d, 'yyyy-MM-dd');
    spent += Number(spentByDate[dStr]) || 0;
    if (incomeByDate) {
      income += Number(incomeByDate[dStr]) || 0;
    }
  }
  spent = round2(spent);
  income = round2(income);

  // ADR 0012: ONE budget per calendar period. After Pure Mode (or a switch) and back inside the same period the
  // hero continues with what is left of the period's pool; Pure Mode days spent from the same pool count too.
  const pools = buildBudgetPools(changes, todayStr);
  const pool = pools[`${owner}_${bounds.start}`];
  const poolMode = !!pool && activeStart > pool.startedOn && activeStart >= BUDGET_RULES_V2_FROM;
  if (poolMode && pool) {
    const tomorrowStr = format(addDays(parseISO(todayStr), 1), 'yyyy-MM-dd');
    const through = poolSpentBefore(pools, changes, pool, tomorrowStr, spentByDate);
    if (pool.closedOn && activeStart >= pool.closedOn) {
      // Switched away and back inside this period: what was left was carried away, nothing is left here.
      spent = round2(pool.budget + Math.max(0, through - poolSpentBefore(pools, changes, pool, pool.closedOn, spentByDate)));
    } else {
      spent = through;
    }
  }

  const fin = calculateCycleFinancials({
    scheduledBudget: poolMode && pool ? pool.budget : fullAmount,
    carriedOverAmount: poolMode ? 0 : carryForPeriod(plan, bounds.start),
    // Income is a separate pool (see moneyWaterfall.ts); it is not part of the period budget.
    eligibleIncome: 0,
    spent,
  });

  const budget = fin.spendable;
  const remaining = fin.remaining;
  const isOver = fin.isOverBudget;
  const overBy = fin.overAmount;

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
    // Same rule as every screen (BUD-009): a weekly budget is worth weekly / 7 per day, for each day of the month.
    projectedMonthlyBudget = Math.round(monthlyAllowanceFromWeeklyBudget(fullAmount, todayStr));
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

export interface CalendarCadenceConnectionInfo {
  dateStr: string;
  owner: DateOwner;
  cycleId: string | null;
  hasLeftConnection: boolean;
  hasRightConnection: boolean;
}

/**
 * 10. Computes horizontal cadence connection metadata for calendar month cells.
 *
 * Rules:
 * - 'daily' or 'paused' dates: hasLeftConnection = false, hasRightConnection = false.
 * - 'weekly' dates: dates belonging to the same 7-day weekly cycle (Monday-Sunday) connect
 *    horizontally within each calendar row. If a cycle crosses rows (Sat -> Sun), Sat connects to the
 *    right edge and Sun connects from the left edge. Consecutive different weekly cycles do NOT connect.
 * - 'monthly' dates: dates belonging to the same monthly cycle (1st to last day of month) connect
 *    horizontally across rows for that month.
 * - Historical preservation: only dates governed by their active plan change share the connection.
 */
export function computeCalendarConnections(
  cells: Array<{ dateStr: string | null; day: number | null }>,
  planChanges: BudgetPlanChange[],
  fallbackCadence: BudgetCadence = 'daily',
  isBudgetModeEnabled: boolean = true
): Record<string, CalendarCadenceConnectionInfo> {
  const result: Record<string, CalendarCadenceConnectionInfo> = {};

  // First pass: resolve owner and cycleId for all non-empty cells
  for (const cell of cells) {
    if (!cell.dateStr) continue;

    let owner: DateOwner;
    if (planChanges && planChanges.length > 0) {
      owner = getDateOwner(planChanges, cell.dateStr);
    } else {
      owner = isBudgetModeEnabled ? fallbackCadence : 'paused';
    }

    let cycleId: string | null = null;
    if (owner === 'weekly') {
      const bounds = getPeriodBounds('weekly', cell.dateStr);
      cycleId = `weekly_${bounds.start}_${bounds.end}`;
    } else if (owner === 'monthly') {
      const bounds = getPeriodBounds('monthly', cell.dateStr);
      cycleId = `monthly_${bounds.start}_${bounds.end}`;
    }

    result[cell.dateStr] = {
      dateStr: cell.dateStr,
      owner,
      cycleId,
      hasLeftConnection: false,
      hasRightConnection: false,
    };
  }

  // Second pass: determine horizontal row connections (grid has 7 columns per row)
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (!cell.dateStr) continue;

    const currentInfo = result[cell.dateStr];
    if (!currentInfo || currentInfo.owner === 'daily' || currentInfo.owner === 'paused' || !currentInfo.cycleId) {
      continue;
    }

    const colIndex = i % 7; // 0 = Su, 1 = Mo, 2 = Tu, 3 = We, 4 = Th, 5 = Fr, 6 = Sa

    // Left connection:
    if (colIndex > 0) {
      const leftCell = cells[i - 1];
      if (leftCell && leftCell.dateStr) {
        const leftInfo = result[leftCell.dateStr];
        if (leftInfo && leftInfo.owner === currentInfo.owner && leftInfo.cycleId === currentInfo.cycleId) {
          currentInfo.hasLeftConnection = true;
        }
      }
    } else if (colIndex === 0) {
      // Sunday - start of row. Check if previous calendar day (Saturday) was in the same cycle!
      const prevDateStr = format(subDays(parseISO(cell.dateStr), 1), 'yyyy-MM-dd');
      let prevOwner: DateOwner;
      if (planChanges && planChanges.length > 0) {
        prevOwner = getDateOwner(planChanges, prevDateStr);
      } else {
        prevOwner = isBudgetModeEnabled ? fallbackCadence : 'paused';
      }

      if (prevOwner === currentInfo.owner) {
        let prevCycleId: string | null = null;
        if (prevOwner === 'weekly') {
          const bounds = getPeriodBounds('weekly', prevDateStr);
          prevCycleId = `weekly_${bounds.start}_${bounds.end}`;
        } else if (prevOwner === 'monthly') {
          const bounds = getPeriodBounds('monthly', prevDateStr);
          prevCycleId = `monthly_${bounds.start}_${bounds.end}`;
        }
        if (prevCycleId === currentInfo.cycleId) {
          currentInfo.hasLeftConnection = true;
        }
      }
    }

    // Right connection:
    if (colIndex < 6) {
      const rightCell = cells[i + 1];
      if (rightCell && rightCell.dateStr) {
        const rightInfo = result[rightCell.dateStr];
        if (rightInfo && rightInfo.owner === currentInfo.owner && rightInfo.cycleId === currentInfo.cycleId) {
          currentInfo.hasRightConnection = true;
        }
      }
    } else if (colIndex === 6) {
      // Saturday - end of row. Check if next calendar day (Sunday) is in the same cycle!
      const nextDateStr = format(addDays(parseISO(cell.dateStr), 1), 'yyyy-MM-dd');
      let nextOwner: DateOwner;
      if (planChanges && planChanges.length > 0) {
        nextOwner = getDateOwner(planChanges, nextDateStr);
      } else {
        nextOwner = isBudgetModeEnabled ? fallbackCadence : 'paused';
      }

      if (nextOwner === currentInfo.owner) {
        let nextCycleId: string | null = null;
        if (nextOwner === 'weekly') {
          const bounds = getPeriodBounds('weekly', nextDateStr);
          nextCycleId = `weekly_${bounds.start}_${bounds.end}`;
        } else if (nextOwner === 'monthly') {
          const bounds = getPeriodBounds('monthly', nextDateStr);
          nextCycleId = `monthly_${bounds.start}_${bounds.end}`;
        }
        if (nextCycleId === currentInfo.cycleId) {
          currentInfo.hasRightConnection = true;
        }
      }
    }
  }

  return result;
}



// ─────────────────────────────────────────────────────────────────────────────
// Budget pools: ONE budget per calendar period (ADR 0012)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The "one budget per calendar period" rules (ADR 0012) apply from this date on.
 * Anything that started earlier keeps the old numbers: nobody's past Gullak / income is rewritten.
 */
export const BUDGET_RULES_V2_FROM = '2026-10-14';

/**
 * A weekly / monthly budget of ONE calendar period. However many times the user pauses (Pure Mode) and comes
 * back inside that period, it is still the same pool: spending (also in Pure Mode) uses it, and what is
 * left is what continues. The full budget is given once, when the pool starts.
 */
export interface BudgetPool {
  /** `${cadence}_${periodStart}` */
  key: string;
  cadence: 'weekly' | 'monthly';
  periodStart: string;
  periodEnd: string;
  /** Total of the pool: plan amount + the first-period carry-over. */
  budget: number;
  /** First day the pool was funded (budget mode on, this cadence). */
  startedOn: string;
  /**
   * Set when the user switched to ANOTHER cadence inside this period: whatever was left was carried to the new
   * cadence, so coming back to this cadence in the same period leaves nothing.
   */
  closedOn: string | null;
  /** The period ended while the user was in Pure Mode: what is left becomes income (Pure Mode has no Gullak). */
  endsInPure: boolean;
}

export const poolKeyFor = (cadence: 'weekly' | 'monthly', dateStr: string): string =>
  `${cadence}_${getPeriodBounds(cadence, dateStr).start}`;

/** All pools from the first weekly / monthly plan up to `upToDate` (inclusive). */
export function buildBudgetPools(changes: BudgetPlanChange[], upToDate: string): Record<string, BudgetPool> {
  const pools: Record<string, BudgetPool> = {};
  const relevant = (changes || []).filter((c) => c.isEnabled && (c.cadence === 'weekly' || c.cadence === 'monthly'));
  if (relevant.length === 0) return pools;
  const first = relevant.reduce((m, c) => (c.effectiveFrom < m ? c.effectiveFrom : m), relevant[0].effectiveFrom);
  if (first > upToDate) return pools;

  for (const day of eachDayOfInterval({ start: parseISO(first), end: parseISO(upToDate) })) {
    const d = format(day, 'yyyy-MM-dd');
    const plan = resolvePlanForDate(changes, d);
    if (!plan || !plan.isEnabled) continue; // Pure Mode never starts or closes a pool
    if (plan.cadence === 'weekly' || plan.cadence === 'monthly') {
      const b = getPeriodBounds(plan.cadence, d);
      const key = `${plan.cadence}_${b.start}`;
      if (!pools[key]) {
        pools[key] = {
          key,
          cadence: plan.cadence,
          periodStart: b.start,
          periodEnd: b.end,
          budget: round2((Number(plan.amount) || 0) + carryForPeriod(plan, b.start)),
          startedOn: d,
          closedOn: null,
          endsInPure: false,
        };
      }
    }
    // Another cadence is in charge today: every still-open pool covering today was handed over (carry-over).
    if (d >= BUDGET_RULES_V2_FROM) {
      for (const pool of Object.values(pools)) {
        if (pool.cadence !== plan.cadence && !pool.closedOn && d > pool.startedOn && d >= pool.periodStart && d <= pool.periodEnd) {
          pool.closedOn = d;
        }
      }
    }
  }
  for (const pool of Object.values(pools)) {
    if (pool.periodEnd <= upToDate && pool.periodEnd >= BUDGET_RULES_V2_FROM && !pool.closedOn) {
      const atEnd = resolvePlanForDate(changes, pool.periodEnd);
      pool.endsInPure = !!atEnd && !atEnd.isEnabled;
    }
  }
  return pools;
}

/**
 * Which pool does this date spend from? (null = none)
 *  - Budget Mode on with a weekly / monthly plan: that period's pool.
 *  - Pure Mode (paused) inside a period whose pool is still alive: the SAME pool.
 */
export function poolForDate(pools: Record<string, BudgetPool>, changes: BudgetPlanChange[], dateStr: string): BudgetPool | null {
  const plan = resolvePlanForDate(changes, dateStr);
  if (!plan || plan.cadence === 'daily') return null;
  const pool = pools[poolKeyFor(plan.cadence, dateStr)];
  if (!pool || dateStr < pool.startedOn) return null;
  if (!plan.isEnabled && pool.closedOn && dateStr >= pool.closedOn) return null;
  return pool;
}

/** Everything spent from `pool` on days in [pool.startedOn, beforeDate). */
export function poolSpentBefore(
  pools: Record<string, BudgetPool>,
  changes: BudgetPlanChange[],
  pool: BudgetPool,
  beforeDate: string,
  spentByDate: Record<string, number>
): number {
  let sum = 0;
  const end = beforeDate <= pool.periodEnd ? addDays(parseISO(beforeDate), -1) : parseISO(pool.periodEnd);
  if (parseISO(pool.startedOn) > end) return 0;
  for (const day of eachDayOfInterval({ start: parseISO(pool.startedOn), end })) {
    const d = format(day, 'yyyy-MM-dd');
    if (poolForDate(pools, changes, d)?.key === pool.key) sum += Number(spentByDate[d]) || 0;
  }
  return round2(sum);
}


// ─────────────────────────────────────────────────────────────────────────────
// Daily carry-over: weekly / monthly -> daily (ADR 0012)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What happens to the money left in a weekly / monthly budget when the user switches to DAILY.
 * (The same two stored values are used, no database change:  'additive' = ADD TO TOMORROW,
 *  'allocation' = SPREAD OVER DAYS.)
 *  - next_day : the first daily day's budget grows by the carried amount. What is not used goes to Gullak
 *               at the end of that day, like any daily leftover.
 *  - spread   : each daily day is paid from the carried money first (one daily budget per day) until it is
 *               used up; the user only has to put the rest into the bank.
 * The carried money is ALREADY in the user's bank (it was part of the old budget), so the notification tells the
 * user how much they still need to add today.
 */
export interface DailyCarryDay {
  mode: 'next_day' | 'spread';
  /** Extra budget added to this day (next_day only). */
  extraBudget: number;
  /** Part of today's budget paid from carried-over money. */
  funded: number;
  /** What the user still has to put into the bank today. */
  toAdd: number;
  /** Carried money left after this day. */
  remainingAfter: number;
  /** Today's normal daily budget (without the extra). */
  base: number;
}

export function dailyCarryForDate(
  changes: BudgetPlanChange[],
  recordBudgetFor: (dateStr: string) => number | undefined,
  fallbackDaily: number,
  dateStr: string
): DailyCarryDay | null {
  const plan = resolvePlanForDate(changes, dateStr);
  if (!plan || !plan.isEnabled || plan.cadence !== 'daily') return null;
  const carry = Number(plan.carriedOverAmount) || 0;
  if (!(carry > 0) || !plan.carryMode || plan.effectiveFrom < BUDGET_RULES_V2_FROM) return null;
  if (dateStr < plan.effectiveFrom) return null;

  if (plan.carryMode === 'additive') {
    if (dateStr !== plan.effectiveFrom) return null;
    const base = (Number(plan.amount) || 0) > 0 ? Number(plan.amount) : fallbackDaily;
    return { mode: 'next_day', extraBudget: carry, funded: carry, toAdd: round2(base), remainingAfter: 0, base: round2(base) };
  }

  let remaining = carry;
  let last: DailyCarryDay | null = null;
  for (const day of eachDayOfInterval({ start: parseISO(plan.effectiveFrom), end: parseISO(dateStr) })) {
    const d = format(day, 'yyyy-MM-dd');
    if (resolvePlanForDate(changes, d) !== plan) break; // another plan took over
    const a = Math.max(0, recordBudgetFor(d) ?? fallbackDaily);
    const funded = round2(Math.min(a, remaining));
    remaining = round2(remaining - funded);
    last = { mode: 'spread', extraBudget: 0, funded, toAdd: round2(a - funded), remainingAfter: remaining, base: round2(a) };
  }
  return last;
}

/** Carried money still unused at the END of `dateStr` (what a further cadence switch can still carry). */
export function dailyCarryRemaining(
  changes: BudgetPlanChange[],
  recordBudgetFor: (dateStr: string) => number | undefined,
  fallbackDaily: number,
  dateStr: string
): number {
  return dailyCarryForDate(changes, recordBudgetFor, fallbackDaily, dateStr)?.remainingAfter ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Period carry-over: weekly / monthly allocation (CAR-001 Mode B)
// ─────────────────────────────────────────────────────────────────────────────

export interface PeriodCarry {
  /** Part of this period's budget paid from carried-over money. */
  funded: number;
  /** What the user still has to add for this period. */
  toAdd: number;
  /** Carried money left after this period. */
  remainingAfter: number;
  /** The base period budget (plan amount). */
  base: number;
}

export function getNextPeriodStart(cadence: 'weekly' | 'monthly', currentStartStr: string): string {
  if (cadence === 'weekly') {
    return format(addDays(parseISO(currentStartStr), 7), 'yyyy-MM-dd');
  }
  return format(startOfMonth(addMonths(parseISO(currentStartStr), 1)), 'yyyy-MM-dd');
}

/**
 * CAR-001 Mode B: multi-period drawdown for weekly / monthly targets.
 * Let U = carriedOverAmount, B = plan amount.
 * For period k = 1, 2, 3...:
 *  - funded_k = min(B, remaining_{k-1})
 *  - toAdd_k = B - funded_k
 *  - remaining_k = remaining_{k-1} - funded_k
 * Loop stops if remaining reaches 0 or if another plan takes over.
 */
export function periodCarryForPeriod(
  changes: BudgetPlanChange[],
  periodStart: string
): PeriodCarry | null {
  if (!changes || changes.length === 0) return null;

  const eligiblePlans = changes.filter(
    (p) =>
      p.isEnabled &&
      (p.cadence === 'weekly' || p.cadence === 'monthly') &&
      p.carryMode === 'allocation' &&
      Number(p.carriedOverAmount) > 0 &&
      Number(p.amount) > 0 &&
      p.effectiveFrom >= BUDGET_RULES_V2_FROM
  );
  if (eligiblePlans.length === 0) return null;

  const sorted = [...eligiblePlans].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

  for (const plan of sorted) {
    const p1Bounds = getPeriodBounds(plan.cadence, plan.effectiveFrom);
    const p1Start = p1Bounds.start;

    if (periodStart < p1Start) continue;

    let remaining = Number(plan.carriedOverAmount) || 0;
    const B = Number(plan.amount) || 0;
    if (!(B > 0)) continue;
    let currentStart = p1Start;

    while (remaining > 0) {
      const bounds = getPeriodBounds(plan.cadence, currentStart);
      if (currentStart > p1Start && resolvePlanForDate(changes, currentStart) !== plan) {
        break;
      }

      const funded = round2(Math.min(B, remaining));
      const toAdd = round2(B - funded);
      const remainingAfter = round2(remaining - funded);

      if (currentStart === periodStart || (periodStart >= bounds.start && periodStart <= bounds.end)) {
        return { funded, toAdd, remainingAfter, base: B };
      }

      remaining = remainingAfter;
      if (remaining <= 0) break;
      currentStart = getNextPeriodStart(plan.cadence as 'weekly' | 'monthly', currentStart);
    }
  }

  return null;
}

/**
 * Carried money still unused at the END of `dateStr` for weekly / monthly allocation plans.
 */
export function periodCarryRemaining(changes: BudgetPlanChange[], dateStr: string): number {
  const plan = resolvePlanForDate(changes, dateStr);
  if (!plan || !plan.isEnabled || (plan.cadence !== 'weekly' && plan.cadence !== 'monthly')) return 0;
  if (plan.carryMode !== 'allocation') return 0;
  const carry = Number(plan.carriedOverAmount) || 0;
  if (carry <= 0 || plan.effectiveFrom < BUDGET_RULES_V2_FROM) return 0;
  if (dateStr < plan.effectiveFrom) return 0;
  const B = Number(plan.amount) || 0;
  if (!(B > 0)) return 0;

  const p1Bounds = getPeriodBounds(plan.cadence, plan.effectiveFrom);
  const p1Start = p1Bounds.start;
  let remaining = carry;
  let currentStart = p1Start;

  while (remaining > 0) {
    const bounds = getPeriodBounds(plan.cadence, currentStart);
    if (currentStart > p1Start && resolvePlanForDate(changes, currentStart) !== plan) {
      break;
    }
    const funded = round2(Math.min(B, remaining));
    const remainingAfter = round2(remaining - funded);

    if (dateStr >= bounds.start && dateStr <= bounds.end) {
      return remainingAfter;
    }

    remaining = remainingAfter;
    if (remaining <= 0) break;
    currentStart = getNextPeriodStart(plan.cadence as 'weekly' | 'monthly', currentStart);
  }

  return 0;
}
