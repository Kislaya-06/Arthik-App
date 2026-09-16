import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { useAuthStore, registerStoreResetCallback } from './authStore';
import { useDailyBudgetStore } from './dailyBudgetStore';
import { useNetworkStore, registerSyncCallback } from './networkStore';

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
}

interface ExpenseState {
  expenses: Expense[];
  loading: boolean;
  transactionType: 'expense' | 'income';
  setTransactionType: (type: 'expense' | 'income') => void;
  fetchExpenses: () => Promise<void>;
  loadPendingExpenses: () => Promise<void>;
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

interface PendingUpdate {
  id: string;
  payload: any;
}

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
    console.log('Error saving pending update to storage:', e);
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
    const list: string[] = stored ? JSON.parse(stored) : [];
    if (!list.includes(id)) {
      list.push(id);
      await AsyncStorage.setItem(key, JSON.stringify(list));
    }
  } catch (e) {
    console.log('Error saving pending delete to storage:', e);
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
    console.log('Error updating pending item offline:', e);
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
    console.log('Error removing pending item offline:', e);
  }
};

const sanitizeNote = (n?: string) => {
  if (!n) return '';
  const words = n.trim().split(/\s+/).slice(0, 50).join(' ');
  return words.slice(0, 250);
};

let isSyncInProgress = false;

const isNetworkFailure = (error: any) => {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  const details = (error.details || '').toLowerCase();
  return (
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    details.includes('network') ||
    error.name === 'TypeError'
  );
};

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  expenses: [],
  loading: false,
  transactionType: 'expense',

  setTransactionType: (transactionType: 'expense' | 'income') => {
    set({ transactionType });
  },

  resetExpenses: () => {
    set({ expenses: [], loading: false, transactionType: 'expense' });
  },

  loadPendingExpenses: async () => {
    try {
      const user = useAuthStore.getState().user;
      if (!user) return;

      const stored = await AsyncStorage.getItem(getPendingStorageKey(user.id));
      if (stored) {
        const pendingList: Expense[] = JSON.parse(stored);
        if (pendingList.length > 0) {
          const currentIds = new Set(get().expenses.map((e) => e.id));
          const newItems = pendingList.filter((e) => !currentIds.has(e.id));
          if (newItems.length > 0) {
            set((state) => ({ expenses: [...newItems, ...state.expenses] }));
            useDailyBudgetStore.getState().syncWithExpenses(get().expenses);
          }
        }
      }
    } catch (e) {
      console.log('Error loading pending offline expenses:', e);
    }
  },

  savePendingOffline: async (expense: Expense) => {
    try {
      const key = getPendingStorageKey(expense.user_id);
      const stored = await AsyncStorage.getItem(key);
      const list: Expense[] = stored ? JSON.parse(stored) : [];
      // Prevent duplicates
      if (!list.some((item) => item.id === expense.id)) {
        list.push(expense);
        await AsyncStorage.setItem(key, JSON.stringify(list));
      }
    } catch (e) {
      console.log('Error saving pending expense to storage:', e);
    }
  },

  syncPendingExpenses: async () => {
    if (isSyncInProgress) return;
    isSyncInProgress = true;
    try {
      // Ensure fresh active session before triggering batch network sync
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user || useAuthStore.getState().user;
      if (!user) return;

      // 1. Sync pending deletes first
      const deleteKey = getPendingDeletesKey(user.id);
      const storedDeletes = await AsyncStorage.getItem(deleteKey);
      if (storedDeletes) {
        const deleteList: string[] = JSON.parse(storedDeletes);
        const remainingDeletes: string[] = [];
        for (const delId of deleteList) {
          try {
            const { error } = await supabase.from('expenses').delete().eq('id', delId);
            if (error) remainingDeletes.push(delId);
          } catch {
            remainingDeletes.push(delId);
          }
        }
        await AsyncStorage.setItem(deleteKey, JSON.stringify(remainingDeletes));
      }

      // 2. Sync pending additions
      const addKey = getPendingStorageKey(user.id);
      const storedAdds = await AsyncStorage.getItem(addKey);
      if (storedAdds) {
        const pendingList: Expense[] = JSON.parse(storedAdds);
        const remainingPending: Expense[] = [];

        for (const item of pendingList) {
          try {
            const payload: any = {
              user_id: user.id,
              amount: item.amount,
              note: item.note,
              payment_mode: item.payment_mode,
              expense_date: item.expense_date,
              type: item.type,
              category_id: item.category_id || null,
            };

            const { data, error } = await supabase
              .from('expenses')
              .insert(payload)
              .select()
              .single();

            if (error) {
              remainingPending.push(item);
            } else if (data) {
              // Replace the temp ID in state with the confirmed server record
              set((state) => ({
                expenses: state.expenses.map((e) => (e.id === item.id ? data : e)),
              }));
            }
          } catch {
            remainingPending.push(item);
          }
        }

        await AsyncStorage.setItem(addKey, JSON.stringify(remainingPending));
      }

      // 3. Sync pending updates
      const updateKey = getPendingUpdatesKey(user.id);
      const storedUpdates = await AsyncStorage.getItem(updateKey);
      if (storedUpdates) {
        const updateList: PendingUpdate[] = JSON.parse(storedUpdates);
        const remainingUpdates: PendingUpdate[] = [];

        for (const upd of updateList) {
          try {
            const { error } = await supabase
              .from('expenses')
              .update(upd.payload)
              .eq('id', upd.id);

            if (error) remainingUpdates.push(upd);
          } catch {
            remainingUpdates.push(upd);
          }
        }

        await AsyncStorage.setItem(updateKey, JSON.stringify(remainingUpdates));
      }

      // Cache updated confirmed expenses for offline resiliency
      const confirmedExpenses = get().expenses.filter((e) => !e.id.startsWith('temp_'));
      await AsyncStorage.setItem(getCachedStorageKey(user.id), JSON.stringify(confirmedExpenses));
      useDailyBudgetStore.getState().syncWithExpenses(get().expenses);
    } catch (e) {
      console.log('Error in syncPendingExpenses:', e);
    } finally {
      isSyncInProgress = false;
    }
  },

  fetchExpenses: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ loading: true });

    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Preserve any pending optimistic items that are still in-flight / offline
      const pending = get().expenses.filter((e) => e.id.startsWith('temp_'));
      const combined = [...pending, ...(data || [])];
      set({ expenses: combined });

      // Cache expenses for offline resilience
      await AsyncStorage.setItem(getCachedStorageKey(user.id), JSON.stringify(data || []));
    } catch (e: any) {
      console.error('Error fetching expenses:', e);
      if (isNetworkFailure(e)) {
        useNetworkStore.getState().setOffline(true);
      }
      // Offline fallback: load cached expenses if available
      try {
        const cached = await AsyncStorage.getItem(getCachedStorageKey(user.id));
        if (cached) {
          const parsed: Expense[] = JSON.parse(cached);
          const pending = get().expenses.filter((e) => e.id.startsWith('temp_'));
          set({ expenses: [...pending, ...parsed] });
        }
      } catch (cacheErr) {
        console.log('Error reading cached expenses:', cacheErr);
      }
    } finally {
      set({ loading: false });
    }
  },

  addExpense: async (amount, categoryId, note, paymentMode, date, type = 'expense') => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();
    const optimisticExpense: Expense = {
      id: tempId,
      user_id: user.id,
      amount,
      category_id: categoryId || null,
      note: sanitizeNote(note),
      payment_mode: paymentMode,
      expense_date: date,
      type,
      created_at: nowIso,
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
        user_id: user.id,
        amount,
        note: sanitizeNote(note),
        payment_mode: paymentMode,
        expense_date: date,
        type,
      };
      if (categoryId) {
        payload.category_id = categoryId;
      } else {
        payload.category_id = null;
      }

      // Use .select().single() so Supabase returns the full server record
      const { data, error } = await supabase
        .from('expenses')
        .insert(payload)
        .select()
        .single();

      if (error) {
        if (isNetworkFailure(error)) {
          // Network issue: keep optimistic item, save offline queue, and show banner
          useNetworkStore.getState().setOffline(true);
          await get().savePendingOffline(optimisticExpense);
          useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
          return;
        }

        // Real schema/DB validation error: rollback optimistic item
        set((state) => ({ expenses: state.expenses.filter((e) => e.id !== tempId) }));
        useDailyBudgetStore.getState().syncWithExpenses(get().expenses);
        throw error;
      }

      // Replace optimistic temp item with confirmed server record
      set((state) => ({
        expenses: state.expenses.map((e) => (e.id === tempId ? data : e)),
      }));
      useDailyBudgetStore.getState().syncWithExpenses(get().expenses);
    } catch (e: any) {
      if (isNetworkFailure(e)) {
        useNetworkStore.getState().setOffline(true);
        await get().savePendingOffline(optimisticExpense);
        useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
        return;
      }
      console.error('Error adding expense:', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  updateExpense: async (id, amount, categoryId, note, paymentMode, date, type = 'expense') => {
    const user = useAuthStore.getState().user;
    if (!user) return;

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

    // 2. If it's a pending offline temp expense, just update it in local pending storage
    if (id.startsWith('temp_')) {
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
        throw error;
      }
    } catch (e: any) {
      if (isNetworkFailure(e)) {
        useNetworkStore.getState().setOffline(true);
        await savePendingUpdateOffline(user.id, id, payload);
        useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
        return;
      }
      console.error('Error updating expense:', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  deleteExpense: async (id) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    // 1. Optimistic local delete
    set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) }));
    useDailyBudgetStore.getState().syncWithExpenses(get().expenses);

    // 2. If it's a pending offline temp expense, remove it from offline queue
    if (id.startsWith('temp_')) {
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
        throw error;
      }
    } catch (e: any) {
      if (isNetworkFailure(e)) {
        useNetworkStore.getState().setOffline(true);
        await savePendingDeleteOffline(user.id, id);
        useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
        return;
      }
      console.error('Error deleting expense:', e);
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
});
