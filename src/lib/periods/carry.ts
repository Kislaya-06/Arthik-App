import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { eachDayOfInterval } from 'date-fns/eachDayOfInterval';
import { round2 } from '../formatters';
import { BudgetPlanChange } from '../../types';
import { getPeriodBounds, resolvePlanForDate, BUDGET_RULES_V2_FROM, getNextPeriodStart } from './core';

// ─────────────────────────────────────────────────────────────────────────────
// Daily carry-over: weekly / monthly -> daily (ADR 0012)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What happens to the money left in a weekly / monthly budget when the user switches to DAILY.
 * (The same two stored values are used, no database change:  'additive' = ADD TO TOMORROW,
 *  'allocation' = SPREAD OVER DAYS.)
 *  - next_day : the first daily day's budget grows by the carried amount. What is not used goes to Gullak
 *               at the end of that day, like any daily leftover.
 *  - spread   : each daily day is paid from the carried money first (one daily budget per day) until it is
 *               used up; the user only has to put the rest into the bank.
 * The carried money is ALREADY in the user's bank (it was part of the old budget), so the notification tells the
 * user how much they still need to add today.
 */
export interface DailyCarryDay {
  mode: 'next_day' | 'spread';
  /** Extra budget added to this day (next_day only). */
  extraBudget: number;
  /** Part of today's budget paid from carried-over money. */
  funded: number;
  /** What the user still has to put into the bank today. */
  toAdd: number;
  /** Carried money left after this day. */
  remainingAfter: number;
  /** Today's normal daily budget (without the extra). */
  base: number;
}

export function dailyCarryForDate(
  changes: BudgetPlanChange[],
  recordBudgetFor: (dateStr: string) => number | undefined,
  fallbackDaily: number,
  dateStr: string
): DailyCarryDay | null {
  const plan = resolvePlanForDate(changes, dateStr);
  if (!plan || !plan.isEnabled || plan.cadence !== 'daily') return null;
  const carry = Number(plan.carriedOverAmount) || 0;
  if (!(carry > 0) || !plan.carryMode || plan.effectiveFrom < BUDGET_RULES_V2_FROM) return null;
  if (dateStr < plan.effectiveFrom) return null;

  if (plan.carryMode === 'additive') {
    if (dateStr !== plan.effectiveFrom) return null;
    const base = (Number(plan.amount) || 0) > 0 ? Number(plan.amount) : fallbackDaily;
    return { mode: 'next_day', extraBudget: carry, funded: carry, toAdd: round2(base), remainingAfter: 0, base: round2(base) };
  }

  let remaining = carry;
  let last: DailyCarryDay | null = null;
  for (const day of eachDayOfInterval({ start: parseISO(plan.effectiveFrom), end: parseISO(dateStr) })) {
    const d = format(day, 'yyyy-MM-dd');
    if (resolvePlanForDate(changes, d) !== plan) break; // another plan took over
    const a = Math.max(0, recordBudgetFor(d) ?? fallbackDaily);
    const funded = round2(Math.min(a, remaining));
    remaining = round2(remaining - funded);
    last = { mode: 'spread', extraBudget: 0, funded, toAdd: round2(a - funded), remainingAfter: remaining, base: round2(a) };
  }
  return last;
}

/** Carried money still unused at the END of `dateStr` (what a further cadence switch can still carry). */
export function dailyCarryRemaining(
  changes: BudgetPlanChange[],
  recordBudgetFor: (dateStr: string) => number | undefined,
  fallbackDaily: number,
  dateStr: string
): number {
  return dailyCarryForDate(changes, recordBudgetFor, fallbackDaily, dateStr)?.remainingAfter ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Period carry-over: weekly / monthly allocation (CAR-001 Mode B)
// ─────────────────────────────────────────────────────────────────────────────

export interface PeriodCarry {
  /** Part of this period's budget paid from carried-over money. */
  funded: number;
  /** What the user still has to add for this period. */
  toAdd: number;
  /** Carried money left after this period. */
  remainingAfter: number;
  /** The base period budget (plan amount). */
  base: number;
}

/**
 * CAR-001 Mode B: multi-period drawdown for weekly / monthly targets.
 * Let U = carriedOverAmount, B = plan amount.
 * For period k = 1, 2, 3...:
 *  - funded_k = min(B, remaining_{k-1})
 *  - toAdd_k = B - funded_k
 *  - remaining_k = remaining_{k-1} - funded_k
 * Loop stops if remaining reaches 0 or if another plan takes over.
 */
export function periodCarryForPeriod(
  changes: BudgetPlanChange[],
  periodStart: string
): PeriodCarry | null {
  if (!changes || changes.length === 0) return null;

  const eligiblePlans = changes.filter(
    (p) =>
      p.isEnabled &&
      (p.cadence === 'weekly' || p.cadence === 'monthly') &&
      p.carryMode === 'allocation' &&
      Number(p.carriedOverAmount) > 0 &&
      Number(p.amount) > 0 &&
      p.effectiveFrom >= BUDGET_RULES_V2_FROM
  );
  if (eligiblePlans.length === 0) return null;

  const sorted = [...eligiblePlans].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

  for (const plan of sorted) {
    const p1Bounds = getPeriodBounds(plan.cadence, plan.effectiveFrom);
    const p1Start = p1Bounds.start;

    if (periodStart < p1Start) continue;

    let remaining = Number(plan.carriedOverAmount) || 0;
    const B = Number(plan.amount) || 0;
    if (!(B > 0)) continue;
    let currentStart = p1Start;

    while (remaining > 0) {
      const bounds = getPeriodBounds(plan.cadence, currentStart);
      if (currentStart > p1Start && resolvePlanForDate(changes, currentStart) !== plan) {
        break;
      }

      const funded = round2(Math.min(B, remaining));
      const toAdd = round2(B - funded);
      const remainingAfter = round2(remaining - funded);

      if (currentStart === periodStart || (periodStart >= bounds.start && periodStart <= bounds.end)) {
        return { funded, toAdd, remainingAfter, base: B };
      }

      remaining = remainingAfter;
      if (remaining <= 0) break;
      currentStart = getNextPeriodStart(plan.cadence as 'weekly' | 'monthly', currentStart);
    }
  }

  return null;
}

/**
 * Carried money still unused at the END of `dateStr` for weekly / monthly allocation plans.
 */
export function periodCarryRemaining(changes: BudgetPlanChange[], dateStr: string): number {
  const plan = resolvePlanForDate(changes, dateStr);
  if (!plan || !plan.isEnabled || (plan.cadence !== 'weekly' && plan.cadence !== 'monthly')) return 0;
  if (plan.carryMode !== 'allocation') return 0;
  const carry = Number(plan.carriedOverAmount) || 0;
  if (carry <= 0 || plan.effectiveFrom < BUDGET_RULES_V2_FROM) return 0;
  if (dateStr < plan.effectiveFrom) return 0;
  const B = Number(plan.amount) || 0;
  if (!(B > 0)) return 0;

  const p1Bounds = getPeriodBounds(plan.cadence, plan.effectiveFrom);
  const p1Start = p1Bounds.start;
  let remaining = carry;
  let currentStart = p1Start;

  while (remaining > 0) {
    const bounds = getPeriodBounds(plan.cadence, currentStart);
    if (currentStart > p1Start && resolvePlanForDate(changes, currentStart) !== plan) {
      break;
    }
    const funded = round2(Math.min(B, remaining));
    const remainingAfter = round2(remaining - funded);

    if (dateStr >= bounds.start && dateStr <= bounds.end) {
      return remainingAfter;
    }

    remaining = remainingAfter;
    if (remaining <= 0) break;
    currentStart = getNextPeriodStart(plan.cadence as 'weekly' | 'monthly', currentStart);
  }

  return 0;
}
