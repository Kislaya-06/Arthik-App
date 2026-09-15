import { create } from 'zustand';
import { supabase } from '../config/supabase';
import { useAuthStore, registerStoreResetCallback } from './authStore';
import { useDailyBudgetStore } from './dailyBudgetStore';

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

const sanitizeNote = (n?: string) => {
  if (!n) return '';
  const words = n.trim().split(/\s+/).slice(0, 50).join(' ');
  return words.slice(0, 250);
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
      // Preserve any pending optimistic items that are still in-flight
      const pending = get().expenses.filter(e => e.id.startsWith('temp_'));
      set({ expenses: [...pending, ...(data || [])] });
    } catch (e) {
      console.error('Error fetching expenses:', e);
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
    set(state => ({ expenses: [optimisticExpense, ...state.expenses] }));
    useDailyBudgetStore.getState().syncWithExpenses(get().expenses);

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
        // Rollback optimistic item if insert failed
        set(state => ({ expenses: state.expenses.filter(e => e.id !== tempId) }));
        useDailyBudgetStore.getState().syncWithExpenses(get().expenses);
        throw error;
      }

      // Replace optimistic temp item with confirmed server record
      set(state => ({
        expenses: state.expenses.map(e => (e.id === tempId ? data : e)),
      }));
      useDailyBudgetStore.getState().syncWithExpenses(get().expenses);
    } catch (e) {
      console.error('Error adding expense:', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  updateExpense: async (id, amount, categoryId, note, paymentMode, date, type = 'expense') => {
    set({ loading: true });
    try {
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

      const { error } = await supabase
        .from('expenses')
        .update(payload)
        .eq('id', id);

      if (error) throw error;
      // Patch only the changed expense — no re-fetch needed
      set(state => ({
        expenses: state.expenses.map(e =>
          e.id === id
            ? { ...e, ...payload }
            : e
        ),
      }));
      useDailyBudgetStore.getState().syncWithExpenses(get().expenses);
    } catch (e) {
      console.error('Error updating expense:', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  deleteExpense: async (id) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      // Remove the deleted expense locally — no re-fetch needed
      set(state => ({ expenses: state.expenses.filter(e => e.id !== id) }));
      useDailyBudgetStore.getState().syncWithExpenses(get().expenses);
    } catch (e) {
      console.error('Error deleting expense:', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },
}));

registerStoreResetCallback(() => {
  useExpenseStore.getState().resetExpenses();
});
