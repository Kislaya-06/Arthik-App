import { create } from 'zustand';
import { supabase } from '../config/supabase';
import { useAuthStore } from './authStore';

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  icon: string;
  color: string;
  is_default: boolean;
}

interface CategoryState {
  categories: Category[];
  loading: boolean;
  fetchCategories: () => Promise<void>;
  addCategory: (name: string, icon: string, color: string) => Promise<void>;
  updateCategory: (id: string, name: string, icon: string, color: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', user_id: null, name: 'Food & Drinks', icon: 'Utensils', color: '#F4B8AE', is_default: true },
  { id: '2', user_id: null, name: 'Shopping', icon: 'ShoppingBag', color: '#B8E0C8', is_default: true },
  { id: '3', user_id: null, name: 'Transport', icon: 'Car', color: '#93C5FD', is_default: true },
  { id: '4', user_id: null, name: 'Bills & Utilities', icon: 'FileText', color: '#FCD34D', is_default: true },
  { id: '5', user_id: null, name: 'Entertainment', icon: 'Film', color: '#C084FC', is_default: true },
  { id: '6', user_id: null, name: 'Health', icon: 'HeartPulse', color: '#F87171', is_default: true },
  { id: '7', user_id: null, name: 'Others', icon: 'DollarSign', color: '#94A3B8', is_default: true },
];

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: DEFAULT_CATEGORIES,
  loading: false,

  fetchCategories: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ loading: true });



    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .or(`user_id.is.null,user_id.eq.${user.id}`);

      if (error) throw error;
      set({ categories: data || DEFAULT_CATEGORIES });
    } catch (e) {
      console.error('Error fetching categories:', e);
    } finally {
      set({ loading: false });
    }
  },

  addCategory: async (name, icon, color) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ loading: true });

    const newCategory = {
      id: undefined,
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
      await get().fetchCategories();
    } catch (e) {
      console.error('Error adding category:', e);
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
      await get().fetchCategories();
    } catch (e) {
      console.error('Error updating category:', e);
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
      await get().fetchCategories();
    } catch (e) {
      console.error('Error deleting category:', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },
}));
