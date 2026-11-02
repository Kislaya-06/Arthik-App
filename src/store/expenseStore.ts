import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
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
  enqueuePendingDelete,
  removePendingDelete,
  readPendingUpdate,
  settlePendingUpdate,
  removePendingAddIfUnchanged,
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
  syncPendingDeletes,
  syncPendingAdds,
  syncPendingUpdates,
  flushSideQueues,
} from './expense/syncPending';

let isSyncInProgress = false;
let activeFetchSeq = 0;

/**
 * OPT-63: true once the expense list was loaded from the server in this app session (not from the cache).
 * Reset on sign-out. Read by hydration through `areExpensesFreshFromServer()`.
 */
let expensesFreshFromServer = false;

/**
 * OPT-60/62: how long a save (add / edit / delete) waits for the server before it stops waiting.
 * The change is already in the offline queue (written ahead), so after this it simply stays
 * "sync pending" and is sent by the normal sync. The request itself keeps running; its late answer
 * is still used (see `inFlightAdds`).
 */
export const SAVE_TIMEOUT_MS = 10_000;
const SAVE_TIMED_OUT = { timedOut: true } as const;
const isTimedOut = (value: unknown): value is typeof SAVE_TIMED_OUT => value === SAVE_TIMED_OUT;

/**
 * Adds whose request timed out but has not answered yet. If the user edits or deletes such an expense
 * meanwhile, the edit / delete is also queued for the server, and re-queued when the late answer
 * arrives, so nothing the user did can be lost to the late insert.
 */
const inFlightAdds = new Map<string, { lastUpdate?: ExpenseUpdatePayload; deleted?: boolean }>();

/**
 * OPT-62: keep the on-phone copy of confirmed expenses in step after a confirmed save, so an offline
 * cold start right after shows it. Same content and format the sync already writes (`flushSideQueues`):
 * every non-pending expense in the current list. Runs in the background, one write at a time.
 */
const persistConfirmedCache = (userId: string, getExpenses: () => Expense[]): Promise<void> => {
  const key = getCachedStorageKey(userId);
  return runExclusive(key, async () => {
    try {
      if (useAuthStore.getState().user?.id !== userId) return; // signed out meanwhile
      // Never replace a fuller copy with a partial list (the list has not been loaded from cache/server yet).
      if (!useExpenseStore.getState().isExpensesLoaded) return;
      const confirmed = getExpenses().filter((e) => !e.pending && !e.id.startsWith('temp_'));
      const json = JSON.stringify(confirmed);
      if (isExpenseCacheUnchanged(key, json)) return;
      await AsyncStorage.setItem(key, json);
      rememberExpenseCache(key, json);
    } catch (e) {
      if (__DEV__) console.log('Error updating confirmed expense cache:', e);
    }
  });
};

/** Cached rows minus any id that is already in the in-memory pending list (never show one expense twice). */
const withoutPendingDuplicates = (cached: Expense[], pending: Expense[]): Expense[] => {
  if (pending.length === 0) return cached;
  const pendingIds = new Set(pending.map((e) => e.id));
  return cached.some((e) => pendingIds.has(e.id)) ? cached.filter((e) => !pendingIds.has(e.id)) : cached;
};

// P0.7: Exact network failure identification
import { isNetworkFailure, withTimeout } from '../lib/networkUtils';
import { runExclusive } from '../lib/queueLock';
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
    inFlightAdds.clear();
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
    const key = getPendingStorageKey(expense.user_id);
    await runExclusive(key, async () => {
      try {
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
    });
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

  fetchExpenses: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    // Fast-path: pre-load cached expenses immediately so state has data right away
    const cacheKey = getCachedStorageKey(user.id);
    if (!get().isExpensesLoaded) {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached !== null) {
          const parsed: Expense[] = JSON.parse(cached);
          const pending = get().expenses.filter((e) => e.pending || e.id.startsWith('temp_'));
          const combined = [...pending, ...withoutPendingDuplicates(parsed, pending)];
          set({ expenses: combined, isExpensesLoaded: true });
          useDailyBudgetStore.getState().syncWithExpenses(combined);
        }
      } catch (cacheErr) {
        if (__DEV__) console.log('Error reading cached expenses on launch:', cacheErr);
      }
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

    // 3. OPT-60 write-ahead: put it in the offline queue BEFORE talking to the server, so it can never be lost
    // (app killed mid-request, phone switched off, request hanging). Removed again once the server confirms.
    // Sending it twice is harmless: same id + upsert with ignoreDuplicates.
    await get().savePendingOffline(optimisticExpense);

    // Server confirmed: same state update as before, then clear the queue entry and refresh the offline copy.
    const applyConfirmed = async (data: Expense | null): Promise<void> => {
      const confirmed = data || { ...optimisticExpense, pending: false };
      set((state) => ({
        expenses: state.expenses.map((e) => (e.id === newId ? { ...confirmed, pending: false } : e)),
      }));
      useDailyBudgetStore.getState().syncWithExpenses(get().expenses);
      // Queue entry first, then the offline copy (this order means one expense can never be in both).
      await removePendingAddIfUnchanged(user.id, optimisticExpense);
      persistConfirmedCache(user.id, () => get().expenses).catch(() => {});
    };

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

      // P0.4: upsert with onConflict: 'id', ignoreDuplicates: true.
      // OPT-62: maybeSingle → a row that is already on the server comes back as data = null (success), not as an error.
      // Promise.resolve runs the request exactly once (a Supabase query re-sends itself on every `.then`).
      const request = Promise.resolve(
        supabase
          .from('expenses')
          .upsert(payload, { onConflict: 'id', ignoreDuplicates: true })
          .select()
          .maybeSingle()
      );
      const outcome = await withTimeout(request, SAVE_TIMEOUT_MS, SAVE_TIMED_OUT);

      if (isTimedOut(outcome)) {
        // OPT-60: stop waiting. It is already queued and shows as "sync pending"; no offline banner, no offline mode.
        inFlightAdds.set(newId, {});
        request.then(
          (late) => {
            const tracked = inFlightAdds.get(newId);
            inFlightAdds.delete(newId);
            if (late.error) return; // still queued; the normal sync retries it
            const stillPending = get().expenses.some((e) => e.id === newId && e.pending);
            if (stillPending && !tracked?.lastUpdate && !tracked?.deleted) {
              applyConfirmed(late.data as Expense | null).catch(() => {});
              return;
            }
            // The user edited or deleted it while we waited: make sure that reaches the server after this insert.
            if (tracked?.deleted) enqueuePendingDelete(user.id, newId).catch(() => {});
            else if (tracked?.lastUpdate) savePendingUpdateOffline(user.id, newId, tracked.lastUpdate).catch(() => {});
          },
          () => {
            inFlightAdds.delete(newId);
          }
        );
        return;
      }

      const { data, error } = outcome;

      if (error) {
        if (isNetworkFailure(error)) {
          useNetworkStore.getState().setOffline(true);
          await get().savePendingOffline(optimisticExpense);
          useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
          return;
        }

        // Real schema/DB validation error: take it out of the queue again, then rollback optimistic item
        await removePendingItemOffline(user.id, newId);
        set((state) => ({ expenses: state.expenses.filter((e) => e.id !== newId) }));
        useDailyBudgetStore.getState().syncWithExpenses(get().expenses);
        throw error;
      }

      // Confirmed by server: clear pending flag
      await applyConfirmed(data as Expense | null);
    } catch (e: unknown) {
      if (isNetworkFailure(e)) {
        useNetworkStore.getState().setOffline(true);
        await get().savePendingOffline(optimisticExpense);
        useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
        return;
      }
      // Anything else: the transaction stays queued (written ahead) and the normal sync retries it.
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
      // OPT-60: its first save timed out and may still land on the server; queue the edit for the server too.
      const tracked = inFlightAdds.get(id);
      if (tracked) {
        tracked.lastUpdate = { ...(tracked.lastUpdate || {}), ...payload };
        await savePendingUpdateOffline(user.id, id, payload);
      }
      return;
    }

    // 3. If currently offline, queue update for later
    const isOffline = useNetworkStore.getState().isOffline;
    if (isOffline) {
      await savePendingUpdateOffline(user.id, id, payload);
      useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
      return;
    }

    // 4. OPT-60 write-ahead: queue the edit BEFORE the request. If an older queued edit exists, the queue now
    // holds both merged (newest values win), exactly like an offline edit; it is then sent by the normal sync.
    const queuedBefore = await readPendingUpdate(user.id, id);
    await savePendingUpdateOffline(user.id, id, payload);
    const queuedNow: ExpenseUpdatePayload = queuedBefore ? { ...queuedBefore.payload, ...payload } : payload;

    set({ loading: true });
    try {
      // Promise.resolve runs the request exactly once.
      const request = Promise.resolve(
        supabase
          .from('expenses')
          .update(payload)
          .eq('id', id)
      );
      const outcome = await withTimeout(request, SAVE_TIMEOUT_MS, SAVE_TIMED_OUT);

      if (isTimedOut(outcome)) {
        // Stop waiting: the edit is queued and will be sent by the normal sync. A late success clears it.
        request.then(
          (late) => {
            if (!late.error && !queuedBefore) settlePendingUpdate(user.id, id, queuedNow, null).catch(() => {});
          },
          () => {}
        );
        return;
      }

      const { error } = outcome;

      if (error) {
        if (isNetworkFailure(error)) {
          useNetworkStore.getState().setOffline(true);
          await savePendingUpdateOffline(user.id, id, payload);
          useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
          return;
        }

        // Refused by the database: put the queue back exactly as it was before this edit, then rollback.
        await settlePendingUpdate(user.id, id, queuedNow, queuedBefore);
        rollbackUpdate();
        throw error;
      }

      // Confirmed. With no older queued edit, the queue entry is done. With one, the merged entry stays and is
      // sent by the normal sync (it carries the older fields that still have to reach the server).
      if (!queuedBefore) await settlePendingUpdate(user.id, id, queuedNow, null);
      persistConfirmedCache(user.id, () => get().expenses).catch(() => {});
    } catch (e: unknown) {
      if (isNetworkFailure(e)) {
        useNetworkStore.getState().setOffline(true);
        await savePendingUpdateOffline(user.id, id, payload);
        useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
        return;
      }

      // Not a server answer (it threw): undo the write-ahead and rollback, exactly as before.
      if (!isRolledBack) await settlePendingUpdate(user.id, id, queuedNow, queuedBefore);
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
      // OPT-60: its first save timed out and may still land on the server; delete it there too.
      const tracked = inFlightAdds.get(id);
      if (tracked) {
        tracked.deleted = true;
        await enqueuePendingDelete(user.id, id);
      }
      return;
    }

    // 3. If currently offline, queue deletion
    const isOffline = useNetworkStore.getState().isOffline;
    if (isOffline) {
      await savePendingDeleteOffline(user.id, id);
      useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
      return;
    }

    // 4. OPT-60 write-ahead: queue the delete BEFORE the request (delete queue only; queued edits are left as they
    // are, like before). `queuedHere` = this call added it, so this call may take it out again.
    const queuedHere = await enqueuePendingDelete(user.id, id);

    set({ loading: true });
    try {
      // Promise.resolve runs the request exactly once.
      const request = Promise.resolve(
        supabase
          .from('expenses')
          .delete()
          .eq('id', id)
      );
      const outcome = await withTimeout(request, SAVE_TIMEOUT_MS, SAVE_TIMED_OUT);

      if (isTimedOut(outcome)) {
        // Stop waiting: the delete is queued and will be sent by the normal sync. A late success clears it.
        request.then(
          (late) => {
            if (!late.error && queuedHere) removePendingDelete(user.id, id).catch(() => {});
          },
          () => {}
        );
        return;
      }

      const { error } = outcome;

      if (error) {
        if (isNetworkFailure(error)) {
          useNetworkStore.getState().setOffline(true);
          await savePendingDeleteOffline(user.id, id);
          useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
          return;
        }

        // Refused by the database: take the write-ahead out again, then rollback (as before).
        if (queuedHere) await removePendingDelete(user.id, id);
        rollbackDelete();
        throw error;
      }

      // Confirmed by the server.
      if (queuedHere) await removePendingDelete(user.id, id);
      persistConfirmedCache(user.id, () => get().expenses).catch(() => {});
    } catch (e: unknown) {
      if (isNetworkFailure(e)) {
        useNetworkStore.getState().setOffline(true);
        await savePendingDeleteOffline(user.id, id);
        useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
        return;
      }

      if (!isRolledBack && queuedHere) await removePendingDelete(user.id, id);
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
