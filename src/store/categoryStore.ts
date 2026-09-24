import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase } from '../config/supabase';
import { useAuthStore, registerStoreResetCallback } from './authStore';
import { useNetworkStore } from './networkStore';
import { isNetworkFailure } from '../lib/networkUtils';

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  icon: string;
  color: string;
  is_default: boolean;
  isPlaceholder?: boolean;
  pending?: boolean; // true = queued offline, never reached Supabase yet
}

interface CategoryState {
  categories: Category[];
  loading: boolean;
  isFetched: boolean;
  fetchCategories: (force?: boolean) => Promise<void>;
  addCategory: (name: string, icon: string, color: string) => Promise<void>;
  updateCategory: (id: string, name: string, icon: string, color: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  syncPendingCategories: () => Promise<void>;
  resetCategories: () => void;
}

let categoryDeleteCallback: ((id: string) => void) | null = null;
export const registerCategoryDeleteCallback = (cb: (id: string) => void) => {
  categoryDeleteCallback = cb;
};

// ── Offline queue helpers ─────────────────────────────────────────────────────

const getPendingCatAddsKey = (uid: string) => `@arthik_pending_cat_adds_${uid}`;
const getPendingCatUpdatesKey = (uid: string) => `@arthik_pending_cat_updates_${uid}`;
const getPendingCatDeletesKey = (uid: string) => `@arthik_pending_cat_deletes_${uid}`;

type PendingCatAdd = { id: string; user_id: string; name: string; icon: string; color: string };
type PendingCatUpdate = { id: string; name: string; icon: string; color: string };

const getStoredList = async <T>(key: string): Promise<T[]> => {
  try {
    const s = await AsyncStorage.getItem(key);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
};
const setStoredList = async <T>(key: string, list: T[]) => {
  try { await AsyncStorage.setItem(key, JSON.stringify(list)); } catch {}
};

const savePendingCatAdd = async (uid: string, cat: PendingCatAdd) => {
  const key = getPendingCatAddsKey(uid);
  const list = await getStoredList<PendingCatAdd>(key);
  if (!list.some((c) => c.id === cat.id)) await setStoredList(key, [...list, cat]);
};

// Returns true if the category was in pending-add queue (never reached Supabase).
const tryRemovePendingCatAdd = async (uid: string, catId: string): Promise<boolean> => {
  const key = getPendingCatAddsKey(uid);
  const list = await getStoredList<PendingCatAdd>(key);
  const filtered = list.filter((c) => c.id !== catId);
  if (filtered.length === list.length) return false;
  await setStoredList(key, filtered);
  return true;
};

const savePendingCatUpdate = async (uid: string, upd: PendingCatUpdate) => {
  const key = getPendingCatUpdatesKey(uid);
  const list = await getStoredList<PendingCatUpdate>(key);
  const idx = list.findIndex((u) => u.id === upd.id);
  if (idx >= 0) list[idx] = upd; else list.push(upd);
  await setStoredList(key, list);
};

const savePendingCatDelete = async (uid: string, catId: string) => {
  const updKey = getPendingCatUpdatesKey(uid);
  const upds = await getStoredList<PendingCatUpdate>(updKey);
  if (upds.some((u) => u.id === catId)) await setStoredList(updKey, upds.filter((u) => u.id !== catId));

  const delKey = getPendingCatDeletesKey(uid);
  const dels = await getStoredList<string>(delKey);
  if (!dels.includes(catId)) await setStoredList(delKey, [...dels, catId]);
};

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

    // Offline fast-path: return immediately with cached categories
    if (useNetworkStore.getState().isOffline) {
      set({ loading: false });
      return;
    }

    set({ loading: true });
    try {
      const fetchPromise = supabase
        .from('categories')
        .select('*')
        .or(`user_id.is.null,user_id.eq.${user.id}`);
      const timeoutPromise = new Promise<{ data: null; error: any }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('Category fetch timeout') }), 3500)
      );

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

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

    const newId = Crypto.randomUUID();
    const newCategory: Category = {
      id: newId,
      user_id: user.id,
      name,
      icon,
      color,
      is_default: false,
      pending: true,
    };

    // Optimistic: add to local state immediately
    set((state) => ({ categories: [...state.categories, newCategory] }));

    if (useNetworkStore.getState().isOffline) {
      await savePendingCatAdd(user.id, { id: newId, user_id: user.id, name, icon, color });
      // Keep pending category in cache so it survives restart
      try {
        const cacheKey = `@arthik_cached_categories_${user.id}`;
        const cached = await AsyncStorage.getItem(cacheKey);
        const list: Category[] = cached ? JSON.parse(cached) : [];
        await AsyncStorage.setItem(cacheKey, JSON.stringify([...list, newCategory]));
      } catch {}
      return;
    }

    set({ loading: true });
    try {
      const { error } = await supabase
        .from('categories')
        .upsert({ id: newId, user_id: user.id, name, icon, color, is_default: false }, { onConflict: 'id' });

      if (error) throw error;
      set((state) => ({
        categories: state.categories.map((c) => c.id === newId ? { ...c, pending: false } : c),
      }));
      await get().fetchCategories(true);
    } catch (e: any) {
      if (isNetworkFailure(e)) {
        await savePendingCatAdd(user.id, { id: newId, user_id: user.id, name, icon, color });
        return;
      }
      set((state) => ({ categories: state.categories.filter((c) => c.id !== newId) }));
      if (__DEV__) console.error('Error adding category:', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  updateCategory: async (id, name, icon, color) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const previousCategory = get().categories.find((c) => c.id === id);
    if (!previousCategory) return;

    // Optimistic update
    set((state) => ({
      categories: state.categories.map((c) => c.id === id ? { ...c, name, icon, color } : c),
    }));

    // If category is pending-add, just patch the pending-add queue entry
    if (previousCategory.pending) {
      const key = getPendingCatAddsKey(user.id);
      const list = await getStoredList<PendingCatAdd>(key);
      const idx = list.findIndex((c) => c.id === id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], name, icon, color };
        await setStoredList(key, list);
      }
      return;
    }

    if (useNetworkStore.getState().isOffline) {
      await savePendingCatUpdate(user.id, { id, name, icon, color });
      return;
    }

    set({ loading: true });
    try {
      const { error } = await supabase.from('categories').update({ name, icon, color }).eq('id', id);
      if (error) throw error;

      // Update cache directly (avoid full refetch round-trip)
      try {
        const cacheKey = `@arthik_cached_categories_${user.id}`;
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const list: Category[] = JSON.parse(cached);
          await AsyncStorage.setItem(cacheKey,
            JSON.stringify(list.map((c) => c.id === id ? { ...c, name, icon, color } : c)));
        }
      } catch {}
    } catch (e: any) {
      if (isNetworkFailure(e)) {
        await savePendingCatUpdate(user.id, { id, name, icon, color });
        return;
      }
      set((state) => ({
        categories: state.categories.map((c) => c.id === id ? previousCategory : c),
      }));
      if (__DEV__) console.error('Error updating category:', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  deleteCategory: async (id) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const previousCategory = get().categories.find((c) => c.id === id);
    if (!previousCategory) return;

    // Optimistic remove from local state
    set((state) => ({ categories: state.categories.filter((c) => c.id !== id) }));

    // Immediately clean up expense category_id references in local state
    if (categoryDeleteCallback) {
      categoryDeleteCallback(id);
    } else {
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
    }

    // If it was a pending-add category (never reached Supabase), just remove from the add queue.
    const wasPending = await tryRemovePendingCatAdd(user.id, id);
    if (wasPending) {
      try {
        const cacheKey = `@arthik_cached_categories_${user.id}`;
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          await AsyncStorage.setItem(cacheKey,
            JSON.stringify(JSON.parse(cached).filter((c: Category) => c.id !== id)));
        }
      } catch {}
      return;
    }

    if (useNetworkStore.getState().isOffline) {
      await savePendingCatDelete(user.id, id);
      return;
    }

    set({ loading: true });
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;

      // Update cache
      try {
        const cacheKey = `@arthik_cached_categories_${user.id}`;
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          await AsyncStorage.setItem(cacheKey,
            JSON.stringify(JSON.parse(cached).filter((c: Category) => c.id !== id)));
        }
      } catch {}
    } catch (e: any) {
      if (isNetworkFailure(e)) {
        await savePendingCatDelete(user.id, id);
        return;
      }
      set((state) => ({ categories: [...state.categories, previousCategory] }));
      if (__DEV__) console.error('Error deleting category:', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  syncPendingCategories: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const userId = user.id;

    // 1. Sync pending adds
    const addsKey = getPendingCatAddsKey(userId);
    const adds = await getStoredList<PendingCatAdd>(addsKey);
    if (adds.length) {
      const synced: string[] = [];
      for (const cat of adds) {
        try {
          const { error } = await supabase.from('categories').upsert(
            { id: cat.id, user_id: cat.user_id, name: cat.name, icon: cat.icon, color: cat.color, is_default: false },
            { onConflict: 'id', ignoreDuplicates: true }
          );
          if (!error) synced.push(cat.id);
        } catch {}
      }
      if (synced.length) {
        await setStoredList(addsKey, adds.filter((c) => !synced.includes(c.id)));
        set((s) => ({ categories: s.categories.map((c) => (synced.includes(c.id) ? { ...c, pending: false } : c)) }));
      }
    }

    // 2. Sync pending updates
    const updsKey = getPendingCatUpdatesKey(userId);
    const upds = await getStoredList<PendingCatUpdate>(updsKey);
    if (upds.length) {
      const synced: string[] = [];
      for (const u of upds) {
        try {
          const { error } = await supabase.from('categories').update({ name: u.name, icon: u.icon, color: u.color }).eq('id', u.id);
          if (!error) synced.push(u.id);
        } catch {}
      }
      if (synced.length) await setStoredList(updsKey, upds.filter((u) => !synced.includes(u.id)));
    }

    // 3. Sync pending deletes
    const delsKey = getPendingCatDeletesKey(userId);
    const dels = await getStoredList<string>(delsKey);
    if (dels.length) {
      const synced: string[] = [];
      for (const id of dels) {
        try {
          const { error } = await supabase.from('categories').delete().eq('id', id);
          if (!error) synced.push(id);
        } catch {}
      }
      if (synced.length) await setStoredList(delsKey, dels.filter((id) => !synced.includes(id)));
    }

    // Refresh categories from server to get authoritative state
    if (!useNetworkStore.getState().isOffline) {
      await get().fetchCategories(true);
    }
  },
}));

registerStoreResetCallback(() => {
  useCategoryStore.getState().resetCategories();
});
