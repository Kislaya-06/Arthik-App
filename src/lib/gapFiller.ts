import { format } from 'date-fns/format';
import { subDays } from 'date-fns/subDays';
import { parseISO } from 'date-fns/parseISO';
import { isDailyOwnedDate } from '../store/dailyBudget/metrics';
import { getStoredList, setStoredList } from './asyncStorageList';
import type { DailyRecord } from './budgetCalculations';
import type { BudgetPlanChange } from '../types';
import type { Expense } from '../store/expense/types';

export interface FindInactiveGapDaysParams {
  todayStr: string;
  userCreatedAt?: string;
  planChanges?: BudgetPlanChange[];
  dailyRecords: Record<string, DailyRecord>;
  expenses: Expense[];
  dismissedDates?: string[];
  isBudgetModeEnabled: boolean;
  isAutoRenew: boolean;
  dailyBudgetAmount: number;
  lookbackDays?: number;
}

const DISMISSED_GAP_DATES_PREFIX = '@arthik_dismissed_gap_dates_';

export const getStoredDismissedGapDates = async (userId: string): Promise<string[]> => {
  if (!userId) return [];
  return getStoredList<string>(`${DISMISSED_GAP_DATES_PREFIX}${userId}`);
};

export const storeDismissedGapDates = async (userId: string, dates: string[]): Promise<void> => {
  if (!userId || !dates.length) return;
  const existing = await getStoredDismissedGapDates(userId);
  const merged = Array.from(new Set([...existing, ...dates]));
  await setStoredList(`${DISMISSED_GAP_DATES_PREFIX}${userId}`, merged);
};

/**
 * Identifies past zero-activity calendar days where an active Daily budget user
 * did not log any transactions and did not open the app to create a daily record.
 * 
 * Rules:
 * - Budget Mode must be active
 * - Auto-renew must be enabled
 * - Daily budget amount must be > 0
 * - Date must be governed by 'daily' cadence
 * - Date must be on or after user account creation date
 * - Date must not already have a daily record
 * - Date must not have any logged expenses
 * - Date must not have been previously dismissed
 * - Capped at lookbackDays (default 7 days) to prevent phantom balances
 */
export function findInactiveGapDays(params: FindInactiveGapDaysParams): string[] {
  const {
    todayStr,
    userCreatedAt,
    planChanges,
    dailyRecords,
    expenses,
    dismissedDates = [],
    isBudgetModeEnabled,
    isAutoRenew,
    dailyBudgetAmount,
    lookbackDays = 7,
  } = params;

  if (!isBudgetModeEnabled || !isAutoRenew || dailyBudgetAmount <= 0) {
    return [];
  }

  // Pre-calculate dates with expenses
  const datesWithExpenses = new Set<string>();
  for (let i = 0; i < expenses.length; i++) {
    const e = expenses[i];
    if (e.expense_date && e.expense_date < todayStr) {
      datesWithExpenses.add(e.expense_date);
    }
  }

  const dismissedSet = new Set(dismissedDates);
  const gapDates: string[] = [];

  const todayDate = parseISO(todayStr);
  const maxDays = Math.min(Math.max(1, lookbackDays), 14);

  for (let i = 1; i <= maxDays; i++) {
    const dateStr = format(subDays(todayDate, i), 'yyyy-MM-dd');

    // Stop if before user account creation
    if (userCreatedAt && dateStr < userCreatedAt) {
      break;
    }

    // Must be governed by daily cadence
    if (!isDailyOwnedDate(planChanges, dateStr)) {
      continue;
    }

    // If dismissed, skip
    if (dismissedSet.has(dateStr)) {
      continue;
    }

    // If daily record already exists (e.g. finalized or active), skip
    if (dailyRecords[dateStr]) {
      continue;
    }

    // If user logged any expense on this date, skip
    if (datesWithExpenses.has(dateStr)) {
      continue;
    }

    gapDates.push(dateStr);
  }

  // Return chronological (oldest first)
  return gapDates.sort();
}
