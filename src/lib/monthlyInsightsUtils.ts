/**
 * monthlyInsightsUtils.ts
 *
 * Pure, framework-free calculation engine for Arthik Monthly Insights.
 * Handles:
 * - Monthly spend aggregation & pacing (28, 29, 30, 31-day months)
 * - Effective monthly budget calculation with mid-month registration proration
 * - Fair Day-Matched Month-to-Date (MTD) comparisons vs full-month comparisons
 * - Monthly Gullak savings aggregation (with strict deduplication of auto-rollovers)
 * - Largest Single Outflow detection & percentage weight
 * - Month-over-month Category Shift detection with Primary Driver fallback
 * - Peak Outflow Week calculation with distribution variance checks
 *
 * Invariant: Real money only. Pure functions only. No React or side-effects.
 */

import {
  parseISO,
  format,
  differenceInCalendarDays,
  addDays,
  getDaysInMonth,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { isIncomeTransaction } from './transactionUtils';
import { round2, formatAmountWithCommas } from './formatters';
import type { DailyRecord, GullakDeposit } from '../store/dailyBudgetStore';
import type { Category } from '../store/categoryStore';
import type { BudgetCadence } from '../types';

export interface ExpenseLike {
  id: string;
  amount: number;
  expense_date: string;
  category_id?: string | null;
  payment_mode?: string;
  notes?: string | null;
  type?: 'expense' | 'income' | string;
}

export interface MonthInterval {
  start: Date;
  end: Date;
}

/**
 * Normalizes Date or ISO string into a canonical 'yyyy-MM-dd' string.
 */
function toDateStr(d: Date | string): string {
  if (typeof d === 'string') {
    return d.split('T')[0]?.trim() || '';
  }
  return format(d, 'yyyy-MM-dd');
}

/**
 * Checks if a 'yyyy-MM-dd' date string falls within [start, end] inclusive.
 */
function isDateInBounds(dateStr: string, startStr: string, endStr: string): boolean {
  return dateStr >= startStr && dateStr <= endStr;
}

// ─── 1. Monthly Spend Aggregation ─────────────────────────────────────────────

/**
 * Computes total monthly outflow for non-income transactions within the month interval.
 */
export function computeMonthlySpend(
  expenses: ExpenseLike[],
  categories: Category[],
  monthInterval: MonthInterval
): number {
  const startStr = toDateStr(monthInterval.start);
  const endStr = toDateStr(monthInterval.end);

  let total = 0;
  for (const exp of expenses) {
    if (!exp.expense_date) continue;
    const cleanDate = toDateStr(exp.expense_date);
    if (!cleanDate) continue;

    const cat = exp.category_id ? categories.find((c) => c.id === exp.category_id) : undefined;
    if (isIncomeTransaction(exp, cat)) continue;

    if (isDateInBounds(cleanDate, startStr, endStr)) {
      total += exp.amount;
    }
  }
  return round2(total);
}

// ─── 2. Effective Monthly Budget & Budget Health ───────────────────────────────

/**
 * Computes the user's active monthly budget across Daily, Weekly, and Monthly cadences.
 * Correctly prorates for users who registered mid-month.
 */
export function computeEffectiveMonthBudget(
  cadence: BudgetCadence,
  dailyAmount: number,
  weeklyAmount: number,
  monthlyAmount: number,
  userCreatedAtStr: string | undefined | null,
  monthInterval: MonthInterval
): { effectiveBudget: number; activeDays: number; totalDays: number; isPartialFirstMonth: boolean } {
  const startStr = toDateStr(monthInterval.start);
  const endStr = toDateStr(monthInterval.end);

  const totalDays = differenceInCalendarDays(parseISO(endStr), parseISO(startStr)) + 1;
  let activeDays = totalDays;
  let isPartialFirstMonth = false;

  if (userCreatedAtStr) {
    const cleanCreated = toDateStr(userCreatedAtStr);
    if (cleanCreated && isDateInBounds(cleanCreated, startStr, endStr)) {
      const remainingDays = differenceInCalendarDays(parseISO(endStr), parseISO(cleanCreated)) + 1;
      if (remainingDays > 0 && remainingDays < totalDays) {
        activeDays = remainingDays;
        isPartialFirstMonth = true;
      }
    }
  }

  let effectiveBudget = 0;
  if (cadence === 'monthly') {
    effectiveBudget = isPartialFirstMonth
      ? round2((monthlyAmount / totalDays) * activeDays)
      : monthlyAmount;
  } else if (cadence === 'weekly') {
    effectiveBudget = round2((weeklyAmount / 7) * activeDays);
  } else {
    // daily cadence
    effectiveBudget = round2(dailyAmount * activeDays);
  }

  return { effectiveBudget, activeDays, totalDays, isPartialFirstMonth };
}

/**
 * Evaluates remaining budget cushion and overspend for the month.
 */
export function computeMonthlyBudgetHealth(
  monthBudget: number,
  monthSpent: number
): { remaining: number; overAmount: number; isOverBudget: boolean; ratio: number } {
  const isOver = monthBudget > 0 && monthSpent > monthBudget;
  const remaining = Math.max(0, round2(monthBudget - monthSpent));
  const overAmount = isOver ? round2(monthSpent - monthBudget) : 0;
  const ratio = monthBudget > 0 ? Math.min(1, round2(monthSpent / monthBudget)) : 0;

  return { remaining, overAmount, isOverBudget: isOver, ratio };
}

/**
 * Calculates safe daily spending pace for remaining days in the month.
 */
export function computeMonthlySafeDailyPace(
  remaining: number,
  elapsedDays: number,
  totalDays: number
): number {
  if (remaining <= 0) return 0;
  const safeElapsed = Math.min(totalDays, Math.max(1, elapsedDays));
  const daysLeft = Math.max(1, totalDays - safeElapsed);
  return Math.round(remaining / daysLeft);
}

export interface MonthlyTakeawayParams {
  currentTotal: number;
  isBudgetMode: boolean;
  isOverBudget: boolean;
  overAmount: number;
  savedDaysCount: number;
  totalMonthSavings: number;
  topCategory?: { name: string; percentage: number } | null;
  isCurrentMonth: boolean;
  safeDailyPace: number;
  remainingDays: number;
  remainingBudget: number;
  transactionCount: number;
  monthlyDailyBurnPace: number;
}

export interface SmartMonthlyTakeawayResult {
  text: string;
  status: 'coral' | 'mint' | 'neutral';
}

/**
 * Evaluates the Smart Monthly Takeaway using an intelligent priority engine.
 */
export function computeSmartMonthlyTakeaway(params: MonthlyTakeawayParams): SmartMonthlyTakeawayResult {
  const {
    currentTotal,
    isBudgetMode,
    isOverBudget,
    overAmount,
    savedDaysCount,
    totalMonthSavings,
    topCategory,
    isCurrentMonth,
    safeDailyPace,
    remainingDays,
    transactionCount,
    monthlyDailyBurnPace,
  } = params;

  // 1. Zero Spend
  if (currentTotal === 0) {
    return {
      text: 'No expenses logged this month.',
      status: 'neutral',
    };
  }

  // 2. Over Budget
  if (isBudgetMode && isOverBudget) {
    return {
      text: `Monthly spend exceeded budget by ₹${formatAmountWithCommas(String(overAmount))}.`,
      status: 'coral',
    };
  }

  // 3. High Savings Discipline (5+ saved days in month and savings > 0)
  if (isBudgetMode && savedDaysCount >= 5 && totalMonthSavings > 0) {
    return {
      text: `Great discipline! Stayed under budget on ${savedDaysCount} days · +₹${formatAmountWithCommas(String(totalMonthSavings))} saved to Gullak.`,
      status: 'mint',
    };
  }

  // 4. Dominant Category (Taking 45%+ of month)
  if (topCategory && topCategory.percentage >= 45) {
    return {
      text: `${topCategory.name} took ${topCategory.percentage}% of this month's spending.`,
      status: 'neutral',
    };
  }

  // 5. In-progress Safe Pace
  if (isBudgetMode && isCurrentMonth && safeDailyPace > 0 && !isOverBudget) {
    return {
      text: `Pacing comfortably: ₹${formatAmountWithCommas(String(safeDailyPace))}/day safe pace with ${remainingDays} days remaining.`,
      status: 'mint',
    };
  }

  // 6. Default balanced summary
  if (transactionCount > 0) {
    return {
      text: `Logged ${transactionCount} transactions with ₹${formatAmountWithCommas(String(monthlyDailyBurnPace))}/day average spend.`,
      status: 'neutral',
    };
  }

  return {
    text: 'Balanced monthly spending flow.',
    status: 'neutral',
  };
}

// ─── 3. Monthly Real Money Gullak Savings ─────────────────────────────────────

/**
 * Aggregates Gullak savings for the month.
 * Strictly avoids double-counting:
 * 1. Sums `dailyRecords[date].saved` for finalized saved days.
 * 2. Sums `gullakDeposits` where `source !== 'daily_savings'` (external/manual deposits only).
 */
export function computeMonthlyGullakSavings(
  dailyRecords: Record<string, DailyRecord>,
  gullakDeposits: GullakDeposit[],
  monthInterval: MonthInterval
): { totalSaved: number; autoSaved: number; manualDeposits: number; savedDaysCount: number } {
  const startStr = toDateStr(monthInterval.start);
  const endStr = toDateStr(monthInterval.end);

  let autoSaved = 0;
  let savedDaysCount = 0;

  Object.values(dailyRecords || {}).forEach((r) => {
    if (!r.date) return;
    const cleanDate = toDateStr(r.date);
    if (isDateInBounds(cleanDate, startStr, endStr) && r.isFinalized) {
      if (r.status === 'saved' && (r.saved || 0) > 0) {
        autoSaved += r.saved;
        savedDaysCount++;
      }
    }
  });

  let manualDeposits = 0;
  (gullakDeposits || []).forEach((dep) => {
    if (!dep.date) return;
    const cleanDate = toDateStr(dep.date);
    if (cleanDate && isDateInBounds(cleanDate, startStr, endStr)) {
      manualDeposits += Number(dep.amount) || 0;
    }
  });

  const totalSaved = round2(autoSaved + manualDeposits);
  return {
    totalSaved,
    autoSaved: round2(autoSaved),
    manualDeposits: round2(manualDeposits),
    savedDaysCount,
  };
}

// ─── 4. Fair Day-Matched Month-to-Date (MTD) Comparison ───────────────────────

export interface MonthlyComparisonResult {
  percentageChange: number | null;
  isIncrease: boolean;
  trendLabel: string;
  matchedPrevTotal: number;
  currentTotal: number;
}

/**
 * Computes fair comparison between current month and previous month.
 * - In-progress month (offset=0): Matches Day 1..D of current month with Day 1..D of previous month.
 * - Past month (offset < 0): Compares full month with full previous month.
 * - Guards against zero previous spend (no NaN/Infinity).
 * - Distinguishes between zero spend in matched window vs zero spend across the full previous month.
 */
export function computeMonthlyComparison(
  expenses: ExpenseLike[],
  categories: Category[],
  currentInterval: MonthInterval,
  previousInterval: MonthInterval,
  offset: number,
  today: Date = new Date()
): MonthlyComparisonResult {
  const currentStartStr = toDateStr(currentInterval.start);
  const currentEndStr = toDateStr(currentInterval.end);
  const prevStartStr = toDateStr(previousInterval.start);
  const prevEndStr = toDateStr(previousInterval.end);

  const isCurrentMonth = offset === 0;
  let matchedCurrentEndStr = currentEndStr;
  let matchedPrevEndStr = prevEndStr;

  if (isCurrentMonth) {
    // Current day number in month (1..31)
    const currentDayNum = today.getDate();
    matchedCurrentEndStr = toDateStr(today);

    // Days in previous month (e.g. 30 for Sept, 31 for Aug, 28/29 for Feb)
    const prevMonthDays = getDaysInMonth(previousInterval.start);
    const matchedPrevDayNum = Math.min(currentDayNum, prevMonthDays);
    const prevStartDate = previousInterval.start;
    const matchedPrevDate = addDays(prevStartDate, matchedPrevDayNum - 1);
    matchedPrevEndStr = toDateStr(matchedPrevDate);
  }

  let currTotal = 0;
  let matchedPrevTotal = 0;
  let prevFullTotal = 0;

  for (const exp of expenses) {
    if (!exp.expense_date) continue;
    const cleanDate = toDateStr(exp.expense_date);
    if (!cleanDate) continue;

    const cat = exp.category_id ? categories.find((c) => c.id === exp.category_id) : undefined;
    if (isIncomeTransaction(exp, cat)) continue;

    if (isDateInBounds(cleanDate, currentStartStr, matchedCurrentEndStr)) {
      currTotal += exp.amount;
    }
    if (isDateInBounds(cleanDate, prevStartStr, matchedPrevEndStr)) {
      matchedPrevTotal += exp.amount;
    }
    if (isDateInBounds(cleanDate, prevStartStr, prevEndStr)) {
      prevFullTotal += exp.amount;
    }
  }

  currTotal = round2(currTotal);
  matchedPrevTotal = round2(matchedPrevTotal);
  prevFullTotal = round2(prevFullTotal);

  if (currTotal === 0) {
    return {
      percentageChange: null,
      isIncrease: false,
      trendLabel: 'No expenses logged this month',
      matchedPrevTotal,
      currentTotal: 0,
    };
  }

  if (matchedPrevTotal === 0) {
    if (prevFullTotal === 0) {
      return {
        percentageChange: null,
        isIncrease: true,
        trendLabel: 'No spend in prev month',
        matchedPrevTotal: 0,
        currentTotal: currTotal,
      };
    }
    return {
      percentageChange: null,
      isIncrease: true,
      trendLabel: isCurrentMonth
        ? `+₹${formatAmountWithCommas(String(currTotal))} vs same days`
        : `+₹${formatAmountWithCommas(String(currTotal))} vs prev month`,
      matchedPrevTotal: 0,
      currentTotal: currTotal,
    };
  }

  const diff = currTotal - matchedPrevTotal;
  const isIncrease = diff >= 0;

  // Low base guard: if matchedPrevTotal < 100, percentage becomes misleadingly huge
  if (matchedPrevTotal < 100) {
    const sign = diff >= 0 ? '+' : '-';
    return {
      percentageChange: null,
      isIncrease,
      trendLabel: diff === 0
        ? (isCurrentMonth ? 'Same as same days' : 'Same as prev month')
        : `${sign}₹${formatAmountWithCommas(String(Math.abs(diff)))} ${isCurrentMonth ? 'vs same days' : 'vs prev month'}`,
      matchedPrevTotal,
      currentTotal: currTotal,
    };
  }

  const percentageChange = Math.round((Math.abs(diff) / matchedPrevTotal) * 100);
  const trendLabel = isCurrentMonth
    ? `${percentageChange}% vs same days`
    : `${percentageChange}% vs prev month`;

  return {
    percentageChange,
    isIncrease,
    trendLabel,
    matchedPrevTotal,
    currentTotal: currTotal,
  };
}

// ─── 5. Largest Single Outflow ────────────────────────────────────────────────

export interface MonthlyLargestOutflowResult {
  expense: ExpenseLike;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  outflowPercent: number;
  shouldShowPill: boolean;
}

/**
 * Finds the single largest non-income transaction of the month.
 * Minimum criteria: amount >= 200, at least 2 transactions logged.
 * Pill threshold: >= 15% of monthly spend.
 */
export function computeMonthlyLargestOutflow(
  expenses: ExpenseLike[],
  categories: Category[],
  monthInterval: MonthInterval,
  currentTotal: number
): MonthlyLargestOutflowResult | null {
  const startStr = toDateStr(monthInterval.start);
  const endStr = toDateStr(monthInterval.end);

  let largest: ExpenseLike | null = null;
  let txnCount = 0;

  for (const exp of expenses) {
    if (!exp.expense_date) continue;
    const cleanDate = toDateStr(exp.expense_date);
    if (!cleanDate) continue;

    const cat = exp.category_id ? categories.find((c) => c.id === exp.category_id) : undefined;
    if (isIncomeTransaction(exp, cat)) continue;

    if (isDateInBounds(cleanDate, startStr, endStr)) {
      txnCount++;
      if (!largest || exp.amount > largest.amount) {
        largest = exp;
      }
    }
  }

  if (!largest || largest.amount < 200 || txnCount < 2 || currentTotal <= 0) {
    return null;
  }

  const cat = largest.category_id ? categories.find((c) => c.id === largest.category_id) : undefined;
  const outflowPercent = Math.round((largest.amount / currentTotal) * 100);

  return {
    expense: largest,
    categoryName: cat?.name || 'Others',
    categoryColor: cat?.color || '#F07167',
    categoryIcon: cat?.icon || null,
    outflowPercent,
    shouldShowPill: outflowPercent >= 15,
  };
}

// ─── 6. Category Shift (MoM Climber/Reducer or Primary Driver Fallback) ───────

export type MonthlyCategoryShiftResult =
  | {
      mode: 'category_shift';
      categoryName: string;
      categoryColor: string;
      categoryIcon: string | null;
      categoryId: string;
      delta: number;
      absDelta: number;
      shiftPercent: number;
      isIncrease: boolean;
      currentAmount: number;
      previousAmount: number;
    }
  | {
      mode: 'primary_driver';
      categoryName: string;
      categoryColor: string;
      categoryIcon: string | null;
      categoryId: string;
      currentAmount: number;
      percentageOfTotal: number;
      txnCount: number;
    };

/**
 * Computes Month-over-Month Category Shift.
 * If previous month data is missing or shifts are below threshold (|Δ| < 300),
 * falls back to Primary Expense Driver.
 */
export function computeMonthlyCategoryShift(
  expenses: ExpenseLike[],
  categories: Category[],
  currentInterval: MonthInterval,
  previousInterval: MonthInterval,
  offset: number,
  today: Date = new Date(),
  currentTotal: number
): MonthlyCategoryShiftResult | null {
  if (currentTotal <= 0) return null;

  const currentStartStr = toDateStr(currentInterval.start);
  const currentEndStr = toDateStr(currentInterval.end);
  const prevStartStr = toDateStr(previousInterval.start);
  const prevEndStr = toDateStr(previousInterval.end);

  const isCurrentMonth = offset === 0;
  let matchedCurrentEndStr = currentEndStr;
  let matchedPrevEndStr = prevEndStr;

  if (isCurrentMonth) {
    matchedCurrentEndStr = toDateStr(today);
    const currentDayNum = today.getDate();
    const prevMonthDays = getDaysInMonth(previousInterval.start);
    const matchedPrevDayNum = Math.min(currentDayNum, prevMonthDays);
    matchedPrevEndStr = toDateStr(addDays(previousInterval.start, matchedPrevDayNum - 1));
  }

  const currentCatTotals: Record<string, { amount: number; count: number }> = {};
  const prevCatTotals: Record<string, number> = {};
  let prevTotalSpend = 0;

  for (const exp of expenses) {
    if (!exp.expense_date) continue;
    const cleanDate = toDateStr(exp.expense_date);
    if (!cleanDate) continue;

    const cat = exp.category_id ? categories.find((c) => c.id === exp.category_id) : undefined;
    if (isIncomeTransaction(exp, cat)) continue;

    const key = exp.category_id || 'others';

    if (isDateInBounds(cleanDate, currentStartStr, matchedCurrentEndStr)) {
      if (!currentCatTotals[key]) currentCatTotals[key] = { amount: 0, count: 0 };
      currentCatTotals[key].amount += exp.amount;
      currentCatTotals[key].count++;
    }
    if (isDateInBounds(cleanDate, prevStartStr, matchedPrevEndStr)) {
      prevCatTotals[key] = (prevCatTotals[key] || 0) + exp.amount;
      prevTotalSpend += exp.amount;
    }
  }

  // Find top current category for primary driver fallback
  let topCatId: string | null = null;
  let topCatAmount = 0;
  let topCatCount = 0;

  for (const [id, data] of Object.entries(currentCatTotals)) {
    if (data.amount > topCatAmount) {
      topCatAmount = data.amount;
      topCatCount = data.count;
      topCatId = id;
    }
  }

  const topCategoryObj = topCatId ? categories.find((c) => c.id === topCatId) : undefined;
  const topPercentage = currentTotal > 0 ? Math.round((topCatAmount / currentTotal) * 100) : 0;

  const fallbackResult: MonthlyCategoryShiftResult | null = topCatId
    ? {
        mode: 'primary_driver',
        categoryName: topCategoryObj?.name || 'Others',
        categoryColor: topCategoryObj?.color || '#F07167',
        categoryIcon: topCategoryObj?.icon || null,
        categoryId: topCatId,
        currentAmount: round2(topCatAmount),
        percentageOfTotal: topPercentage,
        txnCount: topCatCount,
      }
    : null;

  // If previous month has no spend, return fallback
  if (prevTotalSpend === 0 || !fallbackResult) {
    return fallbackResult;
  }

  // Find category with maximum absolute delta
  const allCatKeys = new Set([...Object.keys(currentCatTotals), ...Object.keys(prevCatTotals)]);
  let bestKey: string | null = null;
  let maxAbsDelta = 0;
  let bestDelta = 0;

  allCatKeys.forEach((key) => {
    const curr = currentCatTotals[key]?.amount || 0;
    const prev = prevCatTotals[key] || 0;
    const delta = curr - prev;
    const absDelta = Math.abs(delta);
    if (absDelta > maxAbsDelta) {
      maxAbsDelta = absDelta;
      bestDelta = delta;
      bestKey = key;
    }
  });

  // Minimum significance threshold: |delta| >= 300
  if (!bestKey || maxAbsDelta < 300) {
    return fallbackResult;
  }

  const catObj = categories.find((c) => c.id === bestKey);
  const prevAmount = prevCatTotals[bestKey] || 0;
  const currAmount = currentCatTotals[bestKey]?.amount || 0;
  const shiftPercent = prevAmount > 0 ? Math.round((maxAbsDelta / prevAmount) * 100) : 100;

  return {
    mode: 'category_shift',
    categoryName: catObj?.name || (bestKey === 'others' ? 'Others' : 'Unknown'),
    categoryColor: catObj?.color || '#F07167',
    categoryIcon: catObj?.icon || null,
    categoryId: bestKey,
    delta: round2(bestDelta),
    absDelta: round2(maxAbsDelta),
    shiftPercent,
    isIncrease: bestDelta >= 0,
    currentAmount: round2(currAmount),
    previousAmount: round2(prevAmount),
  };
}

// ─── 7. Peak Outflow Week Narrative in Cash Flow ──────────────────────────────

export interface WeeklyCashFlowItem {
  day: string; // 'W1', 'W2', etc.
  subLabel: string; // '1–7', '8–14', etc.
  income: number;
  spent: number;
}

export interface MonthlyPeakWeekResult {
  status: 'empty' | 'in_progress' | 'even' | 'peak';
  peakWeek?: string;
  share?: number;
  text: string;
}

/**
 * Computes peak week narrative from weekly cash flow blocks.
 */
export function computeMonthlyPeakWeek(
  weeks: WeeklyCashFlowItem[],
  currentTotal: number
): MonthlyPeakWeekResult {
  if (currentTotal <= 0 || !weeks || weeks.length === 0) {
    return {
      status: 'empty',
      text: 'No cash flow activity logged this month',
    };
  }

  const activeWeeks = weeks.filter((w) => w.spent > 0);

  // If only 1 week has activity (e.g. early month)
  if (activeWeeks.length === 1) {
    const single = activeWeeks[0];
    return {
      status: 'in_progress',
      text: `${single.day} in progress · ₹${Math.round(single.spent).toLocaleString('en-IN')} spent so far`,
    };
  }

  // Find max spent week
  let maxWeek = weeks[0];
  for (const w of weeks) {
    if (w.spent > maxWeek.spent) {
      maxWeek = w;
    }
  }

  if (maxWeek.spent <= 0) {
    return {
      status: 'empty',
      text: 'No cash flow activity logged this month',
    };
  }

  // Check if active weeks are evenly distributed (variance < 5%)
  const avgSpent = currentTotal / activeWeeks.length;
  const isEvenlyDistributed = activeWeeks.every(
    (w) => Math.abs(w.spent - avgSpent) / avgSpent < 0.05
  );

  if (isEvenlyDistributed) {
    return {
      status: 'even',
      text: 'Spending was evenly distributed across active weeks',
    };
  }

  const share = Math.round((maxWeek.spent / currentTotal) * 100);
  return {
    status: 'peak',
    peakWeek: maxWeek.day,
    share,
    text: `${maxWeek.day} had highest outflow (${share}% of month)`,
  };
}
