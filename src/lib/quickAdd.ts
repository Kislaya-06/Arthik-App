/**
 * Faster adding, pure helpers:
 * - recentRepeatables: the entries "long-press +" offers to log again (the Add form opens filled in; nothing is saved
 *   until the user taps Save).
 * - suggestCategoryForNow: the category the Add screen picks for you, from what you usually log at this time of day.
 */
import { addDaysToDateKey, toDateKey } from '../money/dateKeys';
import { classifyTransaction } from './transactionUtils';
import { grossAmountOf } from './splitLedger';
import { merchantKey } from '../features/autoLog/merchants';
import { dayPartOf } from './insights/habits';

export interface QuickAddRow {
  id: string;
  amount: number;
  gross_amount?: number | null;
  expense_date: string;
  created_at?: string | null;
  type?: string;
  transaction_class?: string | null;
  category_id?: string | null;
  payment_mode?: 'cash' | 'upi' | 'card';
  note?: string | null;
  split_person?: string | null;
  split_amount?: number | null;
  split_allocations?: unknown[] | null;
}

export interface RepeatableEntry {
  id: string;
  /** The amount PAID (SPL-003), what the form edits. */
  amount: number;
  note: string;
  category_id: string | null;
  payment_mode: 'cash' | 'upi' | 'card';
}

export const REPEATABLE_LIMIT = 3;

const isPlainSpend = (r: QuickAddRow) =>
  classifyTransaction(r) === 'spending' &&
  !(r.split_person && Number(r.split_amount) > 0) &&
  !(r.split_allocations && r.split_allocations.length > 0);

const loggedAt = (r: QuickAddRow) => r.created_at || r.expense_date;

/** Newest plain spends, one per (place, category, amount paid). Income, money back, transfers and splits are left out. */
export function recentRepeatables(rows: readonly QuickAddRow[], limit = REPEATABLE_LIMIT): RepeatableEntry[] {
  const sorted = rows.filter(isPlainSpend).sort((a, b) => (loggedAt(a) < loggedAt(b) ? 1 : loggedAt(a) > loggedAt(b) ? -1 : 0));
  const seen = new Set<string>();
  const out: RepeatableEntry[] = [];
  for (const r of sorted) {
    const amount = grossAmountOf(r);
    const note = (r.note || '').trim();
    const key = `${merchantKey(note)}|${r.category_id || ''}|${amount}`;
    if (amount <= 0 || seen.has(key)) continue;
    seen.add(key);
    out.push({ id: r.id, amount, note, category_id: r.category_id || null, payment_mode: r.payment_mode || 'upi' });
    if (out.length >= limit) break;
  }
  return out;
}

export const SUGGEST_WINDOW_DAYS = 60;
export const SUGGEST_MIN_ENTRIES = 3;

/**
 * The category you mostly log at this time of day (morning / afternoon / evening / night) over the last 60 days.
 * Only entries logged on the day they happened count (their time is real). null with fewer than 3 such entries or
 * when no category has more than half of them.
 */
export function suggestCategoryForNow(rows: readonly QuickAddRow[], now: Date): string | null {
  const part = dayPartOf(now.getHours());
  const todayKey = toDateKey(now);
  const from = addDaysToDateKey(todayKey, -SUGGEST_WINDOW_DAYS);
  const counts = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    if (!r.category_id || !r.created_at || !isPlainSpend(r)) continue;
    const day = toDateKey(r.expense_date);
    if (day < from || day > todayKey) continue;
    const at = new Date(r.created_at);
    if (Number.isNaN(at.getTime()) || toDateKey(at) !== day || dayPartOf(at.getHours()) !== part) continue;
    counts.set(r.category_id, (counts.get(r.category_id) || 0) + 1);
    total++;
  }
  if (total < SUGGEST_MIN_ENTRIES) return null;
  const [best, n] = [...counts].sort((a, b) => b[1] - a[1])[0];
  return n / total > 0.5 ? best : null;
}
