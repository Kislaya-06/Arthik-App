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
 * Order inside one day: income and deposits are applied first, then expenses
 * (sorted by created_at, then id).
 */

import { format } from 'date-fns';
import { round2 } from './formatters';
import {
  resolvePlanForDate,
  buildBudgetPools,
  poolForDate,
  BudgetPool,
  BUDGET_RULES_V2_FROM,
} from './budgetPeriods';
import {
  isCountedExpense,
  isCountedIncome,
  isEligibleReimbursement,
} from './transactionUtils';
import type { BudgetPlanChange } from '../types';

export type WaterfallKind = 'expense' | 'income' | 'reimbursement';

export interface WaterfallTx {
  id: string;
  /** yyyy-MM-dd */
  date: string;
  createdAt?: string;
  amount: number;
  kind: WaterfallKind;
  /**
   * Reimbursements only: the expense this money pays back (a friend's share of a split).
   * The money goes back to where the expense was paid from: budget / income / Gullak, in the same proportion.
   */
  reimbursesExpenseId?: string | null;
}

export interface WaterfallPool {
  /** Same key = same budget pool (a day, a week or a month). */
  key: string;
  budget: number;
  /** The pool was handed over to another cadence on this date: nothing is left in it from then on. */
  closedOn?: string | null;
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
  /** Amount beyond the budget pool (fromIncome + fromGullak). */
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
  /** Income given back to the income pool by a split repayment received this day. */
  incomeRestored: number;
  /** Gullak money given back by a split repayment received this day. */
  gullakRestored: number;
}

/** Where one split repayment went (budget / income / Gullak), for the detail screen. */
export interface ReimbursementReturn {
  expenseId: string | null;
  toBudget: number;
  toIncome: number;
  toGullak: number;
}

export interface WaterfallResult {
  byExpense: Record<string, ExpenseFundingSplit>;
  byReimbursement: Record<string, ReimbursementReturn>;
  /** Budget part of split repayments per day. Only this part adds to that day's / period's unspent budget. */
  reimbBudgetByDate: Record<string, number>;
  byDate: Record<string, DayFunding>;
  incomeReceived: number;
  /** Income left right now (after overspends and income -> Gullak deposits). */
  incomeRemaining: number;
  incomeUsed: number;
  gullakDrawn: number;
}

const emptyDay = (): DayFunding => ({
  incomeReceived: 0,
  spent: 0,
  overspend: 0,
  incomeUsed: 0,
  gullakDrawn: 0,
  incomeRestored: 0,
  gullakRestored: 0,
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
   * Pools that ended while the user was in Pure Mode: what is left in them becomes income (Pure Mode has no
   * Gullak, and the money must not disappear).
   */
  pureEndPools?: BudgetPool[];
  /** "Today": pools that ended before this date are settled. */
  asOf?: string;
}

export function computeMoneyWaterfall(params: ComputeWaterfallParams): WaterfallResult {
  const { txs, deposits = [], resolvePool, excludeExpensesFrom, ungovernedAsOverspend = false, pureEndPools = [], asOf } = params;

  const byDateTx = new Map<string, WaterfallTx[]>();
  for (const tx of txs) {
    if (!tx.date || !(tx.amount > 0)) continue;
    if (excludeExpensesFrom && tx.kind === 'expense' && tx.date >= excludeExpensesFrom) continue;
    const list = byDateTx.get(tx.date);
    if (list) list.push(tx);
    else byDateTx.set(tx.date, [tx]);
  }
  const depositsByDate = new Map<string, number>();
  for (const d of deposits) {
    if (d.source !== 'income') continue;
    const amt = Number(d.amount) || 0;
    if (amt <= 0) continue;
    const dKey = d.date || '9999-12-31';
    depositsByDate.set(dKey, round2((depositsByDate.get(dKey) || 0) + amt));
  }

  const dates = Array.from(new Set([...byDateTx.keys(), ...depositsByDate.keys()])).sort();

  const byExpense: Record<string, ExpenseFundingSplit> = {};
  const byReimbursement: Record<string, ReimbursementReturn> = {};
  const reimbBudgetByDate: Record<string, number> = {};
  const byDate: Record<string, DayFunding> = {};
  const poolSpent: Record<string, number> = {};
  const poolReimb: Record<string, number> = {};

  let incomeAvail = 0;
  let incomeReceived = 0;
  let incomeUsed = 0;
  let gullakDrawn = 0;

  const flushed = new Set<string>();
  const flushPureEnded = (before: string) => {
    for (const pool of pureEndPools) {
      if (flushed.has(pool.key) || pool.periodEnd >= before) continue;
      flushed.add(pool.key);
      const left = Math.max(0, round2(pool.budget + (poolReimb[pool.key] || 0) - (poolSpent[pool.key] || 0)));
      if (left <= 0) continue;
      incomeAvail = round2(incomeAvail + left);
      const endDay = (byDate[pool.periodEnd] = byDate[pool.periodEnd] || emptyDay());
      endDay.incomeRestored = round2(endDay.incomeRestored + left);
    }
  };

  for (const date of dates) {
    flushPureEnded(date);
    const day = (byDate[date] = byDate[date] || emptyDay());
    const list = byDateTx.get(date) || [];

    // 1. Income arrives first. A repayment that is not linked to any split simply restores spending power
    //    of that day's budget (as before).
    for (const tx of list) {
      if (tx.kind === 'income') {
        incomeAvail = round2(incomeAvail + tx.amount);
        incomeReceived = round2(incomeReceived + tx.amount);
        day.incomeReceived = round2(day.incomeReceived + tx.amount);
      } else if (tx.kind === 'reimbursement' && !tx.reimbursesExpenseId) {
        const pool = resolvePool(date);
        if (pool) poolReimb[pool.key] = round2((poolReimb[pool.key] || 0) + tx.amount);
        reimbBudgetByDate[date] = round2((reimbBudgetByDate[date] || 0) + tx.amount);
        byReimbursement[tx.id] = { expenseId: null, toBudget: tx.amount, toIncome: 0, toGullak: 0 };
      }
    }

    // 2. Income moved into Gullak leaves the income pool
    const dep = depositsByDate.get(date) || 0;
    if (dep > 0) incomeAvail = round2(Math.max(0, incomeAvail - dep));

    // 3. Expenses in order
    const expenses = list
      .filter((t) => t.kind === 'expense')
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id));

    for (const tx of expenses) {
      const pool = resolvePool(date);
      day.spent = round2(day.spent + tx.amount);

      if ((!pool || (!(pool.budget > 0) && !pool.pure)) && !ungovernedAsOverspend) {
        byExpense[tx.id] = { fromBudget: tx.amount, fromIncome: 0, fromGullak: 0, overspend: 0, governed: false };
        continue;
      }

      const poolKey = pool && pool.budget > 0 ? pool.key : `none_${date}`;
      const poolBudget = pool && pool.budget > 0 ? round2(pool.budget + (poolReimb[pool.key] || 0)) : 0;
      const already = poolSpent[poolKey] || 0;
      const handedOver = !!pool && !!pool.closedOn && date >= pool.closedOn;
      const budgetLeft = handedOver ? 0 : Math.max(0, round2(poolBudget - already));
      const fromBudget = round2(Math.min(tx.amount, budgetLeft));
      const overspend = round2(tx.amount - fromBudget);
      const fromIncome = round2(Math.min(overspend, incomeAvail));
      const fromGullak = round2(overspend - fromIncome);

      poolSpent[poolKey] = round2(already + tx.amount);
      incomeAvail = round2(incomeAvail - fromIncome);
      incomeUsed = round2(incomeUsed + fromIncome);
      gullakDrawn = round2(gullakDrawn + fromGullak);

      day.overspend = round2(day.overspend + overspend);
      day.incomeUsed = round2(day.incomeUsed + fromIncome);
      day.gullakDrawn = round2(day.gullakDrawn + fromGullak);

      byExpense[tx.id] = { fromBudget, fromIncome, fromGullak, overspend, governed: true };
    }

    // 4. Split repayments (a friend paid their share back). Processed AFTER the day's expenses so a repayment
    //    on the same day as the expense is split by how that expense was really paid.
    //    The money goes back where it came from, in the same proportion: Gullak part -> Gullak,
    //    income part -> income, budget part -> unspent budget.
    const reimbs = list
      .filter((t) => t.kind === 'reimbursement' && !!t.reimbursesExpenseId)
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id));
    for (const tx of reimbs) {
      const orig = tx.reimbursesExpenseId ? byExpense[tx.reimbursesExpenseId] : undefined;
      let toGullak = 0;
      let toIncome = 0;
      if (orig && orig.governed) {
        const total = round2(orig.fromBudget + orig.fromIncome + orig.fromGullak);
        if (total > 0) {
          const back = Math.min(tx.amount, total);
          toGullak = round2((back * orig.fromGullak) / total);
          toIncome = round2((back * orig.fromIncome) / total);
        }
      }
      const toBudget = round2(tx.amount - toGullak - toIncome);

      if (toIncome > 0) {
        incomeAvail = round2(incomeAvail + toIncome);
        incomeUsed = round2(Math.max(0, incomeUsed - toIncome));
        day.incomeRestored = round2(day.incomeRestored + toIncome);
      }
      if (toGullak > 0) {
        gullakDrawn = round2(Math.max(0, gullakDrawn - toGullak));
        day.gullakRestored = round2(day.gullakRestored + toGullak);
      }
      const pool = resolvePool(date);
      if (pool && toBudget > 0) poolReimb[pool.key] = round2((poolReimb[pool.key] || 0) + toBudget);
      reimbBudgetByDate[date] = round2((reimbBudgetByDate[date] || 0) + toBudget);
      byReimbursement[tx.id] = { expenseId: tx.reimbursesExpenseId ?? null, toBudget, toIncome, toGullak };
    }
  }

  if (asOf) flushPureEnded(asOf);

  return {
    byExpense,
    byReimbursement,
    reimbBudgetByDate,
    byDate,
    incomeReceived,
    incomeRemaining: round2(Math.max(0, incomeAvail)),
    incomeUsed,
    gullakDrawn,
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
}

/**
 * Which budget pays for an expense on `date`? Decided by the PLAN HISTORY of that date (not by today's mode):
 *  - daily plan  -> that day's own budget
 *  - weekly / monthly plan -> the period's ONE pool (ADR 0012)
 *  - Pure Mode   -> the same period pool if it is still alive, otherwise nothing: the expense then comes from
 *                   income and then Gullak, exactly like an overspend in Budget Mode.
 * Old users with no plan history at all are old daily users (Budget Mode on) or Pure users (off).
 */
export function buildPoolResolver(p: PoolResolverParams, poolsIn?: Record<string, BudgetPool>): PoolResolver {
  const records = p.records || {};
  const planChanges = p.planChanges || [];
  const hasPlans = planChanges.length > 0;
  const pools = poolsIn ?? buildBudgetPools(planChanges, p.todayStr);

  const pureResult = (date: string): WaterfallPool | null =>
    // Before the rule date Pure days were never part of the money logic: keep every old number as it was.
    date >= BUDGET_RULES_V2_FROM ? { key: `pure_${date}`, budget: 0, pure: true } : null;

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
      return { key: pool.key, budget: pool.budget, closedOn: pool.closedOn };
    }

    if (mode === 'pure') {
      if (hasPlans && plan && plan.cadence !== 'daily') {
        const pool = poolForDate(pools, planChanges, date);
        if (pool) return { key: pool.key, budget: pool.budget, closedOn: pool.closedOn };
      }
      return pureResult(date);
    }

    // daily
    const rec = records[date];
    if (rec && rec.status === 'unknown') return null;
    let budget: number;
    if (date === p.todayStr) {
      if (rec && rec.budget > 0) budget = rec.budget;
      else if ((p.todayBudget || 0) > 0) budget = p.todayBudget as number;
      else budget = p.isAutoRenew ? p.dailyBudgetAmount || 0 : 0;
    } else if (rec && rec.budget !== undefined) {
      budget = rec.budget;
    } else if (plan && plan.cadence === 'daily') {
      budget = Number(plan.amount) || 0;
    } else {
      budget = p.dailyBudgetAmount || 0;
    }
    return budget > 0 ? { key: `daily_${date}`, budget: round2(budget) } : null;
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
  reimburses_share_id?: string | null;
}

export function classifyForWaterfall(
  expenses: RawExpenseLike[],
  categories: Array<{ id: string; name?: string }> = [],
  shares: Array<{ id: string; expense_id: string }> = []
): WaterfallTx[] {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const shareToExpense = new Map(shares.map((s) => [s.id, s.expense_id]));
  const out: WaterfallTx[] = [];
  for (const e of expenses) {
    const date = e.expense_date?.split('T')[0]?.trim();
    const amount = Number(e.amount) || 0;
    if (!date || amount <= 0) continue;
    const cat = e.category_id ? catMap.get(e.category_id) : undefined;
    let kind: WaterfallKind | null = null;
    if (isEligibleReimbursement(e)) kind = 'reimbursement';
    else if (isCountedIncome(e, cat)) kind = 'income';
    else if (isCountedExpense(e, cat)) kind = 'expense';
    if (!kind) continue; // self-transfers: neither income nor expense
    out.push({
      id: e.id,
      date,
      createdAt: e.created_at,
      amount,
      kind,
      reimbursesExpenseId:
        kind === 'reimbursement' && e.reimburses_share_id ? shareToExpense.get(e.reimburses_share_id) ?? null : null,
    });
  }
  return out;
}

export interface WaterfallFromStateParams extends PoolResolverParams {
  expenses: RawExpenseLike[];
  categories?: Array<{ id: string; name?: string }>;
  deposits?: IncomeDepositLike[];
  excludeExpensesFrom?: string;
  ungovernedAsOverspend?: boolean;
  /** Friends' shares (id -> expense) so split repayments can go back to where the expense was paid from. */
  shares?: Array<{ id: string; expense_id: string }>;
}

export function computeWaterfallFromState(p: WaterfallFromStateParams): WaterfallResult {
  const pools = buildBudgetPools(p.planChanges || [], p.todayStr);
  return computeMoneyWaterfall({
    txs: classifyForWaterfall(p.expenses, p.categories, p.shares),
    deposits: p.deposits,
    resolvePool: buildPoolResolver(p, pools),
    pureEndPools: Object.values(pools).filter((x) => x.endsInPure),
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
  let incomeRestored = 0;
  for (const [date, d] of Object.entries(result.byDate)) {
    if (!inScope(date)) continue;
    incomeReceived += d.incomeReceived;
    incomeUsed += d.incomeUsed;
    incomeRestored += d.incomeRestored;
    gullakDrawn += d.gullakDrawn - d.gullakRestored;
  }
  incomeReceived = round2(incomeReceived);
  incomeUsed = round2(incomeUsed);
  incomeRestored = round2(incomeRestored);
  gullakDrawn = round2(Math.max(0, gullakDrawn));
  return {
    incomeReceived,
    incomeUsed,
    incomeRemaining: isAll
      ? result.incomeRemaining
      : round2(Math.max(0, incomeReceived + incomeRestored - incomeUsed)),
    gullakDrawn,
  };
}

export const todayString = (d: Date = new Date()): string => format(d, 'yyyy-MM-dd');
