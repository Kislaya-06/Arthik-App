import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock expo-crypto (used by categoryStore for randomUUID)
let uuidCounter = 0;
vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => `00000000-0000-0000-0000-${String(++uuidCounter).padStart(12, '0')}`),
}));

// Mock AsyncStorage
const storageMap = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storageMap.get(key) ?? null),
    setItem: vi.fn(async (key: string, val: string) => {
      storageMap.set(key, val);
    }),
    removeItem: vi.fn(async (key: string) => {
      storageMap.delete(key);
    }),
    clear: vi.fn(async () => {
      storageMap.clear();
    }),
  },
}));

// Mock Supabase
const mockSupabaseInsert = vi.fn().mockResolvedValue({ error: null });
const mockSupabaseUpsert = vi.fn().mockResolvedValue({ error: null });
const mockSupabaseUpdate = vi.fn(() => ({
  eq: vi.fn().mockResolvedValue({ error: null }),
}));
const mockSupabaseDelete = vi.fn(() => ({
  eq: vi.fn().mockResolvedValue({ error: null }),
}));
const mockSupabaseSelect = vi.fn(() => ({
  or: vi.fn().mockResolvedValue({
    data: [
      { id: 'cat_default_1', user_id: null, name: 'Food & Drinks', icon: 'Utensils', color: '#F4B8AE', is_default: true },
      { id: 'cat_custom_1', user_id: 'user_cat_test_1', name: 'Freelance Tools', icon: 'Briefcase', color: '#B8E0C8', is_default: false },
    ],
    error: null,
  }),
}));

vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSupabaseSelect,
      insert: mockSupabaseInsert,
      upsert: mockSupabaseUpsert,
      update: mockSupabaseUpdate,
      delete: mockSupabaseDelete,
    })),
  },
}));

// Mock NetworkStore (offline detection)
let mockIsOffline = false;
vi.mock('../src/store/networkStore', () => ({
  useNetworkStore: {
    getState: vi.fn(() => ({ isOffline: mockIsOffline })),
  },
  registerSyncCallback: vi.fn(),
}));

// Mock AuthStore
let mockUser: any = { id: 'user_cat_test_1', email: 'user@test.com' };
vi.mock('../src/store/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      user: mockUser,
    })),
  },
  registerStoreResetCallback: vi.fn(),
}));

// Mock ExpenseStore for deletion sync
const mockExpenseStoreSetState = vi.fn();
let mockExpenses: any[] = [];
vi.mock('../src/store/expenseStore', () => ({
  useExpenseStore: {
    getState: vi.fn(() => ({
      expenses: mockExpenses,
    })),
    setState: (updater: any) => {
      mockExpenseStoreSetState(updater);
      if (typeof updater === 'function') {
        mockExpenses = updater({ expenses: mockExpenses }).expenses;
      } else if (updater.expenses) {
        mockExpenses = updater.expenses;
      }
    },
  },
}));

// Import store
import { useCategoryStore, registerCategoryDeleteCallback } from '../src/store/categoryStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('categoryStore (Seam: useCategoryStore)', () => {
  const TEST_USER_ID = 'user_cat_test_1';
  const CACHE_KEY = `@arthik_cached_categories_${TEST_USER_ID}`;

  beforeEach(() => {
    storageMap.clear();
    uuidCounter = 0;
    mockIsOffline = false;
    vi.clearAllMocks();
    mockUser = { id: TEST_USER_ID, email: 'user@test.com' };
    mockExpenses = [];
    registerCategoryDeleteCallback((deletedId) => {
      mockExpenses = mockExpenses.map((e) => (e.category_id === deletedId ? { ...e, category_id: null } : e));
    });
    useCategoryStore.getState().resetCategories();
  });

  describe('Slice 1: Default Placeholders', () => {
    it('initializes with transient visual placeholders marked with isPlaceholder=true', () => {
      const state = useCategoryStore.getState();
      expect(state.categories.length).toBeGreaterThan(0);
      expect(state.categories[0].isPlaceholder).toBe(true);
      expect(state.isFetched).toBe(false);
    });
  });

  describe('Slice 2: Cold Launch / Cache Hydration', () => {
    it('hydrates categories from AsyncStorage cache before network completes', async () => {
      const cachedCategories = [
        { id: 'cat_cached_1', user_id: TEST_USER_ID, name: 'Groceries', icon: 'ShoppingBag', color: '#10B981', is_default: false },
      ];
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cachedCategories));

      await useCategoryStore.getState().fetchCategories();

      // State is populated
      const state = useCategoryStore.getState();
      expect(state.isFetched).toBe(true);
      expect(state.categories.length).toBeGreaterThan(0);
    });
  });

  describe('Slice 3: Fetching and Caching Categories', () => {
    it('fetches categories from Supabase, replaces placeholders, and updates AsyncStorage cache', async () => {
      await useCategoryStore.getState().fetchCategories(true);

      const state = useCategoryStore.getState();
      expect(state.isFetched).toBe(true);
      expect(state.categories).toEqual([
        { id: 'cat_default_1', user_id: null, name: 'Food & Drinks', icon: 'Utensils', color: '#F4B8AE', is_default: true },
        { id: 'cat_custom_1', user_id: TEST_USER_ID, name: 'Freelance Tools', icon: 'Briefcase', color: '#B8E0C8', is_default: false },
      ]);

      // Verify cached to AsyncStorage
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      expect(cached).not.toBeNull();
      expect(JSON.parse(cached!).length).toBe(2);
    });

    it('skips network call if isFetched is true and force is false', async () => {
      useCategoryStore.setState({ isFetched: true });

      await useCategoryStore.getState().fetchCategories(false);

      expect(mockSupabaseSelect).not.toHaveBeenCalled();
    });
  });

  describe('Slice 4: Adding Categories', () => {
    it('upserts new custom category with client UUID and refreshes from server', async () => {
      await useCategoryStore.getState().addCategory('Fitness & Gym', 'Dumbbell', '#EC4899');

      // Now uses upsert (not insert) with a client-generated UUID
      expect(mockSupabaseUpsert).toHaveBeenCalled();
      const upsertArg = (mockSupabaseUpsert as any).mock.calls[0][0];
      expect(upsertArg.name).toBe('Fitness & Gym');
      expect(upsertArg.icon).toBe('Dumbbell');
      expect(upsertArg.color).toBe('#EC4899');
      expect(upsertArg.user_id).toBe(TEST_USER_ID);
      expect(upsertArg.is_default).toBe(false);
      // After successful upsert, a full refetch is triggered to get authoritative server state
      expect(useCategoryStore.getState().isFetched).toBe(true);
    });
  });

  describe('Slice 5: Deleting Category & Orphan Prevention', () => {
    it('deletes category from Supabase and nulls category_id on linked client expenses', async () => {
      // Pre-populate state with a synced (non-pending) category to delete
      useCategoryStore.setState((s) => ({
        categories: [
          ...s.categories,
          { id: 'cat_to_delete', user_id: TEST_USER_ID, name: 'Old Cat', icon: 'Tag', color: '#aaa', is_default: false },
        ],
      }));
      mockExpenses = [
        { id: 'exp_1', amount: 100, category_id: 'cat_to_delete' },
        { id: 'exp_2', amount: 200, category_id: 'other_cat' },
      ];

      await useCategoryStore.getState().deleteCategory('cat_to_delete');

      expect(mockSupabaseDelete).toHaveBeenCalled();
      // Linked expense must have category_id updated to null to prevent orphaned references
      expect(mockExpenses.find((e) => e.id === 'exp_1')?.category_id).toBeNull();
      expect(mockExpenses.find((e) => e.id === 'exp_2')?.category_id).toBe('other_cat');
    });
  });

  describe('Slice 6: Reset on Sign-out', () => {
    it('resets categories back to default placeholders on resetCategories', () => {
      useCategoryStore.setState({
        categories: [{ id: 'cat_real', user_id: TEST_USER_ID, name: 'Custom', icon: 'Car', color: '#000', is_default: false }],
        isFetched: true,
        loading: true,
      });

      useCategoryStore.getState().resetCategories();

      const state = useCategoryStore.getState();
      expect(state.isFetched).toBe(false);
      expect(state.loading).toBe(false);
      expect(state.categories[0].isPlaceholder).toBe(true);
    });
  });
});
