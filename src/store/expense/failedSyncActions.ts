import type { StoreApi } from 'zustand';
import { useAuthStore } from '../authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFailedSyncStorageKey, savePendingUpdateOffline, savePendingDeleteOffline } from './pendingQueues';
import type { Expense } from './types';
import type { ExpenseState } from './types';

/**
 * createFailedSyncActions: actions of useExpenseStore moved here verbatim (facade split, AGENTS.md 6.1).
 * They receive the store's own set / get, so they never import the store (no circular import).
 */
export const createFailedSyncActions = (
  set: StoreApi<ExpenseState>['setState'],
  get: StoreApi<ExpenseState>['getState']
): Pick<ExpenseState, 'loadFailedSyncItems' | 'discardFailedSyncItem' | 'clearAllFailedSyncItems' | 'retryFailedSyncItems'> => ({
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
});
