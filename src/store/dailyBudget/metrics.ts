import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { subDays } from 'date-fns/subDays';
import { useAuthStore } from '../authStore';
import { isCountedIncome } from '../../lib/transactionUtils';
import { round2 } from '../../lib/formatters';
import { todayDateKey } from '../../money/dateKeys';
import { computeWaterfallFromState, WaterfallResult } from '../../lib/moneyWaterfall';
import {
  buildBudgetPools,
  poolSpentBefore,
  allTimeBudget,
  poolKeyFor,
  dailyCarryForDate,
  dailyCarryRemaining,
  periodCarryRemaining,
  getDateOwner,
  computeCadenceStreak,
  StreakUnit,
} from '../../lib/budgetPeriods';
import {
  calculateSavingsMetrics,
  computeSpentByDate,
  evaluateDayStatus,
  DailyRecord,
} from '../../lib/budgetCalculations';
import { getCurrentExpenses } from './expenseBridge';
import { isExcludedFromTotals } from '../../lib/transactionUtils';
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

export const getTodayDateStr = () => todayDateKey();

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

/**
 * Today's allowance for a day that SHOULD have one but whose unfinalized record still says 0 (FIN-16, PUR-003).
 * It happens when a scheduled Pure -> Budget Mode switch matures: the mode and auto-save flip, but the record that was
 * written while the day was still in Pure Mode keeps budget 0 (the real money for that day was never added).
 *
 * Returns the healed record, or null when nothing must change. It only ever fills a ZERO budget of an unfinalized
 * day, and only when Budget Mode, auto-save (isAutoRenew, AGENTS.md 8.1: a paused allowance stays paused) and a
 * daily plan for today are all on. A real budget (> 0) or a finalized day is never touched.
 */
export const healZeroTodayAllowance = (
  state: Pick<DailyBudgetState, 'isBudgetModeEnabled' | 'isAutoRenew' | 'dailyBudgetAmount' | 'planChanges'>,
  record: DailyRecord | undefined,
  todayStr: string,
  spent: number,
  eligibleIncome: number
): DailyRecord | null => {
  if (!state.isBudgetModeEnabled || !state.isAutoRenew) return null;
  if (!(state.dailyBudgetAmount > 0)) return null;
  if (!isDailyOwnedDate(state.planChanges, todayStr)) return null;
  if (!record || record.isFinalized || record.budget !== 0) return null;
  const budget = state.dailyBudgetAmount;
  const { saved } = evaluateDayStatus(budget, spent, eligibleIncome);
  return { ...record, budget, spent, saved, status: spent > budget ? 'missed' : 'active' };
};

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

const NO_PERIODS: Record<string, BudgetPeriodRecord> = {};

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
    budgetPeriods?: Record<string, BudgetPeriodRecord>;
  }
): WaterfallResult => {
  const st = storeGetter ? storeGetter() : ({} as DailyBudgetState);
  const records = overrides?.records ?? st.dailyRecords ?? {};
  const todayStr = getTodayDateStr();
  return computeWaterfallFromState({
    expenses: overrides?.expenses ?? getCurrentExpenses(),
    deposits: overrides?.deposits ?? st.gullakDeposits ?? [],
    isBudgetModeEnabled: st.isBudgetModeEnabled,
    isAutoRenew: st.isAutoRenew,
    todayStr,
    todayBudget: records[todayStr]?.budget,
    dailyBudgetAmount: st.dailyBudgetAmount,
    records,
    planChanges: st.planChanges,
    budgetPeriods: overrides?.budgetPeriods ?? st.budgetPeriods ?? NO_PERIODS,
    skipped: st.allowancePauses,
    savingsFrom: getUserCreatedAtStr(),
    excludeExpensesFrom: overrides?.excludeExpensesFrom,
  });
};

/** All budget money that ever existed, each rupee once (see src/lib/periods/allTimeBudget.ts). */
export const computeAllTimeBudget = (
  records: Record<string, DailyRecord>,
  planChanges: BudgetPlanChange[],
  spentByDate: Record<string, number>,
  budgetPeriods?: Record<string, BudgetPeriodRecord>,
  expenses?: Expense[]
): number =>
  allTimeBudget(
    records,
    planChanges,
    spentByDate,
    getTodayDateStr(),
    budgetPeriods,
    storeGetter ? storeGetter().allowancePauses : undefined,
    runWaterfall({ records, budgetPeriods, expenses }).pools
  );

export const computeMetrics = (
  records: Record<string, DailyRecord>,
  deposits?: GullakDeposit[],
  userCreatedAt?: string,
  budgetPeriods?: Record<string, BudgetPeriodRecord>,
  currentCadence: BudgetCadence = 'daily',
  availableIncome?: number,
  /** The expense list the caller is working with (default: the store's). */
  expenses?: Expense[]
) => {
  const manual =
    deposits && Array.isArray(deposits)
      ? deposits.reduce((s, d) => s + (Number(d.amount) || 0), 0)
      : 0;

  const incomeAvail =
    availableIncome ?? computeGrossIncomeBalance(Array.isArray(deposits) ? deposits : []);

  const waterfallResult = runWaterfall({ records, deposits, budgetPeriods, expenses });
  const dailyMetrics = calculateSavingsMetrics(
    records,
    getTodayDateStr(),
    userCreatedAt ?? getUserCreatedAtStr(),
    new Date(),
    manual,
    incomeAvail,
    undefined,
    waterfallResult.gullakDrawn
  );

  const periodsList = budgetPeriods ? Object.values(budgetPeriods) : [];

  // Gullak is the waterfall's running balance (spec 2026-11-28). It is never rebuilt or capped here.
  const totalAccumulatedSavings = waterfallResult.gullakBalance;

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
        : r.status === 'missed'
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

  // Best streaks come from the records only (ROL-002): a backdated expense / money back can lower them too.
  const mergedBestByCadence: Record<BudgetCadence, number> = {
    daily: Math.max(bestByCadence.daily, dailyMetrics.bestStreak),
    weekly: bestByCadence.weekly,
    monthly: bestByCadence.monthly,
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

/** What the budget running before `plan` starts still held at that midnight (money a carry can move). */
export const leftoverBeforeSwitch = (
  st: Pick<DailyBudgetState, 'planChanges' | 'dailyRecords' | 'dailyBudgetAmount' | 'allowancePauses'>,
  before: BudgetPlanChange[],
  plan: BudgetPlanChange,
  expenses: Expense[]
): number => {
  const lastDay = format(subDays(parseISO(plan.effectiveFrom), 1), 'yyyy-MM-dd');
  const owner = getDateOwner(before, lastDay);
  if (owner === 'daily') {
    return dailyCarryRemaining(before, (d) => st.dailyRecords[d]?.budget, st.dailyBudgetAmount, lastDay);
  }
  if (owner !== 'weekly' && owner !== 'monthly') return 0;
  const pools = buildBudgetPools(st.planChanges, plan.effectiveFrom, st.allowancePauses);
  const pool = pools[poolKeyFor(owner, lastDay)];
  if (!pool) return 0;
  const funded = runWaterfall({ expenses }).pools[pool.key]?.budget ?? pool.budget;
  const spent = poolSpentBefore(pools, st.planChanges, pool, plan.effectiveFrom, computeSpentByDate(expenses));
  return Math.max(0, funded - spent) + periodCarryRemaining(before, lastDay);
};

export const computeAvailableIncomeBalance = (): number => runWaterfall().incomeRemaining;

export const computePriorAvailableIncomeBalance = (todayStr: string = getTodayDateStr()): number =>
  runWaterfall({ excludeExpensesFrom: todayStr }).incomeRemaining;

export const computeCarryableAmount = (st: DailyBudgetState, expenses?: Expense[]): number => {
  if (!st.isBudgetModeEnabled) return 0; // Pure Mode: nothing to carry, the budget already ended
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
    const spentByDate = computeSpentByDate(expenses ?? getCurrentExpenses());
    const tomorrowStr = format(new Date(new Date(`${todayStr}T12:00:00`).getTime() + 86400000), 'yyyy-MM-dd');
    const effective = runWaterfall({ expenses: expenses ?? getCurrentExpenses() }).pools[pool.key]?.budget ?? pool.budget;
    const poolLeft = Math.max(0, effective - poolSpentBefore(pools, plans, pool, tomorrowStr, spentByDate));
    const futureCarry = periodCarryRemaining(plans, todayStr);
    return round2(poolLeft + futureCarry);
  }
  return 0;
};

export const computeTotalAccountRemaining = (st: DailyBudgetState, expenses?: Expense[]): number => {
  const records = st.dailyRecords || {};
  const expensesList = expenses ?? getCurrentExpenses();

  const budget = computeAllTimeBudget(
    records,
    st.planChanges,
    computeSpentByDate(expensesList),
    st.budgetPeriods,
    expensesList
  );

  let income = 0;
  let spent = 0;
  for (const e of expensesList) {
    const amt = Number(e.amount) || 0;
    if (amt <= 0) continue;
    // TXN-003: self-transfers (either leg) are never income and never spent.
    if (isExcludedFromTotals(e)) continue;
    if (isCountedIncome(e)) {
      income += amt;
    } else {
      spent += amt;
    }
  }
  const external = (st.gullakDeposits || []).reduce(
    (sum, d) => sum + (d.source !== 'income' ? Number(d.amount) || 0 : 0),
    0
  );
  return round2(budget + income + external - spent);
};

export const computeGrossIncomeBalance = (
  deposits: GullakDeposit[] = [],
  expenses?: Expense[]
): number => {
  const totalIncome = (expenses ?? getCurrentExpenses()).reduce(
    (sum, e) =>
      sum +
      (isCountedIncome(e)
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

