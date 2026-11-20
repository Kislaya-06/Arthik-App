import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { useAuthStore, registerStoreResetCallback } from './authStore';
import {
  useDailyBudgetStore,
  registerExpenseGetter,
  registerExpensesLoadedGetter,
  registerAddExpense,
} from './dailyBudgetStore';
import { registerExpensesFreshGetter } from './dailyBudget/expenseBridge';
import { useNetworkStore, registerSyncCallback } from './networkStore';
import { registerCategoryDeleteCallback } from './categoryStore';
export type {
  Expense,
  FailedSyncItem,
  ExpenseUpdatePayload,
  PendingUpdate,
  PendingDelete,
  ExpenseState,
} from './expense/types';
import type {
  Expense,
  ExpenseState,
  ExpenseUpdatePayload,
  PendingUpdate,
} from './expense/types';

import { getPendingStorageKey, getPendingUpdatesKey, getPendingDeletesKey, getCachedStorageKey, getFailedSyncStorageKey, MAX_SYNC_RETRIES, getBackoffDelay, UUID_REGEX, isValidUUID, savePendingUpdateOffline, savePendingDeleteOffline, updatePendingItemOffline, removePendingItemOffline, sanitizeNote } from './expense/pendingQueues';
export {
  UUID_REGEX,
  isValidUUID,
  getPendingStorageKey,
  getPendingUpdatesKey,
  getPendingDeletesKey,
  getCachedStorageKey,
  getFailedSyncStorageKey,
  MAX_SYNC_RETRIES,
  getBackoffDelay,
  savePendingUpdateOffline,
  savePendingDeleteOffline,
  updatePendingItemOffline,
  removePendingItemOffline,
  sanitizeNote,
};

import { sameExpenseList } from '../lib/expenseListEquality';
import { isExpenseCacheUnchanged, rememberExpenseCache, forgetExpenseCache } from '../lib/expenseCacheMemo';
import { withRecoveries } from './expense/recoveryMiddleware';
import { probeExpensesVersion, canReuseExpenseList } from './expense/versionProbe';

import NetInfo from '@react-native-community/netinfo';
let activeFetchSeq = 0;

/**
 * OPT-63: true once the expense list was loaded from the server in this app session (not from the cache).
 * Reset on sign-out. Read by hydration through `areExpensesFreshFromServer()`.
 */
let expensesFreshFromServer = false;

/**
 * OPT-69: the server's expense change counter, read just BEFORE the last successful download of this session.
 * While the server still reports the same counter, nothing changed there and the list in memory is reused.
 * `null` = not known (first download of the session, counter not available, or the last download failed).
 * Reset on sign-out.
 */
let lastDownloadVersion: { userId: string; version: number } | null = null;

// P0.7: Exact network failure identification
import { isNetworkFailure, withTimeout } from '../lib/networkUtils';
import { runExclusive } from '../lib/queueLock';
import { inFlightAdds, withoutPendingDuplicates } from './expense/saveGuards';
import { createMutationActions } from './expense/mutationActions';
import { createLoadActions } from './expense/loadActions';
import { createFailedSyncActions } from './expense/failedSyncActions';
export { SAVE_TIMEOUT_MS } from './expense/saveGuards';

export { isNetworkFailure, withTimeout };

export const useExpenseStore = create<ExpenseState>()(withRecoveries((set, get) => ({
  expenses: [],
  loading: false,
  isExpensesLoaded: false,
  transactionType: 'expense',
  failedSyncItems: [],

  setTransactionType: (transactionType: 'expense' | 'income') => {
    set({ transactionType });
  },

  resetExpenses: () => {
    activeFetchSeq++;
    expensesFreshFromServer = false;
    lastDownloadVersion = null;
    inFlightAdds.clear();
    forgetExpenseCache();
    set({ expenses: [], loading: false, isExpensesLoaded: false, transactionType: 'expense', failedSyncItems: [] });
  },
  ...createFailedSyncActions(set, get),
  ...createLoadActions(set, get),

  fetchExpenses: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    await get().loadCachedExpenses();

    // Offline fast-path: if currently offline, return immediately with cached expenses
    const fetchSeq = ++activeFetchSeq;

    // Offline fast-path: return immediately with cached expenses without network call
    const isOffline = useNetworkStore.getState().isOffline;
    if (isOffline) {
      set({ loading: false });
      return;
    }

    set({ loading: true });

    try {
      // P0.5: Run sync before fetch if online
      try {
        await get().syncPendingExpenses();
      } catch {}

      if (fetchSeq !== activeFetchSeq) return;

      // OPT-69: after the first download of a session, ask the server whether any expense changed since then.
      // Read BEFORE the download, so a change that lands in between can only cause one extra download, never a
      // missed row. The first download of a session does not ask (app start sends the same requests as before).
      let probedVersion: number | null = null;
      if (expensesFreshFromServer) {
        probedVersion = await probeExpensesVersion(user.id);
        if (fetchSeq !== activeFetchSeq) return;
        const baseline = lastDownloadVersion?.userId === user.id ? lastDownloadVersion.version : null;
        if (canReuseExpenseList(baseline, probedVersion)) {
          // Same counter: no row was added, changed or deleted on the server. Keep the list (and its array identity).
          useDailyBudgetStore.getState().syncWithExpenses(get().expenses);
          return;
        }
      }

      // FIN-05: Range pagination with per-page timeout guard and retries
      const BATCH_SIZE = 1000;
      const PAGE_TIMEOUT_MS = 10000;
      const MAX_PAGE_RETRIES = 2;
      let fetchedRows: Expense[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        if (fetchSeq !== activeFetchSeq) return;

        let pageData: Expense[] | null = null;
        let lastPageError: unknown = null;

        for (let attempt = 0; attempt <= MAX_PAGE_RETRIES; attempt++) {
          if (fetchSeq !== activeFetchSeq) return;
          try {
            const pageQuery = supabase
              .from('expenses')
              .select('*')
              .eq('user_id', user.id)
              .order('expense_date', { ascending: false })
              .order('created_at', { ascending: false })
              // OPT-70: unique last sort key. Rows saved together share one `created_at`; without this their order
              // is not fixed between two page requests, so a row on a 1,000-row page border could be skipped or repeated.
              .order('id', { ascending: false })
              .range(from, from + BATCH_SIZE - 1);

            const { data, error } = await withTimeout<{ data: Expense[] | null; error: any }>(
              pageQuery,
              PAGE_TIMEOUT_MS,
              { data: null, error: new Error('Network request failed: timeout') }
            );

            if (error) throw error;
            pageData = data;
            lastPageError = null;
            break;
          } catch (pageErr) {
            lastPageError = pageErr;
            if (attempt < MAX_PAGE_RETRIES) {
              await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
            }
          }
        }

        if (lastPageError || !pageData) {
          throw lastPageError || new Error('Network request failed: timeout');
        }

        if (fetchSeq !== activeFetchSeq) return;

        if (pageData && pageData.length > 0) {
          fetchedRows = fetchedRows.concat(pageData);
          if (pageData.length < BATCH_SIZE) {
            hasMore = false;
          } else {
            from += BATCH_SIZE;
          }
        } else {
          hasMore = false;
        }
      }

      if (fetchSeq !== activeFetchSeq) return;

      // P0.5: Read pending deletes, updates, and additions from AsyncStorage in one batch
      let pendingDeletes: string[] = [];
      let pendingUpdates: PendingUpdate[] = [];
      let pendingAdds: Expense[] = [];

      try {
        const [delPair, updPair, addPair] = await AsyncStorage.multiGet([
          getPendingDeletesKey(user.id),
          getPendingUpdatesKey(user.id),
          getPendingStorageKey(user.id),
        ]);

        if (delPair && delPair[1]) {
          const parsed: (string | { id: string })[] = JSON.parse(delPair[1]);
          pendingDeletes = parsed.map((item) => (typeof item === 'string' ? item : item.id));
        }
        if (updPair && updPair[1]) {
          pendingUpdates = JSON.parse(updPair[1]);
        }
        if (addPair && addPair[1]) {
          pendingAdds = JSON.parse(addPair[1]);
        }
      } catch {}

      const pendingDeleteSet = new Set(pendingDeletes);
      const updateMap = new Map<string, ExpenseUpdatePayload>(pendingUpdates.map((u) => [u.id, u.payload]));

      // Filter out pending-deleted rows and re-apply pending updates
      const reconciledFetched = fetchedRows
        .filter((e) => !pendingDeleteSet.has(e.id))
        .map((e) => {
          const patch = updateMap.get(e.id);
          return patch ? { ...e, ...patch } : e;
        });

      // Also preserve any pending additions that haven't synced yet
      const fetchedIdSet = new Set(reconciledFetched.map((e) => e.id));
      const activePendingAdds = pendingAdds
        .filter((e) => !pendingDeleteSet.has(e.id) && !fetchedIdSet.has(e.id))
        .map((e) => {
          const patch = updateMap.get(e.id);
          return patch ? { ...e, ...patch, pending: true } : { ...e, pending: true };
        });

      const combined = [...activePendingAdds, ...reconciledFetched];
      // Keep the same array when nothing changed, so screens do not re-render or recompute for nothing.
      if (sameExpenseList(get().expenses, combined)) {
        if (!get().isExpensesLoaded) set({ isExpensesLoaded: true });
      } else {
        set({ expenses: combined, isExpensesLoaded: true });
      }

      expensesFreshFromServer = true; // OPT-63: the list now comes from the server
      // OPT-69: remember the counter this download belongs to (null when it could not be read).
      lastDownloadVersion = probedVersion !== null ? { userId: user.id, version: probedVersion } : null;

      // Cache expenses for offline resilience (skip the disk write when it would be identical)
      const cacheStorageKey = getCachedStorageKey(user.id);
      const cacheJson = JSON.stringify(reconciledFetched);
      await runExclusive(cacheStorageKey, async () => {
        if (!isExpenseCacheUnchanged(cacheStorageKey, cacheJson)) {
          await AsyncStorage.setItem(cacheStorageKey, cacheJson);
          rememberExpenseCache(cacheStorageKey, cacheJson);
        }
      });
      useDailyBudgetStore.getState().syncWithExpenses(combined);
    } catch (e: unknown) {
      if (fetchSeq !== activeFetchSeq) return;
      lastDownloadVersion = null; // OPT-69: the download failed, so the next refresh must download again
      const err = e as { message?: string } | null;

      let isNetOffline = false;
      try {
        const netState = await NetInfo.fetch();
        isNetOffline = Boolean(netState && (netState.isConnected === false || netState.isInternetReachable === false));
      } catch {}

      if (isNetOffline) {
        if (__DEV__) console.warn('Network unavailable while fetching expenses, falling back to cache:', err?.message || e);
        useNetworkStore.getState().setOffline(true);
      } else if (isNetworkFailure(e)) {
        if (__DEV__) console.warn('Network request failed while fetching expenses, falling back to cache:', err?.message || e);
      } else {
        if (__DEV__) console.error('Error fetching expenses:', e);
      }
      // Offline fallback: load cached expenses if available
      try {
        const cached = await AsyncStorage.getItem(getCachedStorageKey(user.id));
        if (cached !== null) {
          const parsed: Expense[] = JSON.parse(cached);
          const pending = get().expenses.filter((e) => e.pending || e.id.startsWith('temp_'));
          const combined = [...pending, ...withoutPendingDuplicates(parsed, pending)];
          set({ expenses: combined, isExpensesLoaded: true });
          useDailyBudgetStore.getState().syncWithExpenses(combined);
        } else {
          // Network failed and no cache exists: leave isExpensesLoaded as false so rollover notification does not fire with false data!
          useDailyBudgetStore.getState().syncWithExpenses(get().expenses);
        }
      } catch (cacheErr) {
        if (__DEV__) console.log('Error reading cached expenses:', cacheErr);
      }
    } finally {
      if (fetchSeq === activeFetchSeq) {
        set({ loading: false });
      }
    }
  },
  ...createMutationActions(set, get),
})));

// Register auto-sync when connection is restored
registerSyncCallback(async () => {
  await useExpenseStore.getState().syncPendingExpenses();
});

registerStoreResetCallback(() => {
  useExpenseStore.getState().resetExpenses();
  useExpenseStore.setState({ failedSyncItems: [] });
});

registerExpenseGetter(() => useExpenseStore.getState().expenses);
registerExpensesLoadedGetter(() => useExpenseStore.getState().isExpensesLoaded);
registerExpensesFreshGetter(() => expensesFreshFromServer);
registerAddExpense((...args) => useExpenseStore.getState().addExpense(...args));

registerCategoryDeleteCallback((deletedCategoryId: string) => {
  useExpenseStore.setState((s) => ({
    expenses: s.expenses.map((e) => (e.category_id === deletedCategoryId ? { ...e, category_id: null } : e)),
  }));
});

export const getPendingSyncCount = async (userId: string): Promise<number> => {
  try {
    let count = 0;
    const adds = await AsyncStorage.getItem(getPendingStorageKey(userId));
    if (adds) {
      const parsed = JSON.parse(adds);
      if (Array.isArray(parsed)) count += parsed.length;
    }
    const updates = await AsyncStorage.getItem(getPendingUpdatesKey(userId));
    if (updates) {
      const parsed = JSON.parse(updates);
      if (Array.isArray(parsed)) count += parsed.length;
    }
    const deletes = await AsyncStorage.getItem(getPendingDeletesKey(userId));
    if (deletes) {
      const parsed = JSON.parse(deletes);
      if (Array.isArray(parsed)) count += parsed.length;
    }
    const settings = await AsyncStorage.getItem(`@arthik_pending_settings_${userId}`);
    if (settings) {
      count += 1;
    }
    return count;
  } catch {
    return 0;
  }
};
