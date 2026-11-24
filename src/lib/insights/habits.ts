/**
 * Spending habits for Insights (owner decisions 2026-11-25, words in CONTEXT.md "11. Insights Language"):
 * no-spend days, small leaks, category vs your own average, time of day, top places.
 * Pure: every function takes the rows / totals it needs. Amounts are the COUNTED amounts (after money back).
 */
import { DateKey, addDaysToDateKey, isDateKeyWithin, toDateKey } from '../../money/dateKeys';
import { TotalsByDateKey } from '../../money/ledger';
import { classifyTransaction } from '../transactionUtils';
import { round2 } from '../formatters';
import { merchantKey } from '../../features/autoLog/merchants';

export interface HabitRow {
  id?: string;
  amount: number | string;
  expense_date?: string | null;
  type?: string;
  transaction_class?: string | null;
  category_id?: string | null;
  note?: string | null;
  created_at?: string | null;
}

export interface DateRange {
  start: DateKey;
  end: DateKey;
}

/** Counted spending rows of a range (self-transfers, money back and income are never spending). */
function spendingIn(rows: readonly HabitRow[], range: DateRange): HabitRow[] {
  return rows.filter((r) => {
    const d = toDateKey(r.expense_date);
    return !!d && isDateKeyWithin(d, range.start, range.end) && classifyTransaction(r) === 'spending' && (Number(r.amount) || 0) > 0;
  });
}

// ─── No-spend days ──────────────────────────────────────────────────────────

export interface NoSpendDays {
  count: number;
  /** Finished days looked at (since sign-up, today excluded). */
  daysCounted: number;
  longest: { length: number; start: DateKey; end: DateKey } | null;
}

/** Finished days (since sign-up, never today) with no counted spending. null when no finished day is in range. */
export function computeNoSpendDays(
  spentByDate: TotalsByDateKey,
  range: DateRange,
  todayKey: DateKey,
  userCreatedKey?: DateKey | null
): NoSpendDays | null {
  const first = userCreatedKey && userCreatedKey > range.start ? userCreatedKey : range.start;
  const yesterday = addDaysToDateKey(todayKey, -1);
  const last = range.end < yesterday ? range.end : yesterday;
  if (first > last) return null;

  let count = 0;
  let daysCounted = 0;
  let run = 0;
  let runStart = '';
  let longest: NoSpendDays['longest'] = null;
  for (let d = first; d <= last; d = addDaysToDateKey(d, 1)) {
    daysCounted++;
    if ((spentByDate[d] || 0) > 0) {
      run = 0;
      continue;
    }
    count++;
    if (run === 0) runStart = d;
    run++;
    if (!longest || run > longest.length) longest = { length: run, start: runStart, end: d };
  }
  return { count, daysCounted, longest };
}

// ─── Small leaks ────────────────────────────────────────────────────────────

export const SMALL_LEAK_LIMIT = 200;
export const SMALL_LEAK_MIN_COUNT = 5;

export interface SmallLeaks {
  count: number;
  total: number;
  /** Share of all counted spending of the range, 0..1. */
  shareOfSpending: number;
  /** The category with the most small-leak money (null = uncategorised). */
  topCategoryId: string | null;
}

/** Counted expenses under ₹200. null unless there are at least 5 of them. */
export function computeSmallLeaks(rows: readonly HabitRow[], range: DateRange): SmallLeaks | null {
  const spending = spendingIn(rows, range);
  const leaks = spending.filter((r) => Number(r.amount) < SMALL_LEAK_LIMIT);
  if (leaks.length < SMALL_LEAK_MIN_COUNT) return null;

  const total = round2(leaks.reduce((s, r) => s + Number(r.amount), 0));
  const all = spending.reduce((s, r) => s + Number(r.amount), 0);
  const byCategory = new Map<string | null, number>();
  for (const r of leaks) byCategory.set(r.category_id ?? null, (byCategory.get(r.category_id ?? null) || 0) + Number(r.amount));
  let topCategoryId: string | null = null;
  let topAmount = -1;
  for (const [id, amount] of byCategory) {
    if (amount > topAmount) {
      topAmount = amount;
      topCategoryId = id;
    }
  }
  return { count: leaks.length, total, shareOfSpending: all > 0 ? total / all : 0, topCategoryId };
}

// ─── Category vs your own average ───────────────────────────────────────────

export const CATEGORY_SHIFT_MIN_AMOUNT = 500;

export interface CategoryShift {
  categoryId: string;
  current: number;
  average: number;
  /** current / average */
  ratio: number;
}

/**
 * Categories far from their own average: ratio ≥ 1.5 or ≤ 0.5, the bigger of current / average at least ₹500, and the
 * category seen in at least 2 of the baseline periods. Strongest change first, at most 3.
 */
export function computeCategoryVsAverage(
  rows: readonly HabitRow[],
  current: DateRange,
  baselines: readonly DateRange[]
): CategoryShift[] {
  const sumByCategory = (range: DateRange) => {
    const m = new Map<string, number>();
    for (const r of spendingIn(rows, range)) {
      if (!r.category_id) continue;
      m.set(r.category_id, (m.get(r.category_id) || 0) + Number(r.amount));
    }
    return m;
  };
  const now = sumByCategory(current);
  const past = baselines.map(sumByCategory);
  const ids = new Set<string>([...now.keys(), ...past.flatMap((m) => [...m.keys()])]);

  const out: CategoryShift[] = [];
  for (const id of ids) {
    const seenIn = past.filter((m) => (m.get(id) || 0) > 0).length;
    if (seenIn < 2) continue;
    const average = past.reduce((s, m) => s + (m.get(id) || 0), 0) / past.length;
    const cur = now.get(id) || 0;
    if (Math.max(cur, average) < CATEGORY_SHIFT_MIN_AMOUNT || average <= 0) continue;
    const ratio = cur / average;
    if (ratio >= 1.5 || ratio <= 0.5) out.push({ categoryId: id, current: round2(cur), average: round2(average), ratio });
  }
  // Strongest change first: 3x up and 1/3 down are equally strong.
  const strength = (s: CategoryShift) => (s.ratio > 0 ? Math.abs(Math.log(s.ratio)) : Infinity);
  return out.sort((a, b) => strength(b) - strength(a)).slice(0, 3);
}

// ─── Time of day ────────────────────────────────────────────────────────────

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';
export const DAY_PARTS: DayPart[] = ['morning', 'afternoon', 'evening', 'night'];
export const TIME_OF_DAY_MIN_ENTRIES = 5;

/** 5-12 morning, 12-17 afternoon, 17-21 evening, 21-5 night (local time). */
export function dayPartOf(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export interface TimeOfDay {
  amounts: Record<DayPart, number>;
  top: DayPart;
  /** Share of the counted amount spent in `top`, 0..1. */
  topShare: number;
  /** Entries used (logged the same day they happened) and all spending entries of the range. */
  usedEntries: number;
  totalEntries: number;
}

/**
 * When the money goes. Arthik only knows when an entry was LOGGED, so only entries logged on the day they happened
 * are used (the card says how many). null with fewer than 5 such entries.
 */
export function computeTimeOfDay(rows: readonly HabitRow[], range: DateRange): TimeOfDay | null {
  const spending = spendingIn(rows, range);
  const amounts: Record<DayPart, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  let used = 0;
  for (const r of spending) {
    if (!r.created_at) continue;
    const at = new Date(r.created_at);
    if (Number.isNaN(at.getTime()) || toDateKey(at) !== toDateKey(r.expense_date)) continue;
    amounts[dayPartOf(at.getHours())] += Number(r.amount);
    used++;
  }
  if (used < TIME_OF_DAY_MIN_ENTRIES) return null;
  const total = DAY_PARTS.reduce((s, p) => s + amounts[p], 0);
  const top = DAY_PARTS.reduce((a, b) => (amounts[b] > amounts[a] ? b : a));
  for (const p of DAY_PARTS) amounts[p] = round2(amounts[p]);
  return { amounts, top, topShare: total > 0 ? amounts[top] / total : 0, usedEntries: used, totalEntries: spending.length };
}

// ─── Top places ─────────────────────────────────────────────────────────────

export interface TopPlace {
  name: string;
  total: number;
  count: number;
}

export const TOP_PLACE_MIN_VISITS = 2;

/**
 * Places you keep going back to, grouped by the note (cleaned like AutoLog merchant names), most visits first.
 * A note seen once is a one-time buy, not a place. Rows without a note are skipped.
 */
export function computeTopPlaces(rows: readonly HabitRow[], range: DateRange, limit = 3): TopPlace[] {
  const byKey = new Map<string, TopPlace & { lastDate: string }>();
  for (const r of spendingIn(rows, range)) {
    const note = (r.note || '').trim();
    if (!note) continue;
    const key = merchantKey(note);
    if (!key) continue;
    const date = toDateKey(r.expense_date);
    const place = byKey.get(key) || { name: note, total: 0, count: 0, lastDate: '' };
    place.total += Number(r.amount);
    place.count++;
    if (date >= place.lastDate) {
      place.lastDate = date;
      place.name = note; // the newest spelling the user wrote
    }
    byKey.set(key, place);
  }
  return [...byKey.values()]
    .filter((p) => p.count >= TOP_PLACE_MIN_VISITS)
    .sort((a, b) => b.count - a.count || b.total - a.total)
    .slice(0, limit)
    .map(({ name, total, count }) => ({ name, total: round2(total), count }));
}

/** A category rise as the user reads it: "4x" from 2x up (easier than +303%), "+45%" below it. */
export function formatRise(ratio: number): string {
  if (ratio >= 2) return `${Math.round(ratio * 10) / 10}x`;
  return `+${Math.round((ratio - 1) * 100)}%`;
}
