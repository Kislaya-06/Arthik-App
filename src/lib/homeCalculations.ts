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
import { DailyRecord } from './budgetCalculations';

export type HomeFilter = 'All' | 'Daily' | 'Weekly' | 'Monthly';

export interface ExpenseDateItem {
  expense_date?: string;
}

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
      // Today: include today's allowance + any top-up added (+₹100, +₹200, Edit)
      periodBudget += todayBudget > 0 ? todayBudget : (isBudgetConfigured ? dailyBudgetAmount : 0);
    } else if (dailyRecords[d]) {
      if (dailyRecords[d].status !== 'unknown') {
        periodBudget += Number(dailyRecords[d].budget) || 0;
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
  const available = round2(budgetPool + income);
  const isOver = spent > available && available > 0;
  const remaining = round2(Math.max(0, available - spent));
  const overAmount = round2(isOver ? spent - available : 0);

  const isPeriodFilter = activeFilter === 'Weekly' || activeFilter === 'Monthly';
  const prefix = activeFilter === 'Daily' ? 'Daily' : (activeFilter === 'All' ? 'Total' : activeFilter);

  let label: string;
  let subtext: string | null = null;

  if (!isBudgetConfigured && income === 0) {
    label = activeFilter === 'Daily' ? 'Spent Today' : `${prefix} Spent`;
  } else if (isOver) {
    label = `${prefix} Budget Exceeded`;
    subtext = `Exceeded ${prefix.toLowerCase()} limit by ${formatCurrency(overAmount)}`;
  } else {
    label = activeFilter === 'Daily' ? 'Remaining to Spend' : `${prefix} Remaining`;
    if (isBudgetConfigured && budgetPool > 0) {
      const daysSuffix = isPeriodFilter ? ` (${daysCount} ${daysCount === 1 ? 'day' : 'days'})` : '';
      if (income > 0) {
        subtext = `${formatCurrency(budgetPool)} budget${daysSuffix} + ${formatCurrency(income)} income`;
      } else {
        const poolDesc = activeFilter === 'Daily' ? 'daily allowance' : (activeFilter === 'All' ? 'total budget' : `budget${daysSuffix}`);
        subtext = `of ${formatCurrency(budgetPool)} ${poolDesc}`;
      }
    }
  }

  const primaryAmount = round2((!isBudgetConfigured && income === 0) ? spent : (isOver ? overAmount : remaining));

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
