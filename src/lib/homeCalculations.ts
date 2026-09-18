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
import { formatCurrency } from './formatters';
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
  const activeDailyBudget = todayBudget > 0 ? todayBudget : (isBudgetConfigured ? dailyBudgetAmount : 0);
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
    // 'All' filter: all past dates tracked up to today
    const allDates = new Set<string>();
    allDates.add(todayStr);
    for (let i = 0; i < filtered.length; i++) {
      const d = filtered[i].expense_date?.split('T')[0]?.trim();
      if (d && d <= todayStr && (!userCreatedAtStr || d >= userCreatedAtStr)) {
        allDates.add(d);
      }
    }
    Object.keys(dailyRecords).forEach((d) => {
      const cleanD = d.split('T')[0]?.trim();
      // Skip phantom zero-spend 500 days from periodDates (Sentinel site 3, Issue 01)
      if (dailyRecords[d]?.spent === 0 && dailyRecords[d]?.budget === 500 && dailyRecords[d]?.saved === 500) {
        return;
      }
      if (cleanD && cleanD <= todayStr && (!userCreatedAtStr || cleanD >= userCreatedAtStr)) {
        allDates.add(cleanD);
      }
    });
    allDates.forEach((d) => periodDates.push(d));
  }

  let periodBudget = 0;
  periodDates.forEach((d) => {
    if (d === todayStr) {
      // Today: include today's allowance + any top-up added (+₹100, +₹200, Edit)
      const todayVal = todayBudget > 0 ? todayBudget : (isBudgetConfigured ? dailyBudgetAmount : 0);
      periodBudget += todayVal;
    } else if (dailyRecords[d]) {
      if (dailyRecords[d].status === 'unknown') {
        // Untracked day where user had no budget
        periodBudget += 0;
      } else {
        let b = Number(dailyRecords[d].budget) || 0;
        // Sentinel site 3 repair (Issue 05)
        if (b === 500 && dailyBudgetAmount !== 500) {
          b = isBudgetConfigured ? dailyBudgetAmount : 0;
        }
        periodBudget += b;
      }
    } else {
      // Past day in the period where no record was stored
      periodBudget += isBudgetConfigured ? dailyBudgetAmount : 0;
    }
  });

  const daysCount = periodDates.length;
  const income = totalIncome;
  const spent = totalSpent;

  let budgetPool = activeDailyBudget;
  if (activeFilter === 'Weekly' || activeFilter === 'Monthly' || activeFilter === 'All') {
    budgetPool = periodBudget;
  }

  const available = budgetPool + income;
  const isOver = spent > available && available > 0;
  const remaining = Math.max(0, available - spent);
  const overAmount = isOver ? spent - available : 0;

  let label = 'Remaining to Spend';
  let subtext: string | null = null;

  if (activeFilter === 'Daily') {
    if (isOver) {
      label = 'Daily Budget Exceeded';
      subtext = `Exceeded daily limit by ${formatCurrency(overAmount)}`;
    } else {
      label = 'Remaining to Spend';
      if (budgetPool > 0 && income > 0) {
        subtext = `${formatCurrency(budgetPool)} budget + ${formatCurrency(income)} income`;
      } else if (income > 0) {
        subtext = `of ${formatCurrency(income)} total income`;
      } else if (budgetPool > 0) {
        subtext = `of ${formatCurrency(budgetPool)} daily allowance`;
      } else {
        subtext = null;
      }
    }
  } else if (activeFilter === 'Weekly') {
    if (isOver) {
      label = 'Weekly Budget Exceeded';
      subtext = `Exceeded weekly limit by ${formatCurrency(overAmount)}`;
    } else {
      label = 'Weekly Remaining';
      if (budgetPool > 0 && income > 0) {
        subtext = `${formatCurrency(budgetPool)} budget (${daysCount} ${daysCount === 1 ? 'day' : 'days'}) + ${formatCurrency(income)} income`;
      } else if (income > 0) {
        subtext = `of ${formatCurrency(income)} total income`;
      } else if (budgetPool > 0) {
        subtext = `of ${formatCurrency(budgetPool)} budget (${daysCount} ${daysCount === 1 ? 'day' : 'days'})`;
      } else {
        subtext = null;
      }
    }
  } else if (activeFilter === 'Monthly') {
    if (isOver) {
      label = 'Monthly Budget Exceeded';
      subtext = `Exceeded monthly limit by ${formatCurrency(overAmount)}`;
    } else {
      label = 'Monthly Remaining';
      if (budgetPool > 0 && income > 0) {
        subtext = `${formatCurrency(budgetPool)} budget (${daysCount} ${daysCount === 1 ? 'day' : 'days'}) + ${formatCurrency(income)} income`;
      } else if (income > 0) {
        subtext = `of ${formatCurrency(income)} total income`;
      } else if (budgetPool > 0) {
        subtext = `of ${formatCurrency(budgetPool)} budget (${daysCount} ${daysCount === 1 ? 'day' : 'days'})`;
      } else {
        subtext = null;
      }
    }
  } else {
    // 'All' filter
    if (isOver) {
      label = 'Total Budget Exceeded';
      subtext = `Exceeded total limit by ${formatCurrency(overAmount)}`;
    } else {
      label = 'Total Remaining';
      if (budgetPool > 0 && income > 0) {
        subtext = `${formatCurrency(budgetPool)} budget + ${formatCurrency(income)} income`;
      } else if (income > 0) {
        subtext = `of ${formatCurrency(income)} total income`;
      } else if (budgetPool > 0) {
        subtext = `of ${formatCurrency(budgetPool)} total budget`;
      } else {
        subtext = null;
      }
    }
  }

  return {
    primaryAmount: isOver ? overAmount : remaining,
    primaryLabel: label,
    primarySubtext: subtext,
    displaySpent: spent,
    totalAvailable: available,
    isOverBudgetPeriod: isOver,
  };
};
