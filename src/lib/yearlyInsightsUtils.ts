/**
 * yearlyInsightsUtils.ts
 *
 * Pure, framework-free calculation engine for Arthik Yearly Insights.
 * Handles:
 * - Annual real-money Inflow, Outflow, Net Cash Flow & Savings Rate
 * - Fair Day-Matched Year-to-Date (YTD) comparisons vs full-year comparisons
 * - First-year baseline guards (suppressing misleading +100% bugs)
 * - Active registered days & daily average burn velocity
 * - 12-Month cash flow aggregation with inactive future month guards
 * - Annual Budget Discipline & Consistency Score (evaluating completed months)
 * - Annual Capital Outlier detection (threshold: >= ₹500 and >= 5% of year)
 * - Long-Term Category Trajectory Shift (H1 vs H2 shift with Primary Driver fallback)
 * - Smart Annual Takeaways
 *
 * Invariant: Real money only. Pure functions only. No React or side-effects.
 */

import {
  parseISO,
  format,
  differenceInCalendarDays,
  startOfMonth,
  endOfMonth,
  endOfYear,
  setMonth,
  addDays,
  isAfter,
} from 'date-fns';
import { isIncomeTransaction } from './transactionUtils';
import { round2, formatCurrency, formatAmountWithCommas } from './formatters';
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

export interface YearInterval {
  start: Date;
  end: Date;
}

export interface YearlyBudgetConfig {
  isBudgetMode: boolean;
  cadence?: BudgetCadence;
  dailyBudgetAmount?: number;
  weeklyBudgetAmount?: number;
  monthlyBudgetAmount?: number;
}

/**
 * Normalizes Date or ISO string into a canonical 'yyyy-MM-dd' string.
 */
function toDateStr(d: Date | number | string): string {
  if (typeof d === 'number') {
    return format(new Date(d), 'yyyy-MM-dd');
  }
  if (typeof d === 'string') {
    return d.split('T')[0]?.trim() || '';
  }
  return format(d, 'yyyy-MM-dd');
}

function toDateObj(d?: Date | number | string): Date {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  if (typeof d === 'number') return new Date(d);
  return parseISO(d);
}

/**
 * Checks if a 'yyyy-MM-dd' date string falls within [start, end] inclusive.
 */
function isDateInBounds(dateStr: string, startStr: string, endStr: string): boolean {
  return dateStr >= startStr && dateStr <= endStr;
}

// ─── 1. Active Days & Daily Burn Rate ──────────────────────────────────────────

/**
 * Computes active registered days for the user in the target year.
 * Prevents diluting daily burn rate for users who registered mid-year.
 */
export function computeActiveDaysInYear(
  yearStart: Date,
  referenceDate: Date | number | string = new Date(),
  userCreatedAt?: string | null,
  isPastYear: boolean = false
): number {
  const refDate = toDateObj(referenceDate);
  const yearEnd = endOfYear(yearStart);

  if (isPastYear) {
    if (userCreatedAt) {
      const createdStr = toDateStr(userCreatedAt);
      const startStr = toDateStr(yearStart);
      const endStr = toDateStr(yearEnd);
      if (createdStr > startStr && createdStr <= endStr) {
        return Math.max(1, differenceInCalendarDays(yearEnd, parseISO(createdStr)) + 1);
      }
    }
    return differenceInCalendarDays(yearEnd, yearStart) + 1;
  }

  const ref = isAfter(refDate, yearEnd) ? yearEnd : refDate;
  let effectiveStart = yearStart;

  if (userCreatedAt) {
    const createdStr = toDateStr(userCreatedAt);
    const startStr = toDateStr(yearStart);
    if (createdStr > startStr) {
      const createdDate = parseISO(createdStr);
      if (!isAfter(createdDate, ref)) {
        effectiveStart = createdDate;
      }
    }
  }

  return Math.max(1, differenceInCalendarDays(ref, effectiveStart) + 1);
}

/**
 * Computes annual average daily burn rate: spend / active registered days.
 */
export function computeAnnualDailyBurn(annualSpend: number, activeDaysInYear: number): number {
  if (annualSpend <= 0 || activeDaysInYear <= 0) return 0;
  return Math.round(annualSpend / Math.max(1, activeDaysInYear));
}

// ─── 2. Annual Spend Aggregation ──────────────────────────────────────────────

/**
 * Computes total annual outflow for non-income transactions within the year interval.
 */
export function computeYearlySpend(
  expenses: ExpenseLike[],
  categories: Category[],
  yearInterval: YearInterval
): number {
  const startStr = toDateStr(yearInterval.start);
  const endStr = toDateStr(yearInterval.end);

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

// ─── 3. Fair Day-Matched Year-to-Date (YTD) Comparison ────────────────────────

export interface YearlyComparisonResult {
  percentageChange: number | null;
  isIncrease: boolean;
  trendLabel: string;
  matchedPrevTotal: number;
  currentTotal: number;
}

/**
 * Computes Year-over-Year comparison:
 * - For in-progress current year (offset === 0): compares Day 1..D of current year against Day 1..D of previous year (Day-Matched YTD).
 * - For past years (offset < 0): compares full 12 months with full 12 months of prior year.
 * - For first-year users (joined this year or 0 previous spend): suppresses fake 100% and displays "First Year with Arthik" or "Annual Baseline".
 */
export function computeYearlyComparison(
  expenses: ExpenseLike[],
  categories: Category[],
  currentInterval: YearInterval,
  previousInterval: YearInterval,
  offset: number,
  referenceDate: Date | number | string = new Date(),
  userCreatedAt?: string | null
): YearlyComparisonResult {
  const refDate = toDateObj(referenceDate);
  const currStartStr = toDateStr(currentInterval.start);
  const currEndStr = toDateStr(currentInterval.end);
  const prevStartStr = toDateStr(previousInterval.start);
  const prevYearEnd = endOfYear(previousInterval.start);

  let currentTotal = 0;
  let matchedPrevTotal = 0;

  let prevCutoffStr = toDateStr(prevYearEnd);

  if (offset === 0) {
    const elapsedDays = Math.max(1, differenceInCalendarDays(refDate, currentInterval.start) + 1);
    const matchedPrevDate = addDays(previousInterval.start, elapsedDays - 1);
    const cappedPrevDate = isAfter(matchedPrevDate, prevYearEnd) ? prevYearEnd : matchedPrevDate;
    prevCutoffStr = toDateStr(cappedPrevDate);
  }

  for (const exp of expenses) {
    if (!exp.expense_date) continue;
    const cleanDate = toDateStr(exp.expense_date);
    if (!cleanDate) continue;

    const cat = exp.category_id ? categories.find((c) => c.id === exp.category_id) : undefined;
    if (isIncomeTransaction(exp, cat)) continue;

    if (isDateInBounds(cleanDate, currStartStr, currEndStr)) {
      currentTotal += exp.amount;
    } else if (isDateInBounds(cleanDate, prevStartStr, prevCutoffStr)) {
      matchedPrevTotal += exp.amount;
    }
  }

  currentTotal = round2(currentTotal);
  matchedPrevTotal = round2(matchedPrevTotal);

  const prevYearLabel = format(previousInterval.start, 'yyyy');

  const isFirstYearUser =
    Boolean(userCreatedAt && toDateStr(userCreatedAt) >= currStartStr) ||
    matchedPrevTotal === 0;

  if (isFirstYearUser) {
    const isHistoricalFirstYear = Boolean(userCreatedAt && toDateStr(userCreatedAt) < currStartStr);
    return {
      percentageChange: null,
      isIncrease: false,
      trendLabel: isHistoricalFirstYear ? 'Annual Baseline' : 'First Year with Arthik',
      matchedPrevTotal,
      currentTotal,
    };
  }

  const diff = currentTotal - matchedPrevTotal;
  const percentageChange = Math.round((Math.abs(diff) / matchedPrevTotal) * 100);
  const isIncrease = diff >= 0;

  const trendLabel = offset === 0
    ? `${isIncrease ? '+' : '−'}${percentageChange}% vs same period in ${prevYearLabel}`
    : `${isIncrease ? '+' : '−'}${percentageChange}% vs ${prevYearLabel}`;

  return {
    percentageChange,
    isIncrease,
    trendLabel,
    matchedPrevTotal,
    currentTotal,
  };
}

// ─── 4. Real-Money Annual Inflow, Net Cash Flow & Savings Rate ──────────────────

/**
 * Computes total annual inflow:
 * - Budget Mode: Base budget allowance for elapsed active days + direct income transactions + external Gullak deposits.
 * - Pure Mode: Direct income transactions + external Gullak deposits.
 */
export function computeYearlyInflow(
  expenses: ExpenseLike[],
  categories: Category[],
  dailyRecords: Record<string, DailyRecord> | DailyRecord[] = [],
  gullakDeposits: GullakDeposit[] = [],
  budgetConfig?: YearlyBudgetConfig,
  yearInterval?: YearInterval,
  referenceDate: Date | number | string = new Date(),
  userCreatedAt?: string | null
): number {
  if (!yearInterval) return 0;
  const refDate = toDateObj(referenceDate);
  const startStr = toDateStr(yearInterval.start);
  const endStr = toDateStr(yearInterval.end);
  const todayStr = toDateStr(refDate);

  let totalInflow = 0;

  if (budgetConfig?.isBudgetMode) {
    const isPastYear = endStr < todayStr;
    const activeDays = computeActiveDaysInYear(
      yearInterval.start,
      refDate,
      userCreatedAt,
      isPastYear
    );

    const totalDaysInYear = differenceInCalendarDays(yearInterval.end, yearInterval.start) + 1;
    let dailyRate = 0;

    if (budgetConfig.cadence === 'monthly') {
      dailyRate = (budgetConfig.monthlyBudgetAmount || 0) / (totalDaysInYear / 12);
    } else if (budgetConfig.cadence === 'weekly') {
      dailyRate = (budgetConfig.weeklyBudgetAmount || 0) / 7;
    } else {
      dailyRate = budgetConfig.dailyBudgetAmount || 0;
    }

    totalInflow += Math.round(dailyRate * activeDays);
  }

  for (const exp of expenses) {
    if (!exp.expense_date) continue;
    const cleanDate = toDateStr(exp.expense_date);
    if (!cleanDate) continue;

    if (isDateInBounds(cleanDate, startStr, endStr)) {
      const cat = exp.category_id ? categories.find((c) => c.id === exp.category_id) : undefined;
      if (isIncomeTransaction(exp, cat)) {
        totalInflow += exp.amount;
      }
    }
  }

  for (const dep of gullakDeposits) {
    if (!dep.date) continue;
    const cleanDate = toDateStr(dep.date);
    if (!cleanDate) continue;

    if (isDateInBounds(cleanDate, startStr, endStr)) {
      if ((dep as any).source !== 'daily_savings') {
        totalInflow += dep.amount;
      }
    }
  }

  return round2(totalInflow);
}

/**
 * Computes Annual Net Cash Flow = Inflow - Outflow.
 */
export function computeAnnualNetCashFlow(
  annualInflow: number,
  annualOutflow: number
): { netCashFlow: number; isSurplus: boolean } {
  const net = round2(annualInflow - annualOutflow);
  return {
    netCashFlow: net,
    isSurplus: net >= 0,
  };
}

/**
 * Computes Annual Savings Rate = (TotalSavedInGullak / AnnualInflow) * 100.
 * Returns null if inflow <= 0.
 */
export function computeAnnualSavingsRate(
  totalSavedInGullak: number,
  annualInflow: number
): number | null {
  if (annualInflow <= 0 || totalSavedInGullak <= 0) return null;
  const rate = Math.round((totalSavedInGullak / annualInflow) * 100);
  return Math.min(100, Math.max(0, rate));
}

// ─── 5. Smart Annual Takeaway Generator ────────────────────────────────────────

export interface SmartYearlyTakeawayResult {
  text: string;
  status: 'green' | 'coral';
}

export function computeSmartYearlyTakeaway(
  netCashFlow: number,
  savingsRate: number | null,
  activeMonthsCount: number,
  isBudgetMode: boolean,
  totalSavedInGullak: number
): SmartYearlyTakeawayResult {
  const monthsStr = activeMonthsCount === 1 ? '1 month' : `${activeMonthsCount} months`;

  if (netCashFlow >= 0) {
    if (savingsRate !== null && savingsRate > 0) {
      return {
        text: `You built a net surplus of +${formatCurrency(Math.round(netCashFlow))} with a ${savingsRate}% annual savings rate across ${monthsStr}.`,
        status: 'green',
      };
    }
    if (totalSavedInGullak > 0) {
      return {
        text: `Net positive cash flow of +${formatCurrency(Math.round(netCashFlow))} with ${formatCurrency(Math.round(totalSavedInGullak))} saved into Gullak.`,
        status: 'green',
      };
    }
    return {
      text: `Maintained positive financial cash flow of +${formatCurrency(Math.round(netCashFlow))} across ${monthsStr}.`,
      status: 'green',
    };
  }

  const absNet = Math.abs(netCashFlow);
  if (isBudgetMode) {
    return {
      text: `Annual outflow exceeded inflows by ${formatCurrency(Math.round(absNet))}. Focus on capping non-essential spending.`,
      status: 'coral',
    };
  }
  return {
    text: `Total tracked outflows exceeded recorded income by ${formatCurrency(Math.round(absNet))} across ${monthsStr}.`,
    status: 'coral',
  };
}

// ─── 6. 12-Month Cash Flow Chart Data Engine ──────────────────────────────────

export interface YearlyCashFlowMonth {
  monthIndex: number;
  label: string;
  dateStr: string;
  startDate: string;
  endDate: string;
  income: number;
  spent: number;
  isFuture: boolean;
  isCurrentMonth: boolean;
}

export interface YearlyCashFlowData {
  months: YearlyCashFlowMonth[];
  maxAmount: number;
  totalIncome: number;
  totalSpent: number;
  peakMonthName: string;
  peakMonthSpent: number;
  surplusMonthsCount: number;
  activeMonthsCount: number;
  chartSubtitle: string;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Computes 12-month dual-bar Cash Flow data (Jan to Dec):
 * - Correctly marks future inactive months in current year (rendered at 25% opacity)
 * - Identifies active month with MTD indicator
 * - Extracts peak outflow month and surplus month counts
 */
export function compute12MonthCashFlow(
  yearStart: Date,
  yearEnd: Date,
  expenses: ExpenseLike[],
  categories: Category[],
  gullakDeposits: GullakDeposit[] = [],
  budgetConfig?: YearlyBudgetConfig,
  userCreatedAt?: string | null,
  referenceDate: Date | number | string = new Date()
): YearlyCashFlowData {
  const refDate = toDateObj(referenceDate);
  const months: YearlyCashFlowMonth[] = [];
  const todayStr = toDateStr(refDate);
  const currentYearStr = format(refDate, 'yyyy');
  const targetYearStr = format(yearStart, 'yyyy');
  const isCurrentYear = targetYearStr === currentYearStr;
  const currentMonthIdx = refDate.getMonth();

  let totalIncome = 0;
  let totalSpent = 0;
  let peakMonthName = 'None';
  let peakMonthSpent = 0;
  let surplusMonthsCount = 0;
  let activeMonthsCount = 0;

  const totalDaysInYear = differenceInCalendarDays(yearEnd, yearStart) + 1;

  for (let m = 0; m < 12; m++) {
    const mStart = startOfMonth(setMonth(yearStart, m));
    const mEnd = endOfMonth(setMonth(yearStart, m));
    const mStartStr = toDateStr(mStart);
    const mEndStr = toDateStr(mEnd);

    const isFuture = isCurrentYear && m > currentMonthIdx;
    const isCurrentMonth = isCurrentYear && m === currentMonthIdx;

    let monthIncome = 0;
    let monthSpent = 0;

    if (!isFuture) {
      if (budgetConfig?.isBudgetMode) {
        let activeDaysInMonth = 0;
        let d = mStart;
        while (!isAfter(d, mEnd)) {
          const dStr = toDateStr(d);
          const isAfterCreated = !userCreatedAt || dStr >= toDateStr(userCreatedAt);
          const isElapsed = dStr <= todayStr;
          if (isAfterCreated && isElapsed) {
            activeDaysInMonth++;
          }
          d = addDays(d, 1);
        }

        if (activeDaysInMonth > 0) {
          let dailyRate = 0;
          if (budgetConfig.cadence === 'monthly') {
            dailyRate = (budgetConfig.monthlyBudgetAmount || 0) / (totalDaysInYear / 12);
          } else if (budgetConfig.cadence === 'weekly') {
            dailyRate = (budgetConfig.weeklyBudgetAmount || 0) / 7;
          } else {
            dailyRate = budgetConfig.dailyBudgetAmount || 0;
          }
          monthIncome += Math.round(dailyRate * activeDaysInMonth);
        }
      }

      for (const exp of expenses) {
        if (!exp.expense_date) continue;
        const cleanDate = toDateStr(exp.expense_date);
        if (!cleanDate) continue;

        if (isDateInBounds(cleanDate, mStartStr, mEndStr)) {
          const cat = exp.category_id ? categories.find((c) => c.id === exp.category_id) : undefined;
          if (isIncomeTransaction(exp, cat)) {
            monthIncome += exp.amount;
          } else {
            monthSpent += exp.amount;
          }
        }
      }

      for (const dep of gullakDeposits) {
        if (!dep.date) continue;
        const cleanDate = toDateStr(dep.date);
        if (!cleanDate) continue;

        if (isDateInBounds(cleanDate, mStartStr, mEndStr)) {
          if ((dep as any).source !== 'daily_savings') {
            monthIncome += dep.amount;
          }
        }
      }

      monthIncome = round2(monthIncome);
      monthSpent = round2(monthSpent);

      totalIncome += monthIncome;
      totalSpent += monthSpent;

      if (monthSpent > peakMonthSpent) {
        peakMonthSpent = monthSpent;
        peakMonthName = format(mStart, 'MMMM');
      }

      if (monthIncome > monthSpent && monthSpent > 0) {
        surplusMonthsCount++;
      }

      if (monthSpent > 0 || monthIncome > 0) {
        activeMonthsCount++;
      }
    }

    months.push({
      monthIndex: m,
      label: MONTH_LABELS[m],
      dateStr: mStartStr,
      startDate: mStartStr,
      endDate: mEndStr,
      income: monthIncome,
      spent: monthSpent,
      isFuture,
      isCurrentMonth,
    });
  }

  totalIncome = round2(totalIncome);
  totalSpent = round2(totalSpent);

  const maxAmount = Math.max(
    ...months.map((m) => Math.max(m.income, m.spent)),
    0
  );

  let chartSubtitle = '';
  if (totalSpent === 0) {
    chartSubtitle = `No expenses logged in ${targetYearStr}`;
  } else if (activeMonthsCount <= 1 && peakMonthName !== 'None') {
    chartSubtitle = `${peakMonthName} in progress (${formatCurrency(peakMonthSpent)} outflow)`;
  } else {
    chartSubtitle = `${peakMonthName} had highest outflow (${formatCurrency(peakMonthSpent)}) · ${surplusMonthsCount} of ${activeMonthsCount} months had net surplus`;
  }

  return {
    months,
    maxAmount,
    totalIncome,
    totalSpent,
    peakMonthName,
    peakMonthSpent,
    surplusMonthsCount,
    activeMonthsCount,
    chartSubtitle,
  };
}

// ─── 7. Annual Budget Discipline & Consistency Score ──────────────────────────

export interface AnnualBudgetDisciplineResult {
  canDisplay: boolean;
  keptMonths: number;
  totalCompletedMonths: number;
  consistencyRatio: number;
  disciplineText: string;
}

/**
 * Computes Annual Budget Discipline:
 * Strictly evaluates past COMPLETED months in the year to prevent unearned victories.
 * Omitted if user has 0 completed months or in Pure Mode.
 */
export function computeAnnualBudgetDiscipline(
  expenses: ExpenseLike[],
  categories: Category[],
  yearInterval: YearInterval,
  budgetConfig?: YearlyBudgetConfig,
  userCreatedAt?: string | null,
  referenceDate: Date | number | string = new Date()
): AnnualBudgetDisciplineResult {
  if (!budgetConfig?.isBudgetMode) {
    return { canDisplay: false, keptMonths: 0, totalCompletedMonths: 0, consistencyRatio: 0, disciplineText: '' };
  }

  const refDate = toDateObj(referenceDate);
  const todayStr = toDateStr(refDate);
  const userCreatedStr = userCreatedAt ? toDateStr(userCreatedAt) : '';
  const currentMonthIdx = refDate.getMonth();
  const targetYearStr = format(yearInterval.start, 'yyyy');
  const isCurrentYear = targetYearStr === format(refDate, 'yyyy');

  let keptMonths = 0;
  let totalCompletedMonths = 0;

  for (let m = 0; m < 12; m++) {
    const mStart = startOfMonth(setMonth(yearInterval.start, m));
    const mEnd = endOfMonth(setMonth(yearInterval.start, m));
    const mStartStr = toDateStr(mStart);
    const mEndStr = toDateStr(mEnd);

    if (isCurrentYear && m >= currentMonthIdx) continue;
    if (mEndStr >= todayStr) continue;

    if (userCreatedStr && userCreatedStr > mEndStr) continue;

    const daysInMonth = differenceInCalendarDays(mEnd, mStart) + 1;
    let activeDays = daysInMonth;
    if (userCreatedStr && userCreatedStr >= mStartStr && userCreatedStr <= mEndStr) {
      activeDays = differenceInCalendarDays(mEnd, parseISO(userCreatedStr)) + 1;
    }

    if (activeDays <= 0) continue;

    let dailyRate = 0;
    const totalDaysInYear = differenceInCalendarDays(yearInterval.end, yearInterval.start) + 1;
    if (budgetConfig.cadence === 'monthly') {
      dailyRate = (budgetConfig.monthlyBudgetAmount || 0) / (totalDaysInYear / 12);
    } else if (budgetConfig.cadence === 'weekly') {
      dailyRate = (budgetConfig.weeklyBudgetAmount || 0) / 7;
    } else {
      dailyRate = budgetConfig.dailyBudgetAmount || 0;
    }

    const effectiveBudget = Math.round(dailyRate * activeDays);

    let monthSpend = 0;
    for (const exp of expenses) {
      if (!exp.expense_date) continue;
      const cleanDate = toDateStr(exp.expense_date);
      if (isDateInBounds(cleanDate, mStartStr, mEndStr)) {
        const cat = exp.category_id ? categories.find((c) => c.id === exp.category_id) : undefined;
        if (!isIncomeTransaction(exp, cat)) {
          monthSpend += exp.amount;
        }
      }
    }

    totalCompletedMonths++;
    if (monthSpend <= effectiveBudget) {
      keptMonths++;
    }
  }

  if (totalCompletedMonths === 0) {
    return { canDisplay: false, keptMonths: 0, totalCompletedMonths: 0, consistencyRatio: 0, disciplineText: '' };
  }

  const consistencyRatio = Math.round((keptMonths / totalCompletedMonths) * 100);
  const disciplineText = `${keptMonths} of ${totalCompletedMonths} ${totalCompletedMonths === 1 ? 'month' : 'months'} kept within budget (${consistencyRatio}% discipline)`;

  return {
    canDisplay: true,
    keptMonths,
    totalCompletedMonths,
    consistencyRatio,
    disciplineText,
  };
}

// ─── 8. Annual Capital Outlier (Largest Single Purchase) ───────────────────────

export interface AnnualCapitalOutlierResult {
  expense: ExpenseLike;
  categoryName: string;
  categoryColor: string;
  categoryIcon?: string;
  outflowPercent: number;
}

/**
 * Identifies the largest single capital purchase in the year:
 * Threshold: amount >= ₹500 AND amount / annualTotal >= 0.05 (>= 5% of year).
 * Otherwise gracefully returns null.
 */
export function computeAnnualCapitalOutlier(
  expenses: ExpenseLike[],
  categories: Category[],
  annualTotal: number,
  yearInterval: YearInterval
): AnnualCapitalOutlierResult | null {
  if (annualTotal <= 0) return null;

  const startStr = toDateStr(yearInterval.start);
  const endStr = toDateStr(yearInterval.end);

  let largestExp: ExpenseLike | null = null;
  let maxAmount = 0;

  for (const exp of expenses) {
    if (!exp.expense_date) continue;
    const cleanDate = toDateStr(exp.expense_date);
    if (!cleanDate) continue;

    if (isDateInBounds(cleanDate, startStr, endStr)) {
      const cat = exp.category_id ? categories.find((c) => c.id === exp.category_id) : undefined;
      if (isIncomeTransaction(exp, cat)) continue;

      if (exp.amount > maxAmount) {
        maxAmount = exp.amount;
        largestExp = exp;
      }
    }
  }

  if (!largestExp) return null;

  const outflowRatio = largestExp.amount / annualTotal;
  if (largestExp.amount < 500 || outflowRatio < 0.05) {
    return null;
  }

  const cat = largestExp.category_id ? categories.find((c) => c.id === largestExp.category_id) : undefined;
  const categoryName = cat?.name || 'Uncategorized';
  const categoryColor = cat?.color || '#F07167';
  const categoryIcon = cat?.icon;
  const outflowPercent = Math.round(outflowRatio * 100);

  return {
    expense: largestExp,
    categoryName,
    categoryColor,
    categoryIcon,
    outflowPercent,
  };
}

// ─── 9. Long-Term Category Trajectory (H1 vs H2 Shift / Primary Driver) ────────

export interface AnnualCategoryTrajectoryResult {
  mode: 'category_shift' | 'primary_driver';
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon?: string;
  isIncrease: boolean;
  absDelta: number;
  shiftPercent: number;
  annualAmount: number;
  percentageOfTotal: number;
  txnCount: number;
}

/**
 * Computes Long-Term Category Shift (H1 vs H2):
 * - If user has >= 2 active months in H1 (Jan–Jun) AND >= 2 in H2 (Jul–Dec): isolates max |Delta| category (>= ₹1,000).
 * - Otherwise falls back to Primary Expense Driver.
 */
export function computeAnnualCategoryTrajectory(
  expenses: ExpenseLike[],
  categories: Category[],
  yearInterval: YearInterval,
  annualTotal: number,
  userCreatedAt?: string | null,
  referenceDate: Date | number | string = new Date()
): AnnualCategoryTrajectoryResult | null {
  if (annualTotal <= 0) return null;

  const refDate = toDateObj(referenceDate);
  const startStr = toDateStr(yearInterval.start);
  const endStr = toDateStr(yearInterval.end);
  const userCreatedStr = userCreatedAt ? toDateStr(userCreatedAt) : '';

  const h1Start = yearInterval.start;
  const h1End = endOfMonth(setMonth(yearInterval.start, 5));
  const h2Start = startOfMonth(setMonth(yearInterval.start, 6));
  const h2End = yearInterval.end;

  const h1StartStr = toDateStr(h1Start);
  const h1EndStr = toDateStr(h1End);
  const h2StartStr = toDateStr(h2Start);
  const h2EndStr = toDateStr(h2End);
  const todayStr = toDateStr(refDate);

  let h1ActiveMonths = 0;
  for (let m = 0; m < 6; m++) {
    const mEndStr = toDateStr(endOfMonth(setMonth(yearInterval.start, m)));
    if ((!userCreatedStr || userCreatedStr <= mEndStr) && mEndStr <= todayStr) {
      h1ActiveMonths++;
    }
  }

  let h2ActiveMonths = 0;
  for (let m = 6; m < 12; m++) {
    const mEndStr = toDateStr(endOfMonth(setMonth(yearInterval.start, m)));
    if ((!userCreatedStr || userCreatedStr <= mEndStr) && mEndStr <= todayStr) {
      h2ActiveMonths++;
    }
  }

  const h1SpendByCat: Record<string, number> = {};
  const h2SpendByCat: Record<string, number> = {};
  const annualSpendByCat: Record<string, { amount: number; txnCount: number }> = {};

  for (const exp of expenses) {
    if (!exp.expense_date) continue;
    const cleanDate = toDateStr(exp.expense_date);
    if (!cleanDate) continue;

    if (isDateInBounds(cleanDate, startStr, endStr)) {
      const cat = exp.category_id ? categories.find((c) => c.id === exp.category_id) : undefined;
      if (isIncomeTransaction(exp, cat)) continue;

      const catId = exp.category_id || 'others';

      if (!annualSpendByCat[catId]) {
        annualSpendByCat[catId] = { amount: 0, txnCount: 0 };
      }
      annualSpendByCat[catId].amount += exp.amount;
      annualSpendByCat[catId].txnCount += 1;

      if (isDateInBounds(cleanDate, h1StartStr, h1EndStr)) {
        h1SpendByCat[catId] = (h1SpendByCat[catId] || 0) + exp.amount;
      } else if (isDateInBounds(cleanDate, h2StartStr, h2EndStr)) {
        h2SpendByCat[catId] = (h2SpendByCat[catId] || 0) + exp.amount;
      }
    }
  }

  if (h1ActiveMonths >= 2 && h2ActiveMonths >= 2) {
    let bestCatId: string | null = null;
    let maxAbsDelta = 0;
    let isIncrease = false;
    let rawDelta = 0;

    const allCatIds = new Set([...Object.keys(h1SpendByCat), ...Object.keys(h2SpendByCat)]);

    for (const catId of allCatIds) {
      const h1Amt = h1SpendByCat[catId] || 0;
      const h2Amt = h2SpendByCat[catId] || 0;
      const delta = h2Amt - h1Amt;
      const absDelta = Math.abs(delta);

      if (absDelta >= 1000 && absDelta > maxAbsDelta) {
        maxAbsDelta = absDelta;
        rawDelta = delta;
        isIncrease = delta > 0;
        bestCatId = catId;
      }
    }

    if (bestCatId) {
      const cat = categories.find((c) => c.id === bestCatId);
      const h1Amt = h1SpendByCat[bestCatId] || 0;
      const shiftPercent = h1Amt > 0 ? Math.round((maxAbsDelta / h1Amt) * 100) : 100;
      const annualAmt = annualSpendByCat[bestCatId]?.amount || maxAbsDelta;
      const txnCount = annualSpendByCat[bestCatId]?.txnCount || 1;

      return {
        mode: 'category_shift',
        categoryId: bestCatId,
        categoryName: cat?.name || (bestCatId === 'others' ? 'Others' : 'Uncategorized'),
        categoryColor: cat?.color || '#F07167',
        categoryIcon: cat?.icon,
        isIncrease,
        absDelta: round2(maxAbsDelta),
        shiftPercent,
        annualAmount: round2(annualAmt),
        percentageOfTotal: Math.round((annualAmt / annualTotal) * 100),
        txnCount,
      };
    }
  }

  // Fallback: Primary Expense Driver
  let topCatId: string | null = null;
  let topAmount = 0;

  for (const [catId, data] of Object.entries(annualSpendByCat)) {
    if (data.amount > topAmount) {
      topAmount = data.amount;
      topCatId = catId;
    }
  }

  if (!topCatId) return null;

  const cat = categories.find((c) => c.id === topCatId);
  const data = annualSpendByCat[topCatId];

  return {
    mode: 'primary_driver',
    categoryId: topCatId,
    categoryName: cat?.name || (topCatId === 'others' ? 'Others' : 'Uncategorized'),
    categoryColor: cat?.color || '#F07167',
    categoryIcon: cat?.icon,
    isIncrease: false,
    absDelta: 0,
    shiftPercent: 0,
    annualAmount: round2(data.amount),
    percentageOfTotal: Math.round((data.amount / annualTotal) * 100),
    txnCount: data.txnCount,
  };
}
