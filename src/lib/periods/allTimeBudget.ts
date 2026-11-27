import { round2 } from '../formatters';
import type { BudgetPlanChange, BudgetPeriodRecord } from '../../types';
import type { DailyRecord } from '../budgetCalculations';
import type { AllowancePause } from '../allowancePauses';
import { getDateOwner } from './core';
import { buildBudgetPools, poolSpentBefore } from './pools';
import { dailyCarryRemaining, periodCarryRemaining, droppedCarries } from './carry';

/**
 * All budget money that ever existed, each rupee ONCE (the budget part of Total Account Remaining):
 *  - daily plan days: that day's recorded budget (a day without a record never got one)
 *  - weekly / monthly: ONE pool per calendar period. A leftover that went to Gullak is still the user's money, so
 *    the whole pool counts. Only the amount CARRIED out of a pool is left out (it is inside the new cadence's
 *    budget). Everything else stays: what the pool spent, and what Gullak paid out of it during Pure Mode.
 */
export function allTimeBudget(
  records: Record<string, DailyRecord>,
  planChanges: BudgetPlanChange[] | undefined,
  spentByDate: Record<string, number>,
  todayStr: string,
  budgetPeriods?: Record<string, BudgetPeriodRecord>,
  skipped?: AllowancePause[],
  /** The waterfall's pools (effective budget after any return from Pure Mode). Needed for carried pools. */
  funded?: Record<string, { budget: number }>
): number {
  let total = 0;
  const hasPlans = !!planChanges && planChanges.length > 0;
  for (const r of Object.values(records)) {
    if (r.status === 'unknown' || !(r.budget > 0)) continue;
    const owner = hasPlans ? getDateOwner(planChanges!, r.date) : 'daily';
    if (owner === 'weekly' || owner === 'monthly') continue;
    total += Number(r.budget) || 0;
  }
  if (!hasPlans) {
    // Old user without plan history: only period records exist (if any).
    if (budgetPeriods) for (const bp of Object.values(budgetPeriods)) total += Number(bp.budgetAmount) || 0;
    return round2(total);
  }
  const pools = buildBudgetPools(planChanges!, todayStr, skipped);
  for (const pool of Object.values(pools)) {
    const carried = pool.closures.find((c) => c.reason === 'carry');
    if (!carried) {
      total += pool.budget;
      continue;
    }
    const held = funded?.[pool.key]?.budget ?? pool.budget;
    const carriedOut = Math.max(0, held - poolSpentBefore(pools, planChanges!, pool, carried.from, spentByDate));
    total += pool.budget - carriedOut;
  }
  total += dailyCarryRemaining(planChanges!, (d) => records[d]?.budget, 0, todayStr);
  total += periodCarryRemaining(planChanges!, todayStr);
  // Carry that ended unused is in Gullak now: still the user's money.
  for (const d of droppedCarries(planChanges!, (day) => records[day]?.budget, todayStr)) total += d.amount;
  return round2(total);
}
