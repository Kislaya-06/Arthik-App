import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { useAuthStore, registerStoreResetCallback } from './authStore';

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  icon: string;
  color: string;
  is_default: boolean;
  isPlaceholder?: boolean;
}

interface CategoryState {
  categories: Category[];
  loading: boolean;
  isFetched: boolean;
  fetchCategories: (force?: boolean) => Promise<void>;
  addCategory: (name: string, icon: string, color: string) => Promise<void>;
  updateCategory: (id: string, name: string, icon: string, color: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  resetCategories: () => void;
}

// Display-only visual placeholder array shown before real categories load from Supabase.
// IMPORTANT: These fake IDs ('1' through '7') are NEVER selectable and NEVER sent to Supabase.
const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', user_id: null, name: 'Food & Drinks', icon: 'Utensils', color: '#F4B8AE', is_default: true, isPlaceholder: true },
  { id: '2', user_id: null, name: 'Shopping', icon: 'ShoppingBag', color: '#B8E0C8', is_default: true, isPlaceholder: true },
  { id: '3', user_id: null, name: 'Transport', icon: 'Car', color: '#93C5FD', is_default: true, isPlaceholder: true },
  { id: '4', user_id: null, name: 'Bills & Utilities', icon: 'FileText', color: '#FCD34D', is_default: true, isPlaceholder: true },
  { id: '5', user_id: null, name: 'Entertainment', icon: 'Film', color: '#C084FC', is_default: true, isPlaceholder: true },
  { id: '6', user_id: null, name: 'Health', icon: 'HeartPulse', color: '#F87171', is_default: true, isPlaceholder: true },
  { id: '7', user_id: null, name: 'Others', icon: 'DollarSign', color: '#94A3B8', is_default: true, isPlaceholder: true },
];

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: DEFAULT_CATEGORIES,
  loading: false,
  isFetched: false,

  resetCategories: () => {
    set({ categories: DEFAULT_CATEGORIES, isFetched: false, loading: false });
  },

  fetchCategories: async (force = false) => {
    // Skip network call if data is already loaded and caller didn't force a refresh.
    if (get().isFetched && !force) return;

    const user = useAuthStore.getState().user;
    if (!user) return;

    // Load cached real categories first if offline or cold launch
    const cacheKey = `@arthik_cached_categories_${user.id}`;
    if (!get().isFetched) {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            set({ categories: parsed, isFetched: true });
          }
        }
      } catch (cacheErr) {
        if (__DEV__) console.log('Error reading cached categories:', cacheErr);
      }
    }

    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .or(`user_id.is.null,user_id.eq.${user.id}`);

      if (error) throw error;
      if (data) {
        set({ categories: data, isFetched: true });
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      }
    } catch (e) {
      if (__DEV__) console.error('Error fetching categories:', e);
    } finally {
      set({ loading: false });
    }
  },

  addCategory: async (name, icon, color) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ loading: true });

    const newCategory = {
      user_id: user.id,
      name,
      icon,
      color,
      is_default: false,
    };



    try {
      const { error } = await supabase
        .from('categories')
        .insert(newCategory);

      if (error) throw error;
      await get().fetchCategories(true);
    } catch (e) {
      if (__DEV__) console.error('Error adding category:', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  updateCategory: async (id, name, icon, color) => {
    set({ loading: true });



    try {
      const { error } = await supabase
        .from('categories')
        .update({ name, icon, color })
        .eq('id', id);

      if (error) throw error;
      await get().fetchCategories(true);
    } catch (e) {
      if (__DEV__) console.error('Error updating category:', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  deleteCategory: async (id) => {
    set({ loading: true });



    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await get().fetchCategories(true);

      // Clean up client expenses store so no expense retains the deleted category_id
      try {
        const { useExpenseStore } = require('./expenseStore');
        const expStore = useExpenseStore.getState();
        if (expStore.expenses.some((e: any) => e.category_id === id)) {
          useExpenseStore.setState((s: any) => ({
            expenses: s.expenses.map((e: any) => (e.category_id === id ? { ...e, category_id: null } : e)),
          }));
        }
      } catch (err) {
        if (__DEV__) console.log('Error syncing deleted category with expense store:', err);
      }
    } catch (e) {
      if (__DEV__) console.error('Error deleting category:', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },
}));

registerStoreResetCallback(() => {
  useCategoryStore.getState().resetCategories();
});
