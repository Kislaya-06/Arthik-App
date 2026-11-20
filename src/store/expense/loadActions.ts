import type { StoreApi } from 'zustand';
import { useAuthStore } from '../authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPendingStorageKey, getCachedStorageKey } from './pendingQueues';
import type { Expense } from './types';
import { useDailyBudgetStore } from '../dailyBudgetStore';
import { runExclusive } from '../../lib/queueLock';
import { supabase } from '../../config/supabase';
import { syncPendingTransferRules } from '../transferRulesStore';
import { syncPendingDeletes, syncPendingAdds, syncPendingUpdates, flushSideQueues } from './syncPending';
import { withoutPendingDuplicates } from './saveGuards';
import type { ExpenseState } from './types';

let isSyncInProgress = false;

/**
 * createLoadActions: actions of useExpenseStore moved here verbatim (facade split, AGENTS.md 6.1).
 * They receive the store's own set / get, so they never import the store (no circular import).
 */
export const createLoadActions = (
  set: StoreApi<ExpenseState>['setState'],
  get: StoreApi<ExpenseState>['getState']
): Pick<ExpenseState, 'loadPendingExpenses' | 'savePendingOffline' | 'syncPendingExpenses' | 'loadCachedExpenses'> => ({
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

      // Remembered transfer rules made offline go first: an expense can point to one, and the server rejects a
      // pointer to a rule it does not know yet.
      await syncPendingTransferRules(user.id).catch(() => {});
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

  loadCachedExpenses: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return false;
    if (get().isExpensesLoaded) return true;
    // Fast-path: pre-load cached expenses immediately so state has data right away
    try {
      const cached = await AsyncStorage.getItem(getCachedStorageKey(user.id));
      if (cached !== null) {
        const parsed: Expense[] = JSON.parse(cached);
        const pending = get().expenses.filter((e) => e.pending || e.id.startsWith('temp_'));
        const combined = [...pending, ...withoutPendingDuplicates(parsed, pending)];
        set({ expenses: combined, isExpensesLoaded: true });
        useDailyBudgetStore.getState().syncWithExpenses(combined);
        return true;
      }
    } catch (cacheErr) {
      if (__DEV__) console.log('Error reading cached expenses on launch:', cacheErr);
    }
    return false;
  },
});
