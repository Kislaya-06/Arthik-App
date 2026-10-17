import { describe, it, expect, beforeEach, vi } from 'vitest';

// 1. Mock AsyncStorage
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

// 2. Mock expo-crypto
let uuidCounter = 1;
vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => `10000000-0000-4000-8000-${String(uuidCounter++).padStart(12, '0')}`),
}));

// 3. Mock Supabase
vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      or: vi.fn().mockResolvedValue({ data: [], error: null }),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'u1', email: 'test@example.com' } } },
      }),
    },
  },
}));

// 4. Mock AuthStore
vi.mock('../src/store/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      user: { id: 'u1', email: 'test@example.com' },
    })),
  },
  registerStoreResetCallback: vi.fn(),
}));

// 5. Mock DailyBudgetStore
vi.mock('../src/store/dailyBudgetStore', () => ({
  useDailyBudgetStore: {
    getState: vi.fn(() => ({
      syncWithExpenses: vi.fn(),
      uploadPendingDailyRecords: vi.fn().mockResolvedValue(undefined),
    })),
  },
  registerExpenseGetter: vi.fn(),
  registerExpensesLoadedGetter: vi.fn(),
  registerAddExpense: vi.fn(),
}));

// 6. Mock NetworkStore
vi.mock('../src/store/networkStore', () => ({
  useNetworkStore: {
    getState: vi.fn(() => ({
      isOffline: false,
    })),
  },
  registerSyncCallback: vi.fn(),
}));

import { useCategoryStore } from '../src/store/categoryStore';
import { useExpenseStore, Expense } from '../src/store/expenseStore';

describe('Phase A.4 — Granular Zustand Selector Optimization', () => {
  beforeEach(() => {
    // Reset stores to known clean states
    useCategoryStore.setState({
      categories: [
        { id: 'cat_1', name: 'Food', color: '#FF857A', icon: 'Utensils', is_default: true, user_id: 'u1' },
        { id: 'cat_2', name: 'Transport', color: '#4A90D9', icon: 'Car', is_default: true, user_id: 'u1' },
      ],
      loading: false,
      isFetched: true,
    });

    useExpenseStore.setState({
      expenses: [
        { id: 'exp_1', amount: 150, category_id: 'cat_1', expense_date: '2026-10-18T10:00:00Z', user_id: 'u1', type: 'expense', payment_mode: 'upi' },
      ],
      loading: false,
      isExpensesLoaded: true,
      transactionType: 'expense',
      failedSyncItems: [],
    });
  });

  /**
   * Simulates how React's useSyncExternalStoreWithSelector evaluates state updates
   * given a selector and an equality function (default Object.is).
   */
  function trackSelectorUpdates<TStore, TSlice>(
    store: { subscribe: (fn: (s: TStore, prev: TStore) => void) => () => void; getState: () => TStore },
    selector: (s: TStore) => TSlice
  ) {
    let updateCount = 0;
    let currentSlice = selector(store.getState());

    const unsubscribe = store.subscribe((nextState) => {
      const nextSlice = selector(nextState);
      if (!Object.is(currentSlice, nextSlice)) {
        currentSlice = nextSlice;
        updateCount++;
      }
    });

    return {
      getUpdateCount: () => updateCount,
      getCurrentSlice: () => currentSlice,
      unsubscribe,
    };
  }

  it('eliminates unnecessary subscriber notifications when unrelated categoryStore fields change', () => {
    // Whole store selector: (s) => s (old pattern in ManageCategoriesScreen & CategoryDetailScreen)
    const wholeStore = trackSelectorUpdates(useCategoryStore, (s) => s);

    // Granular selector: (s) => s.categories (new pattern)
    const granularCategories = trackSelectorUpdates(useCategoryStore, (s) => s.categories);

    expect(wholeStore.getUpdateCount()).toBe(0);
    expect(granularCategories.getUpdateCount()).toBe(0);

    // 1. Toggling loading state
    useCategoryStore.setState({ loading: true });
    // 2. Setting isFetched flag
    useCategoryStore.setState({ isFetched: false });
    // 3. Clearing loading state
    useCategoryStore.setState({ loading: false });

    // Whole store received 3 update notifications
    expect(wholeStore.getUpdateCount()).toBe(3);

    // Granular selector received 0 update notifications (categories array reference was untouched)
    expect(granularCategories.getUpdateCount()).toBe(0);

    // 4. Updating categories array with a new category
    const updatedCats = [
      ...useCategoryStore.getState().categories,
      { id: 'cat_3', name: 'Bills', color: '#F4A460', icon: 'FileText', is_default: false, user_id: 'u1' },
    ];
    useCategoryStore.setState({ categories: updatedCats });

    // Now both receive the update
    expect(wholeStore.getUpdateCount()).toBe(4);
    expect(granularCategories.getUpdateCount()).toBe(1);
    expect(granularCategories.getCurrentSlice()).toHaveLength(3);

    wholeStore.unsubscribe();
    granularCategories.unsubscribe();
  });

  it('eliminates unnecessary subscriber notifications when unrelated expenseStore fields change', () => {
    // Whole store selector: (s) => s (old pattern in ManageCategoriesScreen & CategoryDetailScreen)
    const wholeStore = trackSelectorUpdates(useExpenseStore, (s) => s);

    // Granular selector: (s) => s.expenses (new pattern)
    const granularExpenses = trackSelectorUpdates(useExpenseStore, (s) => s.expenses);

    expect(wholeStore.getUpdateCount()).toBe(0);
    expect(granularExpenses.getUpdateCount()).toBe(0);

    // 1. Toggling loading flag
    useExpenseStore.setState({ loading: true });
    // 2. Toggling isExpensesLoaded flag
    useExpenseStore.setState({ isExpensesLoaded: false });
    // 3. Changing transactionType
    useExpenseStore.setState({ transactionType: 'income' });
    // 4. Updating failedSyncItems
    useExpenseStore.setState({ failedSyncItems: [{ id: 'f1', type: 'add', errorReason: 'timeout', failedAt: '2026-10-18' }] });

    // Whole store selector received 4 update notifications
    expect(wholeStore.getUpdateCount()).toBe(4);

    // Granular expenses selector received 0 update notifications (expenses array was untouched)
    expect(granularExpenses.getUpdateCount()).toBe(0);

    // 5. Updating expenses array with a new transaction
    const newExpenses: Expense[] = [
      ...useExpenseStore.getState().expenses,
      { id: 'exp_2', amount: 500, category_id: 'cat_2', expense_date: '2026-10-18T11:00:00Z', user_id: 'u1', type: 'expense', payment_mode: 'cash' },
    ];
    useExpenseStore.setState({ expenses: newExpenses });

    // Now both receive the update
    expect(wholeStore.getUpdateCount()).toBe(5);
    expect(granularExpenses.getUpdateCount()).toBe(1);
    expect(granularExpenses.getCurrentSlice()).toHaveLength(2);

    wholeStore.unsubscribe();
    granularExpenses.unsubscribe();
  });

  it('guarantees stable action references across store state updates', () => {
    const fetchCats1 = useCategoryStore.getState().fetchCategories;
    const deleteCat1 = useCategoryStore.getState().deleteCategory;
    const fetchExpenses1 = useExpenseStore.getState().fetchExpenses;

    // Mutate state in both stores
    useCategoryStore.setState({ loading: true, isFetched: false });
    useExpenseStore.setState({ loading: true, transactionType: 'income' });

    const fetchCats2 = useCategoryStore.getState().fetchCategories;
    const deleteCat2 = useCategoryStore.getState().deleteCategory;
    const fetchExpenses2 = useExpenseStore.getState().fetchExpenses;

    // Action function references are strictly immutable (===)
    expect(fetchCats1).toBe(fetchCats2);
    expect(deleteCat1).toBe(deleteCat2);
    expect(fetchExpenses1).toBe(fetchExpenses2);
  });
});
