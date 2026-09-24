import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase } from '../config/supabase';
import { useAuthStore, registerStoreResetCallback } from './authStore';
import { useDailyBudgetStore, registerExpenseGetter, registerExpensesLoadedGetter } from './dailyBudgetStore';
import { useNetworkStore, registerSyncCallback } from './networkStore';
import { useCategoryStore, registerCategoryDeleteCallback } from './categoryStore';

export interface Expense {
  id: string;
  user_id: string;
  category_id?: string | null;
  amount: number;
  type?: 'expense' | 'income';
  note?: string;
  payment_mode: 'cash' | 'upi' | 'card';
  expense_date: string; // YYYY-MM-DD
  created_at?: string;
  pending?: boolean;
  retryCount?: number;
  lastRetryAt?: number;
}

export interface FailedSyncItem {
  id: string;
  type: 'add' | 'update' | 'delete';
  expense?: Partial<Expense>;
  errorReason: string;
  failedAt: string;
}

interface ExpenseState {
  expenses: Expense[];
  loading: boolean;
  isExpensesLoaded: boolean;
  transactionType: 'expense' | 'income';
  failedSyncItems: FailedSyncItem[];
  setTransactionType: (type: 'expense' | 'income') => void;
  fetchExpenses: () => Promise<void>;
  loadPendingExpenses: () => Promise<void>;
  loadFailedSyncItems: () => Promise<void>;
  discardFailedSyncItem: (id: string) => Promise<void>;
  clearAllFailedSyncItems: () => Promise<void>;
  retryFailedSyncItems: () => Promise<void>;
  savePendingOffline: (expense: Expense) => Promise<void>;
  syncPendingExpenses: () => Promise<void>;
  addExpense: (
    amount: number,
    categoryId: string | null | undefined,
    note: string,
    paymentMode: 'cash' | 'upi' | 'card',
    date: string,
    type?: 'expense' | 'income'
  ) => Promise<void>;
  updateExpense: (
    id: string,
    amount: number,
    categoryId: string | null | undefined,
    note: string,
    paymentMode: 'cash' | 'upi' | 'card',
    date: string,
    type?: 'expense' | 'income'
  ) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  resetExpenses: () => void;
}

const getPendingStorageKey = (userId: string) => `@arthik_pending_expenses_${userId}`;
const getPendingUpdatesKey = (userId: string) => `@arthik_pending_updates_${userId}`;
const getPendingDeletesKey = (userId: string) => `@arthik_pending_deletes_${userId}`;
const getCachedStorageKey = (userId: string) => `@arthik_cached_expenses_${userId}`;
const getFailedSyncStorageKey = (userId: string) => `@arthik_failed_sync_${userId}`;

const MAX_SYNC_RETRIES = 5;

// Exponential backoff schedule (P0.7)
const getBackoffDelay = (retries: number) => {
  const delays = [2000, 5000, 15000, 30000, 60000];
  return delays[Math.min(retries, delays.length - 1)];
};

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isValidUUID = (id?: string | null): boolean => {
  if (!id) return true;
  return UUID_REGEX.test(id);
};

interface PendingUpdate {
  id: string;
  payload: any;
  retryCount?: number;
  lastRetryAt?: number;
}

interface PendingDelete {
  id: string;
  retryCount?: number;
  lastRetryAt?: number;
}

const saveFailedSyncItem = async (userId: string, item: FailedSyncItem) => {
  try {
    const key = getFailedSyncStorageKey(userId);
    const stored = await AsyncStorage.getItem(key);
    const list: FailedSyncItem[] = stored ? JSON.parse(stored) : [];
    const filtered = list.filter((f) => f.id !== item.id);
    filtered.unshift(item);
    await AsyncStorage.setItem(key, JSON.stringify(filtered));
    useExpenseStore.setState({ failedSyncItems: filtered });
  } catch (e) {
    if (__DEV__) console.log('Error saving failed sync item:', e);
  }
};

const savePendingUpdateOffline = async (userId: string, id: string, payload: any) => {
  try {
    const key = getPendingUpdatesKey(userId);
    const stored = await AsyncStorage.getItem(key);
    const list: PendingUpdate[] = stored ? JSON.parse(stored) : [];
    const idx = list.findIndex((u) => u.id === id);
    if (idx >= 0) {
      list[idx] = { id, payload: { ...list[idx].payload, ...payload } };
    } else {
      list.push({ id, payload });
    }
    await AsyncStorage.setItem(key, JSON.stringify(list));
  } catch (e) {
    if (__DEV__) console.log('Error saving pending update to storage:', e);
  }
};

const savePendingDeleteOffline = async (userId: string, id: string) => {
  try {
    const updateKey = getPendingUpdatesKey(userId);
    const storedUpdates = await AsyncStorage.getItem(updateKey);
    if (storedUpdates) {
      const updates: PendingUpdate[] = JSON.parse(storedUpdates);
      const filtered = updates.filter((u) => u.id !== id);
      await AsyncStorage.setItem(updateKey, JSON.stringify(filtered));
    }

    const key = getPendingDeletesKey(userId);
    const stored = await AsyncStorage.getItem(key);
    const list: (string | PendingDelete)[] = stored ? JSON.parse(stored) : [];
    const exists = list.some((item) => (typeof item === 'string' ? item === id : item.id === id));
    if (!exists) {
      list.push({ id, retryCount: 0, lastRetryAt: 0 });
      await AsyncStorage.setItem(key, JSON.stringify(list));
    }
  } catch (e) {
    if (__DEV__) console.log('Error saving pending delete to storage:', e);
  }
};

const updatePendingItemOffline = async (userId: string, id: string, patch: Partial<Expense>) => {
  try {
    const key = getPendingStorageKey(userId);
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return;
    const list: Expense[] = JSON.parse(stored);
    const updated = list.map((item) => (item.id === id ? { ...item, ...patch } : item));
    await AsyncStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    if (__DEV__) console.log('Error updating pending item offline:', e);
  }
};

const removePendingItemOffline = async (userId: string, id: string) => {
  try {
    const key = getPendingStorageKey(userId);
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return;
    const list: Expense[] = JSON.parse(stored);
    const filtered = list.filter((item) => item.id !== id);
    await AsyncStorage.setItem(key, JSON.stringify(filtered));
  } catch (e) {
    if (__DEV__) console.log('Error removing pending item offline:', e);
  }
};

const sanitizeNote = (n?: string) => {
  if (!n) return '';
  const words = n.trim().split(/\s+/).slice(0, 50).join(' ');
  return words.slice(0, 250);
};

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

      const now = Date.now();

      // 1. Sync pending deletes first
      const deleteKey = getPendingDeletesKey(user.id);
      const storedDeletes = await AsyncStorage.getItem(deleteKey);
      if (storedDeletes) {
        const rawList: any[] = JSON.parse(storedDeletes);
        const deleteList: PendingDelete[] = rawList.map((item) =>
          typeof item === 'string'
            ? { id: item, retryCount: 0, lastRetryAt: 0 }
            : { id: item.id, retryCount: item.retryCount || 0, lastRetryAt: item.lastRetryAt || 0 }
        );

        const syncedDeleteIds = new Set<string>();
        const updatedDeletesMap = new Map<string, PendingDelete>();

        for (const item of deleteList) {
          const retries = item.retryCount || 0;
          // Exponential backoff check (P0.7)
          if (now - (item.lastRetryAt || 0) < getBackoffDelay(retries)) {
            continue;
          }

          try {
            const { error } = await supabase.from('expenses').delete().eq('id', item.id);
            if (error) {
              if (isNetworkFailure(error)) {
                const nextRetries = retries + 1;
                if (nextRetries >= MAX_SYNC_RETRIES) {
                  syncedDeleteIds.add(item.id);
                  await saveFailedSyncItem(user.id, {
                    id: item.id,
                    type: 'delete',
                    errorReason: 'Deletion failed after 5 network attempts',
                    failedAt: new Date().toISOString(),
                  });
                } else {
                  updatedDeletesMap.set(item.id, { id: item.id, retryCount: nextRetries, lastRetryAt: now });
                }
              } else {
                if (__DEV__) console.error(`[sync] Permanent failure deleting expense ${item.id}:`, error);
                syncedDeleteIds.add(item.id);
                await saveFailedSyncItem(user.id, {
                  id: item.id,
                  type: 'delete',
                  errorReason: error.message || 'Database rejected delete',
                  failedAt: new Date().toISOString(),
                });
              }
            } else {
              // Delete succeeded on server
              syncedDeleteIds.add(item.id);
            }
          } catch (e: any) {
            if (isNetworkFailure(e)) {
              const nextRetries = retries + 1;
              if (nextRetries >= MAX_SYNC_RETRIES) {
                syncedDeleteIds.add(item.id);
                await saveFailedSyncItem(user.id, {
                  id: item.id,
                  type: 'delete',
                  errorReason: 'Deletion failed after 5 attempts',
                  failedAt: new Date().toISOString(),
                });
              } else {
                updatedDeletesMap.set(item.id, { id: item.id, retryCount: nextRetries, lastRetryAt: now });
              }
            } else {
              syncedDeleteIds.add(item.id);
              await saveFailedSyncItem(user.id, {
                id: item.id,
                type: 'delete',
                errorReason: e?.message || 'Unexpected delete failure',
                failedAt: new Date().toISOString(),
              });
            }
          }
        }

        // P0.12: Re-read queue before saving so concurrently added items are not lost
        const freshDeletesStored = await AsyncStorage.getItem(deleteKey);
        const freshDeletesRaw: any[] = freshDeletesStored ? JSON.parse(freshDeletesStored) : [];
        const freshDeletesList: PendingDelete[] = freshDeletesRaw.map((item) =>
          typeof item === 'string'
            ? { id: item, retryCount: 0, lastRetryAt: 0 }
            : { id: item.id, retryCount: item.retryCount || 0, lastRetryAt: item.lastRetryAt || 0 }
        );

        const finalDeletes = freshDeletesList
          .filter((d) => !syncedDeleteIds.has(d.id))
          .map((d) => updatedDeletesMap.get(d.id) || d);

        await AsyncStorage.setItem(deleteKey, JSON.stringify(finalDeletes));
      }

      // 2. Sync pending additions (P0.4 UUID client-generated + upsert)
      const addKey = getPendingStorageKey(user.id);
      const storedAdds = await AsyncStorage.getItem(addKey);
      if (storedAdds) {
        const pendingList: Expense[] = JSON.parse(storedAdds);
        const syncedAddIds = new Set<string>();
        const updatedAddsMap = new Map<string, Expense>();

        for (const item of pendingList) {
          const retries = item.retryCount || 0;
          if (now - (item.lastRetryAt || 0) < getBackoffDelay(retries)) {
            continue;
          }

          // Check for invalid fake category IDs (e.g. '1' through '7') sitting in legacy queues
          if (item.category_id && !isValidUUID(item.category_id)) {
            if (__DEV__) console.warn(`[sync] Purging pending expense with invalid fake category_id: ${item.category_id}`);
            syncedAddIds.add(item.id);
            set((state) => ({ expenses: state.expenses.filter((e) => e.id !== item.id) }));
            await saveFailedSyncItem(user.id, {
              id: item.id,
              type: 'add',
              expense: item,
              errorReason: 'Invalid category format (legacy placeholder category)',
              failedAt: new Date().toISOString(),
            });
            continue;
          }

          try {
            const payload: any = {
              id: item.id,
              user_id: user.id,
              amount: item.amount,
              note: item.note,
              payment_mode: item.payment_mode,
              expense_date: item.expense_date,
              type: item.type,
              category_id: item.category_id || null,
            };

            // P0.4: upsert with onConflict: 'id', ignoreDuplicates: true
            const { data, error } = await supabase
              .from('expenses')
              .upsert(payload, { onConflict: 'id', ignoreDuplicates: true })
              .select()
              .single();

            if (error) {
              if (isNetworkFailure(error)) {
                const nextRetries = retries + 1;
                if (nextRetries >= MAX_SYNC_RETRIES) {
                  syncedAddIds.add(item.id);
                  set((state) => ({ expenses: state.expenses.filter((e) => e.id !== item.id) }));
                  await saveFailedSyncItem(user.id, {
                    id: item.id,
                    type: 'add',
                    expense: item,
                    errorReason: 'Sync failed after 5 network attempts',
                    failedAt: new Date().toISOString(),
                  });
                } else {
                  updatedAddsMap.set(item.id, { ...item, retryCount: nextRetries, lastRetryAt: now });
                }
              } else {
                if (__DEV__) console.error(`[sync] Permanent failure saving expense ${item.id}:`, error);
                syncedAddIds.add(item.id);
                set((state) => ({ expenses: state.expenses.filter((e) => e.id !== item.id) }));
                await saveFailedSyncItem(user.id, {
                  id: item.id,
                  type: 'add',
                  expense: item,
                  errorReason: error.message || 'Database rejected transaction',
                  failedAt: new Date().toISOString(),
                });
              }
            } else {
              // Successfully upserted
              syncedAddIds.add(item.id);
              const confirmedRecord = data || { ...item, pending: false };
              set((state) => ({
                expenses: state.expenses.map((e) => (e.id === item.id ? { ...confirmedRecord, pending: false } : e)),
              }));
            }
          } catch (e: any) {
            if (isNetworkFailure(e)) {
              const nextRetries = retries + 1;
              if (nextRetries >= MAX_SYNC_RETRIES) {
                syncedAddIds.add(item.id);
                set((state) => ({ expenses: state.expenses.filter((e) => e.id !== item.id) }));
                await saveFailedSyncItem(user.id, {
                  id: item.id,
                  type: 'add',
                  expense: item,
                  errorReason: 'Sync failed after 5 network attempts',
                  failedAt: new Date().toISOString(),
                });
              } else {
                updatedAddsMap.set(item.id, { ...item, retryCount: nextRetries, lastRetryAt: now });
              }
            } else {
              syncedAddIds.add(item.id);
              set((state) => ({ expenses: state.expenses.filter((e) => e.id !== item.id) }));
              await saveFailedSyncItem(user.id, {
                id: item.id,
                type: 'add',
                expense: item,
                errorReason: e?.message || 'Unexpected sync failure',
                failedAt: new Date().toISOString(),
              });
            }
          }
        }

        // P0.12: Concurrency-safe queue update
        const freshAddsStored = await AsyncStorage.getItem(addKey);
        const freshAddsList: Expense[] = freshAddsStored ? JSON.parse(freshAddsStored) : [];
        const finalAdds = freshAddsList
          .filter((e) => !syncedAddIds.has(e.id))
          .map((e) => updatedAddsMap.get(e.id) || e);

        await AsyncStorage.setItem(addKey, JSON.stringify(finalAdds));
      }

      // 3. Sync pending updates
      const updateKey = getPendingUpdatesKey(user.id);
      const storedUpdates = await AsyncStorage.getItem(updateKey);
      if (storedUpdates) {
        const updateList: PendingUpdate[] = JSON.parse(storedUpdates);
        const syncedUpdateIds = new Set<string>();
        const updatedUpdatesMap = new Map<string, PendingUpdate>();

        for (const upd of updateList) {
          const retries = upd.retryCount || 0;
          if (now - (upd.lastRetryAt || 0) < getBackoffDelay(retries)) {
            continue;
          }

          if (upd.payload?.category_id && !isValidUUID(upd.payload.category_id)) {
            if (__DEV__) console.warn(`[sync] Dropping pending update with invalid category_id: ${upd.payload.category_id}`);
            syncedUpdateIds.add(upd.id);
            await saveFailedSyncItem(user.id, {
              id: upd.id,
              type: 'update',
              errorReason: 'Invalid category identifier format',
              failedAt: new Date().toISOString(),
            });
            continue;
          }

          try {
            const { error } = await supabase
              .from('expenses')
              .update(upd.payload)
              .eq('id', upd.id);

            if (error) {
              if (isNetworkFailure(error)) {
                const nextRetries = retries + 1;
                if (nextRetries >= MAX_SYNC_RETRIES) {
                  syncedUpdateIds.add(upd.id);
                  await saveFailedSyncItem(user.id, {
                    id: upd.id,
                    type: 'update',
                    errorReason: 'Update sync failed after 5 network attempts',
                    failedAt: new Date().toISOString(),
                  });
                } else {
                  updatedUpdatesMap.set(upd.id, { ...upd, retryCount: nextRetries, lastRetryAt: now });
                }
              } else {
                if (__DEV__) console.error(`[sync] Permanent failure updating expense ${upd.id}:`, error);
                syncedUpdateIds.add(upd.id);
                await saveFailedSyncItem(user.id, {
                  id: upd.id,
                  type: 'update',
                  errorReason: error.message || 'Database rejected update',
                  failedAt: new Date().toISOString(),
                });
              }
            } else {
              syncedUpdateIds.add(upd.id);
            }
          } catch (e: any) {
            if (isNetworkFailure(e)) {
              const nextRetries = retries + 1;
              if (nextRetries >= MAX_SYNC_RETRIES) {
                syncedUpdateIds.add(upd.id);
                await saveFailedSyncItem(user.id, {
                  id: upd.id,
                  type: 'update',
                  errorReason: 'Update sync failed after 5 attempts',
                  failedAt: new Date().toISOString(),
                });
              } else {
                updatedUpdatesMap.set(upd.id, { ...upd, retryCount: nextRetries, lastRetryAt: now });
              }
            } else {
              syncedUpdateIds.add(upd.id);
              await saveFailedSyncItem(user.id, {
                id: upd.id,
                type: 'update',
                errorReason: e?.message || 'Unexpected update sync failure',
                failedAt: new Date().toISOString(),
              });
            }
          }
        }

        // P0.12: Concurrency-safe queue update
        const freshUpdatesStored = await AsyncStorage.getItem(updateKey);
        const freshUpdatesList: PendingUpdate[] = freshUpdatesStored ? JSON.parse(freshUpdatesStored) : [];
        const finalUpdates = freshUpdatesList
          .filter((u) => !syncedUpdateIds.has(u.id))
          .map((u) => updatedUpdatesMap.get(u.id) || u);

        await AsyncStorage.setItem(updateKey, JSON.stringify(finalUpdates));
      }

      // 4. Flush pending budget settings (P0.13)
      try {
        const settingsKey = `@arthik_pending_settings_${user.id}`;
        const storedSettings = await AsyncStorage.getItem(settingsKey);
        if (storedSettings) {
          const patch = JSON.parse(storedSettings);
          if (patch.daily_budget !== undefined || patch.is_auto_renew !== undefined) {
            const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
            if (!error) {
              await AsyncStorage.removeItem(settingsKey);
            }
          }
        }
      } catch (settingsErr) {
        if (__DEV__) console.log('Error syncing pending settings:', settingsErr);
      }

      // 5. Upload pending daily savings records (P0.14)
      await useDailyBudgetStore.getState().uploadPendingDailyRecords();

      // 6. Sync pending gullak deposits
      await useDailyBudgetStore.getState().syncPendingGullakDeposits().catch((e) => {
        if (__DEV__) console.log('[sync] Error syncing gullak deposits:', e);
      });

      // 7. Sync pending category mutations
      await useCategoryStore.getState().syncPendingCategories().catch((e) => {
        if (__DEV__) console.log('[sync] Error syncing categories:', e);
      });

      // 8. Flush pending profile patch (name / avatar; budget settings already handled in step 4)
      try {
        const profileKey = `@arthik_pending_profile_${user.id}`;
        const storedPatch = await AsyncStorage.getItem(profileKey);
        if (storedPatch) {
          const { error } = await supabase.from('profiles').update(JSON.parse(storedPatch)).eq('id', user.id);
          if (!error) await AsyncStorage.removeItem(profileKey);
        }
      } catch (profileErr) {
        if (__DEV__) console.log('[sync] Error syncing profile:', profileErr);
      }

      // Cache updated confirmed expenses for offline resiliency
      const confirmedExpenses = get().expenses.filter((e) => !e.pending && !e.id.startsWith('temp_'));
      await AsyncStorage.setItem(getCachedStorageKey(user.id), JSON.stringify(confirmedExpenses));
      useDailyBudgetStore.getState().syncWithExpenses(get().expenses);
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
          const parsed = JSON.parse(delStored);
          pendingDeletes = parsed.map((item: any) => (typeof item === 'string' ? item : item.id));
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
      const updateMap = new Map<string, any>(pendingUpdates.map((u) => [u.id, u.payload]));

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
    } catch (e: any) {
      if (__DEV__) console.error('Error fetching expenses:', e);
      if (isNetworkFailure(e)) {
        useNetworkStore.getState().setOffline(true);
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

  addExpense: async (amount, categoryId, note, paymentMode, date, type = 'expense') => {
    const user = useAuthStore.getState().user;
    // P0.10: Throw error if no active session
    if (!user) {
      throw new Error('No active user session. Please log in again.');
    }

    // Defense-in-depth: validate categoryId format if provided
    if (categoryId && !isValidUUID(categoryId)) {
      throw new Error(`Invalid category selected (${categoryId}). Please select a valid category.`);
    }

    // P0.4: Generate client-side UUID (no temp_ prefix)
    const newId = Crypto.randomUUID();
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
      const payload: any = {
        id: newId,
        user_id: user.id,
        amount,
        note: sanitizeNote(note),
        payment_mode: paymentMode,
        expense_date: date,
        type,
        category_id: categoryId || null,
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
    } catch (e: any) {
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

    const payload: any = {
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
    } catch (e: any) {
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
    } catch (e: any) {
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
