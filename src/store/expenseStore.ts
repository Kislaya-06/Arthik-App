import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase } from '../config/supabase';
import { useAuthStore, registerStoreResetCallback } from './authStore';
import { useDailyBudgetStore, registerExpenseGetter, registerExpensesLoadedGetter } from './dailyBudgetStore';
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

import {
  syncPendingDeletes,
  syncPendingAdds,
  syncPendingUpdates,
  flushSideQueues,
} from './expense/syncPending';

let isSyncInProgress = false;

// P0.7: Exact network failure identification
export { isNetworkFailure } from '../lib/networkUtils';
import { isNetworkFailure } from '../lib/networkUtils';

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  expenses: [],
  loading: false,
  isExpensesLoaded: false,
  transactionType: 'expense',
  failedSyncItems: [],

  setTransactionType: (transactionType: 'expense' | 'income') => {
    set({ transactionType });
  },

  resetExpenses: () => {
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
          const combined = [...pending, ...parsed];
          set({ expenses: combined, isExpensesLoaded: true });
          useDailyBudgetStore.getState().syncWithExpenses(combined);
        }
      } catch (cacheErr) {
        if (__DEV__) console.log('Error reading cached expenses on launch:', cacheErr);
      }
    }

    // Offline fast-path: if currently offline, return immediately with cached expenses
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

      // P0.6: Range pagination in a loop with timeout guard
      const BATCH_SIZE = 1000;
      let fetchedRows: Expense[] = [];
      let from = 0;
      let hasMore = true;

      const paginationPromise = (async () => {
        while (hasMore) {
          const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .eq('user_id', user.id)
            .order('expense_date', { ascending: false })
            .order('created_at', { ascending: false })
            .range(from, from + BATCH_SIZE - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            fetchedRows = fetchedRows.concat(data);
            if (data.length < BATCH_SIZE) {
              hasMore = false;
            } else {
              from += BATCH_SIZE;
            }
          } else {
            hasMore = false;
          }
        }
      })();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Network request failed: timeout')), 5000)
      );

      await Promise.race([paginationPromise, timeoutPromise]);

      // P0.5: Read pending deletes and updates from AsyncStorage
      let pendingDeletes: string[] = [];
      try {
        const delStored = await AsyncStorage.getItem(getPendingDeletesKey(user.id));
        if (delStored) {
          const parsed: (string | { id: string })[] = JSON.parse(delStored);
          pendingDeletes = parsed.map((item) => (typeof item === 'string' ? item : item.id));
        }
      } catch {}

      let pendingUpdates: PendingUpdate[] = [];
      try {
        const updStored = await AsyncStorage.getItem(getPendingUpdatesKey(user.id));
        if (updStored) pendingUpdates = JSON.parse(updStored);
      } catch {}

      let pendingAdds: Expense[] = [];
      try {
        const addStored = await AsyncStorage.getItem(getPendingStorageKey(user.id));
        if (addStored) pendingAdds = JSON.parse(addStored);
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
      set({ expenses: combined, isExpensesLoaded: true });

      // Cache expenses for offline resilience
      await AsyncStorage.setItem(getCachedStorageKey(user.id), JSON.stringify(reconciledFetched));
      useDailyBudgetStore.getState().syncWithExpenses(combined);
    } catch (e: unknown) {
      const err = e as { message?: string } | null;
      if (isNetworkFailure(e)) {
        if (__DEV__) console.warn('Network unavailable while fetching expenses, falling back to cache:', err?.message || e);
        useNetworkStore.getState().setOffline(true);
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
      set({ loading: false });
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
      reimburses_share_id: options?.reimbursesShareId ?? null,
      transfer_rule_id: options?.transferRuleId ?? null,
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
        reimburses_share_id: options?.reimbursesShareId ?? null,
        transfer_rule_id: options?.transferRuleId ?? null,
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

  updateExpense: async (id, amount, categoryId, note, paymentMode, date, type = 'expense') => {
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

    // 1. Optimistic update in Zustand state
    set((state) => ({
      expenses: state.expenses.map((e) =>
        e.id === id ? { ...e, ...payload } : e
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
}));

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
