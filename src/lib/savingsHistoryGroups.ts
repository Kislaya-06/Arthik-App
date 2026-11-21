import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { startOfWeek } from 'date-fns/startOfWeek';
import { endOfWeek } from 'date-fns/endOfWeek';
import { subWeeks } from 'date-fns/subWeeks';
import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays';
import { formatCurrency, round2 } from './formatters';

/**
 * Savings history grouping (Savings tab, "Day-by-Day Savings History").
 * Display only: the group totals add up the SAME amounts the rows show (`savingsRowValue`),
 * they never compute money of their own.
 */

export type SavingsRowKind = 'saved' | 'deposit' | 'over' | 'even' | 'unknown';

interface RecordLike { saved: number; spent: number; budget: number; status: string }
interface DepositLike { amount: number }
interface PeriodLike { status: string; amountSaved: number; spentAmount: number; budgetAmount: number }

export interface SavingsHistoryItem {
  id: string;
  date: string;
  dailyRecord?: RecordLike;
  deposit?: DepositLike;
  period?: PeriodLike;
}

/** The amount and meaning of one history row (same rules the row has always used). */
export function savingsRowValue(item: Pick<SavingsHistoryItem, 'dailyRecord' | 'deposit' | 'period'>): {
  kind: SavingsRowKind;
  amount: number;
} {
  const { period, deposit, dailyRecord: rec } = item;
  if (period) {
    if (period.status === 'saved' || period.amountSaved > 0) return { kind: 'saved', amount: period.amountSaved };
    if (period.status === 'missed') return { kind: 'over', amount: Math.max(0, period.spentAmount - period.budgetAmount) };
    if (period.status === 'even') return { kind: 'even', amount: 0 };
    return { kind: 'unknown', amount: 0 };
  }
  if (deposit) return { kind: 'deposit', amount: deposit.amount };
  if (!rec) return { kind: 'unknown', amount: 0 };
  if (rec.saved > 0 && rec.status !== 'unknown') return { kind: 'saved', amount: rec.saved };
  if (rec.status === 'missed') return { kind: 'over', amount: rec.spent - rec.budget };
  if (rec.status === 'unknown') return { kind: 'unknown', amount: 0 };
  return { kind: 'even', amount: 0 };
}

export interface SavingsHistoryGroup<T extends SavingsHistoryItem> {
  key: string;
  label: string;
  items: T[];
  /** Saved days + deposits shown in this group. */
  savedTotal: number;
  /** Over-budget amounts shown in this group (positive number). */
  overTotal: number;
}

const yearSuffix = (d: Date, today: Date) => (d.getFullYear() === today.getFullYear() ? '' : ` ${format(d, 'yyyy')}`);

function weekLabel(start: Date, today: Date): string {
  const thisWeek = startOfWeek(today, { weekStartsOn: 1 });
  if (differenceInCalendarDays(start, thisWeek) === 0) return 'THIS WEEK';
  if (differenceInCalendarDays(start, subWeeks(thisWeek, 1)) === 0) return 'LAST WEEK';
  const end = endOfWeek(start, { weekStartsOn: 1 });
  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameYear && start.getMonth() === end.getMonth()) {
    return `${format(start, 'd')} – ${format(end, 'd MMM')}${yearSuffix(end, today)}`.toUpperCase();
  }
  if (!sameYear) {
    // A week across New Year names both years so "4 Jan" is never ambiguous.
    return `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`.toUpperCase();
  }
  return `${format(start, 'd MMM')} – ${format(end, 'd MMM')}${yearSuffix(end, today)}`.toUpperCase();
}

function monthLabel(d: Date, today: Date): string {
  if (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth()) return 'THIS MONTH';
  return `${format(d, 'MMMM')}${yearSuffix(d, today)}`.toUpperCase();
}

/** Groups newest-first history rows by week (Monday start) or by month, keeping their order. */
export function groupSavingsHistory<T extends SavingsHistoryItem>(
  items: T[],
  by: 'week' | 'month',
  today: Date
): SavingsHistoryGroup<T>[] {
  const groups: SavingsHistoryGroup<T>[] = [];
  const byKey = new Map<string, SavingsHistoryGroup<T>>();
  for (const item of items) {
    const d = parseISO(item.date);
    const anchor = by === 'week' ? startOfWeek(d, { weekStartsOn: 1 }) : new Date(d.getFullYear(), d.getMonth(), 1);
    const key = format(anchor, 'yyyy-MM-dd');
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        label: by === 'week' ? weekLabel(anchor, today) : monthLabel(anchor, today),
        items: [],
        savedTotal: 0,
        overTotal: 0,
      };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
    const { kind, amount } = savingsRowValue(item);
    if (kind === 'saved' || kind === 'deposit') group.savedTotal = round2(group.savedTotal + amount);
    else if (kind === 'over' && amount > 0) group.overTotal = round2(group.overTotal + amount);
  }
  return groups;
}

/**
 * "See More" paging by whole groups: shows groups until at least `target` rows are visible, never cutting
 * a group in half (so a group's total always matches the rows under it).
 */
export function pageSavingsGroups<G extends { items: unknown[] }>(
  groups: G[],
  target: number
): { shown: G[]; hiddenCount: number } {
  const shown: G[] = [];
  let used = 0;
  let total = 0;
  for (const group of groups) {
    total += group.items.length;
    if (used < target) {
      shown.push(group);
      used += group.items.length;
    }
  }
  return { shown, hiddenCount: total - used };
}

/** Header total, written like the History day headers ("−₹X  •  +₹Y"). */
export function groupTotalText(g: { savedTotal: number; overTotal: number }): {
  text: string;
  tone: 'income' | 'expense' | 'mixed' | 'zero';
} {
  if (g.savedTotal > 0 && g.overTotal > 0) {
    return { text: `−${formatCurrency(g.overTotal)}  •  +${formatCurrency(g.savedTotal)}`, tone: 'mixed' };
  }
  if (g.savedTotal > 0) return { text: `+${formatCurrency(g.savedTotal)}`, tone: 'income' };
  if (g.overTotal > 0) return { text: `−${formatCurrency(g.overTotal)}`, tone: 'expense' };
  return { text: '₹0', tone: 'zero' };
}

/** Row date: "Yesterday, 19 Nov", "Wed, 18 Nov" (daily) or "18 Nov" (deposit); the year only when it is not this year. */
export function savingsRowDateLabel(date: string, kind: 'daily' | 'deposit', today: Date): string {
  try {
    const d = parseISO(date);
    const yr = yearSuffix(d, today);
    if (kind === 'daily' && differenceInCalendarDays(today, d) === 1) return `Yesterday, ${format(d, 'd MMM')}`;
    return kind === 'deposit' ? `${format(d, 'd MMM')}${yr}` : `${format(d, 'EEE, d MMM')}${yr}`;
  } catch {
    return date;
  }
}
