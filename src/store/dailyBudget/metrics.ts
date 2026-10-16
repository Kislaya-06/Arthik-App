import { format, parseISO } from 'date-fns';
import { useCategoryStore } from '../categoryStore';
import { useAuthStore } from '../authStore';
import { isCountedIncome } from '../../lib/transactionUtils';
import { round2 } from '../../lib/formatters';
import { computeWaterfallFromState, WaterfallResult } from '../../lib/moneyWaterfall';
import {
  buildBudgetPools,
  poolSpentBefore,
  poolKeyFor,
  dailyCarryForDate,
  dailyCarryRemaining,
  getDateOwner,
  computeCadenceStreak,
  StreakUnit,
} from '../../lib/budgetPeriods';
import {
  calculateSavingsMetrics,
  computeSpentByDate,
  DailyRecord,
} from '../../lib/budgetCalculations';
import {
  buildCategoryClassifier,
  buildEligibleIncomeClassifier,
  buildReimbursementClassifier,
} from './classifiers';
import { getCurrentExpenses, getCurrentShares } from './expenseBridge';
import type {
  GullakDeposit,
  DailyBudgetState,
} from './types';
import type {
  BudgetCadence,
  BudgetPlanChange,
  BudgetPeriodRecord,
  BudgetPeriodStatus,
} from '../../types';
import type { Expense } from '../expense/types';

let storeGetter: (() => DailyBudgetState) | null = null;
export const registerMetricsStoreGetter = (getter: () => DailyBudgetState) => {
  storeGetter = getter;
};

export const getTodayDateStr = () => format(new Date(), 'yyyy-MM-dd');

export const getUserCreatedAtLocalDate = (createdAt?: string | null): string | undefined => {
  if (!createdAt) return undefined;
  try {
    return format(parseISO(createdAt), 'yyyy-MM-dd');
  } catch {
    return createdAt.split('T')[0]?.trim();
  }
};

export const getUserCreatedAtStr = (): string | undefined =>
  getUserCreatedAtLocalDate(useAuthStore.getState().user?.created_at);

/**
 * Does the DAILY engine own this date? (Fix: a weekly / monthly plan, or Pure Mode, owns the day instead.)
 * Users with no plan history at all are old daily users: the daily engine owns every day for them.
 * Without this, a weekly user also got a daily budget record every day (a second budget on the same day).
 */
export const isDailyOwnedDate = (changes: BudgetPlanChange[] | undefined, dateStr: string): boolean =>
  !changes || changes.length === 0 ? true : getDateOwner(changes, dateStr) === 'daily';

/** Extra budget the first daily day gets from money carried over from a weekly / monthly plan ("add to tomorrow"). */
export const dailyCarryExtraFor = (dateStr: string, st?: DailyBudgetState): number => {
  const state = st ?? (storeGetter ? storeGetter() : null);
  if (!state) return 0;
  return (
    dailyCarryForDate(
      state.planChanges,
      (d) => state.dailyRecords[d]?.budget,
      state.dailyBudgetAmount,
      dateStr
    )?.extraBudget ?? 0
  );
};

/**
 * Replays all money in time order (budget -> income -> Gullak). Single source of truth shared with
 * the Home hero chips and the expense detail funding card (src/lib/moneyWaterfall.ts).
 */
export const runWaterfall = (
  overrides?: {
    records?: Record<string, DailyRecord>;
    deposits?: GullakDeposit[];
    excludeExpensesFrom?: string;
    expenses?: Expense[];
  }
): WaterfallResult => {
  const st = storeGetter ? storeGetter() : ({} as DailyBudgetState);
  const records = overrides?.records ?? st.dailyRecords ?? {};
  const todayStr = getTodayDateStr();
  return computeWaterfallFromState({
    expenses: overrides?.expenses ?? getCurrentExpenses(),
    shares: getCurrentShares(),
    categories: useCategoryStore.getState().categories,
    deposits: overrides?.deposits ?? st.gullakDeposits ?? [],
    isBudgetModeEnabled: st.isBudgetModeEnabled,
    isAutoRenew: st.isAutoRenew,
    todayStr,
    todayBudget: records[todayStr]?.budget,
    dailyBudgetAmount: st.dailyBudgetAmount,
    records,
    planChanges: st.planChanges,
    excludeExpensesFrom: overrides?.excludeExpensesFrom,
  });
};

/**
 * All budget money that ever existed, each rupee ONCE:
 *  - daily plan days: that day's budget
 *  - weekly / monthly: ONE pool per calendar period (a pool the user handed over to another cadence only counts
 *    what it really used: the rest was carried to the new cadence's budget)
 */
export const computeAllTimeBudget = (
  records: Record<string, DailyRecord>,
  planChanges: BudgetPlanChange[],
  spentByDate: Record<string, number>,
  budgetPeriods?: Record<string, BudgetPeriodRecord>
): number => {
  let total = 0;
  for (const r of Object.values(records)) {
    if (r.status === 'unknown' || !(r.budget > 0)) continue;
    if (!isDailyOwnedDate(planChanges, r.date)) continue; // a weekly / monthly / Pure day owns no daily budget
    total += Number(r.budget) || 0;
  }
  if (!planChanges || planChanges.length === 0) {
    // Old user without plan history: only period records exist (if any).
    if (budgetPeriods) for (const bp of Object.values(budgetPeriods)) total += Number(bp.budgetAmount) || 0;
    return round2(total);
  }
  const pools = buildBudgetPools(planChanges, getTodayDateStr());
  for (const pool of Object.values(pools)) {
    if (pool.closedOn) total += Math.min(pool.budget, poolSpentBefore(pools, planChanges, pool, pool.closedOn, spentByDate));
    else total += pool.budget;
  }
  return round2(total);
};

export const computeMetrics = (
  records: Record<string, DailyRecord>,
  deposits?: GullakDeposit[],
  userCreatedAt?: string,
  budgetPeriods?: Record<string, BudgetPeriodRecord>,
  currentCadence: BudgetCadence = 'daily',
  existingBestStreakByCadence?: Record<BudgetCadence, number>,
  availableIncome?: number
) => {
  const manual =
    deposits && Array.isArray(deposits)
      ? deposits.reduce((s, d) => s + (Number(d.amount) || 0), 0)
      : 0;

  let incomeAvail = availableIncome;
  if (incomeAvail === undefined) {
    const isIncomeFn = buildCategoryClassifier();
    const totalIncome = getCurrentExpenses().reduce(
      (sum, e) => sum + (isCountedIncome(e, undefined) && isIncomeFn(e) ? Number(e.amount) || 0 : 0),
      0
    );
    const incomeDeposits =
      deposits && Array.isArray(deposits)
        ? deposits.reduce((sum, d) => sum + (d.source === 'income' ? Number(d.amount) || 0 : 0), 0)
        : 0;
    incomeAvail = round2(Math.max(0, totalIncome - incomeDeposits));
  }

  const dailyMetrics = calculateSavingsMetrics(
    records,
    getTodayDateStr(),
    userCreatedAt ?? getUserCreatedAtStr(),
    new Date(),
    manual,
    incomeAvail,
    undefined,
    // Overspend really paid from Gullak (budget -> income -> Gullak), not "all overspend".
    runWaterfall({ records, deposits }).gullakDrawn
  );

  let periodsSaved = 0;
  const periodsList = budgetPeriods ? Object.values(budgetPeriods) : [];
  for (const p of periodsList) {
    periodsSaved += Number(p.amountSaved) || 0;
  }
  const rawAccumulatedSavings = round2(dailyMetrics.totalAccumulatedSavings + periodsSaved);

  // Hard Real-Money Invariant: Gullak savings cannot exceed Total Account Remaining
  const expensesList = getCurrentExpenses();
  let totalAccumulatedSavings = rawAccumulatedSavings;

  if (expensesList && expensesList.length > 0) {
    const isIncomeFn = buildCategoryClassifier();
    const isEligibleIncomeFn = buildEligibleIncomeClassifier();
    const isReimbFn = buildReimbursementClassifier();

    const st = storeGetter ? storeGetter() : null;
    const currentPlanChanges = st ? st.planChanges : [];

    const allTimeBudget = computeAllTimeBudget(
      records,
      currentPlanChanges,
      computeSpentByDate(expensesList, isIncomeFn),
      budgetPeriods
    );

    let allTimeIncome = 0;
    let allTimeReimb = 0;
    let allTimeSpent = 0;
    for (let i = 0; i < expensesList.length; i++) {
      const e = expensesList[i];
      const amt = Number(e.amount) || 0;
      if (amt <= 0) continue;
      if (isIncomeFn(e)) {
        if (isEligibleIncomeFn(e)) allTimeIncome += amt;
      } else if (isReimbFn(e)) {
        allTimeReimb += amt;
      } else {
        allTimeSpent += amt;
      }
    }

    const externalDeposits =
      deposits && Array.isArray(deposits)
        ? deposits.reduce((s, d) => s + (d.source !== 'income' ? Number(d.amount) || 0 : 0), 0)
        : 0;

    const totalInflow = round2(allTimeBudget + allTimeIncome + allTimeReimb + externalDeposits);
    const totalAccountRemaining = Math.max(0, round2(totalInflow - allTimeSpent));

    const isBudgetOn = st ? st.isBudgetModeEnabled : false;
    if (!isBudgetOn) {
      // In Pure Mode, hard cap Gullak at Total Account Remaining
      totalAccumulatedSavings = Math.min(rawAccumulatedSavings, totalAccountRemaining);
    } else {
      // In Budget Mode: overspending is absorbed first from Income, then Gullak (already computed in rawAccumulatedSavings).
      // Only cap to 0 if the entire account is in overall deficit (totalAccountRemaining <= 0).
      if (totalAccountRemaining <= 0) {
        totalAccumulatedSavings = 0;
      } else {
        totalAccumulatedSavings = rawAccumulatedSavings;
      }
    }
  }

  const todayStr = getTodayDateStr();
  const uCreatedAt = userCreatedAt ?? getUserCreatedAtStr();

  const units: StreakUnit[] = [];

  const dailyList = Object.values(records)
    .filter((r) => r.isFinalized && r.date < todayStr && (!uCreatedAt || r.date >= uCreatedAt))
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const r of dailyList) {
    const status: BudgetPeriodStatus =
      r.status === 'saved'
        ? 'saved'
        : r.status === 'exceeded'
        ? 'missed'
        : r.status === 'even'
        ? 'even'
        : 'unknown';
    units.push({
      cadence: 'daily',
      status,
      key: `daily_${r.date}`,
      date: r.date,
      amountSaved: r.saved,
    });
  }

  for (const p of periodsList) {
    units.push({
      cadence: p.cadence,
      status: p.status,
      key: p.id,
      date: p.activeStart,
      amountSaved: p.amountSaved,
    });
  }

  units.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const { currentStreak, bestByCadence } = computeCadenceStreak(units, currentCadence);

  const mergedBestByCadence: Record<BudgetCadence, number> = {
    daily: Math.max(bestByCadence.daily, existingBestStreakByCadence?.daily || 0, dailyMetrics.bestStreak),
    weekly: Math.max(bestByCadence.weekly, existingBestStreakByCadence?.weekly || 0),
    monthly: Math.max(bestByCadence.monthly, existingBestStreakByCadence?.monthly || 0),
  };

  const savingsStreak =
    currentCadence === 'daily' && periodsList.length === 0
      ? dailyMetrics.savingsStreak
      : currentStreak;

  const bestStreak =
    currentCadence === 'daily' && periodsList.length === 0
      ? dailyMetrics.bestStreak
      : mergedBestByCadence[currentCadence];

  return {
    totalAccumulatedSavings,
    savingsStreak,
    bestStreak,
    bestStreakByCadence: mergedBestByCadence,
  };
};

export const computeAvailableIncomeBalance = (): number => runWaterfall().incomeRemaining;

export const computePriorAvailableIncomeBalance = (todayStr: string = getTodayDateStr()): number =>
  runWaterfall({ excludeExpensesFrom: todayStr }).incomeRemaining;

export const computeCarryableAmount = (st: DailyBudgetState, expenses?: Expense[]): number => {
  if (!st.isBudgetModeEnabled) return 0; // Pure Mode: what is left of a pool becomes income, never "carry"
  const todayStr = getTodayDateStr();
  const plans = st.planChanges || [];
  if (plans.length === 0) return 0;
  const owner = getDateOwner(plans, todayStr);
  if (owner === 'daily') {
    // Today's unused daily money goes to Gullak tonight: nothing to carry. Only carried money that is still
    // unused (from an earlier switch) can move on.
    return dailyCarryRemaining(plans, (d) => st.dailyRecords[d]?.budget, st.dailyBudgetAmount, todayStr);
  }
  if (owner === 'weekly' || owner === 'monthly') {
    const pools = buildBudgetPools(plans, todayStr);
    const pool = pools[poolKeyFor(owner, todayStr)];
    if (!pool || pool.closedOn) return 0;
    const spentByDate = computeSpentByDate(expenses ?? getCurrentExpenses(), buildCategoryClassifier());
    const tomorrowStr = format(new Date(new Date(`${todayStr}T12:00:00`).getTime() + 86400000), 'yyyy-MM-dd');
    return round2(Math.max(0, pool.budget - poolSpentBefore(pools, plans, pool, tomorrowStr, spentByDate)));
  }
  return 0;
};

export const computeTotalAccountRemaining = (st: DailyBudgetState, expenses?: Expense[]): number => {
  const records = st.dailyRecords || {};
  const expensesList = expenses ?? getCurrentExpenses();
  const isIncomeFn = buildCategoryClassifier();
  const isEligibleIncomeFn = buildEligibleIncomeClassifier();
  const isReimbFn = buildReimbursementClassifier();

  const budget = computeAllTimeBudget(
    records,
    st.planChanges,
    computeSpentByDate(expensesList, isIncomeFn),
    st.budgetPeriods
  );

  let income = 0;
  let reimb = 0;
  let spent = 0;
  for (const e of expensesList) {
    const amt = Number(e.amount) || 0;
    if (amt <= 0) continue;
    if (isIncomeFn(e)) {
      if (isEligibleIncomeFn(e)) income += amt;
    } else if (isReimbFn(e)) {
      reimb += amt;
    } else {
      spent += amt;
    }
  }
  const external = (st.gullakDeposits || []).reduce(
    (sum, d) => sum + (d.source !== 'income' ? Number(d.amount) || 0 : 0),
    0
  );
  return round2(budget + income + reimb + external - spent);
};

export const computeGrossIncomeBalance = (
  deposits: GullakDeposit[] = [],
  expenses?: Expense[]
): number => {
  const catMap = new Map(useCategoryStore.getState().categories.map((c) => [c.id, c]));
  const totalIncome = (expenses ?? getCurrentExpenses()).reduce(
    (sum, e) =>
      sum +
      (isCountedIncome(e, e.category_id ? catMap.get(e.category_id) : undefined)
        ? Number(e.amount) || 0
        : 0),
    0
  );
  const incomeDeposits = deposits.reduce(
    (sum, d) => sum + (d.source === 'income' ? Number(d.amount) || 0 : 0),
    0
  );
  return round2(Math.max(0, totalIncome - incomeDeposits));
};

