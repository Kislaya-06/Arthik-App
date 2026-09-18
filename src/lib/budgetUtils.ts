/**
 * Pure helper functions for daily budget hydration, phantom row detection,
 * and budget resolution.
 *
 * Extracted from src/store/dailyBudgetStore.ts to make the decision logic
 * pure and testable without storage, store state, or network I/O.
 */

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
