/**
 * Money with others and Gullak, for Insights: split & money back summary, where Gullak money came from (INS-010),
 * best and worst month (INS-011). Pure.
 */
import { DateKey, addDaysToDateKey, isDateKeyWithin, monthBoundsOfDateKey, toDateKey } from '../../money/dateKeys';
import { AllowanceHistory, allowanceFromHistory } from '../../money/budgetAllowance';
import { LedgerRow, buildPersonSummaries, grossAmountOf, splitAllocationsOf } from '../splitLedger';
import { classifyTransaction, isCountedExpense, isCountedIncome } from '../transactionUtils';
import { round2 } from '../formatters';
import type { GullakDeposit } from '../../store/dailyBudget/types';
import type { DateRange } from './habits';

const inRange = (date: string | null | undefined, range: DateRange) => {
  const d = toDateKey(date);
  return !!d && isDateKeyWithin(d, range.start, range.end);
};

// ─── Split & money back ─────────────────────────────────────────────────────

export interface SplitSummary {
  /** Other people's shares of expenses of the period. */
  paidForOthers: number;
  /** Friends paying back in the period. */
  cameBack: number;
  /** Refunds in the period (shown on their own line). */
  refunds: number;
  /** Still owed today, all time. */
  stillOwed: number;
  topDebtor: { name: string; owed: number } | null;
  /** Days since the oldest unpaid share. null when nothing is owed. */
  oldestDebtDays: number | null;
}

/** null when the period and the ledger have nothing to show. */
export function computeSplitSummary(rows: readonly LedgerRow[], range: DateRange, todayKey: DateKey): SplitSummary | null {
  let paidForOthers = 0;
  let cameBack = 0;
  let refunds = 0;
  for (const r of rows) {
    if (!inRange(r.expense_date, range)) continue;
    const kind = classifyTransaction(r);
    if (kind === 'spending') paidForOthers += splitAllocationsOf(r).reduce((s, a) => s + a.amount, 0);
    else if (kind === 'moneyBack') {
      if (r.recovery_kind === 'refund') refunds += grossAmountOf(r);
      else cameBack += grossAmountOf(r);
    }
  }

  const people = buildPersonSummaries(rows as LedgerRow[]).filter((p) => p.owed > 0);
  const stillOwed = round2(people.reduce((s, p) => s + p.owed, 0));
  const top = people.reduce<(typeof people)[number] | null>((a, p) => (!a || p.owed > a.owed ? p : a), null);
  let oldest: DateKey | null = null;
  for (const p of people) {
    for (const s of p.splits) {
      const d = toDateKey(s.date);
      if (s.outstanding > 0 && d && (!oldest || d < oldest)) oldest = d;
    }
  }
  let oldestDebtDays: number | null = null;
  if (oldest) {
    oldestDebtDays = 0;
    for (let d = oldest; d < todayKey; d = addDaysToDateKey(d, 1)) oldestDebtDays++;
  }

  if (paidForOthers <= 0 && cameBack <= 0 && refunds <= 0 && stillOwed <= 0) return null;
  return {
    paidForOthers: round2(paidForOthers),
    cameBack: round2(cameBack),
    refunds: round2(refunds),
    stillOwed,
    topDebtor: top ? { name: top.name, owed: top.owed } : null,
    oldestDebtDays,
  };
}

// ─── Where Gullak money came from (INS-010) ────────────────────────────────

export interface GullakSources {
  autoSaved: number;
  fromIncome: number;
  fromOutside: number;
  /** autoSaved + fromIncome + fromOutside: the base of the shares. */
  total: number;
  /** Gullak used to cover overspending in the period (GUL-008). Never subtracted from the shares. */
  coveredOverspend: number;
}

/**
 * `autoSaved` is the INS-002 attribution the Insights tabs already compute (finalized daily `saved` + finalized
 * period `amountSaved`); `gullakDrawn` comes from the money waterfall for the same period. null when all four are 0.
 */
export function computeGullakSources(
  autoSaved: number,
  deposits: readonly GullakDeposit[],
  gullakDrawn: number,
  range: DateRange
): GullakSources | null {
  let fromIncome = 0;
  let fromOutside = 0;
  for (const d of deposits) {
    if (!inRange(d.date, range)) continue;
    if (d.source === 'income') fromIncome += Number(d.amount) || 0;
    else if (d.source === 'external') fromOutside += Number(d.amount) || 0;
  }
  const auto = Math.max(0, Number(autoSaved) || 0);
  const covered = Math.max(0, Number(gullakDrawn) || 0);
  if (auto <= 0 && fromIncome <= 0 && fromOutside <= 0 && covered <= 0) return null;
  return {
    autoSaved: round2(auto),
    fromIncome: round2(fromIncome),
    fromOutside: round2(fromOutside),
    total: round2(auto + fromIncome + fromOutside),
    coveredOverspend: round2(covered),
  };
}

// ─── Best and worst month (INS-011) ─────────────────────────────────────────

export interface MonthResult {
  /** First day of the month. */
  monthKey: DateKey;
  inflow: number;
  spent: number;
  moneyLeft: number;
}

export interface BestWorstMonth {
  best: MonthResult;
  worst: MonthResult;
  /** Why the worst month was worst: its top category, when it ran ≥ 1.5x that category's monthly average. */
  worstReason: { categoryId: string; ratio: number } | null;
}

type MonthRow = LedgerRow & { category_id?: string | null };

/** Finished months of the year only (never the current one), at least 2 of them. A tie goes to the later month. */
export function computeBestWorstMonth(
  rows: readonly MonthRow[],
  deposits: readonly GullakDeposit[],
  history: AllowanceHistory,
  year: number,
  todayKey: DateKey,
  userCreatedKey?: DateKey | null
): BestWorstMonth | null {
  const months: (MonthResult & { byCategory: Map<string, number> })[] = [];
  for (let m = 1; m <= 12; m++) {
    const { firstDateKey, lastDateKey } = monthBoundsOfDateKey(`${year}-${String(m).padStart(2, '0')}-01`);
    if (lastDateKey >= todayKey) break; // not finished
    if (userCreatedKey && lastDateKey < userCreatedKey) continue; // before sign-up
    const range = { start: firstDateKey, end: lastDateKey };
    const allowanceStart = userCreatedKey && userCreatedKey > firstDateKey ? userCreatedKey : firstDateKey;

    let inflow = allowanceFromHistory(history, allowanceStart, lastDateKey);
    let spent = 0;
    const byCategory = new Map<string, number>();
    for (const r of rows) {
      if (!inRange(r.expense_date, range)) continue;
      const amount = Number(r.amount) || 0;
      if (isCountedIncome(r)) inflow += amount;
      else if (isCountedExpense(r)) {
        spent += amount;
        if (r.category_id) byCategory.set(r.category_id, (byCategory.get(r.category_id) || 0) + amount);
      }
    }
    for (const d of deposits) if (d.source === 'external' && inRange(d.date, range)) inflow += Number(d.amount) || 0;

    months.push({ monthKey: firstDateKey, inflow: round2(inflow), spent: round2(spent), moneyLeft: round2(inflow - spent), byCategory });
  }
  if (months.length < 2) return null;

  // Later month wins a tie: compare with >= / <= while walking forward.
  let best = months[0];
  let worst = months[0];
  for (const m of months.slice(1)) {
    if (m.moneyLeft >= best.moneyLeft) best = m;
    if (m.moneyLeft <= worst.moneyLeft) worst = m;
  }
  if (best === worst) return null; // every month ended the same: nothing to compare

  let worstReason: BestWorstMonth['worstReason'] = null;
  let topId: string | null = null;
  for (const [id, amount] of worst.byCategory) if (!topId || amount > worst.byCategory.get(topId)!) topId = id;
  if (topId) {
    const average = months.reduce((s, m) => s + (m.byCategory.get(topId!) || 0), 0) / months.length;
    const ratio = average > 0 ? worst.byCategory.get(topId)! / average : 0;
    if (ratio >= 1.5) worstReason = { categoryId: topId, ratio };
  }

  const strip = ({ byCategory: _b, ...m }: (typeof months)[number]): MonthResult => m;
  return { best: strip(best), worst: strip(worst), worstReason };
}
