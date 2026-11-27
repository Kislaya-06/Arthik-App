import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { addDays } from 'date-fns/addDays';
import { eachDayOfInterval } from 'date-fns/eachDayOfInterval';
import { round2 } from '../formatters';
import { BudgetPlanChange } from '../../types';
import type { AllowancePause } from '../allowancePauses';
import { getPeriodBounds, carryForPeriod, resolvePlanForDate, BUDGET_RULES_V2_FROM } from './core';

/**
 * Why a pool stopped being the running budget (spec 2026-11-28 rules 18-24):
 *  - 'pure'   : switched to Pure Mode. The leftover goes to Gullak and comes back on a same-period return.
 *  - 'switch' : another cadence, "Save to Gullak". It does not come back.
 *  - 'carry'  : another cadence, "Carry forward". The leftover funds the new budget; nothing goes to Gullak.
 */
export interface PoolClosure {
  from: string;
  /** The day it came back (Pure Mode only). null = still closed. */
  to: string | null;
  reason: 'pure' | 'switch' | 'carry';
}

/** The weekly / monthly budget of ONE calendar period: given once, when the pool starts. */
export interface BudgetPool {
  /** `${cadence}_${periodStart}` */
  key: string;
  cadence: 'weekly' | 'monthly';
  periodStart: string;
  periodEnd: string;
  /** Total of the pool: plan amount + the first-period additive carry-over (old plans). */
  budget: number;
  /** First day the pool was funded (budget mode on, this cadence). */
  startedOn: string;
  /** First day of the closure still in force (null = open). */
  closedOn: string | null;
  closures: PoolClosure[];
}

export const poolKeyFor = (cadence: 'weekly' | 'monthly', dateStr: string): string =>
  `${cadence}_${getPeriodBounds(cadence, dateStr).start}`;

export const isPoolClosedOn = (pool: BudgetPool, dateStr: string): boolean =>
  pool.closures.some((c) => dateStr >= c.from && (c.to === null || dateStr < c.to));

/** A period the user chose not to count (away 7+ days): all of it lies inside one skipped stretch. */
export const isPeriodSkipped = (skipped: AllowancePause[] | undefined, start: string, end: string): boolean =>
  !!skipped && skipped.some((s) => s.from <= start && s.to !== null && s.to >= end);

/** All pools from the first weekly / monthly plan up to `upToDate` (inclusive). */
export function buildBudgetPools(
  changes: BudgetPlanChange[],
  upToDate: string,
  skipped?: AllowancePause[]
): Record<string, BudgetPool> {
  const pools: Record<string, BudgetPool> = {};
  const relevant = (changes || []).filter((c) => c.isEnabled && (c.cadence === 'weekly' || c.cadence === 'monthly'));
  if (relevant.length === 0) return pools;
  const first = relevant.reduce((m, c) => (c.effectiveFrom < m ? c.effectiveFrom : m), relevant[0].effectiveFrom);
  if (first > upToDate) return pools;

  for (const day of eachDayOfInterval({ start: parseISO(first), end: parseISO(upToDate) })) {
    const d = format(day, 'yyyy-MM-dd');
    const plan = resolvePlanForDate(changes, d);
    if (!plan) continue;
    if (plan.isEnabled && (plan.cadence === 'weekly' || plan.cadence === 'monthly')) {
      const b = getPeriodBounds(plan.cadence, d);
      const key = `${plan.cadence}_${b.start}`;
      if (!pools[key] && !isPeriodSkipped(skipped, b.start, b.end)) {
        pools[key] = {
          key,
          cadence: plan.cadence,
          periodStart: b.start,
          periodEnd: b.end,
          budget: round2((Number(plan.amount) || 0) + carryForPeriod(plan, b.start)),
          startedOn: d,
          closedOn: null,
          closures: [],
        };
      }
    }
    if (d < BUDGET_RULES_V2_FROM) continue;
    for (const pool of Object.values(pools)) {
      if (d <= pool.startedOn || d < pool.periodStart || d > pool.periodEnd) continue;
      const open = pool.closures.find((c) => c.to === null);
      if (plan.isEnabled && plan.cadence === pool.cadence) {
        if (open && open.reason === 'pure') {
          open.to = d;
          pool.closedOn = null;
        }
      } else if (!open) {
        const reason = !plan.isEnabled ? 'pure' : plan.carryMode ? 'carry' : 'switch';
        pool.closures.push({ from: d, to: null, reason });
        pool.closedOn = d;
      } else if (open.reason === 'pure' && plan.isEnabled) {
        // Another cadence took over from Pure Mode: this budget cannot come back (rule 24).
        open.reason = 'switch';
      }
    }
  }
  return pools;
}

/**
 * Which pool does this date spend from? (null = none). Only a Budget Mode day has one. Before the rules date, Pure
 * days kept spending from the paused pool, and those old numbers stay.
 */
export function poolForDate(pools: Record<string, BudgetPool>, changes: BudgetPlanChange[], dateStr: string): BudgetPool | null {
  const plan = resolvePlanForDate(changes, dateStr);
  if (!plan || plan.cadence === 'daily') return null;
  if (!plan.isEnabled && dateStr >= BUDGET_RULES_V2_FROM) return null;
  const pool = pools[poolKeyFor(plan.cadence, dateStr)];
  if (!pool || dateStr < pool.startedOn) return null;
  return pool;
}

/** Everything spent from `pool` on days in [pool.startedOn, beforeDate). */
export function poolSpentBefore(
  pools: Record<string, BudgetPool>,
  changes: BudgetPlanChange[],
  pool: BudgetPool,
  beforeDate: string,
  spentByDate: Record<string, number>
): number {
  let sum = 0;
  const end = beforeDate <= pool.periodEnd ? addDays(parseISO(beforeDate), -1) : parseISO(pool.periodEnd);
  if (parseISO(pool.startedOn) > end) return 0;
  for (const day of eachDayOfInterval({ start: parseISO(pool.startedOn), end })) {
    const d = format(day, 'yyyy-MM-dd');
    if (poolForDate(pools, changes, d)?.key === pool.key) sum += Number(spentByDate[d]) || 0;
  }
  return round2(sum);
}
