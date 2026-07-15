import { create } from 'zustand';
import { supabase } from '../config/supabase';
import { useAuthStore } from './authStore';

export interface Expense {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  note?: string;
  payment_mode: 'cash' | 'upi' | 'card';
  expense_date: string; // YYYY-MM-DD
  created_at?: string;
}

interface ExpenseState {
  expenses: Expense[];
  loading: boolean;
  fetchExpenses: () => Promise<void>;
  addExpense: (amount: number, categoryId: string, note: string, paymentMode: 'cash' | 'upi' | 'card', date: string) => Promise<void>;
  updateExpense: (id: string, amount: number, categoryId: string, note: string, paymentMode: 'cash' | 'upi' | 'card', date: string) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
}

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  expenses: [],
  loading: false,

  fetchExpenses: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ loading: true });



    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      set({ expenses: data || [] });
    } catch (e) {
      console.error('Error fetching expenses:', e);
    } finally {
      set({ loading: false });
    }
  },

  addExpense: async (amount, categoryId, note, paymentMode, date) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ loading: true });

    const newExpense = {
      id: undefined,
      user_id: user.id,
      category_id: categoryId,
      amount,
      note,
      payment_mode: paymentMode,
      expense_date: date,
    };



    try {
      const { error } = await supabase
        .from('expenses')
        .insert(newExpense);

      if (error) throw error;
      await get().fetchExpenses();
    } catch (e) {
      console.error('Error adding expense:', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  updateExpense: async (id, amount, categoryId, note, paymentMode, date) => {
    set({ loading: true });



    try {
      const { error } = await supabase
        .from('expenses')
        .update({ amount, category_id: categoryId, note, payment_mode: paymentMode, expense_date: date })
        .eq('id', id);

      if (error) throw error;
      await get().fetchExpenses();
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
      await get().fetchExpenses();
    } catch (e) {
      console.error('Error deleting expense:', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },
}));
