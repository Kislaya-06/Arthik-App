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
  };
}
