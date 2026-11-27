/**
 * moneyWaterfall.ts
 *
 * THE single source of truth for "where did my money come from?".
 *
 * Rules (confirmed by product owner):
 *  1. Every expense is paid FIRST from the budget of the user's active cadence
 *     (the day for daily, the week for weekly, the month for monthly).
 *  2. Only when that budget is used up, the rest is paid from INCOME.
 *  3. Only when income is also used up, the rest is paid from GULLAK.
 *  4. Income NEVER moves into Gullak by itself. Gullak receives only
 *     (a) the unspent BUDGET at the natural end of a cadence period, and
 *     (b) manual deposits.
 *
 * Money is replayed in time order, so income that arrives TODAY is never eaten by an
 * overspend that happened BEFORE it arrived. Home chips, the Gullak total and the
 * expense-detail funding card all read from this one function, so they can never disagree.
 *
 * Order inside one day: budget endings / returns of that midnight, then income, then deposits, then expenses
 * (sorted by created_at, then id), then that day's unspent daily budget goes to Gullak.
 *
 * With `budgetPeriods` passed, Gullak is ONE running balance, built here and nowhere else: it never goes below
 * zero, and what nothing can cover is a `deficit` that only later INCOME pays (spec 2026-11-28 rules 3-6).
 */

import { todayDateKey, addDaysToDateKey } from '../money/dateKeys';
import { round2 } from './formatters';
import type { AllowancePause } from './allowancePauses';
import {
  resolvePlanForDate,
  buildBudgetPools,
  poolForDate,
  isPoolClosedOn,
  getDateOwner,
  droppedCarries,
  BudgetPool,
  BUDGET_RULES_V2_FROM,
} from './budgetPeriods';
import { isCountedExpense, isCountedIncome } from './transactionUtils';
import type { BudgetPeriodRecord, BudgetPlanChange } from '../types';

export type WaterfallKind = 'expense' | 'income';

export interface WaterfallTx {
  id: string;
  /** yyyy-MM-dd */
  date: string;
  createdAt?: string;
  amount: number;
  kind: WaterfallKind;
}

export interface WaterfallPool {
  /** Same key = same budget pool (a day, a week or a month). */
  key: string;
  budget: number;
  /** The pool is not the running budget on the asked date: nothing is left in it. */
  closed?: boolean;
  /**
   * Pure Mode day with no budget left to use: the whole expense is an overspend (income first, then Gullak),
   * exactly as in Budget Mode. Pure Mode only changes the screen, never the money.
   */
  pure?: boolean;
}

export type PoolResolver = (date: string) => WaterfallPool | null;

export interface IncomeDepositLike {
  /** Missing date = applied after everything else. */
  date?: string;
  amount: number | string;
  source?: 'income' | 'external';
}

export interface ExpenseFundingSplit {
  fromBudget: number;
  fromIncome: number;
  fromGullak: number;
  /** What nothing could cover (added to the deficit). */
  short: number;
  /** Amount beyond the budget pool (fromIncome + fromGullak + short). */
  overspend: number;
  /** False when no budget governed that date (Pure Mode / paused). Nothing is drawn then. */
  governed: boolean;
}

export interface DayFunding {
  incomeReceived: number;
  spent: number;
  overspend: number;
  incomeUsed: number;
  gullakDrawn: number;
}

export interface WaterfallResult {
  byExpense: Record<string, ExpenseFundingSplit>;
  byDate: Record<string, DayFunding>;
  incomeReceived: number;
  /** Income left right now (after overspends and income -> Gullak deposits). */
  incomeRemaining: number;
  incomeUsed: number;
  gullakDrawn: number;
  /** Money in Gullak right now. Only meaningful when savings are tracked. */
  gullakBalance: number;
  /** Spending nothing could cover yet. The next income pays it. */
  deficit: number;
  /** Weekly / monthly pools: effective budget (after any return from Pure Mode), spent so far, closed or not. */
  pools: Record<string, { budget: number; spent: number; closed: boolean }>;
  /** What each pool put into Gullak. `date` is the last day of the stretch that ended. */
  poolSavings: Array<{ key: string; date: string; amount: number }>;
}

const emptyDay = (): DayFunding => ({
  incomeReceived: 0,
  spent: 0,
  overspend: 0,
  incomeUsed: 0,
  gullakDrawn: 0,
});

export interface ComputeWaterfallParams {
  txs: WaterfallTx[];
  /** Only deposits with source === 'income' touch the income pool. Others are ignored here. */
  deposits?: IncomeDepositLike[];
  resolvePool: PoolResolver;
  /** Ignore EXPENSES on/after this date (incomes are still counted). Used for "prior" balance. */
  excludeExpensesFrom?: string;
  /**
   * When no budget governs a date (Pure Mode, paused, zero budget) the default is to leave income and
   * Gullak untouched. Set true to treat the whole expense as overspend (income first, then Gullak).
   * Only the expense-detail card uses this for Pure Mode.
   */
  ungovernedAsOverspend?: boolean;
  /**
   * Track Gullak as a running balance: unspent daily budgets (`credits`, added at the end of their date) and the
   * weekly / monthly `pools`. Omitted = draws are not limited (unit use of the replay only).
   */
  savings?: { credits: Array<{ date: string; amount: number }>; pools: BudgetPool[] };
  /** "Today": pools that ended before this date are settled. */
  asOf?: string;
}

type PoolEvent = { date: string; pool: BudgetPool; type: 'end' | 'return'; lastDate: string };

/** The midnights on which pools give money to Gullak ('end') or take it back ('return'), oldest first. */
function poolEvents(pools: BudgetPool[], asOf?: string): PoolEvent[] {
  const out: PoolEvent[] = [];
  const reached = (date: string) => !asOf || date <= asOf;
  for (const pool of pools) {
    for (const c of pool.closures) {
      if (c.reason !== 'carry' && reached(c.from)) {
        out.push({ date: c.from, pool, type: 'end', lastDate: addDaysToDateKey(c.from, -1) });
      }
      if (c.reason === 'pure' && c.to && reached(c.to)) out.push({ date: c.to, pool, type: 'return', lastDate: c.to });
    }
    const after = addDaysToDateKey(pool.periodEnd, 1);
    if (!pool.closures.some((c) => c.to === null) && reached(after)) {
      out.push({ date: after, pool, type: 'end', lastDate: pool.periodEnd });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function computeMoneyWaterfall(params: ComputeWaterfallParams): WaterfallResult {
  const { txs, deposits = [], resolvePool, excludeExpensesFrom, ungovernedAsOverspend = false, savings, asOf } = params;

  const byDateTx = new Map<string, WaterfallTx[]>();
  for (const tx of txs) {
    if (!tx.date || !(tx.amount > 0)) continue;
    if (excludeExpensesFrom && tx.kind === 'expense' && tx.date >= excludeExpensesFrom) continue;
    const list = byDateTx.get(tx.date);
    if (list) list.push(tx);
    else byDateTx.set(tx.date, [tx]);
  }
  const incomeDeposits = new Map<string, number>();
  const newMoney = new Map<string, number>();
  for (const d of deposits) {
    const amt = Number(d.amount) || 0;
    if (amt <= 0) continue;
    const key = d.date?.split('T')[0] || '9999-12-31';
    const map = d.source === 'income' ? incomeDeposits : newMoney;
    map.set(key, round2((map.get(key) || 0) + amt));
  }
  const credits = new Map<string, number>();
  for (const c of savings?.credits ?? []) {
    if (c.amount > 0) credits.set(c.date, round2((credits.get(c.date) || 0) + c.amount));
  }
  const events = savings ? poolEvents(savings.pools, asOf) : [];

  const dates = Array.from(
    new Set([...byDateTx.keys(), ...incomeDeposits.keys(), ...newMoney.keys(), ...credits.keys(), ...events.map((e) => e.date)])
  ).sort();

  const byExpense: Record<string, ExpenseFundingSplit> = {};
  const byDate: Record<string, DayFunding> = {};
  const poolSpent: Record<string, number> = {};
  const poolBudgets: Record<string, number> = {};
  for (const p of savings?.pools ?? []) poolBudgets[p.key] = round2(p.budget);
  /** Pool money moved to Gullak by an ending, and the Gullak draws counted up to that moment. */
  const moved: Record<string, { amount: number; drawnBefore: number }> = {};
  const poolSavings: WaterfallResult['poolSavings'] = [];

  let incomeAvail = 0;
  let incomeReceived = 0;
  let incomeUsed = 0;
  let gullakDrawn = 0;
  let gullak = 0;
  let deficit = 0;

  const applyPoolEvent = ({ pool, type, lastDate }: PoolEvent) => {
    const spent = poolSpent[pool.key] || 0;
    if (type === 'end') {
      const left = Math.max(0, round2(poolBudgets[pool.key] - spent));
      gullak = round2(gullak + left);
      moved[pool.key] = { amount: left, drawnBefore: gullakDrawn };
      poolSavings.push({ key: pool.key, date: lastDate, amount: left });
      return;
    }
    // Rule 19: what was moved comes back, minus what Gullak had to pay in between.
    const m = moved[pool.key] || { amount: 0, drawnBefore: gullakDrawn };
    const back = Math.min(gullak, Math.max(0, round2(m.amount - (gullakDrawn - m.drawnBefore))));
    gullak = round2(gullak - back);
    poolBudgets[pool.key] = round2(spent + back);
  };

  let nextEvent = 0;
  for (const date of dates) {
    // 0. Budgets that ended (or came back) at the midnight before this date.
    while (nextEvent < events.length && events[nextEvent].date <= date) applyPoolEvent(events[nextEvent++]);

    const day = (byDate[date] = byDate[date] || emptyDay());
    const list = byDateTx.get(date) || [];

    // 1. Income arrives first (WAT-002). It pays any deficit first. Money back is not income (SPL-003).
    for (const tx of list) {
      if (tx.kind !== 'income') continue;
      const repaid = round2(Math.min(deficit, tx.amount));
      deficit = round2(deficit - repaid);
      incomeAvail = round2(incomeAvail + tx.amount - repaid);
      incomeUsed = round2(incomeUsed + repaid);
      incomeReceived = round2(incomeReceived + tx.amount);
      day.incomeReceived = round2(day.incomeReceived + tx.amount);
      day.incomeUsed = round2(day.incomeUsed + repaid);
    }

    // 2. Manual deposits: "from income" moves only what exists; new money is added.
    const fromIncomeDeposit = round2(Math.min(incomeDeposits.get(date) || 0, incomeAvail));
    incomeAvail = round2(incomeAvail - fromIncomeDeposit);
    gullak = round2(gullak + fromIncomeDeposit + (newMoney.get(date) || 0));

    // 3. Expenses in order
    const expenses = list
      .filter((t) => t.kind === 'expense')
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id));

    for (const tx of expenses) {
      const pool = resolvePool(date);
      day.spent = round2(day.spent + tx.amount);

      if ((!pool || (!(pool.budget > 0) && !pool.pure)) && !ungovernedAsOverspend) {
        byExpense[tx.id] = { fromBudget: tx.amount, fromIncome: 0, fromGullak: 0, short: 0, overspend: 0, governed: false };
        continue;
      }

      const poolKey = pool && pool.budget > 0 ? pool.key : `none_${date}`;
      const budget = pool && pool.budget > 0 ? round2(poolBudgets[poolKey] ?? pool.budget) : 0;
      const already = poolSpent[poolKey] || 0;
      const budgetLeft = pool?.closed ? 0 : Math.max(0, round2(budget - already));
      const fromBudget = round2(Math.min(tx.amount, budgetLeft));
      const overspend = round2(tx.amount - fromBudget);

      const fromIncome = round2(Math.min(overspend, incomeAvail));
      const rest = round2(overspend - fromIncome);
      const fromGullak = savings ? round2(Math.min(rest, gullak)) : rest;
      const short = round2(rest - fromGullak);

      poolSpent[poolKey] = round2(already + tx.amount);
      incomeAvail = round2(incomeAvail - fromIncome);
      incomeUsed = round2(incomeUsed + fromIncome);
      if (savings) gullak = round2(gullak - fromGullak);
      gullakDrawn = round2(gullakDrawn + fromGullak);
      deficit = round2(deficit + short);

      day.overspend = round2(day.overspend + overspend);
      day.incomeUsed = round2(day.incomeUsed + fromIncome);
      day.gullakDrawn = round2(day.gullakDrawn + fromGullak);

      byExpense[tx.id] = { fromBudget, fromIncome, fromGullak, short, overspend, governed: true };
    }

    // 4. The day's unspent daily budget reaches Gullak.
    gullak = round2(gullak + (credits.get(date) || 0));
  }

  // Endings up to today that fall after the last row.
  while (nextEvent < events.length) applyPoolEvent(events[nextEvent++]);

  const poolsOut: WaterfallResult['pools'] = {};
  for (const p of savings?.pools ?? []) {
    poolsOut[p.key] = {
      budget: poolBudgets[p.key],
      spent: poolSpent[p.key] || 0,
      closed: !!asOf && (isPoolClosedOn(p, asOf) || asOf > p.periodEnd),
    };
  }

  return {
    byExpense,
    byDate,
    incomeReceived,
    incomeRemaining: round2(Math.max(0, incomeAvail)),
    incomeUsed,
    gullakDrawn,
    gullakBalance: gullak,
    deficit,
    pools: poolsOut,
    poolSavings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pool resolver: which budget governs a date?
// ─────────────────────────────────────────────────────────────────────────────

export interface PoolResolverParams {
  isBudgetModeEnabled: boolean;
  isAutoRenew: boolean;
  todayStr: string;
  /** Today's allowance if known (record budget). 0/undefined falls back to dailyBudgetAmount. */
  todayBudget?: number;
  dailyBudgetAmount: number;
  records?: Record<string, { budget: number; status?: string }>;
  planChanges?: BudgetPlanChange[];
  /** Stretches the user chose not to count (away 7+ days). */
  skipped?: AllowancePause[];
}

/**
 * Which budget pays for an expense on `date`? Decided by the PLAN HISTORY of that date (not by today's mode):
 *  - daily plan  -> that day's own budget
 *  - weekly / monthly plan -> the period's ONE pool (ADR 0012)
 *  - Pure Mode, or a day with no budget -> nothing: the expense comes from income, then Gullak.
 * Old users with no plan history at all are old daily users (Budget Mode on) or Pure users (off).
 */
export function buildPoolResolver(p: PoolResolverParams, poolsIn?: Record<string, BudgetPool>): PoolResolver {
  const records = p.records || {};
  const planChanges = p.planChanges || [];
  const hasPlans = planChanges.length > 0;
  const pools = poolsIn ?? buildBudgetPools(planChanges, p.todayStr, p.skipped);

  // A day with no budget is paid from income, then Gullak. With savings tracked this holds for ALL history (the
  // money was really spent); without tracking, days before the rule date stay ungoverned.
  const tracked = (p as { budgetPeriods?: unknown }).budgetPeriods !== undefined;
  const pureResult = (date: string): WaterfallPool | null =>
    tracked || date >= BUDGET_RULES_V2_FROM ? { key: `pure_${date}`, budget: 0, pure: true } : null;

  return (date: string): WaterfallPool | null => {
    let mode: 'daily' | 'weekly' | 'monthly' | 'pure';
    const plan = hasPlans ? resolvePlanForDate(planChanges, date) : null;
    if (hasPlans) {
      mode = !plan || !plan.isEnabled ? 'pure' : plan.cadence;
    } else {
      mode = p.isBudgetModeEnabled ? 'daily' : 'pure';
    }

    if (mode === 'weekly' || mode === 'monthly') {
      const pool = poolForDate(pools, planChanges, date);
      if (!pool) return null;
      return { key: pool.key, budget: pool.budget, closed: isPoolClosedOn(pool, date) };
    }

    if (mode === 'pure') {
      // A day with a saved budget (its leftover goes to Gullak) is paid from that budget first, never twice.
      const saved = records[date];
      if (saved && saved.budget > 0 && saved.status !== 'unknown' && date < p.todayStr) {
        return { key: `daily_${date}`, budget: round2(saved.budget) };
      }
      // Before the rules date, Pure days kept spending from the paused pool.
      const old = hasPlans ? poolForDate(pools, planChanges, date) : null;
      return old ? { key: old.key, budget: old.budget } : pureResult(date);
    }

    // daily
    const rec = records[date];
    // A past day recorded with no budget stays without one (never rebuilt from the plan amount).
    if (rec && rec.status === 'unknown' && date < p.todayStr) return pureResult(date);
    let budget: number;
    if (date === p.todayStr) {
      if (rec && rec.budget > 0) budget = rec.budget;
      else if ((p.todayBudget || 0) > 0) budget = p.todayBudget as number;
      else budget = p.isAutoRenew ? p.dailyBudgetAmount || 0 : 0;
    } else if (rec && Number(rec.budget) > 0) {
      budget = rec.budget;
    } else if (plan && plan.cadence === 'daily') {
      budget = Number(plan.amount) || 0;
    } else if (rec && rec.status !== 'unknown' && rec.budget !== undefined) {
      budget = rec.budget;
    } else {
      budget = (p.isAutoRenew || p.isBudgetModeEnabled) ? p.dailyBudgetAmount || 0 : 0;
    }
    return budget > 0 ? { key: `daily_${date}`, budget: round2(budget) } : pureResult(date);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: classify raw expenses and run the waterfall
// ─────────────────────────────────────────────────────────────────────────────

export interface RawExpenseLike {
  id: string;
  amount: number | string;
  expense_date?: string;
  created_at?: string;
  category_id?: string | null;
  type?: string;
  transaction_class?: string | null;
}

export function classifyForWaterfall(
  expenses: RawExpenseLike[]
): WaterfallTx[] {
  const out: WaterfallTx[] = [];
  for (const e of expenses) {
    const date = e.expense_date?.split('T')[0]?.trim();
    const amount = Number(e.amount) || 0;
    if (!date || amount <= 0) continue;
    let kind: WaterfallKind | null = null;
    if (isCountedIncome(e)) kind = 'income';
    else if (isCountedExpense(e)) kind = 'expense';
    if (!kind) continue; // self-transfers: neither income nor expense
    out.push({
      id: e.id,
      date,
      createdAt: e.created_at,
      amount,
      kind,
    });
  }
  return out;
}

export interface WaterfallFromStateParams extends PoolResolverParams {
  expenses: RawExpenseLike[];
  deposits?: IncomeDepositLike[];
  excludeExpensesFrom?: string;
  ungovernedAsOverspend?: boolean;
  /** Pass it (even empty) to track the Gullak balance. Only old accounts without plan history read its rows. */
  budgetPeriods?: Record<string, BudgetPeriodRecord>;
  /** First day that can hold savings (sign-up day). */
  savingsFrom?: string;
}

/**
 * Recent results of computeWaterfallFromState (WAT-001 performance).
 * The waterfall is a pure function of its inputs, and one expense change used to run it about five times
 * (Home twice, Savings, the Gullak popup, the store sync), each walking the whole history. A result is reused
 * only when EVERY input field is the same reference / value (Object.is). Store state is never mutated in
 * place (every change builds a new array / object), so a reused result is always the one a fresh computation
 * would give (tests/waterfallCache.test.ts). Callers treat the result as read-only.
 */
const WATERFALL_CACHE_SIZE = 4;
const waterfallCache: Array<{ keys: string[]; values: unknown[]; result: WaterfallResult }> = [];

const sameInputs = (entry: { keys: string[]; values: unknown[] }, p: WaterfallFromStateParams): boolean => {
  const keys = Object.keys(p);
  if (keys.length !== entry.keys.length) return false;
  for (let i = 0; i < entry.keys.length; i++) {
    const k = entry.keys[i];
    if (!(k in p) || !Object.is((p as unknown as Record<string, unknown>)[k], entry.values[i])) return false;
  }
  return true;
};

export function computeWaterfallFromState(p: WaterfallFromStateParams): WaterfallResult {
  for (let i = 0; i < waterfallCache.length; i++) {
    if (sameInputs(waterfallCache[i], p)) {
      const hit = waterfallCache[i];
      if (i > 0) {
        waterfallCache.splice(i, 1);
        waterfallCache.unshift(hit);
      }
      return hit.result;
    }
  }
  const result = computeWaterfallUncached(p);
  const keys = Object.keys(p);
  waterfallCache.unshift({ keys, values: keys.map((k) => (p as unknown as Record<string, unknown>)[k]), result });
  if (waterfallCache.length > WATERFALL_CACHE_SIZE) waterfallCache.length = WATERFALL_CACHE_SIZE;
  return result;
}

/** Unspent budgets that reach Gullak, besides the pools: finished daily days, and period rows of old accounts. */
function savingsCredits(p: WaterfallFromStateParams): Array<{ date: string; amount: number }> {
  const out: Array<{ date: string; amount: number }> = [];
  const changes = p.planChanges || [];
  for (const [date, r] of Object.entries(p.records || {})) {
    const rec = r as { saved?: number; isFinalized?: boolean; status?: string };
    if (!rec.isFinalized || date >= p.todayStr || rec.status === 'unknown') continue;
    if (p.savingsFrom && date < p.savingsFrom) continue;
    const owner = changes.length > 0 ? getDateOwner(changes, date) : 'daily';
    if (owner === 'weekly' || owner === 'monthly') continue;
    out.push({ date, amount: Number(rec.saved) || 0 });
  }
  out.push(...droppedCarries(changes, (day) => p.records?.[day]?.budget, p.todayStr));
  if (changes.length === 0) {
    for (const period of Object.values(p.budgetPeriods || {})) {
      out.push({ date: period.activeEnd, amount: Number(period.amountSaved) || 0 });
    }
  }
  return out;
}

function computeWaterfallUncached(p: WaterfallFromStateParams): WaterfallResult {
  const pools = buildBudgetPools(p.planChanges || [], p.todayStr, p.skipped);
  return computeMoneyWaterfall({
    txs: classifyForWaterfall(p.expenses),
    deposits: p.deposits,
    resolvePool: buildPoolResolver(p, pools),
    savings: p.budgetPeriods ? { credits: savingsCredits(p), pools: Object.values(pools) } : undefined,
    asOf: p.todayStr,
    excludeExpensesFrom: p.excludeExpensesFrom,
    ungovernedAsOverspend: p.ungovernedAsOverspend,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Scope helpers (Daily / Weekly / Monthly / All pills)
// ─────────────────────────────────────────────────────────────────────────────

export interface ScopeFunding {
  incomeReceived: number;
  incomeUsed: number;
  /** Income of this scope that is still unspent. */
  incomeRemaining: number;
  gullakDrawn: number;
}

/**
 * Sums the waterfall over the dates of one pill.
 * - Daily/Weekly/Monthly: income received in the scope minus what overspends in the scope used.
 * - All: income remaining is the real lifetime remaining (after income -> Gullak deposits too).
 */
export function summarizeScope(
  result: WaterfallResult,
  inScope: (date: string) => boolean,
  isAll = false
): ScopeFunding {
  let incomeReceived = 0;
  let incomeUsed = 0;
  let gullakDrawn = 0;
  for (const [date, d] of Object.entries(result.byDate)) {
    if (!inScope(date)) continue;
    incomeReceived += d.incomeReceived;
    incomeUsed += d.incomeUsed;
    gullakDrawn += d.gullakDrawn;
  }
  incomeReceived = round2(incomeReceived);
  incomeUsed = round2(incomeUsed);
  gullakDrawn = round2(Math.max(0, gullakDrawn));
  return {
    incomeReceived,
    incomeUsed,
    incomeRemaining: isAll
      ? result.incomeRemaining
      : round2(Math.max(0, incomeReceived - incomeUsed)),
    gullakDrawn,
  };
}

export const todayString = (d: Date = new Date()): string => todayDateKey(d);
