/**
 * The ledger: every raw expense row, cleaned ONCE, then summed by day.
 *
 * WHY THIS EXISTS
 * Every screen used to do the same three steps on its own: (1) "is this row spending?", (2) "what is its clean date
 * and amount?", (3) "add it up". Each copy was slightly different (some rounded, some did not, some forgot
 * self-transfers). Now there is one place. Screens ask for totals; they do not loop over raw rows.
 *
 * TWO AMOUNTS PER ROW (canonical rule SPL-003)
 *  - amountPaid                   : what really left the bank. The database always holds this.
 *  - amountCountedAfterMoneyBack  : amountPaid minus money that came back (friend payback or refund), never below 0.
 *                                   Every total, budget day and chart uses THIS one.
 * The expense store keeps the counted amount in `amount` and the paid amount in `gross_amount`. That double meaning of
 * the name "amount" is hidden here: below this file, the names say exactly which one they are.
 *
 * Pure functions only. No React, no stores.
 */
import { round2 } from '../lib/formatters';
import { classifyTransaction, TransactionKind } from '../lib/transactionUtils';
import { DateKey, isDateKeyWithin, toDateKey } from './dateKeys';

/** The fields of an expense row that the ledger reads. The store's Expense type fits this. */
export interface LedgerSourceRow {
  id?: string;
  /** As the store holds it: the COUNTED amount (after money back). */
  amount: number | string;
  /** The amount really paid. Missing means nothing came back, so it equals `amount`. */
  gross_amount?: number | null;
  expense_date?: string | null;
  type?: string;
  transaction_class?: string | null;
  category_id?: string | null;
}

export interface LedgerCategory {
  id: string;
  name?: string;
}

export interface LedgerEntry {
  transactionId: string;
  /** '' when the row has no usable date. Such rows are skipped by every total. */
  dateKey: DateKey;
  kind: TransactionKind;
  amountPaid: number;
  amountCountedAfterMoneyBack: number;
  categoryId: string | null;
}

/** Money amount of one date: { '2026-10-05': 250.55, ... } */
export type TotalsByDateKey = Record<DateKey, number>;

const categoryLookupCache = new WeakMap<readonly LedgerCategory[], Map<string, LedgerCategory>>();

/** id -> category, built once per categories array (cached on the array itself). */
export function buildCategoryLookup(categories: readonly LedgerCategory[]): Map<string, LedgerCategory> {
  const cached = categoryLookupCache.get(categories);
  if (cached) return cached;
  const lookup = new Map<string, LedgerCategory>();
  for (const category of categories) {
    if (category && category.id) lookup.set(category.id, category);
  }
  categoryLookupCache.set(categories, lookup);
  return lookup;
}

/** Cleans one row. */
export function toLedgerEntry(
  row: LedgerSourceRow,
  categoryLookup: Map<string, LedgerCategory>
): LedgerEntry {
  const category = row.category_id ? categoryLookup.get(row.category_id) : undefined;
  const amountCountedAfterMoneyBack = Number(row.amount) || 0;
  return {
    transactionId: row.id ?? '',
    dateKey: toDateKey(row.expense_date),
    kind: classifyTransaction(row, category),
    amountPaid: round2(Number(row.gross_amount ?? row.amount) || 0),
    amountCountedAfterMoneyBack,
    categoryId: row.category_id ?? null,
  };
}

/** Cleans every row, once. Keep the result in a useMemo / selector and hand it to the total functions below. */
// OPT-63: Home, Savings and Insights each built the ledger from the same expense list on every change. The
// ledger is a pure function of (rows, categories), so the result for the same two references is reused.
// Keyed weakly on the rows array: it is dropped together with that array. Entries are read-only.
const ledgerMemo = new WeakMap<
  readonly LedgerSourceRow[],
  { categories: readonly LedgerCategory[] | undefined; rowCount: number; categoryCount: number; entries: LedgerEntry[] }
>();

export function buildLedgerEntries(
  rows: readonly LedgerSourceRow[],
  categories?: readonly LedgerCategory[]
): LedgerEntry[] {
  const hit = ledgerMemo.get(rows);
  const categoryCount = categories ? categories.length : -1;
  // Same arrays AND same lengths (an array appended to in place never counts as the same).
  if (hit && hit.categories === categories && hit.rowCount === rows.length && hit.categoryCount === categoryCount) {
    return hit.entries;
  }
  const entries = buildLedgerEntriesUncached(rows, categories ?? []);
  ledgerMemo.set(rows, { categories, rowCount: rows.length, categoryCount, entries });
  return entries;
}

function buildLedgerEntriesUncached(
  rows: readonly LedgerSourceRow[],
  categories: readonly LedgerCategory[]
): LedgerEntry[] {
  const categoryLookup = buildCategoryLookup(categories);
  const entries: LedgerEntry[] = new Array(rows.length);
  for (let index = 0; index < rows.length; index++) {
    entries[index] = toLedgerEntry(rows[index], categoryLookup);
  }
  return entries;
}

/** Spending per day. Only rows of kind 'spending' with a clean date are added (rounded to paise at every step). */
export function spendingTotalsByDateKey(entries: readonly LedgerEntry[]): TotalsByDateKey {
  const totals: TotalsByDateKey = {};
  for (const entry of entries) {
    if (entry.kind !== 'spending' || !entry.dateKey) continue;
    totals[entry.dateKey] = round2((totals[entry.dateKey] || 0) + entry.amountCountedAfterMoneyBack);
  }
  return totals;
}

/** Income per day. Only rows of kind 'income' with a clean date; a zero, negative or broken amount adds nothing. */
export function incomeTotalsByDateKey(entries: readonly LedgerEntry[]): TotalsByDateKey {
  const totals: TotalsByDateKey = {};
  for (const entry of entries) {
    if (entry.kind !== 'income' || !entry.dateKey) continue;
    const incomeAmount = entry.amountCountedAfterMoneyBack > 0 ? entry.amountCountedAfterMoneyBack : 0;
    totals[entry.dateKey] = round2((totals[entry.dateKey] || 0) + incomeAmount);
  }
  return totals;
}

/** Adds the days of a ready-made per-day total that fall between two date keys (both included). */
export function sumTotalsBetweenDateKeys(
  totalsByDateKey: TotalsByDateKey,
  startDateKey: DateKey,
  endDateKey: DateKey
): number {
  let sum = 0;
  for (const dateKey of Object.keys(totalsByDateKey)) {
    if (isDateKeyWithin(dateKey, startDateKey, endDateKey)) sum += totalsByDateKey[dateKey];
  }
  return round2(sum);
}

/** Total spending between two date keys (both included). One call replaces the old per-screen loops. */
export function sumSpendingBetweenDateKeys(
  rows: readonly LedgerSourceRow[],
  categories: readonly LedgerCategory[],
  startDateKey: DateKey,
  endDateKey: DateKey
): number {
  let sum = 0;
  for (const entry of buildLedgerEntries(rows, categories)) {
    if (entry.kind === 'spending' && entry.dateKey && isDateKeyWithin(entry.dateKey, startDateKey, endDateKey)) {
      sum += entry.amountCountedAfterMoneyBack;
    }
  }
  return round2(sum);
}

/** Total spending of the given rows, whatever their dates (the caller already chose the rows). */
export function sumCountedSpending(
  rows: readonly LedgerSourceRow[],
  categories: readonly LedgerCategory[] = []
): number {
  let sum = 0;
  for (const entry of buildLedgerEntries(rows, categories)) {
    if (entry.kind === 'spending') sum += entry.amountCountedAfterMoneyBack;
  }
  return round2(sum);
}
