import { format } from 'date-fns/format';
import { subDays } from 'date-fns/subDays';
import { parseISO } from 'date-fns/parseISO';
import { formatCurrency, round2 } from './formatters';
import { resolvePlanForDate } from './budgetPeriods';
import type { BudgetPlanChange } from '../types';
import type { DailyRecord } from './budgetCalculations';

export interface ShouldDeletePhantom500DayParams {
  date: string;
  yesterdayStr: string;
  daySpent: number;
  spentOnDate?: number;
  rawLogBudget: number | null;
  rawLogSaved: number;
  localRecord?: { budget?: number } | null;
  resolvedAutoRenew: boolean;
  resolvedBudget: number;
}

/**
 * Pure decision function: determines whether a daily_savings_log entry is considered
 * a phantom 500 record left behind by historical bugs.
 *
 * A legitimate user record with budget = 500 is preserved (not deleted).
 */
export function shouldDeletePhantom500Day(params: ShouldDeletePhantom500DayParams): boolean {
  const {
    date,
    yesterdayStr,
    daySpent,
    spentOnDate,
    rawLogBudget,
    rawLogSaved,
    localRecord,
    resolvedAutoRenew,
    resolvedBudget,
  } = params;

  return (
    daySpent === 0 &&
    !spentOnDate &&
    (rawLogBudget === 500 || rawLogSaved === 500) &&
    (!localRecord || localRecord.budget === 0) &&
    (date !== yesterdayStr || !resolvedAutoRenew || resolvedBudget <= 0)
  );
}

export interface ResolveHydratedDayBudgetParams {
  rawLogBudget: number | null;
  localRecordBudget?: number | null;
  resolvedBudget: number;
}

/**
 * Pure decision function: determines the effective daily budget during hydration
 * across three tiers:
 *   1. Supabase raw log (`budget_amount`)
 *   2. Local store record (`records[d].budget`)
 *   3. Resolved user profile budget (`resolvedBudget`)
 *
 * A budget of 500 is treated like any other valid number across all three tiers.
 */
export function resolveHydratedDayBudget(params: ResolveHydratedDayBudgetParams): number {
  const { rawLogBudget, localRecordBudget, resolvedBudget } = params;

  if (rawLogBudget !== null && rawLogBudget > 0) {
    // Explicit custom budget saved for this day in Supabase log
    return rawLogBudget;
  } else if (localRecordBudget && localRecordBudget > 0) {
    // Local store has the real custom budget
    return localRecordBudget;
  } else if (resolvedBudget > 0) {
    // User profile daily budget
    return resolvedBudget;
  } else {
    return 0;
  }
}

/**
 * Pure decision function: determines the budget to lock for an existing
 * past day record during checkAndRollover.
 *
 * A recorded past budget is the user's real historical data and is preserved
 * as-is without rewriting.
 */
export function resolveRolloverBudget(
  existingBudget: number,
  _currentDailyBudget: number
): number {
  return existingBudget;
}

export interface BackdatedSpendingNoticeParams {
  selectedDate: Date;
  todayStr: string;
  isBudgetModeEnabled: boolean;
  planChanges: BudgetPlanChange[];
  dailyRecords?: Record<string, DailyRecord>;
  evaluatedAmount: number;
  totalVaultLiquidity: number;
  totalAccumulatedSavings: number;
}

export interface BackdatedSpendingNotice {
  dayName: string;
  isUngoverned: boolean;
  hasShortfall: boolean;
  shortfallAmount: number;
  availableLiquidity: number;
  gullakAvailable: number;
  title: string;
  description: string;
}

/**
 * Pure helper for backdated expense logging (FIN-01 / UX Transparency).
 * Detects if a past date had no active budget or unspent funds, and calculates
 * whether the expense can be drawn from Gullak or has a shortfall requiring Vault Guard.
 */
export function getBackdatedSpendingNotice(
  params: BackdatedSpendingNoticeParams
): BackdatedSpendingNotice | null {
  const {
    selectedDate,
    todayStr,
    isBudgetModeEnabled,
    planChanges,
    dailyRecords,
    evaluatedAmount,
    totalVaultLiquidity,
    totalAccumulatedSavings,
  } = params;

  if (!isBudgetModeEnabled) return null;

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  if (selectedDateStr >= todayStr) return null;

  // Determine if selectedDateStr had an active budget
  const plan = resolvePlanForDate(planChanges || [], selectedDateStr);
  let hasBudget = false;

  if (plan && plan.isEnabled) {
    if (plan.cadence === 'daily') {
      const rec = dailyRecords ? dailyRecords[selectedDateStr] : undefined;
      hasBudget = Boolean(rec && rec.status !== 'unknown' && Number(rec.budget) > 0);
    } else {
      hasBudget = Boolean(Number(plan.amount) > 0);
    }
  }

  if (hasBudget) return null;

  const yesterdayStr = format(subDays(parseISO(todayStr), 1), 'yyyy-MM-dd');
  const dayName = selectedDateStr === yesterdayStr ? 'Yesterday' : format(selectedDate, 'EEEE');
  const availableLiquidity = Math.max(0, totalVaultLiquidity || 0);
  const gullakAvailable = Math.max(0, totalAccumulatedSavings || 0);
  const effectiveAvailable = Math.min(availableLiquidity, gullakAvailable);

  const numAmount = evaluatedAmount > 0 ? evaluatedAmount : 0;
  const hasShortfall = numAmount > availableLiquidity || availableLiquidity <= 0;
  const shortfallAmount = hasShortfall ? round2(Math.max(0, numAmount - availableLiquidity)) : 0;

  let title = '';
  let description = '';

  if (availableLiquidity <= 0) {
    title = `${dayName} had no budget · Balance ₹0`;
    description = `Your vault balance is ₹0. Please add money first to log this expense.`;
  } else if (hasShortfall) {
    title = `${dayName} had no budget · ${formatCurrency(shortfallAmount)} short`;
    description = `You only have ${formatCurrency(effectiveAvailable)} in Gullak. Add ${formatCurrency(shortfallAmount)} to log this expense.`;
  } else {
    title = `${dayName} had no active budget`;
    if (numAmount > 0) {
      description = `${formatCurrency(numAmount)} will be drawn from your Gullak (${formatCurrency(gullakAvailable)} available).`;
    } else {
      description = `Expenses on this date will be drawn from your Gullak (${formatCurrency(gullakAvailable)} available).`;
    }
  }

  return {
    dayName,
    isUngoverned: true,
    hasShortfall,
    shortfallAmount,
    availableLiquidity,
    gullakAvailable,
    title,
    description,
  };
}

