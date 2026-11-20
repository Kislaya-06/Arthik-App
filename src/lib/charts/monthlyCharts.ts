import { format } from 'date-fns/format';
import { addDays } from 'date-fns/addDays';
import { isAfter } from 'date-fns/isAfter';
import { round2 } from '../formatters';
import { isExcludedFromTotals } from '../transactionUtils';
import { budgetAllowedForActiveDays } from '../../money/budgetAllowance';

export interface MonthlyWeekSpending {
  day: string; // 'W1', 'W2', 'W3', 'W4'
  dateStr: string; // 'yyyy-MM-dd' (earliest date in week with spending, or start date if none)
  startDate: string; // 'yyyy-MM-dd'
  endDate: string; // 'yyyy-MM-dd'
  amount: number;
  subLabel: string; // e.g. '1–7', '8–14', '15–21', '22–30'
}

/**
 * Splits a calendar month into exactly 4 consecutive weeks (W1–W4)
 * and calculates total non-income spending for each week.
 *
 * W1: 1–7
 * W2: 8–14
 * W3: 15–21
 * W4: 22 to end of month (e.g. 22–30, 22–31, or 22–28)
 *
 * If userCreatedAtStr is provided, any weeks ending before user registration
 * or expenses prior to registration date are excluded (0 spending).
 */
export function computeMonthlyWeeksData(
  monthStart: Date,
  monthEnd: Date,
  expenses: Array<{ amount: number; expense_date: string; category_id?: string | null; transaction_class?: string | null }>,
  isIncomeCheck?: (expense: { category_id?: string | null; transaction_class?: string | null }) => boolean,
  userCreatedAtStr?: string
): { weeks: MonthlyWeekSpending[]; maxWeek: MonthlyWeekSpending | null } {
  const weeks: MonthlyWeekSpending[] = [];
  const endDay = monthEnd.getDate(); // 28, 29, 30, or 31

  const weekRanges: Array<{ label: string; startDay: number; endDay: number }> = [
    { label: 'W1', startDay: 1, endDay: Math.min(7, endDay) },
    { label: 'W2', startDay: 8, endDay: Math.min(14, endDay) },
    { label: 'W3', startDay: 15, endDay: Math.min(21, endDay) },
    { label: 'W4', startDay: 22, endDay },
  ];

  for (const range of weekRanges) {
    const rangeStart = addDays(monthStart, range.startDay - 1);
    const rangeEnd = addDays(monthStart, range.endDay - 1);
    const startStr = format(rangeStart, 'yyyy-MM-dd');
    const endStr = format(rangeEnd, 'yyyy-MM-dd');

    // If the entire week range ended strictly before account registration, amount is strictly 0
    if (userCreatedAtStr && endStr < userCreatedAtStr) {
      weeks.push({
        day: range.label,
        dateStr: startStr,
        startDate: startStr,
        endDate: endStr,
        amount: 0,
        subLabel: `${range.startDay}–${range.endDay}`,
      });
      continue;
    }

    let sum = 0;
    for (const exp of expenses) {
      if ((isIncomeCheck && isIncomeCheck(exp)) || isExcludedFromTotals(exp)) continue;
      const cleanDate = exp.expense_date?.split('T')[0]?.trim();
      if (!cleanDate) continue;
      // Exclude expenses before account registration
      if (userCreatedAtStr && cleanDate < userCreatedAtStr) continue;

      if (cleanDate >= startStr && cleanDate <= endStr) {
        sum += exp.amount;
      }
    }

    // Find the first date in [rangeStart..rangeEnd] that actually has spending (ascending order)
    let firstSpendingDate: string | null = null;
    let curDay = rangeStart;
    while (!isAfter(curDay, rangeEnd)) {
      const curStr = format(curDay, 'yyyy-MM-dd');
      const hasExpense = expenses.some((exp) => {
        if ((isIncomeCheck && isIncomeCheck(exp)) || isExcludedFromTotals(exp)) return false;
        const cleanDate = exp.expense_date?.split('T')[0]?.trim();
        if (!cleanDate) return false;
        if (userCreatedAtStr && cleanDate < userCreatedAtStr) return false;
        return cleanDate === curStr && exp.amount > 0;
      });

      if (hasExpense) {
        firstSpendingDate = curStr;
        break;
      }
      curDay = addDays(curDay, 1);
    }

    weeks.push({
      day: range.label,
      dateStr: firstSpendingDate || startStr,
      startDate: startStr,
      endDate: endStr,
      amount: round2(sum),
      subLabel: `${range.startDay}–${range.endDay}`,
    });
  }

  const maxWeek = weeks.reduce((max, w) => (w.amount > max.amount ? w : max), weeks[0]);
  return { weeks, maxWeek: maxWeek.amount > 0 ? maxWeek : null };
}

export interface MonthlyCashFlowWeek {
  day: string; // 'W1', 'W2', 'W3', 'W4'
  subLabel: string; // '1–7', '8–14', '15–21', '22–30'
  income: number;
  spent: number;
  dateStr: string; // earliest date in week with transaction, or startStr
  startDate: string;
  endDate: string;
}

export interface MonthlyCashFlowData {
  weeks: MonthlyCashFlowWeek[];
  totalIncome: number;
  totalSpent: number;
  maxAmount: number;
}

/**
 * Computes 4-week dual-bar cash flow breakdown (Income vs Spent) for a calendar month.
 * W1: 1–7
 * W2: 8–14
 * W3: 15–21
 * W4: 22 to end of month (22–30, 22–31, etc.)
 */
export interface MonthlyCashFlowBudgetConfig {
  isBudgetMode: boolean;
  cadence?: 'daily' | 'weekly' | 'monthly';
  dailyBudgetAmount?: number;
  weeklyBudgetAmount?: number;
  monthlyBudgetAmount?: number;
}

export function computeMonthlyCashFlowData(
  monthStart: Date,
  monthEnd: Date,
  expenses: Array<{ amount: number; expense_date: string; type?: string; category_id?: string | null; transaction_class?: string | null }>,
  gullakDeposits: Array<{ date: string; amount: number; source?: string }>,
  isIncomeCheck?: (expense: { category_id?: string | null; transaction_class?: string | null; type?: string }) => boolean,
  userCreatedAtStr?: string,
  budgetConfig?: MonthlyCashFlowBudgetConfig,
  referenceDate: Date = new Date()
): MonthlyCashFlowData {
  const cleanUserCreated = userCreatedAtStr ? userCreatedAtStr.split('T')[0]?.trim() : undefined;
  const weeks: MonthlyCashFlowWeek[] = [];
  const endDay = monthEnd.getDate();
  const weekRanges: Array<{ label: string; startDay: number; endDay: number }> = [
    { label: 'W1', startDay: 1, endDay: Math.min(7, endDay) },
    { label: 'W2', startDay: 8, endDay: Math.min(14, endDay) },
    { label: 'W3', startDay: 15, endDay: Math.min(21, endDay) },
    { label: 'W4', startDay: 22, endDay },
  ];

  let totalIncome = 0;
  let totalSpent = 0;

  for (const range of weekRanges) {
    const rangeStart = addDays(monthStart, range.startDay - 1);
    const rangeEnd = addDays(monthStart, range.endDay - 1);
    const startStr = format(rangeStart, 'yyyy-MM-dd');
    const endStr = format(rangeEnd, 'yyyy-MM-dd');

    if (cleanUserCreated && endStr < cleanUserCreated) {
      weeks.push({
        day: range.label,
        subLabel: `${range.startDay}–${range.endDay}`,
        income: 0,
        spent: 0,
        dateStr: startStr,
        startDate: startStr,
        endDate: endStr,
      });
      continue;
    }

    let weekIncome = 0;
    let weekSpent = 0;

    // 1. Budget Allowance Allocation (when Budget Mode is ON)
    // Only elapsed days up to today receive operational liquidity; future weeks remain empty until reached.
    if (budgetConfig?.isBudgetMode) {
      const todayStr = format(referenceDate, 'yyyy-MM-dd');
      // One rule for every screen (BUD-009): only days after the user joined and up to today get allowance.
      weekIncome += Math.round(
        budgetAllowedForActiveDays(budgetConfig, startStr, endStr, {
          userJoinedDateKey: cleanUserCreated || null,
          todayDateKey: todayStr,
        })
      );
    }

    // 2. Direct Income Transactions
    for (const exp of expenses) {
      const cleanDate = exp.expense_date?.split('T')[0]?.trim();
      if (!cleanDate) continue;
      if (cleanUserCreated && cleanDate < cleanUserCreated) continue;

      if (cleanDate >= startStr && cleanDate <= endStr) {
        if (isExcludedFromTotals(exp)) continue;
        const isIncome = isIncomeCheck ? isIncomeCheck(exp) : exp.type === 'income';
        if (isIncome) {
          weekIncome += exp.amount;
        } else {
          weekSpent += exp.amount;
        }
      }
    }

    // 3. External Gullak Deposits
    for (const dep of gullakDeposits) {
      const cleanDate = dep.date?.split('T')[0]?.trim();
      if (!cleanDate) continue;
      if (cleanUserCreated && cleanDate < cleanUserCreated) continue;

      if (cleanDate >= startStr && cleanDate <= endStr) {
        if (dep.source === 'external') {
          weekIncome += dep.amount;
        }
      }
    }

    // Find the first date in [rangeStart..rangeEnd] that has an event (ascending order)
    let firstEventDate: string | null = null;
    let curDay = rangeStart;
    while (!isAfter(curDay, rangeEnd)) {
      const curStr = format(curDay, 'yyyy-MM-dd');
      const hasExp = expenses.some((exp) => {
        const c = exp.expense_date?.split('T')[0]?.trim();
        return c === curStr && (!cleanUserCreated || c >= cleanUserCreated) && exp.amount > 0;
      });
      const hasDep = gullakDeposits.some((dep) => {
        const c = dep.date?.split('T')[0]?.trim();
        return c === curStr && (!cleanUserCreated || c >= cleanUserCreated) && dep.amount > 0;
      });

      if (hasExp || hasDep) {
        firstEventDate = curStr;
        break;
      }
      curDay = addDays(curDay, 1);
    }

    totalIncome += weekIncome;
    totalSpent += weekSpent;

    weeks.push({
      day: range.label,
      subLabel: `${range.startDay}–${range.endDay}`,
      income: round2(weekIncome),
      spent: round2(weekSpent),
      dateStr: firstEventDate || startStr,
      startDate: startStr,
      endDate: endStr,
    });
  }

  totalIncome = round2(totalIncome);
  totalSpent = round2(totalSpent);

  const maxAmount = Math.max(
    ...weeks.map((w) => Math.max(w.income, w.spent)),
    0
  );

  return {
    weeks,
    totalIncome,
    totalSpent,
    maxAmount,
  };
}
