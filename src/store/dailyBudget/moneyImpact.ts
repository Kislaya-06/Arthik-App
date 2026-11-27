/**
 * "What would this change do to the money?" (spec 2026-11-28 rules 12-13). ONE check for adding, editing and
 * deleting: it replays the waterfall with the change and compares.
 */
import { round2 } from '../../lib/formatters';
import { computeSpentByDate, DailyRecord } from '../../lib/budgetCalculations';
import { runWaterfall } from './metrics';
import { dailyCarryRemaining, periodCarryRemaining } from '../../lib/budgetPeriods';
import { todayDateKey } from '../../money/dateKeys';
import type { BudgetPlanChange } from '../../types';
import { getCurrentExpenses } from './expenseBridge';
import type { Expense } from '../expense/types';
import type { GullakDeposit } from './types';

export interface MoneyImpact {
  /** How much Gullak goes down. */
  gullakDrop: number;
  /** Money that nothing would cover any more: Budget Mode needs this much income first. */
  shortfall: number;
}

/** Finished days keep their budget; what they saved follows their new spending (rule 11). */
function recordsFor(records: Record<string, DailyRecord>, before: Expense[], after: Expense[]): Record<string, DailyRecord> {
  const was = computeSpentByDate(before);
  const now = computeSpentByDate(after);
  let out = records;
  for (const [date, r] of Object.entries(records)) {
    if (!r.isFinalized || r.status === 'unknown' || (was[date] || 0) === (now[date] || 0)) continue;
    if (out === records) out = { ...records };
    out[date] = { ...r, saved: Math.max(0, round2(r.budget - (now[date] || 0))) };
  }
  return out;
}

export function previewMoneyImpact(
  records: Record<string, DailyRecord>,
  change: { expenses?: Expense[]; deposits?: GullakDeposit[] },
  planChanges: BudgetPlanChange[] = []
): MoneyImpact {
  const current = getCurrentExpenses();
  const next = change.expenses ?? current;
  const before = runWaterfall({ records, expenses: current });
  const after = runWaterfall({
    records: recordsFor(records, current, next),
    expenses: next,
    deposits: change.deposits,
  });
  // Carried money that has not become a budget yet is the user's too: the day-by-day replay cannot see it.
  const today = todayDateKey();
  const waiting =
    dailyCarryRemaining(planChanges, (d) => records[d]?.budget, 0, today) + periodCarryRemaining(planChanges, today);
  return {
    gullakDrop: Math.max(0, round2(before.gullakBalance - after.gullakBalance)),
    shortfall: Math.max(0, round2(after.deficit - before.deficit - waiting)),
  };
}
