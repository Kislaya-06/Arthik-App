import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../authStore';
import type { Expense, ExpenseUpdatePayload } from './types';
import { getCachedStorageKey } from './pendingQueues';
import { isExpenseCacheUnchanged, isExpenseSourceUnchanged, rememberExpenseCache } from '../../lib/expenseCacheMemo';
import { runExclusive } from '../../lib/queueLock';

/**
 * OPT-60/62: how long a save (add / edit / delete) waits for the server before it stops waiting.
 * The change is already in the offline queue (written ahead), so after this it simply stays
 * "sync pending" and is sent by the normal sync. The request itself keeps running; its late answer
 * is still used (see `inFlightAdds`).
 */
export const SAVE_TIMEOUT_MS = 10_000;

export const SAVE_TIMED_OUT = { timedOut: true } as const;

export const isTimedOut = (value: unknown): value is typeof SAVE_TIMED_OUT => value === SAVE_TIMED_OUT;

/**
 * Adds whose request timed out but has not answered yet. If the user edits or deletes such an expense
 * meanwhile, the edit / delete is also queued for the server, and re-queued when the late answer
 * arrives, so nothing the user did can be lost to the late insert.
 */
export const inFlightAdds = new Map<string, { lastUpdate?: ExpenseUpdatePayload; deleted?: boolean }>();

/**
 * OPT-62: keep the on-phone copy of confirmed expenses in step after a confirmed save, so an offline
 * cold start right after shows it. Same content and format the sync already writes (`flushSideQueues`):
 * every non-pending expense in the current list. Runs in the background, one write at a time.
 * `isExpensesLoaded` reads the store's own flag (passed in, so this helper never imports the store).
 */
export const persistConfirmedCache = (userId: string, getExpenses: () => Expense[], isExpensesLoaded: () => boolean): Promise<void> => {
  const key = getCachedStorageKey(userId);
  return runExclusive(key, async () => {
    try {
      if (useAuthStore.getState().user?.id !== userId) return; // signed out meanwhile
      // Never replace a fuller copy with a partial list (the list has not been loaded from cache/server yet).
      if (!isExpensesLoaded()) return;
      const list = getExpenses();
      // Same list as the last write (several saves queued behind one lock): nothing new, skip the stringify.
      if (isExpenseSourceUnchanged(key, list)) return;
      const confirmed = list.filter((e) => !e.pending && !e.id.startsWith('temp_'));
      const json = JSON.stringify(confirmed);
      if (isExpenseCacheUnchanged(key, json)) {
        rememberExpenseCache(key, json, list);
        return;
      }
      await AsyncStorage.setItem(key, json);
      rememberExpenseCache(key, json, list);
    } catch (e) {
      if (__DEV__) console.log('Error updating confirmed expense cache:', e);
    }
  });
};

/** Cached rows minus any id that is already in the in-memory pending list (never show one expense twice). */
export const withoutPendingDuplicates = (cached: Expense[], pending: Expense[]): Expense[] => {
  if (pending.length === 0) return cached;
  const pendingIds = new Set(pending.map((e) => e.id));
  return cached.some((e) => pendingIds.has(e.id)) ? cached.filter((e) => !pendingIds.has(e.id)) : cached;
};
