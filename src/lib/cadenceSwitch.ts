import { parseISO, addDays, format, differenceInCalendarDays } from 'date-fns';
import { BudgetCadence } from '../types';
import { getPeriodBounds } from './budgetPeriods';
import { formatAmountWithCommas } from './formatters';

export type CadenceCarryMode = 'additive' | 'allocation';

export interface CadenceSwitchValidation {
  isExceeding: boolean;
  remainingCapacity: number;
  remainingDays: number;
  maxSafeWeeklyAmount?: number;
  maxSafeDailyAmount?: number;
  warningMessage?: string;
}

export interface CadenceCarryCalculation {
  carriedAmount: number;
  effectiveBudgetPool: number;
  allocatedHeadstart: number;
  mode: CadenceCarryMode;
}

export interface CadenceAllocationSummary {
  fullPeriods: number;
  partialFunded: number;
  partialGap: number;
  unit: 'day' | 'week' | 'month';
  coverText: string;
}

export function computeAllocationSummary(
  targetCadence: BudgetCadence,
  targetAmount: number,
  unspentAmount: number
): CadenceAllocationSummary {
  const unit: 'day' | 'week' | 'month' = targetCadence === 'daily' ? 'day' : targetCadence === 'weekly' ? 'week' : 'month';
  const unitPlural = targetCadence === 'daily' ? 'days' : targetCadence === 'weekly' ? 'weeks' : 'months';

  const B = Math.max(0, targetAmount);
  const U = Math.max(0, unspentAmount);

  if (!(B > 0) || !(U > 0)) {
    return {
      fullPeriods: 0,
      partialFunded: 0,
      partialGap: 0,
      unit,
      coverText: '',
    };
  }

  const full = Math.floor(U / B);
  const part = Math.round((U - full * B) * 100) / 100;
  const gap = part > 0 ? Math.round((B - part) * 100) / 100 : 0;

  let coverText = '';
  if (full === 0) {
    coverText = `₹${formatAmountWithCommas(String(part))} of your first ${unit}`;
  } else {
    const countStr = `${full} ${full === 1 ? unit : unitPlural}`;
    coverText = part > 0 ? `${countStr}, then ₹${formatAmountWithCommas(String(part))} of ${unit} ${full + 1}` : countStr;
  }

  return {
    fullPeriods: full,
    partialFunded: part,
    partialGap: gap,
    unit,
    coverText,
  };
}

export interface CadenceSwitchPlan {
  currentCadence: BudgetCadence;
  targetCadence: BudgetCadence;
  effectiveFrom: string; // 'yyyy-MM-dd' (Tomorrow)
  todayStr: string;
  unspentAmount: number;
  carriedAmount: number;
  carryMode: CadenceCarryMode;
  targetBudgetAmount: number;
  effectiveBudgetPool: number;
  gullakDeposit: 0;
  validation: CadenceSwitchValidation;
  allocationSummary?: CadenceAllocationSummary;
}

/**
 * Calculates remaining days in the active period starting from tomorrow (the effective switch date).
 */
export function getRemainingDaysInCurrentPeriod(
  currentCadence: BudgetCadence,
  todayStr: string
): number {
  const tomorrow = addDays(parseISO(todayStr), 1);

  if (currentCadence === 'daily') {
    return 1;
  }

  const bounds = getPeriodBounds(currentCadence, todayStr);
  const diff = differenceInCalendarDays(parseISO(bounds.end), tomorrow) + 1;
  return Math.max(1, diff);
}

/**
 * Checks if target weekly/daily budget exceeds remaining monthly/weekly capacity.
 * Used for Audio Clip 2 edge case:
 * E.g. Monthly budget has ₹18,000 left with 12 days remaining. Setting ₹15,000/week exceeds capacity.
 */
export function checkCadenceCapacity(params: {
  currentCadence: BudgetCadence;
  currentRemaining: number;
  remainingDays: number;
  targetCadence: BudgetCadence;
  targetAmount: number;
}): CadenceSwitchValidation {
  const { currentCadence, currentRemaining, remainingDays, targetCadence, targetAmount } = params;

  const remaining = Math.max(0, currentRemaining);
  const days = Math.max(1, remainingDays);

  if (currentCadence === 'monthly' && targetCadence === 'weekly') {
    const remainingWeeks = days / 7;
    const requiredForRemainingPeriod = targetAmount * remainingWeeks;
    const isExceeding = requiredForRemainingPeriod > remaining && remaining > 0;
    const maxSafeWeeklyAmount = Math.max(0, Math.floor(remaining / remainingWeeks));

    return {
      isExceeding,
      remainingCapacity: remaining,
      remainingDays: days,
      maxSafeWeeklyAmount,
      warningMessage: isExceeding
        ? `Your remaining monthly budget is ₹${formatAmountWithCommas(String(remaining))} for ${days} days. Setting ₹${formatAmountWithCommas(String(targetAmount))}/week requires approx ₹${formatAmountWithCommas(String(Math.round(requiredForRemainingPeriod)))}, which exceeds your available allowance.`
        : undefined,
    };
  }

  if (currentCadence === 'monthly' && targetCadence === 'daily') {
    const requiredForRemainingPeriod = targetAmount * days;
    const isExceeding = requiredForRemainingPeriod > remaining && remaining > 0;
    const maxSafeDailyAmount = Math.max(0, Math.floor(remaining / days));

    return {
      isExceeding,
      remainingCapacity: remaining,
      remainingDays: days,
      maxSafeDailyAmount,
      warningMessage: isExceeding
        ? `Your remaining monthly budget is ₹${formatAmountWithCommas(String(remaining))} for ${days} days. Setting ₹${formatAmountWithCommas(String(targetAmount))}/day requires ₹${formatAmountWithCommas(String(Math.round(requiredForRemainingPeriod)))}, which exceeds your available allowance.`
        : undefined,
    };
  }

  if (currentCadence === 'weekly' && targetCadence === 'daily') {
    const required = targetAmount * days;
    const isExceeding = required > remaining && remaining > 0;
    const maxSafeDailyAmount = Math.max(0, Math.floor(remaining / days));

    return {
      isExceeding,
      remainingCapacity: remaining,
      remainingDays: days,
      maxSafeDailyAmount,
      warningMessage: isExceeding
        ? `Your remaining weekly budget is ₹${formatAmountWithCommas(String(remaining))} for ${days} days. Setting ₹${formatAmountWithCommas(String(targetAmount))}/day exceeds your current weekly pool.`
        : undefined,
    };
  }

  return {
    isExceeding: false,
    remainingCapacity: remaining,
    remainingDays: days,
  };
}

/**
 * Computes how carried-over funds integrate into the new cadence pool.
 * Option A (Additive Pool): Carried funds are added on top of the target budget.
 * Option B (Remaining Allocation): Carried funds act as a headstart toward the target budget.
 * Overspent amounts yield 0 carry-forward (deficits are settled via real income/savings).
 */
export function calculateCadenceCarryForward(params: {
  unspentAmount: number;
  targetBudget: number;
  carryMode: CadenceCarryMode;
}): CadenceCarryCalculation {
  const { unspentAmount, targetBudget, carryMode } = params;

  // Deficits or zero unspent yield clean 0 carry forward
  if (unspentAmount <= 0) {
    return {
      carriedAmount: 0,
      effectiveBudgetPool: targetBudget,
      allocatedHeadstart: 0,
      mode: carryMode,
    };
  }

  const carried = Math.round(unspentAmount * 100) / 100;
  const target = Math.max(0, Math.round(targetBudget * 100) / 100);

  if (carryMode === 'additive') {
    return {
      carriedAmount: carried,
      effectiveBudgetPool: Math.round((target + carried) * 100) / 100,
      allocatedHeadstart: 0,
      mode: 'additive',
    };
  }

  // Allocation mode
  return {
    carriedAmount: carried,
    effectiveBudgetPool: target,
    allocatedHeadstart: Math.min(target, carried),
    mode: 'allocation',
  };
}

/**
 * Builds a complete CadenceSwitchPlan adhering to all 8 Audio clips:
 * - Next-day activation (tomorrow 00:00:00)
 * - Zero Gullak deposit
 * - Carry forward mode & calculation
 * - Capacity validation
 */
export function buildCadenceSwitchPlan(params: {
  currentCadence: BudgetCadence;
  targetCadence: BudgetCadence;
  currentBudget: number;
  currentSpent: number;
  targetAmount: number;
  carryMode: CadenceCarryMode;
  todayStr: string;
}): CadenceSwitchPlan {
  const {
    currentCadence,
    targetCadence,
    currentBudget,
    currentSpent,
    targetAmount,
    carryMode,
    todayStr,
  } = params;

  const tomorrow = addDays(parseISO(todayStr), 1);
  const effectiveFrom = format(tomorrow, 'yyyy-MM-dd');

  const unspentRaw = currentBudget - currentSpent;
  const unspentAmount = Math.max(0, Math.round(unspentRaw * 100) / 100);

  const remainingDays = getRemainingDaysInCurrentPeriod(currentCadence, todayStr);

  const validation = checkCadenceCapacity({
    currentCadence,
    currentRemaining: unspentAmount,
    remainingDays,
    targetCadence,
    targetAmount,
  });

  const carryCalc = calculateCadenceCarryForward({
    unspentAmount,
    targetBudget: targetAmount,
    carryMode,
  });

  const allocationSummary = computeAllocationSummary(targetCadence, targetAmount, unspentAmount);

  return {
    currentCadence,
    targetCadence,
    effectiveFrom,
    todayStr,
    unspentAmount,
    carriedAmount: carryCalc.carriedAmount,
    carryMode,
    targetBudgetAmount: targetAmount,
    effectiveBudgetPool: carryCalc.effectiveBudgetPool,
    gullakDeposit: 0,
    validation,
    allocationSummary,
  };
}
