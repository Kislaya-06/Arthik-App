/**
 * Expense download helpers (OPT-60, OPT-61, OPT-66, OPT-69). Pure data plumbing: no money logic lives here.
 *
 * 1. Keyset pagination (OPT-66)
 *    The list is read in pages ordered by (expense_date DESC, created_at DESC, id DESC). Page 2 onwards asks for
 *    "rows after the last row I already have" instead of "skip N rows". Skipping N rows shifts when a row is
 *    added or deleted between two pages (a row could be read twice and counted twice, or missed), and it gets
 *    slower for every page. `id` is the final tie-breaker, so the order is total and the same on every read.
 *
 * 2. Change-version probe (OPT-69)
 *    Supabase keeps one counter per user (`expense_sync_versions`, bumped by a trigger on every insert, update
 *    and delete of that user's expenses). After a full download, the raw server rows are kept in memory together
 *    with the counter value read BEFORE the download started. On the next refresh the app reads the counter
 *    again: the same number means the server rows are exactly the same, so the kept rows are used instead of
 *    downloading every page again. Everything after that point (pending queues, cache, budget sync) runs exactly
 *    as after a real download. A different number, an error, a missing function (SQL not run yet) or a forced
 *    refresh (pull-to-refresh, midnight) always means a full download, exactly as before.
 *
 * 3. Shared freshness clock (OPT-60)
 *    One "last fetch started at" time for the whole app, instead of one per screen, so Splash, Home, History,
 *    Insights and Savings do not each download the same list again within the same minute.
 */
import { supabase } from '../../config/supabase';
import { withTimeout } from '../../lib/networkUtils';
import type { Expense } from './types';

// ─── Shared freshness clock (OPT-60) ─────────────────────────────────────────────────────────────────────

let lastFetchStartedAt = 0;

/** Time (ms since epoch) the last `fetchExpenses` call started. 0 = never in this session. */
export const getLastExpensesFetchAt = (): number => lastFetchStartedAt;

export const markExpensesFetchStarted = (now: number = Date.now()): void => {
  lastFetchStartedAt = now;
};

// ─── Keyset pagination (OPT-66) ──────────────────────────────────────────────────────────────────────────

export interface ExpenseKeysetCursor {
  expense_date: string;
  created_at: string | null;
  id: string;
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[0-9a-fA-F-]{1,64}$/;
// What Postgres prints for a timestamptz: digits, '-', ':', '.', '+', 'T', ' ', 'Z'. Nothing that needs escaping.
const TIMESTAMP_RE = /^[0-9TZ:.+\- ]{10,40}$/;

/**
 * The cursor for the next page, taken from the last row of the current page.
 * Returns null when the row does not look like a normal server row; the caller then keeps reading by offset
 * (the old way) so nothing can be skipped.
 */
export function expenseKeysetCursor(row: Partial<Expense> | undefined): ExpenseKeysetCursor | null {
  if (!row) return null;
  const date = typeof row.expense_date === 'string' ? row.expense_date : '';
  const id = typeof row.id === 'string' ? row.id : '';
  const created = row.created_at;
  if (!DATE_KEY_RE.test(date) || !ID_RE.test(id)) return null;
  if (created !== null && created !== undefined) {
    if (typeof created !== 'string' || !TIMESTAMP_RE.test(created)) return null;
    return { expense_date: date, created_at: created, id };
  }
  return { expense_date: date, created_at: null, id };
}

/**
 * PostgREST `or` filter for "every row that comes AFTER `c`" in the order
 * expense_date DESC, created_at DESC (NULLS FIRST, the Postgres default for DESC), id DESC.
 * Timestamps are wrapped in double quotes because they contain ':' and '.', which are reserved in a filter tree.
 */
export function expenseKeysetFilter(c: ExpenseKeysetCursor): string {
  const d = c.expense_date;
  if (c.created_at === null) {
    // NULL created_at sorts FIRST inside a date, so after a NULL row come: the other NULL rows with a smaller id,
    // then every non-NULL row of the same date, then every older date.
    return [
      `expense_date.lt.${d}`,
      `and(expense_date.eq.${d},created_at.not.is.null)`,
      `and(expense_date.eq.${d},created_at.is.null,id.lt.${c.id})`,
    ].join(',');
  }
  const t = `"${c.created_at}"`;
  return [
    `expense_date.lt.${d}`,
    `and(expense_date.eq.${d},created_at.lt.${t})`,
    `and(expense_date.eq.${d},created_at.eq.${t},id.lt.${c.id})`,
  ].join(',');
}

// ─── Change-version probe and in-session snapshot (OPT-69) ───────────────────────────────────────────────

export const EXPENSES_VERSION_RPC = 'arthik_expenses_version';
const PROBE_TIMEOUT_MS = 4000;

let probeUnavailable = false;

/** PostgREST answers PGRST202 when the function does not exist (SQL not run yet). */
export const isMissingFunctionError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  return code === 'PGRST202' || code === '42883';
};

/**
 * The user's current expense version, or null when it cannot be known (offline, timeout, error, SQL not run).
 * Null always leads to a full download.
 */
export async function readExpensesVersion(userId: string): Promise<number | null> {
  if (probeUnavailable) return null;
  try {
    const res = await withTimeout(
      supabase.rpc(EXPENSES_VERSION_RPC, { p_user_id: userId }) as PromiseLike<{ data: unknown; error: unknown }>,
      PROBE_TIMEOUT_MS,
      { data: null, error: new Error('timeout') }
    );
    if (res.error) {
      if (isMissingFunctionError(res.error)) probeUnavailable = true;
      return null;
    }
    const value = typeof res.data === 'string' && res.data.trim() !== '' ? Number(res.data) : res.data;
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

export interface ExpenseServerSnapshot {
  userId: string;
  /** Version read BEFORE the download started. */
  version: number;
  /** Raw rows exactly as the server returned them (before pending queues are applied). Never mutated. */
  rows: Expense[];
}

let snapshot: ExpenseServerSnapshot | null = null;
/** The user whose list was fully downloaded at least once in this session (the first download never probes). */
let fullFetchDoneForUser: string | null = null;

export const getExpenseServerSnapshot = (): ExpenseServerSnapshot | null => snapshot;

export const setExpenseServerSnapshot = (next: ExpenseServerSnapshot | null): void => {
  snapshot = next;
};

export const hasFullFetchFor = (userId: string): boolean => fullFetchDoneForUser === userId;

export const markFullFetchDone = (userId: string): void => {
  fullFetchDoneForUser = userId;
};

/** The kept rows for this user when the server version is still `version`, otherwise null. */
export function reusableSnapshotRows(userId: string, version: number | null): Expense[] | null {
  if (version === null || !snapshot) return null;
  if (snapshot.userId !== userId || snapshot.version !== version) return null;
  return snapshot.rows;
}

/** Sign-out / account switch: forget everything this module knows. */
export function resetExpenseServerSync(): void {
  snapshot = null;
  fullFetchDoneForUser = null;
  lastFetchStartedAt = 0;
  probeUnavailable = false;
}

/** Test helper: same as a fresh app start. */
export const __resetExpenseServerSyncForTests = resetExpenseServerSync;
