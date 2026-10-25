/**
 * heroDetails.ts — what the Home card shows (ONE chip) and what its tap-to-open details sheet shows.
 *
 * The card stays calm: one most-important chip. The sheet holds the full story of the same period, using the
 * SAME numbers the card already shows (no second calculation of budget, income or Gullak draw), so the two can
 * never disagree. Pure functions only.
 */
import { round2 } from './formatters';
import { isRecoveryClass } from './transactionUtils';
import type { HeroSubtextChip } from './homeCalculations';

// ─────────────────────────────────────────────────────────────────────────────
// The one chip on the card
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Priority, most important first:
 *  1. Money drawn from Gullak
 *  2. Over the limit
 *  3. Budget used up
 *  4. Budget left
 *  5. Anything else (income, deposits)
 * Returns null when there is nothing to say.
 */
export function pickPrimaryChip(chips: HeroSubtextChip[]): HeroSubtextChip | null {
  if (chips.length === 0) return null;
  const rank = (c: HeroSubtextChip): number => {
    const t = c.text.toLowerCase();
    if (c.badgeText || c.id === 'gullak_only') return 0;
    if (/exceeded|over limit|over budget/.test(t)) return 1;
    if (/used up/.test(t)) return 2;
    if (/budget|allowance/.test(t) && !/income|deposit/.test(t)) return 3;
    return 4;
  };
  let best = chips[0];
  for (const c of chips) if (rank(c) < rank(best)) best = c;
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// Numbers for the sheet
// ─────────────────────────────────────────────────────────────────────────────

/** Money that came back (friend paid back / refund) in the rows of a period. Never income (SPL-003). */
export const moneyBackInRows = (rows: ReadonlyArray<{ amount: number | string; transaction_class?: string | null; gross_amount?: number | null }>): number => {
  let sum = 0;
  for (const r of rows) if (isRecoveryClass(r)) sum += Number(r.gross_amount ?? r.amount) || 0;
  return round2(sum);
};

/** Budget the app saved to Gullak by itself in a period: finalized saved days plus finished weekly / monthly periods. */
export function autoSavedInScope(
  records: Record<string, { date: string; saved?: number; isFinalized?: boolean; status?: string }>,
  periods: Record<string, { periodEnd: string; amountSaved?: number }>,
  inScope: (date: string) => boolean
): number {
  let sum = 0;
  for (const r of Object.values(records)) {
    if (r.isFinalized && r.status === 'saved' && inScope(r.date)) sum += Number(r.saved) || 0;
  }
  for (const p of Object.values(periods)) {
    if (inScope(p.periodEnd)) sum += Number(p.amountSaved) || 0;
  }
  return round2(sum);
}

export interface HeroDetailsInput {
  isBudgetMode: boolean;
  /** Budget given so far in this period. */
  budgetGiven: number;
  /** Everything spent in the period (counted amounts). */
  spent: number;
  /** New money that came in from outside (money back is NOT in here). */
  incomeReceived: number;
  incomeLeft: number;
  moneyBack: number;
  /** Money that went into Gullak: saved budget + what the user put in. */
  gullakAdded: number;
  /** Money taken out of Gullak to pay for overspending. */
  gullakDrawn: number;
  /** Gullak total right now. Only passed for the All view. */
  gullakNow: number | null;
  /** Active period/today remaining budget, preserving today's unspent allowance in All view. */
  activeBudgetLeft?: number;
  /** Real unspent inflow balance remaining (so All-time sheet agrees with All-time card). */
  unspentInflowLeft?: number;
}

export interface DetailRow {
  id: string;
  label: string;
  amount: number;
  /** 'bad' = money going out of savings / over budget, 'good' = money kept or coming in. */
  tone?: 'good' | 'bad' | 'neutral';
}

export interface DetailSection {
  id: 'budget' | 'money_in' | 'gullak';
  title: string;
  rows: DetailRow[];
}

export interface HeroDetails {
  sections: DetailSection[];
  totalSpent: number;
}

/** The sections of the sheet. Pure Mode has no budget and no Gullak (GUL-002). */
export function buildHeroDetails(i: HeroDetailsInput): HeroDetails {
  const sections: DetailSection[] = [];

  if (i.isBudgetMode && i.budgetGiven > 0) {
    const rawLeft = round2(Math.max(0, i.budgetGiven - i.spent));
    // Lifecycle preservation: active period/today's unspent budget is real cash allocated for today
    // and must never be wiped out by past historical finalized spending in the All-time sheet.
    const budgetLeft = i.activeBudgetLeft !== undefined
      ? Math.max(rawLeft, round2(i.activeBudgetLeft))
      : rawLeft;
    const used = round2(Math.min(i.budgetGiven - budgetLeft, i.spent));
    sections.push({
      id: 'budget',
      title: 'Budget',
      rows: [
        { id: 'given', label: 'Total budget', amount: round2(i.budgetGiven), tone: 'neutral' },
        { id: 'used', label: 'Spent from budget', amount: round2(used), tone: 'bad' },
        { id: 'left', label: 'Remaining budget', amount: round2(budgetLeft), tone: 'good' },
      ],
    });
  }

  const rawIncomeLeft = i.unspentInflowLeft !== undefined
    ? round2(i.unspentInflowLeft)
    : round2(i.incomeLeft);
  // Real money invariant: Money unspent cannot exceed money received
  const effectiveIncomeLeft = Math.min(round2(i.incomeReceived), Math.max(0, rawIncomeLeft));

  // Same shape as Budget: white (came in) -> red (spent) -> green (left).
  // Money back is intentionally not shown here (it is never income and is already inside Total spent).
  const moneyIn: DetailRow[] = [{ id: 'received', label: 'Income received', amount: round2(i.incomeReceived), tone: 'neutral' }];
  if (i.isBudgetMode) {
    const spentFromIncome = round2(Math.max(0, i.incomeReceived - effectiveIncomeLeft));
    moneyIn.push({ id: 'spent', label: 'Spent from income', amount: spentFromIncome, tone: 'bad' });
    moneyIn.push({ id: 'left', label: 'Unspent income', amount: round2(effectiveIncomeLeft), tone: 'good' });
  }
  sections.push({ id: 'money_in', title: 'Money in', rows: moneyIn });

  if (i.isBudgetMode) {
    // Real money invariant: Money taken from Gullak cannot exceed money added to Gullak (no overdraft)
    const effectiveGullakDrawn = Math.min(round2(i.gullakDrawn), round2(i.gullakAdded));
    const gullak: DetailRow[] = [
      { id: 'added', label: 'Saved to Gullak', amount: round2(i.gullakAdded), tone: 'neutral' },
      { id: 'drawn', label: 'Withdrawn from Gullak', amount: round2(effectiveGullakDrawn), tone: 'bad' },
    ];
    if (i.gullakNow !== null) gullak.push({ id: 'now', label: 'Gullak balance', amount: round2(i.gullakNow), tone: 'good' });
    sections.push({ id: 'gullak', title: 'Gullak', rows: gullak });
  }

  return { sections, totalSpent: round2(i.spent) };
}

/** Title of the sheet, e.g. "This week" / "All time". */
export const heroDetailsTitle = (filter: 'All' | 'Daily' | 'Weekly' | 'Monthly', isToday: boolean): string => {
  if (filter === 'All') return 'All time';
  if (filter === 'Daily') return isToday ? 'Today' : 'Selected day';
  return filter === 'Weekly' ? 'This week' : 'This month';
};

/**
 * Date line under the filter pills. A week or month that is still running says how far the numbers go
 * ("till today" / "till 18 Oct"), so nobody reads them as a full-period figure. Past periods are shown whole.
 */
export function withTillToday(
  label: string,
  filter: 'All' | 'Daily' | 'Weekly' | 'Monthly',
  periodContainsToday: boolean,
  todayLabel: string
): string {
  if (!periodContainsToday) return label;
  if (filter === 'Weekly') return `${label} · till today`;
  if (filter === 'Monthly') return `${label} · till ${todayLabel}`;
  return label;
}
