import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { addDays } from 'date-fns/addDays';
import { eachDayOfInterval } from 'date-fns/eachDayOfInterval';
import { round2 } from '../formatters';
import { BudgetPlanChange } from '../../types';
import { getPeriodBounds, carryForPeriod, resolvePlanForDate, BUDGET_RULES_V2_FROM } from './core';

/**
 * A weekly / monthly budget of ONE calendar period. However many times the user pauses (Pure Mode) and comes
 * back inside that period, it is still the same pool: spending (also in Pure Mode) uses it, and what is
 * left is what continues. The full budget is given once, when the pool starts.
 */
export interface BudgetPool {
  /** `${cadence}_${periodStart}` */
  key: string;
  cadence: 'weekly' | 'monthly';
  periodStart: string;
  periodEnd: string;
  /** Total of the pool: plan amount + the first-period carry-over. */
  budget: number;
  /** First day the pool was funded (budget mode on, this cadence). */
  startedOn: string;
  /**
   * Set when the user switched to ANOTHER cadence inside this period: whatever was left was carried to the new
   * cadence, so coming back to this cadence in the same period leaves nothing.
   */
  closedOn: string | null;
  /** The period ended while the user was in Pure Mode: what is left becomes income (Pure Mode has no Gullak). */
  endsInPure: boolean;
}

export const poolKeyFor = (cadence: 'weekly' | 'monthly', dateStr: string): string =>
  `${cadence}_${getPeriodBounds(cadence, dateStr).start}`;

/** All pools from the first weekly / monthly plan up to `upToDate` (inclusive). */
export function buildBudgetPools(changes: BudgetPlanChange[], upToDate: string): Record<string, BudgetPool> {
  const pools: Record<string, BudgetPool> = {};
  const relevant = (changes || []).filter((c) => c.isEnabled && (c.cadence === 'weekly' || c.cadence === 'monthly'));
  if (relevant.length === 0) return pools;
  const first = relevant.reduce((m, c) => (c.effectiveFrom < m ? c.effectiveFrom : m), relevant[0].effectiveFrom);
  if (first > upToDate) return pools;

  for (const day of eachDayOfInterval({ start: parseISO(first), end: parseISO(upToDate) })) {
    const d = format(day, 'yyyy-MM-dd');
    const plan = resolvePlanForDate(changes, d);
    if (!plan || !plan.isEnabled) continue; // Pure Mode never starts or closes a pool
    if (plan.cadence === 'weekly' || plan.cadence === 'monthly') {
      const b = getPeriodBounds(plan.cadence, d);
      const key = `${plan.cadence}_${b.start}`;
      if (!pools[key]) {
        pools[key] = {
          key,
          cadence: plan.cadence,
          periodStart: b.start,
          periodEnd: b.end,
          budget: round2((Number(plan.amount) || 0) + carryForPeriod(plan, b.start)),
          startedOn: d,
          closedOn: null,
          endsInPure: false,
        };
      }
    }
    // Another cadence is in charge today: every still-open pool covering today was handed over (carry-over).
    if (d >= BUDGET_RULES_V2_FROM) {
      for (const pool of Object.values(pools)) {
        if (pool.cadence !== plan.cadence && !pool.closedOn && d > pool.startedOn && d >= pool.periodStart && d <= pool.periodEnd) {
          pool.closedOn = d;
        }
      }
    }
  }
  for (const pool of Object.values(pools)) {
    if (pool.periodEnd <= upToDate && pool.periodEnd >= BUDGET_RULES_V2_FROM && !pool.closedOn) {
      const atEnd = resolvePlanForDate(changes, pool.periodEnd);
      pool.endsInPure = !!atEnd && !atEnd.isEnabled;
    }
  }
  return pools;
}

/**
 * Which pool does this date spend from? (null = none)
 *  - Budget Mode on with a weekly / monthly plan: that period's pool.
 *  - Pure Mode (paused) inside a period whose pool is still alive: the SAME pool.
 */
export function poolForDate(pools: Record<string, BudgetPool>, changes: BudgetPlanChange[], dateStr: string): BudgetPool | null {
  const plan = resolvePlanForDate(changes, dateStr);
  if (!plan || plan.cadence === 'daily') return null;
  const pool = pools[poolKeyFor(plan.cadence, dateStr)];
  if (!pool || dateStr < pool.startedOn) return null;
  if (!plan.isEnabled && pool.closedOn && dateStr >= pool.closedOn) return null;
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
