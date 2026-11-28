import { format } from 'date-fns/format';
import { addDays } from 'date-fns/addDays';
import { isAfter } from 'date-fns/isAfter';
import { round2 } from '../formatters';
import { buildLedgerEntries, sumKindBetweenDateKeys } from '../../money/ledger';
import { externalDepositsBetween } from '../../money/inflow';
import { budgetAllowedForActiveDays, allowanceForActiveDays, type AllowanceHistory } from '../../money/budgetAllowance';

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
  userCreatedAtStr?: string,
  budgetConfig?: MonthlyCashFlowBudgetConfig,
  referenceDate: Date = new Date(),
  /** When given, budget days come from the plan history, whatever the mode is today (INS-004 / INS-006). */
  history?: AllowanceHistory
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
  const ledgerEntries = buildLedgerEntries(expenses);
  let exactBudget = 0;
  let roundedBudget = 0;

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
    let weekBudget = 0;
    if (history) {
      weekBudget = allowanceForActiveDays(history, startStr, endStr, cleanUserCreated);
    } else if (budgetConfig?.isBudgetMode) {
      const todayStr = format(referenceDate, 'yyyy-MM-dd');
      // One rule for every screen (BUD-009): only days after the user joined and up to today get allowance.
      weekBudget = budgetAllowedForActiveDays(budgetConfig, startStr, endStr, {
        userJoinedDateKey: cleanUserCreated || null,
        todayDateKey: todayStr,
      });
    }
    exactBudget += weekBudget;
    roundedBudget += Math.round(weekBudget);
    weekIncome += Math.round(weekBudget);

    // 2. Direct income, spending and 3. external Gullak deposits, from the sign-up date on.
    const countFromStr = cleanUserCreated && cleanUserCreated > startStr ? cleanUserCreated : startStr;
    weekIncome += sumKindBetweenDateKeys(ledgerEntries, 'income', countFromStr, endStr);
    weekSpent += sumKindBetweenDateKeys(ledgerEntries, 'spending', countFromStr, endStr);
    weekIncome += externalDepositsBetween(gullakDeposits, countFromStr, endStr);

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

  // INS-006: the total rounds the budget once. Each week bar keeps its own rounding.
  totalIncome = round2(totalIncome - roundedBudget + Math.round(exactBudget));
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
