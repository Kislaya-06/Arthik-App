import { create } from 'zustand';
import { supabase, isMockMode } from '../config/supabase';
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

// Initial mock data to make the app look stunning out of the box
const MOCK_EXPENSES: Expense[] = [
  { id: 'e1', user_id: 'mock-user-123', category_id: '1', amount: 350.00, note: 'Dinner with friends', payment_mode: 'upi', expense_date: new Date().toISOString().split('T')[0] },
  { id: 'e2', user_id: 'mock-user-123', category_id: '2', amount: 1500.00, note: 'New sneakers', payment_mode: 'card', expense_date: new Date().toISOString().split('T')[0] },
  { id: 'e3', user_id: 'mock-user-123', category_id: '3', amount: 60.00, note: 'Auto rickshaw ride', payment_mode: 'cash', expense_date: new Date(Date.now() - 86400000).toISOString().split('T')[0] }, // Yesterday
  { id: 'e4', user_id: 'mock-user-123', category_id: '4', amount: 850.00, note: 'Electricity bill', payment_mode: 'upi', expense_date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0] },
  { id: 'e5', user_id: 'mock-user-123', category_id: '5', amount: 240.00, note: 'Movie tickets', payment_mode: 'upi', expense_date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0] },
  { id: 'e6', user_id: 'mock-user-123', category_id: '6', amount: 120.00, note: 'Cold medicine', payment_mode: 'cash', expense_date: new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0] },
  { id: 'e7', user_id: 'mock-user-123', category_id: '1', amount: 45.00, note: 'Morning tea & snacks', payment_mode: 'cash', expense_date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0] },
];

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  expenses: MOCK_EXPENSES,
  loading: false,

  fetchExpenses: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ loading: true });

    if (isMockMode) {
      // TODO: Supabase Integration - Fetch expenses from Supabase database when ready
      set({ loading: false });
      return;
    }

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
      id: isMockMode ? Math.random().toString() : undefined,
      user_id: user.id,
      category_id: categoryId,
      amount,
      note,
      payment_mode: paymentMode,
      expense_date: date,
    };

    if (isMockMode) {
      // TODO: Supabase Integration - Insert new expense to Supabase database when ready
      set((state) => ({
        expenses: [newExpense as Expense, ...state.expenses].sort((a, b) => b.expense_date.localeCompare(a.expense_date)),
        loading: false,
      }));
      return;
    }

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

    if (isMockMode) {
      // TODO: Supabase Integration - Update expense in Supabase database when ready
      set((state) => ({
        expenses: state.expenses.map((e) =>
          e.id === id ? { ...e, amount, category_id: categoryId, note, payment_mode: paymentMode, expense_date: date } : e
        ).sort((a, b) => b.expense_date.localeCompare(a.expense_date)),
        loading: false,
      }));
      return;
    }

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

    if (isMockMode) {
      // TODO: Supabase Integration - Delete expense from Supabase database when ready
      set((state) => ({
        expenses: state.expenses.filter((e) => e.id !== id),
        loading: false,
      }));
      return;
    }

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
