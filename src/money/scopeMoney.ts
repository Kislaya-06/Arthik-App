/**
 * Money Scope: every money figure one screen card shows, for one time window, from ONE call.
 * Home's hero card -> `heroMoney`; Savings' allowance card -> `allowanceCardMoney`.
 * The screens only render; they never wire the ledger / period / waterfall helpers themselves (ADR 0022).
 * Rules: docs/ARTHIK_CANONICAL_RULES.md (WAT, BUD, MNY, SPL). Each step below is the same call, with the
 * same inputs, the screens made before (pure move, tests/scopeMoney.test.ts proves the numbers match).
 */
import { parseISO } from 'date-fns/parseISO';
import { round2 } from '../lib/formatters';
import { filterExpenses, Filter } from '../lib/expenseFilters';
import { isDateInPeriod, FilterPeriod } from '../lib/dateFilters';
import {
  calculatePeriodSummary,
  calculateExpenseTotals,
  getExternalDepositsInPeriod,
  getCarryCoveredByDate,
  PeriodSummary,
} from '../lib/homeCalculations';
import { getCurrentPeriodSummary, PeriodSummaryInfo } from '../lib/budgetPeriods';
import { computeWaterfallFromState, summarizeScope, ScopeFunding, WaterfallResult } from '../lib/moneyWaterfall';
import { moneyBackInRows, autoSavedInScope } from '../lib/heroDetails';
import type { DailyRecord, TodayMetrics } from '../lib/budgetCalculations';
import type { BudgetCadence, BudgetPlanChange, BudgetPeriodRecord } from '../types';
import type { Expense } from '../store/expense/types';
import type { GullakDeposit } from '../store/dailyBudget/types';
import type { Category } from '../store/categoryStore';
import { calculateBudgetStatus } from './budgetStatus';
import { buildLedgerEntries, spendingTotalsByDateKey } from './ledger';

/** The stored data the figures come from (the same objects the stores hold, so caches can match them). */
export interface MoneySnapshot {
  expenses: Expense[];
  categories: Category[];
  gullakDeposits: GullakDeposit[];
  dailyRecords: Record<string, DailyRecord>;
  planChanges: BudgetPlanChange[];
  budgetPeriods: Record<string, BudgetPeriodRecord>;
  dailyBudgetAmount: number;
  isAutoRenew: boolean;
  isBudgetModeEnabled: boolean;
  budgetCadence: BudgetCadence;
  totalAccumulatedSavings: number;
}

// ─── Parts that do not depend on the Home pill ────────────────────────────────
// Kept for the last snapshot so a pill switch never re-reads the whole ledger (Home's old separate memos).

interface ScopeBase {
  catMap: Record<string, Category>;
  spentByDate: Record<string, number>;
  waterfall: WaterfallResult;
  cadencePeriodSummary: PeriodSummaryInfo | null;
  carryCoveredByDate: Record<string, number>;
}

let lastBase: { s: MoneySnapshot; today: string; base: ScopeBase } | null = null;

function sameSnapshot(a: MoneySnapshot, b: MoneySnapshot): boolean {
  return (
    a.expenses === b.expenses &&
    a.categories === b.categories &&
    a.gullakDeposits === b.gullakDeposits &&
    a.dailyRecords === b.dailyRecords &&
    a.planChanges === b.planChanges &&
    a.dailyBudgetAmount === b.dailyBudgetAmount &&
    a.isAutoRenew === b.isAutoRenew &&
    a.isBudgetModeEnabled === b.isBudgetModeEnabled &&
    a.budgetCadence === b.budgetCadence
  );
}

function scopeBase(s: MoneySnapshot, today: string): ScopeBase {
  if (lastBase && lastBase.today === today && sameSnapshot(lastBase.s, s)) return lastBase.base;

  const catMap: Record<string, Category> = {};
  for (let i = 0; i < s.categories.length; i++) {
    catMap[s.categories[i].id] = s.categories[i];
  }
  const spentByDate = spendingTotalsByDateKey(buildLedgerEntries(s.expenses, s.categories));
  // Money waterfall: budget first -> then income -> then Gullak (time ordered, shared with the
  // expense detail screen and the Gullak total). Its own cache skips the re-run when every input is the same.
  const waterfall = computeWaterfallFromState({
    expenses: s.expenses,
    categories: s.categories,
    deposits: s.gullakDeposits,
    isBudgetModeEnabled: s.isBudgetModeEnabled,
    isAutoRenew: s.isAutoRenew,
    todayStr: today,
    todayBudget: s.dailyRecords[today]?.budget,
    dailyBudgetAmount: s.dailyBudgetAmount,
    records: s.dailyRecords,
    planChanges: s.planChanges,
  });
  const cadencePeriodSummary =
    !s.isBudgetModeEnabled || s.budgetCadence === 'daily'
      ? null
      : getCurrentPeriodSummary(s.planChanges, spentByDate, today);
  // Carried-over money inside the daily budgets (from a weekly / monthly budget): already in the old budget,
  // so "All" must not count it twice.
  const carryCoveredByDate = getCarryCoveredByDate(s.planChanges, s.dailyRecords, s.dailyBudgetAmount, today);

  const base = { catMap, spentByDate, waterfall, cadencePeriodSummary, carryCoveredByDate };
  lastBase = { s, today, base };
  return base;
}

const periodOf = (filter: Filter): FilterPeriod | null =>
  filter === 'Daily' ? 'day' : filter === 'Weekly' ? 'week' : filter === 'Monthly' ? 'month' : null;

// ─── Home hero card ───────────────────────────────────────────────────────────

export interface HeroMoneyInput {
  filter: Filter;
  /** Home's "today" (`yyyy-MM-dd`). */
  today: string;
  /** The store's `getTodayRecord()` (it owns the heal / paused-allowance rules, §8.1). */
  todayRecord: DailyRecord;
  /** Account creation day (`yyyy-MM-dd`), if known. */
  userCreatedAt?: string;
}

/** Numbers for the hero details sheet (its sections and copy are built by `buildHeroDetails`). */
export interface HeroDetailsMoney {
  moneyBack: number;
  gullakAdded: number;
  activeBudgetLeft: number | undefined;
  unspentInflowLeft: number | undefined;
}

export interface HeroMoney extends PeriodSummary {
  todayBudget: number;
  todayRecordSpent: number;
  todayRemaining: number;
  isOverBudget: boolean;
  cadencePeriodSummary: PeriodSummaryInfo | null;
  details: HeroDetailsMoney;
}

export function heroMoney(s: MoneySnapshot, input: HeroMoneyInput): HeroMoney {
  const { filter, today, todayRecord, userCreatedAt } = input;
  const referenceDate = parseISO(today);
  const base = scopeBase(s, today);

  const filtered = filterExpenses(s.expenses, filter, referenceDate);
  const { totalIncome, totalSpent } = calculateExpenseTotals(filtered, base.catMap);

  const isBudgetConfigured = s.isBudgetModeEnabled && s.isAutoRenew && s.dailyBudgetAmount > 0;
  const todayBudget = isBudgetConfigured ? todayRecord.budget : 0;
  // Today's spent straight from the ledger for zero-lag live reactivity.
  const todayLiveSpent = base.spentByDate[today] || 0;
  const todayRecordSpent = filter === 'Daily' ? totalSpent : todayLiveSpent;
  const todayBudgetStatus = calculateBudgetStatus(todayBudget, todayRecordSpent);
  const todayRemaining = todayBudgetStatus.budgetLeftUnspent;
  const isOverBudget = todayBudgetStatus.isOverBudget;

  const externalDepositsInPeriod = getExternalDepositsInPeriod(s.gullakDeposits, filter, referenceDate);
  // Same waterfall the store's getAvailableIncomeBalance() runs (runWaterfall), read here without the hidden global.
  const availableIncomeBalance = base.waterfall.incomeRemaining;

  const period = periodOf(filter);
  const inScope = (d: string) => (period ? isDateInPeriod(d, period, referenceDate) : true);
  const scopeFunding: ScopeFunding = summarizeScope(base.waterfall, inScope, filter === 'All');

  const summary = calculatePeriodSummary({
    activeFilter: filter,
    dailyBudgetAmount: s.dailyBudgetAmount,
    isAutoRenew: s.isBudgetModeEnabled && s.isAutoRenew,
    todayBudget,
    dailyRecords: s.dailyRecords,
    totalIncome,
    totalSpent,
    filtered,
    userCreatedAtStr: userCreatedAt,
    referenceDate,
    externalDepositsInPeriod,
    planChanges: s.planChanges,
    todaySpent: todayRecordSpent,
    spentByDate: base.spentByDate,
    availableIncomeBalance,
    funding: { incomeRemaining: scopeFunding.incomeRemaining, gullakDrawn: scopeFunding.gullakDrawn },
    carryCoveredByDate: base.carryCoveredByDate,
  });

  const activeBudgetLeft =
    filter === 'Daily' || filter === 'All' || (s.isBudgetModeEnabled && s.budgetCadence === 'daily')
      ? todayRemaining
      : undefined;
  const totalRemainingBalance = summary.isOverBudgetPeriod ? 0 : summary.primaryAmount;
  const unspentInflowLeft =
    filter === 'All'
      ? Math.min(
          summary.periodIncome,
          Math.max(0, round2(totalRemainingBalance - (todayRemaining || 0) - (s.totalAccumulatedSavings || 0)))
        )
      : undefined;

  return {
    ...summary,
    todayBudget,
    todayRecordSpent,
    todayRemaining,
    isOverBudget,
    cadencePeriodSummary: base.cadencePeriodSummary,
    details: {
      moneyBack: moneyBackInRows(filtered),
      gullakAdded: round2(externalDepositsInPeriod + autoSavedInScope(s.dailyRecords, s.budgetPeriods, inScope)),
      activeBudgetLeft,
      unspentInflowLeft,
    },
  };
}

// ─── Savings allowance card ───────────────────────────────────────────────────

export interface AllowanceCardInput {
  /** Savings' "today" (`yyyy-MM-dd`). */
  today: string;
  /** `calculateTodayMetrics(getTodayRecord())`, from useSavingsDashboard. */
  todayMetrics: TodayMetrics;
}

export interface AllowanceCardMoney {
  /** Weekly / monthly Budget Mode: the card shows the running budget period instead of today. */
  isCadenceMode: boolean;
  cadencePeriodSummary: PeriodSummaryInfo | null;
  budget: number;
  spent: number;
  remaining: number;
  isOver: boolean;
  overAmount: number;
  progressRatio: number;
  /** Who paid this card's overspend: income first, then Gullak (WAT-001). */
  funding: ScopeFunding;
}

export function allowanceCardMoney(s: MoneySnapshot, input: AllowanceCardInput): AllowanceCardMoney {
  const { today, todayMetrics } = input;
  const base = scopeBase(s, today);
  const cadencePeriodSummary = base.cadencePeriodSummary;
  const isCadenceMode = s.isBudgetModeEnabled && s.budgetCadence !== 'daily';
  const usePeriod = isCadenceMode && cadencePeriodSummary;

  const budget = usePeriod ? cadencePeriodSummary.budget : todayMetrics.budget;
  const spent = usePeriod ? cadencePeriodSummary.spent : todayMetrics.spent;
  const remaining = usePeriod ? cadencePeriodSummary.remaining : todayMetrics.remaining;
  const isOver = usePeriod ? cadencePeriodSummary.isOver : todayMetrics.isOverBudget;
  const overAmount = usePeriod ? cadencePeriodSummary.overBy : todayMetrics.overAmount;

  const start = usePeriod ? cadencePeriodSummary.periodStart : today;
  const end = usePeriod ? cadencePeriodSummary.periodEnd : today;

  return {
    isCadenceMode,
    cadencePeriodSummary,
    budget,
    spent,
    remaining,
    isOver,
    overAmount,
    progressRatio: budget > 0 ? spent / budget : 0,
    funding: summarizeScope(base.waterfall, (d) => d >= start && d <= end),
  };
}
