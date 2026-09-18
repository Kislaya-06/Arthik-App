import { format, subDays, parseISO, isSameWeek, isSameMonth, isSameYear } from 'date-fns';

export interface DailyRecord {
  date: string; // 'yyyy-MM-dd'
  budget: number;
  spent: number;
  saved: number;
  isFinalized: boolean;
  status: 'saved' | 'exceeded' | 'even' | 'active' | 'unknown';
  needsUpload?: boolean;
}

export interface SavingsMetrics {
  totalAccumulatedSavings: number;
  savingsStreak: number;
  bestStreak: number;
}

/**
 * Pure calculation engine for Gullak savings, current streak, and best streak.
 *
 * @param records Map of date strings to DailyRecord objects.
 * @param todayStr Current date formatted as 'yyyy-MM-dd'.
 * @param userCreatedAtStr User registration date formatted as 'yyyy-MM-dd', or undefined.
 * @param referenceDate Explicit reference date used as the anchor for current streak calculation.
 */
export const calculateSavingsMetrics = (
  records: Record<string, DailyRecord>,
  todayStr: string,
  userCreatedAtStr: string | undefined,
  referenceDate: Date
): SavingsMetrics => {
  let totalSaved = 0;
  let totalOverspent = 0;
  const userCreatedAt = userCreatedAtStr;

  Object.values(records).forEach((r) => {
    // Check confirmed finalized past days that are on or after the user registered
    if (r.isFinalized && r.date < todayStr) {
      if (userCreatedAt && r.date < userCreatedAt) {
        // Pre-registration backdated days do not affect Gullak savings or penalty
        return;
      }
      // 'unknown' days do not affect Gullak savings or penalties
      if (r.status === 'unknown') {
        return;
      }
      if (r.budget > 0 && r.spent > r.budget) {
        totalOverspent += (r.spent - r.budget);
      } else if ((r.saved || 0) > 0) {
        totalSaved += (r.saved || 0);
      }
    }
  });

  // Include today's live overspend if user spent more than today's budget
  const todayRec = records[todayStr];
  if (todayRec && todayRec.budget > 0 && todayRec.spent > todayRec.budget) {
    totalOverspent += (todayRec.spent - todayRec.budget);
  }

  // Net accumulated savings cannot drop below 0
  const netSavings = Math.max(0, totalSaved - totalOverspent);

  const confirmedSavedDays = Object.values(records).filter(
    (r) => r.isFinalized && r.date < todayStr && r.status === 'saved' && (r.saved || 0) > 0 && (!userCreatedAt || r.date >= userCreatedAt)
  ).length;

  let streak = 0;
  let dayCheck = subDays(referenceDate, 1);
  while (true) {
    const dStr = format(dayCheck, 'yyyy-MM-dd');
    if (userCreatedAt && dStr < userCreatedAt) {
      break;
    }
    const rec = records[dStr];
    if (rec && rec.isFinalized) {
      // 'unknown' days neither extend nor break the streak: skip and continue checking earlier days
      if (rec.status === 'unknown') {
        dayCheck = subDays(dayCheck, 1);
        continue;
      }
      if (rec.status === 'saved' && (rec.saved || 0) > 0) {
        streak++;
        dayCheck = subDays(dayCheck, 1);
        continue;
      }
    }
    // Any other status (exceeded, even, active, or missing unfinalized day) breaks the streak
    break;
  }

  let maxStreak = 0;
  let currentRun = 0;
  const finalizedSavedRecords = Object.values(records)
    .filter((r) => r.isFinalized && r.date < todayStr && r.status === 'saved' && (r.saved || 0) > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  for (let i = 0; i < finalizedSavedRecords.length; i++) {
    const rec = finalizedSavedRecords[i];
    if (i === 0) {
      currentRun = 1;
    } else {
      const prevDate = new Date(finalizedSavedRecords[i - 1].date);
      const curDate = new Date(rec.date);
      const diffDays = Math.round((curDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentRun++;
      } else {
        // Check if all days in between are 'unknown' — an unknown day should neither extend nor break a streak
        let allIntermediateUnknown = true;
        for (let step = 1; step < diffDays; step++) {
          const intermediateDate = new Date(prevDate);
          intermediateDate.setDate(prevDate.getDate() + step);
          const intermediateStr = format(intermediateDate, 'yyyy-MM-dd');
          if (records[intermediateStr]?.status !== 'unknown') {
            allIntermediateUnknown = false;
            break;
          }
        }
        if (allIntermediateUnknown) {
          currentRun++;
        } else {
          currentRun = 1;
        }
      }
    }
    if (currentRun > maxStreak) {
      maxStreak = currentRun;
    }
  }

  if (confirmedSavedDays === 0) {
    streak = 0;
    maxStreak = 0;
  } else if (streak > confirmedSavedDays) {
    streak = confirmedSavedDays;
  }
  const bestStreak = confirmedSavedDays === 0 ? 0 : Math.max(maxStreak, streak);

  return {
    totalAccumulatedSavings: netSavings,
    savingsStreak: streak,
    bestStreak,
  };
};

export type DayStatus = 'saved' | 'exceeded' | 'even' | 'active' | 'unknown';

export interface DayEvaluation {
  saved: number;
  status: 'saved' | 'exceeded' | 'even' | 'unknown';
}

/**
 * Evaluates savings and DayStatus for a finalized day given its budget and spending.
 *
 * @param budget Daily budget amount.
 * @param spent Amount spent on that day.
 */
export const evaluateDayStatus = (
  budget: number,
  spent: number
): DayEvaluation => {
  if (budget <= 0) {
    return {
      saved: 0,
      status: 'unknown',
    };
  }

  const saved = Math.max(0, budget - spent);
  const status = spent > budget ? 'exceeded' : saved > 0 ? 'saved' : 'even';
  return { saved, status };
};

export interface ExpenseItem {
  amount: number | string;
  type?: 'expense' | 'income';
  category_id?: string | null;
  expense_date?: string;
}

export interface NonIncomeExpenseEntry {
  date: string;
  amount: number;
}

/**
 * Extracts date ('yyyy-MM-dd') and amount for non-income expenses.
 * Returns null if the expense is income or has no clean date.
 */
export const extractNonIncomeExpense = <T extends ExpenseItem>(
  expense: T,
  isIncomeFn: (expense: T) => boolean
): NonIncomeExpenseEntry | null => {
  const isIncome = isIncomeFn(expense);
  const cleanDate = expense.expense_date?.split('T')[0]?.trim();
  if (!isIncome && cleanDate) {
    return {
      date: cleanDate,
      amount: Number(expense.amount) || 0,
    };
  }
  return null;
};

/**
 * Groups all non-income expenses by date ('yyyy-MM-dd') in a single pass.
 */
export const computeSpentByDate = <T extends ExpenseItem>(
  expenses: T[],
  isIncomeFn: (expense: T) => boolean
): Record<string, number> => {
  const spentByDate: Record<string, number> = {};
  for (let i = 0; i < expenses.length; i++) {
    const entry = extractNonIncomeExpense(expenses[i], isIncomeFn);
    if (entry) {
      spentByDate[entry.date] = (spentByDate[entry.date] || 0) + entry.amount;
    }
  }
  return spentByDate;
};

/**
 * Computes non-income spending for a single target date ('yyyy-MM-dd').
 * Loops once and sums only rows matching targetDate using extractNonIncomeExpense.
 */
export const computeSpentForDate = <T extends ExpenseItem>(
  expenses: T[],
  targetDate: string,
  isIncomeFn: (expense: T) => boolean
): number => {
  let totalSpent = 0;
  for (let i = 0; i < expenses.length; i++) {
    const entry = extractNonIncomeExpense(expenses[i], isIncomeFn);
    if (entry && entry.date === targetDate) {
      totalSpent += entry.amount;
    }
  }
  return totalSpent;
};

/**
 * Constructs the default DailyRecord for today when not present in state.
 */
export const buildDefaultTodayRecord = (
  todayStr: string,
  isAutoRenew: boolean,
  dailyBudgetAmount: number
): DailyRecord => {
  const budget = isAutoRenew ? dailyBudgetAmount : 0;
  return {
    date: todayStr,
    budget,
    spent: 0,
    saved: budget,
    isFinalized: false,
    status: 'active',
  };
};

/**
 * Filters out today's record and sorts past (and future) records in descending order by date.
 */
export const filterPastRecords = (
  records: Record<string, DailyRecord> | DailyRecord[],
  todayStr: string
): DailyRecord[] => {
  const recordList = Array.isArray(records) ? records : Object.values(records);
  return recordList
    .filter((r) => r.date !== todayStr)
    .sort((a, b) => b.date.localeCompare(a.date));
};

/**
 * Determines whether a Supabase upsert to daily_savings_log should ignore duplicates
 * (ON CONFLICT DO NOTHING).
 *
 * Ticket 02: Real finalized days ('saved', 'exceeded', 'even') must always overwrite/update
 * the remote record. Only untracked days ('unknown') are insert-only to prevent blank gap fills
 * from overwriting existing server records.
 */
export const shouldIgnoreDuplicates = (status: DayStatus): boolean => {
  return status === 'unknown';
};

export type SavingsFilter = 'All' | 'This Week' | 'This Month';

export interface TodayMetrics {
  budget: number;
  spent: number;
  remaining: number;
  progressRatio: number;
  isOverBudget: boolean;
  overAmount: number;
}

/**
 * Derives live allowance display metrics for today from the given today record.
 */
export const calculateTodayMetrics = (todayRecord: DailyRecord): TodayMetrics => {
  const budget = todayRecord.budget;
  const spent = todayRecord.spent;
  const remaining = Math.max(0, budget - spent);
  const progressRatio = budget > 0 ? Math.min(spent / budget, 1) : 0;
  const isOverBudget = budget > 0 && spent > budget;
  const overAmount = isOverBudget ? spent - budget : 0;

  return {
    budget,
    spent,
    remaining,
    progressRatio,
    isOverBudget,
    overAmount,
  };
};

/**
 * Pure filter for past savings records based on an explicit reference date.
 * Week boundary strictly starts on Monday ({ weekStartsOn: 1 }).
 * Month boundary strictly checks same month and same year.
 */
export const filterSavingsRecords = (
  records: DailyRecord[],
  filter: SavingsFilter,
  referenceDate: Date
): DailyRecord[] => {
  if (filter === 'All') return records;

  return records.filter((rec) => {
    try {
      const d = parseISO(rec.date);
      if (filter === 'This Week') {
        return isSameWeek(d, referenceDate, { weekStartsOn: 1 });
      } else if (filter === 'This Month') {
        return isSameMonth(d, referenceDate) && isSameYear(d, referenceDate);
      }
    } catch {
      return false;
    }
    return true;
  });
};

