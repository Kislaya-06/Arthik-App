/**
 * homeCalculations.ts
 *
 * Pure financial aggregation engine for the HomeScreen Hero Summary Card.
 *
 * ARCHITECTURAL NOTE ON DISPLAY STRINGS:
 * This module deliberately returns both calculated financial metrics AND formatted user-facing
 * copy (primaryLabel, primarySubtext).
 *
 * While src/lib calculation files typically return only domain primitives, bundling the copy
 * here is an intentional design decision: the user-facing text is a direct deterministic projection
 * of the period dates, budget pools, income, and overage state (~60 lines of complex branching).
 * Leaving string resolution to callers would force every consumer/view to re-implement or duplicate
 * identical branch logic across all four time filters, creating a wide, brittle interface.
 *
 * By returning a complete PeriodSummary descriptor, the entire financial summary state machine
 * remains pure, deterministic, and 100% unit-testable in isolation without React or UI dependencies.
 */

import { format, parseISO, startOfWeek, startOfMonth, eachDayOfInterval } from 'date-fns';
import { formatCurrency, round2 } from './formatters';
import { DailyRecord, calculateCycleFinancials } from './budgetCalculations';
import { isDateInPeriod, FilterPeriod } from './dateFilters';
import { isIncomeTransaction } from './transactionUtils';
import { resolvePlanForDate } from './budgetPeriods';
import { BudgetPlanChange } from '../types';

export type HomeFilter = 'All' | 'Daily' | 'Weekly' | 'Monthly';

export interface ExpenseDateItem {
  expense_date?: string;
}

export interface DepositDateItem {
  date: string;
  amount: number;
  source?: 'income' | 'external';
}

export const getExternalDepositsInPeriod = (
  deposits: DepositDateItem[],
  filter: HomeFilter,
  referenceDate: Date,
  userCreatedAtStr?: string
): number => {
  const period: FilterPeriod = filter === 'All' ? 'all' : (filter === 'Daily' ? 'day' : (filter === 'Weekly' ? 'week' : 'month'));
  let sum = 0;
  for (let i = 0; i < deposits.length; i++) {
    const dep = deposits[i];
    if (dep.source === 'external' && isDateInPeriod(dep.date, period, referenceDate, userCreatedAtStr)) {
      sum += Number(dep.amount) || 0;
    }
  }
  return round2(sum);
};

export interface PeriodCalculationParams {
  activeFilter: HomeFilter;
  dailyBudgetAmount: number;
  isAutoRenew: boolean;
  todayBudget: number;
  dailyRecords: Record<string, DailyRecord>;
  totalIncome: number;
  totalSpent: number;
  filtered: ExpenseDateItem[];
  userCreatedAtStr?: string;
  referenceDate: Date;
  externalDepositsInPeriod?: number;
  planChanges?: BudgetPlanChange[];
}

export interface PeriodSummary {
  primaryAmount: number;
  primaryLabel: string;
  primarySubtext: string | null;
  displaySpent: number;
  totalAvailable: number;
  isOverBudgetPeriod: boolean;
  periodIncome: number;
  periodSpent: number;
  periodBudgetPool: number;
  isBudgetConfigured: boolean;
}

/**
 * Computes period financial metrics and formatted display descriptors for the Hero Summary Card.
 *
 * PRESERVED LOGIC:
 * - Phantom-500 skip on zero-spend days (cross-reference: .scratch/daily-budget/issues/01).
 * - Registration boundary clipping on past elapsed days.
 * - Exact branching for all four time filters and singular/plural day strings.
 */
export const calculatePeriodSummary = (params: PeriodCalculationParams): PeriodSummary => {
  const {
    activeFilter,
    dailyBudgetAmount,
    isAutoRenew,
    todayBudget,
    dailyRecords,
    totalIncome,
    totalSpent,
    filtered,
    userCreatedAtStr,
    referenceDate,
    externalDepositsInPeriod = 0,
    planChanges,
  } = params;

  const isBudgetConfigured = isAutoRenew && dailyBudgetAmount > 0;
  const activeDailyBudget = isBudgetConfigured ? (todayBudget > 0 ? todayBudget : dailyBudgetAmount) : 0;
  const todayStr = format(referenceDate, 'yyyy-MM-dd');

  // Determine the calendar days belonging to the active period up to today
  const periodDates: string[] = [];

  if (activeFilter === 'Daily') {
    periodDates.push(todayStr);
  } else if (activeFilter === 'Weekly') {
    // Week starts Monday, counts days elapsed so far this week up to TODAY
    const monday = startOfWeek(referenceDate, { weekStartsOn: 1 });
    const mondayStr = format(monday, 'yyyy-MM-dd');
    // If user joined after Monday (e.g. Wednesday), start from registration day
    const startDateStr = (userCreatedAtStr && userCreatedAtStr > mondayStr) ? userCreatedAtStr : mondayStr;
    const startDate = parseISO(startDateStr);
    const days = eachDayOfInterval({ start: startDate <= referenceDate ? startDate : referenceDate, end: referenceDate });
    days.forEach((d) => {
      periodDates.push(format(d, 'yyyy-MM-dd'));
    });
  } else if (activeFilter === 'Monthly') {
    // Month starts 1st of month, counts days elapsed so far this month up to TODAY
    const firstOfMonth = startOfMonth(referenceDate);
    const firstOfMonthStr = format(firstOfMonth, 'yyyy-MM-dd');
    // If user joined after 1st of month, start from registration day
    const startDateStr = (userCreatedAtStr && userCreatedAtStr > firstOfMonthStr) ? userCreatedAtStr : firstOfMonthStr;
    const startDate = parseISO(startDateStr);
    const days = eachDayOfInterval({ start: startDate <= referenceDate ? startDate : referenceDate, end: referenceDate });
    days.forEach((d) => {
      periodDates.push(format(d, 'yyyy-MM-dd'));
    });
  } else {
    // 'All': from user registration date (or earliest record date) up to today
    const candidateDates: string[] = [todayStr];
    if (userCreatedAtStr) candidateDates.push(userCreatedAtStr);
    for (let i = 0; i < filtered.length; i++) {
      const d = filtered[i].expense_date?.split('T')[0]?.trim();
      if (d) candidateDates.push(d);
    }
    Object.keys(dailyRecords).forEach((d) => {
      const cleanD = d.split('T')[0]?.trim();
      if (cleanD) candidateDates.push(cleanD);
    });
    if (planChanges && planChanges.length > 0) {
      planChanges.forEach((c) => {
        if (c.effectiveFrom) candidateDates.push(c.effectiveFrom);
      });
    }
    candidateDates.sort();
    const earliestDateStr = candidateDates[0];
    const startDate = parseISO(earliestDateStr);
    const days = eachDayOfInterval({ start: startDate <= referenceDate ? startDate : referenceDate, end: referenceDate });
    days.forEach((d) => {
      periodDates.push(format(d, 'yyyy-MM-dd'));
    });
  }

  let periodBudget = 0;
  periodDates.forEach((d) => {
    if (d === todayStr) {
      // Today: include today's allowance
      periodBudget += todayBudget > 0 ? todayBudget : (isBudgetConfigured ? dailyBudgetAmount : 0);
    } else if (dailyRecords[d]) {
      if (dailyRecords[d].status !== 'unknown') {
        periodBudget += Number(dailyRecords[d].budget) || 0;
      }
    } else if (planChanges && planChanges.length > 0) {
      // Past day in the period governed by plan changes
      const plan = resolvePlanForDate(planChanges, d);
      if (plan && plan.isEnabled && plan.cadence === 'daily') {
        periodBudget += Number(plan.amount) || 0;
      }
    } else {
      // Past day in the period where no record was stored
      periodBudget += isBudgetConfigured ? dailyBudgetAmount : 0;
    }
  });

  const daysCount = periodDates.length;
  const income = round2(totalIncome);
  const spent = round2(totalSpent);

  const budgetPool = round2(activeFilter === 'Daily' ? activeDailyBudget : periodBudget);
  const cycle = calculateCycleFinancials({
    scheduledBudget: budgetPool,
    eligibleIncome: income,
    carriedOverAmount: externalDepositsInPeriod,
    spent,
  });

  const available = cycle.spendable;
  const isOver = cycle.isOverBudget;
  const remaining = cycle.remaining;
  const overAmount = cycle.overAmount;

  const isPeriodFilter = activeFilter === 'Weekly' || activeFilter === 'Monthly';
  const prefix = activeFilter === 'Daily' ? 'Daily' : (activeFilter === 'All' ? 'Total' : activeFilter);

  let label: string;
  let subtext: string | null = null;

  if (!isBudgetConfigured && income === 0 && externalDepositsInPeriod === 0) {
    label = activeFilter === 'Daily' ? 'Spent Today' : `${prefix} Spent`;
  } else if (isOver) {
    label = `${prefix} Budget Exceeded`;
    subtext = `Exceeded ${prefix.toLowerCase()} limit by ${formatCurrency(overAmount)}`;
  } else {
    label = activeFilter === 'Daily' ? 'Remaining to Spend' : `${prefix} Remaining`;
    if (isBudgetConfigured && budgetPool > 0) {
      const daysSuffix = isPeriodFilter ? ` (${daysCount} ${daysCount === 1 ? 'day' : 'days'})` : '';
      const parts: string[] = [];
      parts.push(`${formatCurrency(budgetPool)} budget${daysSuffix}`);
      if (income > 0) parts.push(`${formatCurrency(income)} income`);
      if (externalDepositsInPeriod > 0) parts.push(`${formatCurrency(externalDepositsInPeriod)} deposits to Gullak`);
      if (parts.length > 1) {
        subtext = parts.join(' + ');
      } else {
        const poolDesc = activeFilter === 'Daily' ? 'daily allowance' : (activeFilter === 'All' ? 'total budget' : `budget${daysSuffix}`);
        subtext = `of ${formatCurrency(budgetPool)} ${poolDesc}`;
      }
    } else if (externalDepositsInPeriod > 0) {
      if (income > 0) {
        subtext = `${formatCurrency(income)} income + ${formatCurrency(externalDepositsInPeriod)} deposits to Gullak`;
      } else {
        subtext = `${formatCurrency(externalDepositsInPeriod)} deposits to Gullak`;
      }
    }
  }

  const primaryAmount = round2((!isBudgetConfigured && income === 0 && externalDepositsInPeriod === 0) ? spent : (isOver ? overAmount : remaining));

  return {
    primaryAmount,
    primaryLabel: label,
    primarySubtext: subtext,
    displaySpent: spent,
    totalAvailable: available,
    isOverBudgetPeriod: isOver,
    periodIncome: income,
    periodSpent: spent,
    periodBudgetPool: budgetPool,
    isBudgetConfigured,
  };
};

export interface ParsedChipNumber {
  prefix: string;
  numericValue: number;
  suffix: string;
  hasDecimals: boolean;
}

/**
 * Parses numeric currency components from a chip string for ticker animation.
 * e.g. "₹19,750 budget" -> prefix: "₹", numericValue: 19750, suffix: " budget", hasDecimals: false
 * e.g. "+₹2,823.8 income" -> prefix: "+₹", numericValue: 2823.8, suffix: " income", hasDecimals: true
 */
export function parseChipNumber(chipStr: string): ParsedChipNumber | null {
  if (!chipStr) return null;
  const match = chipStr.match(/^(.*?₹\s?)([0-9,]+(?:\.[0-9]+)?)(.*)$/);
  if (!match) return null;
  const prefix = match[1];
  const rawNum = match[2].replace(/,/g, '');
  const suffix = match[3];
  const numericValue = parseFloat(rawNum);
  if (isNaN(numericValue)) return null;
  const hasDecimals = match[2].includes('.');
  return { prefix, numericValue, suffix, hasDecimals };
}

/**
 * Returns the filter-specific header title for Pure Mode (budget mode disabled).
 * Projects "Remaining" when user has a positive balance, "Deficit" when overspent, or "Spent" when zero inflow.
 * - Daily: "Daily Remaining" / "Daily Deficit" / "Spent Today"
 * - Weekly: "Weekly Remaining" / "Weekly Deficit" / "Weekly Spent"
 * - Monthly: "Monthly Remaining" / "Monthly Deficit" / "Monthly Spent"
 * - All: "Total Remaining" / "Total Deficit" / "Total Spent"
 */
export const getPureHeroTitle = (activeFilter: string, isDeficit = false, hasInflow = true): string => {
  const prefix = activeFilter === 'Daily' ? 'Daily' : (activeFilter === 'All' ? 'Total' : activeFilter);
  if (!hasInflow) {
    return activeFilter === 'Daily' ? 'Spent Today' : `${prefix} Spent`;
  }
  if (isDeficit) {
    return `${prefix} Deficit`;
  }
  return `${prefix} Remaining`;
};

export interface PureHeroMetrics {
  title: string;
  totalRemaining: number;
  totalExpense: number;
  inflow: number;
  outflow: number;
  net: number;
  isDeficit: boolean;
}

/**
 * Calculates pure mode hero metrics: total remaining (big number), inflow, outflow, and net cashflow.
 */
export const calculatePureHeroMetrics = (
  activeFilter: string,
  totalInflow: number,
  totalSpent: number
): PureHeroMetrics => {
  const inflow = round2(Math.max(0, totalInflow));
  const outflow = round2(Math.max(0, totalSpent));
  const net = round2(inflow - outflow);
  const isDeficit = outflow > inflow && inflow > 0;
  const hasInflow = inflow > 0;

  let totalRemaining: number;
  if (!hasInflow) {
    totalRemaining = outflow;
  } else if (isDeficit) {
    totalRemaining = round2(outflow - inflow);
  } else {
    totalRemaining = net;
  }

  const title = getPureHeroTitle(activeFilter, isDeficit, hasInflow);

  return {
    title,
    totalRemaining,
    totalExpense: outflow,
    inflow,
    outflow,
    net,
    isDeficit,
  };
};

export interface ExpenseTotals {
  totalIncome: number;
  totalSpent: number;
}

/**
 * Aggregates a list of expenses into totalIncome and totalSpent.
 * Extracted from HomeScreen to resolve accumulation logic leakage (.scratch/home/issues/05).
 */
export const calculateExpenseTotals = (
  expenses: Array<{ amount: number | string; category_id?: string | null; type?: string }>,
  catMap: Record<string, { name?: string; is_income?: boolean } | undefined>
): ExpenseTotals => {
  let income = 0;
  let spent = 0;
  for (let i = 0; i < expenses.length; i++) {
    const e = expenses[i];
    const cat = e.category_id ? catMap[e.category_id] : undefined;
    const isIncome = isIncomeTransaction(e, cat);
    if (isIncome) income += Number(e.amount) || 0;
    else spent += Number(e.amount) || 0;
  }
  return {
    totalIncome: round2(income),
    totalSpent: round2(spent),
  };
};
