import { format, subDays } from 'date-fns';
import { isDateInPeriod, FilterPeriod } from './dateFilters';
import { round2 } from './formatters';

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
  referenceDate: Date,
  manualDeposits: number = 0,
  availableIncome: number = 0,
  totalAccountRemaining?: number
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

  // Deduct from income first! Only overspent amount exceeding available income touches Gullak savings
  const effectiveOverspent = Math.max(0, round2(totalOverspent - Math.max(0, availableIncome)));

  // Net accumulated savings cannot drop below 0 (includes manual Gullak deposits)
  let netSavings = Math.max(0, round2(totalSaved - effectiveOverspent + manualDeposits));
  if (totalAccountRemaining !== undefined) {
    netSavings = Math.min(netSavings, Math.max(0, round2(totalAccountRemaining)));
  }

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
  // Invariant: maxStreak cannot exceed confirmedSavedDays because both are computed
  // over the same post-registration set. If maxStreak ever exceeds confirmedSavedDays,
  // a filter has drifted and should be investigated/fixed rather than clamped away.
  const finalizedSavedRecords = Object.values(records)
    .filter(
      (r) =>
        r.isFinalized &&
        r.date < todayStr &&
        r.status === 'saved' &&
        (r.saved || 0) > 0 &&
        (!userCreatedAt || r.date >= userCreatedAt)
    )
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
    // Redundant given the post-registration filter on finalizedSavedRecords,
    // kept as a harmless explicit statement of the invariant.
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
 * Evaluates savings and DayStatus for a finalized day given its budget, spending, and eligible income.
 * Uses the canonical calculateCycleFinancials engine.
 *
 * @param budget Daily budget amount.
 * @param spent Amount spent on that day.
 * @param eligibleIncome Optional additional eligible income received on that day.
 */
export const evaluateDayStatus = (
  budget: number,
  spent: number,
  eligibleIncome: number = 0,
  _baseBudget?: number,
  eligibleReimbursements: number = 0
): DayEvaluation => {
  const result = calculateCycleFinancials({
    scheduledBudget: budget,
    eligibleIncome: typeof eligibleIncome === 'number' && eligibleIncome > 0 ? eligibleIncome : 0,
    eligibleReimbursements: typeof eligibleReimbursements === 'number' && eligibleReimbursements > 0 ? eligibleReimbursements : 0,
    spent,
  });
  return { saved: result.gullakDeposit, status: result.status };
};

export interface ExpenseItem {
  amount: number | string;
  type?: 'expense' | 'income';
  category_id?: string | null;
  expense_date?: string;
  transaction_class?: string | null;
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
  // Self-transfers (either leg) and reimbursements are never money spent.
  if (expense.transaction_class === 'self_transfer' || expense.transaction_class === 'reimbursement') return null;
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
      spentByDate[entry.date] = round2((spentByDate[entry.date] || 0) + entry.amount);
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
      totalSpent = round2(totalSpent + entry.amount);
    }
  }
  return totalSpent;
};

/**
 * Extracts date ('yyyy-MM-dd') and amount for eligible income entries.
 * Returns null if the entry is not income or has no clean date.
 */
export const extractEligibleIncome = <T extends ExpenseItem>(
  expense: T,
  isEligibleIncomeFn: (expense: T) => boolean
): NonIncomeExpenseEntry | null => {
  const isIncome = isEligibleIncomeFn(expense);
  const cleanDate = expense.expense_date?.split('T')[0]?.trim();
  if (isIncome && cleanDate) {
    const amt = Number(expense.amount);
    return {
      date: cleanDate,
      amount: Number.isFinite(amt) && amt > 0 ? amt : 0,
    };
  }
  return null;
};

/**
 * Groups all eligible incoming money by date ('yyyy-MM-dd') in a single pass.
 */
export const computeIncomeByDate = <T extends ExpenseItem>(
  expenses: T[],
  isEligibleIncomeFn: (expense: T) => boolean
): Record<string, number> => {
  const incomeByDate: Record<string, number> = {};
  for (let i = 0; i < expenses.length; i++) {
    const entry = extractEligibleIncome(expenses[i], isEligibleIncomeFn);
    if (entry) {
      incomeByDate[entry.date] = round2((incomeByDate[entry.date] || 0) + entry.amount);
    }
  }
  return incomeByDate;
};

/**
 * Computes eligible incoming money for a single target date ('yyyy-MM-dd').
 */
export const computeIncomeForDate = <T extends ExpenseItem>(
  expenses: T[],
  targetDate: string,
  isEligibleIncomeFn: (expense: T) => boolean
): number => {
  let totalIncome = 0;
  for (let i = 0; i < expenses.length; i++) {
    const entry = extractEligibleIncome(expenses[i], isEligibleIncomeFn);
    if (entry && entry.date === targetDate) {
      totalIncome = round2(totalIncome + entry.amount);
    }
  }
  return totalIncome;
};

/**
 * Extracts date and amount for confirmed reimbursements (real incoming cash that repays a friend share).
 * These are NOT income; they feed the separate `eligibleReimbursements` channel.
 */
export const extractEligibleReimbursement = <T extends ExpenseItem>(
  expense: T,
  isReimbursementFn: (expense: T) => boolean
): NonIncomeExpenseEntry | null => {
  const cleanDate = expense.expense_date?.split('T')[0]?.trim();
  if (cleanDate && isReimbursementFn(expense)) {
    const amt = Number(expense.amount);
    return { date: cleanDate, amount: Number.isFinite(amt) && amt > 0 ? amt : 0 };
  }
  return null;
};

export const computeReimbursementsByDate = <T extends ExpenseItem>(
  expenses: T[],
  isReimbursementFn: (expense: T) => boolean
): Record<string, number> => {
  const byDate: Record<string, number> = {};
  for (let i = 0; i < expenses.length; i++) {
    const entry = extractEligibleReimbursement(expenses[i], isReimbursementFn);
    if (entry) byDate[entry.date] = round2((byDate[entry.date] || 0) + entry.amount);
  }
  return byDate;
};

export const computeReimbursementsForDate = <T extends ExpenseItem>(
  expenses: T[],
  targetDate: string,
  isReimbursementFn: (expense: T) => boolean
): number => {
  let total = 0;
  for (let i = 0; i < expenses.length; i++) {
    const entry = extractEligibleReimbursement(expenses[i], isReimbursementFn);
    if (entry && entry.date === targetDate) total = round2(total + entry.amount);
  }
  return total;
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

export type SavingsFilter = 'All' | 'This Week' | 'This Month' | 'Deposits';

export interface TodayMetrics {
  budget: number;
  spent: number;
  remaining: number;
  progressRatio: number;
  isOverBudget: boolean;
  overAmount: number;
  saved: number;
}

/**
 * Derives live allowance display metrics for today from the given today record.
 */
export const calculateTodayMetrics = (todayRecord: DailyRecord): TodayMetrics => {
  const budget = round2(todayRecord.budget);
  const spent = round2(todayRecord.spent);
  const remaining = Math.max(0, round2(budget - spent));
  const progressRatio = budget > 0 ? Math.min(spent / budget, 1) : 0;
  const isOverBudget = budget > 0 && spent > budget;
  const overAmount = isOverBudget ? round2(spent - budget) : 0;
  const saved = round2(todayRecord.saved);

  return {
    budget,
    spent,
    remaining,
    progressRatio,
    isOverBudget,
    overAmount,
    saved,
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
  if (filter === 'All' || filter === 'Deposits') return records;

  const period: FilterPeriod = filter === 'This Week' ? 'week' : 'month';
  return records.filter((rec) => isDateInPeriod(rec.date, period, referenceDate));
};

export interface RolloverNotificationParams {
  date: string;
  yesterdayStr: string;
  saved: number;
  isExpensesLoaded: boolean;
  skipRolloverNotification?: boolean;
  lastRolloverNotifiedDate: string | null;
}

/**
 * Evaluates whether a daily savings rollover notification should be sent for a given past date.
 *
 * Invariants:
 * 1. Only evaluates for yesterday (date === yesterdayStr).
 * 2. Only notifies if savings were actually positive (saved > 0).
 * 3. Never notifies before expenses are confirmed loaded from Supabase or cache (isExpensesLoaded).
 * 4. Strictly respects caller opt-out (skipRolloverNotification).
 * 5. Strictly enforces once-per-day guarantee (lastRolloverNotifiedDate !== date).
 */
export const shouldSendRolloverNotification = (params: RolloverNotificationParams): boolean => {
  if (params.date !== params.yesterdayStr) return false;
  if (params.saved <= 0) return false;
  if (!params.isExpensesLoaded) return false;
  if (params.skipRolloverNotification) return false;
  if (params.lastRolloverNotifiedDate === params.date) return false;
  return true;
};

export interface CycleFinancialInput {
  /** The base budget allocated for this cycle (Daily allowance, Weekly budget, or Monthly budget) */
  scheduledBudget: number;
  /** Direct eligible income received in this cycle (excluding self-transfers) */
  eligibleIncome?: number;
  /** Recovered friend shares / refunds that offset spending */
  eligibleReimbursements?: number;
  /** Carried-over unspent allocation from a previous period/cadence switch (if additive) */
  carriedOverAmount?: number;
  /** Total non-income expenses incurred in this cycle */
  spent: number;
}

export interface CycleFinancialResult {
  /** Total spendable money in the pool: scheduledBudget + carriedOver + eligibleIncome + reimbursements */
  spendable: number;
  /** Total spent in this cycle */
  spent: number;
  /** Real unspent money remaining in the cycle: max(0, spendable - spent) */
  remaining: number;
  /** True if user spent more than the total spendable pool */
  isOverBudget: boolean;
  /** Amount exceeded beyond spendable (0 if within budget) */
  overAmount: number;
  /** EXACT amount to deposit into Gullak at cycle close (guaranteed == remaining) */
  gullakDeposit: number;
  /** Canonical status for the period/day */
  status: 'saved' | 'exceeded' | 'even' | 'unknown';
}

/**
 * THE CANONICAL FINANCIAL ENGINE FOR ALL ARTHIK CYCLES.
 * Single source of truth for Daily, Weekly, Monthly, and Gullak calculations.
 */
export const calculateCycleFinancials = (input: CycleFinancialInput): CycleFinancialResult => {
  const budget = Math.max(0, input.scheduledBudget || 0);
  const carried = Math.max(0, input.carriedOverAmount || 0);
  const income = Math.max(0, input.eligibleIncome || 0);
  const reimbursements = Math.max(0, input.eligibleReimbursements || 0);
  const spent = Math.max(0, round2(input.spent || 0));

  const spendable = round2(budget + carried + income + reimbursements);

  if (spendable <= 0 && spent <= 0) {
    return {
      spendable: 0,
      spent: 0,
      remaining: 0,
      isOverBudget: false,
      overAmount: 0,
      gullakDeposit: 0,
      status: 'unknown',
    };
  }

  const remaining = round2(Math.max(0, spendable - spent));
  const isOverBudget = spent > spendable && spendable > 0;
  const overAmount = isOverBudget ? round2(spent - spendable) : 0;
  const gullakDeposit = isOverBudget ? 0 : remaining;

  let status: 'saved' | 'exceeded' | 'even' | 'unknown';
  if (spendable <= 0) {
    status = 'unknown';
  } else if (isOverBudget) {
    status = 'exceeded';
  } else if (remaining > 0) {
    status = 'saved';
  } else {
    status = 'even';
  }

  return {
    spendable,
    spent,
    remaining,
    isOverBudget,
    overAmount,
    gullakDeposit,
    status,
  };
};


