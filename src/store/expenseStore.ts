import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase } from '../config/supabase';
import { useAuthStore, registerStoreResetCallback } from './authStore';
import { useDailyBudgetStore, registerExpenseGetter, registerExpensesLoadedGetter, registerAddExpense } from './dailyBudgetStore';
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

import {
  getPendingStorageKey,
  getPendingUpdatesKey,
  getPendingDeletesKey,
  getCachedStorageKey,
  getFailedSyncStorageKey,
  MAX_SYNC_RETRIES,
  getBackoffDelay,
  UUID_REGEX,
  isValidUUID,
  savePendingUpdateOffline,
  savePendingDeleteOffline,
  updatePendingItemOffline,
  removePendingItemOffline,
  sanitizeNote,
} from './expense/pendingQueues';
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

import { extraColumnsFor } from './expense/payload';
import { sameExpenseList } from '../lib/expenseListEquality';
import { isExpenseCacheUnchanged, rememberExpenseCache, forgetExpenseCache } from '../lib/expenseCacheMemo';
import { withRecoveries } from './expense/recoveryMiddleware';
import { deleteBlockReason } from '../lib/splitLedger';

import NetInfo from '@react-native-community/netinfo';
import {
  markExpensesFetchStarted,
  expenseKeysetCursor,
  expenseKeysetFilter,
  readExpensesVersion,
  reusableSnapshotRows,
  setExpenseServerSnapshot,
  hasFullFetchFor,
  markFullFetchDone,
  resetExpenseServerSync,
} from './expense/serverSync';
export { getLastExpensesFetchAt } from './expense/serverSync';
import type { ExpenseKeysetCursor } from './expense/serverSync';
import {
  syncPendingDeletes,
  syncPendingAdds,
  syncPendingUpdates,
  flushSideQueues,
} from './expense/syncPending';

/**
 * Puts the cached expense list into the store (no network). Same code the first step of `fetchExpenses` always ran;
 * OPT-07 also calls it on its own to show Home from cache. Returns true when a cached list was loaded.
 */
export async function preloadCachedExpenses(): Promise<boolean> {
  const user = useAuthStore.getState().user;
  if (!user) return false;
  try {
    const cached = await AsyncStorage.getItem(getCachedStorageKey(user.id));
    if (cached === null) return false;
    const parsed: Expense[] = JSON.parse(cached);
    const pending = useExpenseStore.getState().expenses.filter((e) => e.pending || e.id.startsWith('temp_'));
    const combined = [...pending, ...parsed];
    useExpenseStore.setState({ expenses: combined, isExpensesLoaded: true });
    useDailyBudgetStore.getState().syncWithExpenses(combined);
    return true;
  } catch (cacheErr) {
    if (__DEV__) console.log('Error reading cached expenses on launch:', cacheErr);
    return false;
  }
}

let isSyncInProgress = false;
let activeFetchSeq = 0;

// OPT-61: one download at a time. A normal (not forced) call made while a download for the same user is
// already running waits for that download instead of starting a second one that would cancel the first.
let inFlightFetch: { userId: string; promise: Promise<void> } | null = null;

// OPT-64: what the expense cache was last written from. When the next refresh reuses the same server rows
// (OPT-69) with the same pending deletes / updates, the cache JSON would be byte-for-byte the same, so the
// JSON.stringify of the whole list is skipped too (not only the disk write).
let lastCacheSource: {
  key: string;
  rows: Expense[];
  deletesRaw: string | null;
  updatesRaw: string | null;
  json: string;
} | null = null;

// P0.7: Exact network failure identification
import { isNetworkFailure, withTimeout } from '../lib/networkUtils';
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
    inFlightFetch = null;
    lastCacheSource = null;
    resetExpenseServerSync();
    forgetExpenseCache();
    set({ expenses: [], loading: false, isExpensesLoaded: false, transactionType: 'expense', failedSyncItems: [] });
  },

  loadFailedSyncItems: async () => {
    try {
      const user = useAuthStore.getState().user;
      if (!user) return;
      const stored = await AsyncStorage.getItem(getFailedSyncStorageKey(user.id));
      if (stored) {
        set({ failedSyncItems: JSON.parse(stored) });
      }
    } catch (e) {
      if (__DEV__) console.log('Error loading failed sync items:', e);
    }
  },

  discardFailedSyncItem: async (id: string) => {
    try {
      const user = useAuthStore.getState().user;
      if (!user) return;
      const key = getFailedSyncStorageKey(user.id);
      const updated = get().failedSyncItems.filter((item) => item.id !== id);
      await AsyncStorage.setItem(key, JSON.stringify(updated));
      set({ failedSyncItems: updated });
    } catch (e) {
      if (__DEV__) console.log('Error discarding failed sync item:', e);
    }
  },

  clearAllFailedSyncItems: async () => {
    try {
      const user = useAuthStore.getState().user;
      if (!user) return;
      const key = getFailedSyncStorageKey(user.id);
      await AsyncStorage.removeItem(key);
      set({ failedSyncItems: [] });
    } catch (e) {
      if (__DEV__) console.log('Error clearing failed sync items:', e);
    }
  },

  // P0.8: Retry failed items by re-enqueueing them and triggering sync
  retryFailedSyncItems: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const failed = [...get().failedSyncItems];
    if (failed.length === 0) return;

    await get().clearAllFailedSyncItems();

    for (const item of failed) {
      if (item.type === 'add' && item.expense) {
        await get().savePendingOffline({
          ...(item.expense as Expense),
          retryCount: 0,
          pending: true,
        });
      } else if (item.type === 'update' && item.expense) {
        await savePendingUpdateOffline(user.id, item.id, item.expense);
      } else if (item.type === 'delete') {
        await savePendingDeleteOffline(user.id, item.id);
      }
    }

    await get().syncPendingExpenses();
  },

  loadPendingExpenses: async () => {
    try {
      const user = useAuthStore.getState().user;
      if (!user) return;

      await get().loadFailedSyncItems();

      const stored = await AsyncStorage.getItem(getPendingStorageKey(user.id));
      if (stored) {
        const pendingList: Expense[] = JSON.parse(stored);
        if (pendingList.length > 0) {
          const currentIds = new Set(get().expenses.map((e) => e.id));
          const newItems = pendingList
            .filter((e) => !currentIds.has(e.id))
            .map((e) => ({ ...e, pending: true }));
          if (newItems.length > 0) {
            set((state) => ({ expenses: [...newItems, ...state.expenses] }));
            useDailyBudgetStore.getState().syncWithExpenses(get().expenses);
          }
        }
      }
    } catch (e) {
      if (__DEV__) console.log('Error loading pending offline expenses:', e);
    }
  },

  savePendingOffline: async (expense: Expense) => {
    try {
      const key = getPendingStorageKey(expense.user_id);
      const stored = await AsyncStorage.getItem(key);
      const list: Expense[] = stored ? JSON.parse(stored) : [];
      const idx = list.findIndex((item) => item.id === expense.id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...expense, pending: true };
      } else {
        list.push({ ...expense, pending: true });
      }
      await AsyncStorage.setItem(key, JSON.stringify(list));
    } catch (e) {
      if (__DEV__) console.log('Error saving pending expense to storage:', e);
    }
  },

  syncPendingExpenses: async () => {
    if (isSyncInProgress) return;
    isSyncInProgress = true;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user || useAuthStore.getState().user;
      if (!user) return;

      await syncPendingDeletes(user.id, get, set);
      await syncPendingAdds(user.id, get, set);
      await syncPendingUpdates(user.id, get, set);
      await flushSideQueues(user.id, get);
    } catch (e) {
      if (__DEV__) console.log('Error in syncPendingExpenses:', e);
    } finally {
      isSyncInProgress = false;
    }
  },

  fetchExpenses: (options?: { force?: boolean }) => {
    const user = useAuthStore.getState().user;
    if (!user) return Promise.resolve();
    const force = options?.force === true;

    // OPT-60: one shared "last fetch" clock for every screen (was one per screen).
    markExpensesFetchStarted();

    // OPT-61: join the download that is already running for this user. A forced refresh (pull-to-refresh,
    // midnight) always starts its own, exactly as before; the older one then stops at its next sequence check.
    if (!force && inFlightFetch && inFlightFetch.userId === user.id) {
      return inFlightFetch.promise;
    }

    const promise = (async (): Promise<void> => {
      // Fast-path: pre-load cached expenses immediately so state has data right away
      if (!get().isExpensesLoaded) {
        await preloadCachedExpenses();
      }

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

        // OPT-69: when this session already holds a full download, ask the server whether anything changed since.
        // The version is read AFTER the pending sync above (so our own just-synced writes count as a change) and
        // BEFORE any page is read (so a change during the download can never hide behind an old version).
        // The very first download of a session does not ask (no extra round trip on app start).
        const canProbe = !force && hasFullFetchFor(user.id);
        const versionBeforeDownload = canProbe ? await readExpensesVersion(user.id) : null;
        if (fetchSeq !== activeFetchSeq) return;
        const reusedRows = reusableSnapshotRows(user.id, versionBeforeDownload);

        // FIN-05: Range pagination with per-page timeout guard and retries
        // OPT-66: keyset pages ("rows after the last row I have"), id as the final tie-breaker.
        const BATCH_SIZE = 1000;
        const PAGE_TIMEOUT_MS = 10000;
        const MAX_PAGE_RETRIES = 2;
        let fetchedRows: Expense[] = reusedRows ?? [];
        let from = 0;
        let hasMore = reusedRows === null;
        let cursor: ExpenseKeysetCursor | null = null;
        let keysetBroken = false;

        while (hasMore) {
          if (fetchSeq !== activeFetchSeq) return;

          let pageData: Expense[] | null = null;
          let lastPageError: unknown = null;

          for (let attempt = 0; attempt <= MAX_PAGE_RETRIES; attempt++) {
            if (fetchSeq !== activeFetchSeq) return;
            try {
              let pageBuilder = supabase
                .from('expenses')
                .select('*')
                .eq('user_id', user.id);
              if (cursor) {
                pageBuilder = pageBuilder.or(expenseKeysetFilter(cursor));
              }
              // With a cursor every page starts at 0; without one (first page, or a row the cursor cannot
              // describe) the old offset is used, so no row can ever be skipped.
              const pageStart = cursor ? 0 : from;
              const pageQuery = pageBuilder
                .order('expense_date', { ascending: false })
                .order('created_at', { ascending: false })
                .order('id', { ascending: false })
                .range(pageStart, pageStart + BATCH_SIZE - 1);

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
              if (!keysetBroken) {
                cursor = expenseKeysetCursor(pageData[pageData.length - 1]);
                // A row the cursor cannot describe: keep reading by offset for the rest (the old way).
                if (!cursor) keysetBroken = true;
              }
            }
          } else {
            hasMore = false;
          }
        }

        if (fetchSeq !== activeFetchSeq) return;

        // OPT-69: a complete download becomes the session snapshot, tagged with the version read before it.
        if (reusedRows === null) {
          setExpenseServerSnapshot(
            versionBeforeDownload !== null ? { userId: user.id, version: versionBeforeDownload, rows: fetchedRows } : null
          );
          markFullFetchDone(user.id);
        }

        // P0.5: Read pending deletes, updates, and additions from AsyncStorage in one batch
        let pendingDeletes: string[] = [];
        let pendingUpdates: PendingUpdate[] = [];
        let pendingAdds: Expense[] = [];
        let deletesRaw: string | null = null;
        let updatesRaw: string | null = null;

        try {
          const [delPair, updPair, addPair] = await AsyncStorage.multiGet([
            getPendingDeletesKey(user.id),
            getPendingUpdatesKey(user.id),
            getPendingStorageKey(user.id),
          ]);

          deletesRaw = delPair ? delPair[1] ?? null : null;
          updatesRaw = updPair ? updPair[1] ?? null : null;
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

        // Cache expenses for offline resilience (skip the disk write when it would be identical)
        const cacheStorageKey = getCachedStorageKey(user.id);
        // OPT-64: same server rows + same pending deletes/updates => the very same JSON as the last write. Only
        // skipped while the cache memo still holds that JSON (nothing else has written the cache since).
        const cacheInputsUnchanged =
          lastCacheSource !== null &&
          lastCacheSource.key === cacheStorageKey &&
          lastCacheSource.rows === fetchedRows &&
          lastCacheSource.deletesRaw === deletesRaw &&
          lastCacheSource.updatesRaw === updatesRaw &&
          isExpenseCacheUnchanged(cacheStorageKey, lastCacheSource.json);
        if (!cacheInputsUnchanged) {
          const cacheJson = JSON.stringify(reconciledFetched);
          if (!isExpenseCacheUnchanged(cacheStorageKey, cacheJson)) {
            await AsyncStorage.setItem(cacheStorageKey, cacheJson);
            rememberExpenseCache(cacheStorageKey, cacheJson);
          }
          lastCacheSource = { key: cacheStorageKey, rows: fetchedRows, deletesRaw, updatesRaw, json: cacheJson };
        }
        useDailyBudgetStore.getState().syncWithExpenses(combined);
      } catch (e: unknown) {
        if (fetchSeq !== activeFetchSeq) return;
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
            const combined = [...pending, ...parsed];
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
    })();

    const entry = { userId: user.id, promise };
    inFlightFetch = entry;
    const clearInFlight = () => {
      if (inFlightFetch === entry) inFlightFetch = null;
    };
    promise.then(clearInFlight, clearInFlight);
    return promise;
  },

  addExpense: async (amount, categoryId, note, paymentMode, date, type = 'expense', options) => {
    const user = useAuthStore.getState().user;
    // P0.10: Throw error if no active session
    if (!user) {
      throw new Error('No active user session. Please log in again.');
    }

    // Defense-in-depth: validate categoryId format if provided
    if (categoryId && !isValidUUID(categoryId)) {
      throw new Error(`Invalid category selected (${categoryId}). Please select a valid category.`);
    }

    // P0.4: Generate client-side UUID (no temp_ prefix).
    // Automatic Logging passes its own id so the transaction stays linked to its source message.
    const newId = options?.id && isValidUUID(options.id) ? options.id : Crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const optimisticExpense: Expense = {
      id: newId,
      user_id: user.id,
      amount,
      category_id: categoryId || null,
      note: sanitizeNote(note),
      payment_mode: paymentMode,
      expense_date: date,
      type,
      transaction_class: options?.transactionClass ?? 'normal',
      transfer_rule_id: options?.transferRuleId ?? null,
      split_person: options?.split?.person ?? null,
      split_amount: options?.split?.amount ?? null,
      split_allocations: options?.split?.allocations ?? null,
      recovery_kind: options?.recovery?.kind ?? null,
      recovery_person: options?.recovery?.person ?? null,
      recovery_allocations: options?.recovery?.allocations ?? null,
      created_at: nowIso,
      pending: true,
    };

    // 1. Instant optimistic update so UI shows transaction immediately (0ms)
    set((state) => ({ expenses: [optimisticExpense, ...state.expenses] }));
    useDailyBudgetStore.getState().syncWithExpenses(get().expenses);

    // 2. Check if already known to be offline
    const isOffline = useNetworkStore.getState().isOffline;
    if (isOffline) {
      await get().savePendingOffline(optimisticExpense);
      useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
      return;
    }

    set({ loading: true });
    try {
      const payload = {
        id: newId,
        user_id: user.id,
        amount,
        note: sanitizeNote(note),
        payment_mode: paymentMode,
        expense_date: date,
        type,
        category_id: categoryId || null,
        transaction_class: options?.transactionClass ?? 'normal',
        transfer_rule_id: options?.transferRuleId ?? null,
        ...extraColumnsFor(optimisticExpense),
      };

      // P0.4: upsert with onConflict: 'id', ignoreDuplicates: true
      const { data, error } = await supabase
        .from('expenses')
        .upsert(payload, { onConflict: 'id', ignoreDuplicates: true })
        .select()
        .single();

      if (error) {
        if (isNetworkFailure(error)) {
          useNetworkStore.getState().setOffline(true);
          await get().savePendingOffline(optimisticExpense);
          useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
          return;
        }

        // Real schema/DB validation error: rollback optimistic item
        set((state) => ({ expenses: state.expenses.filter((e) => e.id !== newId) }));
        useDailyBudgetStore.getState().syncWithExpenses(get().expenses);
        throw error;
      }

      // Confirmed by server: clear pending flag
      const confirmed = data || { ...optimisticExpense, pending: false };
      set((state) => ({
        expenses: state.expenses.map((e) => (e.id === newId ? { ...confirmed, pending: false } : e)),
      }));
      useDailyBudgetStore.getState().syncWithExpenses(get().expenses);
    } catch (e: unknown) {
      if (isNetworkFailure(e)) {
        useNetworkStore.getState().setOffline(true);
        await get().savePendingOffline(optimisticExpense);
        useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
        return;
      }
      if (__DEV__) console.error('Error adding expense:', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  updateExpense: async (id, amount, categoryId, note, paymentMode, date, type = 'expense', extras) => {
    const user = useAuthStore.getState().user;
    // P0.10: Throw error if no active session
    if (!user) {
      throw new Error('No active user session. Please log in again.');
    }

    // Defense-in-depth: validate categoryId format if provided
    if (categoryId && !isValidUUID(categoryId)) {
      throw new Error(`Invalid category selected (${categoryId}). Please select a valid category.`);
    }

    const previousExpense = get().expenses.find((e) => e.id === id);
    if (!previousExpense) return;

    let isRolledBack = false;
    const rollbackUpdate = () => {
      if (isRolledBack) return;
      isRolledBack = true;
      set((state) => ({
        expenses: state.expenses.map((e) => (e.id === id ? previousExpense : e)),
      }));
      useDailyBudgetStore.getState().syncWithExpenses(get().expenses);
    };

    const payload: ExpenseUpdatePayload = {
      amount,
      note: sanitizeNote(note),
      payment_mode: paymentMode,
      expense_date: date,
      type,
    };
    if (categoryId !== undefined) {
      payload.category_id = categoryId || null;
    }
    // SPL-001: undefined = leave the split alone, null = remove it, object = set / change it.
    if (extras?.split !== undefined) {
      payload.split_person = extras.split?.person ?? null;
      payload.split_amount = extras.split?.amount ?? null;
      payload.split_allocations = extras.split?.allocations ?? null;
    }

    // 1. Optimistic update in Zustand state. `amount` here is the amount PAID; the middleware turns it into the
    // counted amount (SPL-003), so the paid amount is also kept as gross_amount.
    set((state) => ({
      expenses: state.expenses.map((e) =>
        e.id === id ? { ...e, ...payload, gross_amount: amount } : e
      ),
    }));
    useDailyBudgetStore.getState().syncWithExpenses(get().expenses);

    // 2. If it's a pending offline expense, update it in local pending storage
    if (previousExpense.pending || id.startsWith('temp_')) {
      await updatePendingItemOffline(user.id, id, payload);
      return;
    }

    // 3. If currently offline, queue update for later
    const isOffline = useNetworkStore.getState().isOffline;
    if (isOffline) {
      await savePendingUpdateOffline(user.id, id, payload);
      useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
      return;
    }

    set({ loading: true });
    try {
      const { error } = await supabase
        .from('expenses')
        .update(payload)
        .eq('id', id);

      if (error) {
        if (isNetworkFailure(error)) {
          useNetworkStore.getState().setOffline(true);
          await savePendingUpdateOffline(user.id, id, payload);
          useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
          return;
        }

        rollbackUpdate();
        throw error;
      }
    } catch (e: unknown) {
      if (isNetworkFailure(e)) {
        useNetworkStore.getState().setOffline(true);
        await savePendingUpdateOffline(user.id, id, payload);
        useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
        return;
      }

      rollbackUpdate();
      if (__DEV__) console.error('Error updating expense:', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  deleteExpense: async (id) => {
    const user = useAuthStore.getState().user;
    // P0.10: Throw error if no active session
    if (!user) {
      throw new Error('No active user session. Please log in again.');
    }

    const previousExpense = get().expenses.find((e) => e.id === id);
    const previousIndex = get().expenses.findIndex((e) => e.id === id);
    if (!previousExpense) return;

    // SPL-006: money that came back for this expense must be deleted first, so no money-back row is left pointing at nothing.
    const blocked = deleteBlockReason(id, get().expenses);
    if (blocked) throw new Error(blocked);

    let isRolledBack = false;
    const rollbackDelete = () => {
      if (isRolledBack) return;
      isRolledBack = true;
      set((state) => {
        if (state.expenses.some((e) => e.id === id)) return state;
        const restored = [...state.expenses];
        if (previousIndex >= 0 && previousIndex <= restored.length) {
          restored.splice(previousIndex, 0, previousExpense);
        } else {
          restored.unshift(previousExpense);
        }
        restored.sort((a, b) => {
          const dateCompare = (b.expense_date || '').localeCompare(a.expense_date || '');
          if (dateCompare !== 0) return dateCompare;
          return (b.created_at || '').localeCompare(a.created_at || '');
        });
        return { expenses: restored };
      });
      useDailyBudgetStore.getState().syncWithExpenses(get().expenses);
    };

    // 1. Optimistic local delete
    set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) }));
    useDailyBudgetStore.getState().syncWithExpenses(get().expenses);

    // 2. If it's a pending offline expense, remove it from offline queue
    if (previousExpense.pending || id.startsWith('temp_')) {
      await removePendingItemOffline(user.id, id);
      return;
    }

    // 3. If currently offline, queue deletion
    const isOffline = useNetworkStore.getState().isOffline;
    if (isOffline) {
      await savePendingDeleteOffline(user.id, id);
      useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
      return;
    }

    set({ loading: true });
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) {
        if (isNetworkFailure(error)) {
          useNetworkStore.getState().setOffline(true);
          await savePendingDeleteOffline(user.id, id);
          useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
          return;
        }

        rollbackDelete();
        throw error;
      }
    } catch (e: unknown) {
      if (isNetworkFailure(e)) {
        useNetworkStore.getState().setOffline(true);
        await savePendingDeleteOffline(user.id, id);
        useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
        return;
      }

      rollbackDelete();
      if (__DEV__) console.error('Error deleting expense:', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },
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
