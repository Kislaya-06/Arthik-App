import { supabase } from '../../config/supabase';
import { withTimeout } from '../../lib/networkUtils';

/**
 * OPT-69: "has anything changed?" check for the expense list.
 *
 * The server keeps one counter per user (`expense_sync_versions`, bumped by a trigger on every insert / update /
 * delete of that user's expenses, in the same transaction as the change; see
 * `supabase/migrations/20261030145341_performance_sync_version_bootstrap.sql`). `arthik_expenses_version` returns it.
 *
 * `fetchExpenses` reads the counter BEFORE it downloads the list and remembers it. On a later refresh, when the
 * counter is still the same, no row was added, changed or deleted on the server since that download, so the list
 * already in memory is the server's list and the download is skipped.
 *
 * Every problem (function not installed, network, timeout, strange answer) returns `null`, which always means
 * "download everything", exactly like before this file existed.
 */

export const VERSION_PROBE_TIMEOUT_MS = 2500;

/** The server answered "this function does not exist": do not ask again in this app run. */
let functionMissing = false;

const isFunctionMissingError = (error: unknown): boolean => {
  const e = (error ?? {}) as { code?: unknown; status?: unknown; message?: unknown };
  if (e.code === 'PGRST202' || e.code === '42883' || e.status === 404) return true;
  return typeof e.message === 'string' && /could not find the function/i.test(e.message);
};

/** A whole number >= 0, as a number or as digits in a string (bigint). Anything else is not a counter. */
export function parseExpensesVersion(data: unknown): number | null {
  const value = typeof data === 'string' && /^\d{1,15}$/.test(data) ? Number(data) : data;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

export async function probeExpensesVersion(userId: string): Promise<number | null> {
  if (functionMissing) return null;
  try {
    if (typeof (supabase as { rpc?: unknown }).rpc !== 'function') return null;
    // Promise.resolve runs the request exactly once (a Supabase query re-sends itself on every `.then`).
    const request = Promise.resolve(supabase.rpc('arthik_expenses_version', { p_user_id: userId }));
    const result = await withTimeout<{ data: unknown; error: unknown }, null>(request, VERSION_PROBE_TIMEOUT_MS, null);
    if (!result) return null;
    if (result.error) {
      if (isFunctionMissingError(result.error)) functionMissing = true;
      return null;
    }
    return parseExpensesVersion(result.data);
  } catch {
    return null;
  }
}

/**
 * True only when the list in memory can stand in for a fresh download.
 * `baseline` = counter read before the last successful download of this session (null = not known).
 * A counter of 0 is never trusted: 0 is also what a server without the trigger would always answer.
 */
export function canReuseExpenseList(baseline: number | null | undefined, probed: number | null | undefined): boolean {
  if (baseline === null || baseline === undefined || probed === null || probed === undefined) return false;
  return probed >= 1 && probed === baseline;
}

/** Tests only. */
export function resetVersionProbeForTests(): void {
  functionMissing = false;
}
