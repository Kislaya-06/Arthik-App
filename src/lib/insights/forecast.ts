/**
 * Where you're heading, for Insights: spending projection (INS-007), runway (INS-008), Gullak milestone ETA (INS-009).
 * Pure. Amounts are COUNTED amounts (after money back).
 */
import { DateKey, addDaysToDateKey, countDaysInclusive, isDateKeyWithin, toDateKey } from '../../money/dateKeys';
import { TotalsByDateKey, sumTotalsBetweenDateKeys } from '../../money/ledger';
import { MILESTONES } from '../charts/gullakMilestones';
import { round2 } from '../formatters';
import { classifyTransaction } from '../transactionUtils';
import type { HabitRow, DateRange } from './habits';

// ─── Spending projection (INS-007) ──────────────────────────────────────────

export const MAJOR_OUTFLOW_SHARE = 0.3;

export interface SpendingProjection {
  spentSoFar: number;
  projected: number;
  /** Budget pool (Budget Mode) or last period's spending (Pure Mode). null when there is nothing to compare with. */
  target: number | null;
  /** projected − target (positive = over). null without a target. */
  difference: number | null;
  /** Per day to cut for the rest of the period to land on the target. null unless over. */
  dailyCut: number | null;
  daysLeft: number;
  /** Big one-off expenses kept out of the daily pace (INS-005). */
  majorOutflowCount: number;
}

/**
 * Current period only, from its `minDay`-th day (3 for a week, 4 for a month). Today counts as elapsed.
 * `projected = spentSoFar + avg × daysLeft`, `avg = (spentSoFar − major outflows) / daysElapsed`.
 */
export function computeSpendingProjection(
  rows: readonly HabitRow[],
  range: DateRange,
  todayKey: DateKey,
  minDay: number,
  target: number | null
): SpendingProjection | null {
  if (!isDateKeyWithin(todayKey, range.start, range.end)) return null;
  const daysElapsed = countDaysInclusive(range.start, todayKey);
  if (daysElapsed < minDay) return null;
  const daysLeft = countDaysInclusive(addDaysToDateKey(todayKey, 1), range.end);

  const amounts: number[] = [];
  for (const r of rows) {
    const d = toDateKey(r.expense_date);
    const a = Number(r.amount) || 0;
    if (d && isDateKeyWithin(d, range.start, todayKey) && classifyTransaction(r) === 'spending' && a > 0) amounts.push(a);
  }
  const spentSoFar = amounts.reduce((s, a) => s + a, 0);
  const majors = amounts.filter((a) => a >= spentSoFar * MAJOR_OUTFLOW_SHARE && spentSoFar > 0);
  const avg = (spentSoFar - majors.reduce((s, a) => s + a, 0)) / daysElapsed;
  const projected = round2(spentSoFar + avg * daysLeft);

  const hasTarget = target !== null && target > 0;
  const difference = hasTarget ? round2(projected - target!) : null;
  return {
    spentSoFar: round2(spentSoFar),
    projected,
    target: hasTarget ? round2(target!) : null,
    difference,
    dailyCut: difference !== null && difference > 0 && daysLeft > 0 ? Math.round(difference / daysLeft) : null,
    daysLeft,
    majorOutflowCount: majors.length,
  };
}

// ─── Runway (INS-008) ───────────────────────────────────────────────────────

export const RUNWAY_WINDOW_DAYS = 30;

export interface Runway {
  /** Total Account Remaining − Gullak. */
  spendable: number;
  gullak: number;
  dailyAvg: number;
  /** 0 when nothing spendable is left. */
  runwayDays: number;
}

/** null with fewer than 30 days since sign-up or no spending in the last 30 finished days. */
export function computeRunway(
  totalAccountRemaining: number,
  gullak: number,
  spentByDate: TotalsByDateKey,
  todayKey: DateKey,
  userCreatedKey?: DateKey | null
): Runway | null {
  const from = addDaysToDateKey(todayKey, -RUNWAY_WINDOW_DAYS);
  if (userCreatedKey && userCreatedKey > from) return null;
  const dailyAvg = sumTotalsBetweenDateKeys(spentByDate, from, addDaysToDateKey(todayKey, -1)) / RUNWAY_WINDOW_DAYS;
  if (dailyAvg <= 0) return null;
  const spendable = round2((Number(totalAccountRemaining) || 0) - (Number(gullak) || 0));
  return {
    spendable,
    gullak: round2(Number(gullak) || 0),
    dailyAvg: round2(dailyAvg),
    runwayDays: spendable > 0 ? Math.floor(spendable / dailyAvg) : 0,
  };
}

// ─── Gullak milestone ETA (INS-009) ─────────────────────────────────────────

export const GULLAK_PACE_DAYS = 90;
const ETA_MAX_DAYS = 3 * 365;

export type GullakEta =
  | { status: 'growing'; milestone: { amount: number; name: string }; etaDays: number; tooFar: boolean; perDay: number }
  | { status: 'notGrowing' }
  | { status: 'allReached' };

/** `moneyIn` / `drawnOut`: Gullak money in and money drawn for overspending over the last 90 days. */
export function computeGullakEta(gullak: number, moneyIn: number, drawnOut: number): GullakEta {
  const next = MILESTONES.find((m) => m.amount > gullak);
  if (!next) return { status: 'allReached' };
  const perDay = ((Number(moneyIn) || 0) - (Number(drawnOut) || 0)) / GULLAK_PACE_DAYS;
  if (perDay <= 0) return { status: 'notGrowing' };
  const etaDays = Math.ceil((next.amount - gullak) / perDay);
  return { status: 'growing', milestone: next, etaDays, tooFar: etaDays > ETA_MAX_DAYS, perDay: round2(perDay) };
}
