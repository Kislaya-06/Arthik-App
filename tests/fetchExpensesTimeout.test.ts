import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 1. Setup in-memory AsyncStorage
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
vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => '10000000-0000-4000-8000-000000000001'),
}));

// 3. Mock Supabase
let rangeMock = vi.fn();
vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn((_table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      range: (...args: any[]) => rangeMock(...args),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user_test_123', email: 'test@example.com' } } },
      }),
    },
  },
}));

// 4. Mock AuthStore
vi.mock('../src/store/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      user: { id: 'user_test_123', email: 'test@example.com' },
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
      syncPendingGullakDeposits: vi.fn().mockResolvedValue(undefined),
    })),
  },
  registerExpenseGetter: vi.fn(),
  registerExpensesLoadedGetter: vi.fn(),
  registerAddExpense: vi.fn(),
}));

// 6. NetworkStore tracking
let mockIsOffline = false;
const setOfflineSpy = vi.fn((val: boolean) => {
  mockIsOffline = val;
});
vi.mock('../src/store/networkStore', () => ({
  useNetworkStore: {
    getState: vi.fn(() => ({
      isOffline: mockIsOffline,
      setOffline: setOfflineSpy,
      triggerOfflineAlert: vi.fn(),
    })),
  },
  registerSyncCallback: vi.fn(),
}));

import NetInfo, { NetInfoStateType } from '@react-native-community/netinfo';
import { useExpenseStore, Expense, getCachedStorageKey } from '../src/store/expenseStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('FIN-05: fetchExpenses pagination & timeout hardening', () => {
  const TEST_USER_ID = 'user_test_123';
  const CACHE_KEY = getCachedStorageKey(TEST_USER_ID);

  const createPage = (pageNum: number, count: number): Expense[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `exp-${pageNum}-${i}`,
      user_id: TEST_USER_ID,
      amount: 100,
      expense_date: '2026-10-01',
      payment_mode: 'upi',
      type: 'expense' as const,
    }));
  };

  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
    mockIsOffline = false;
    useExpenseStore.getState().resetExpenses();
    vi.useFakeTimers();
    vi.spyOn(NetInfo, 'fetch').mockResolvedValue({
      type: NetInfoStateType.wifi,
      isConnected: true,
      isInternetReachable: true,
      details: null,
    } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('(a) slow multi-page success does NOT set offline and loads all rows', async () => {
    let pageCallCount = 0;
    rangeMock.mockImplementation(async () => {
      pageCallCount++;
      // Each page takes 1000ms. Over 6 pages, total elapsed is 6s (> old 5s global timeout)
      await vi.advanceTimersByTimeAsync(1000);
      if (pageCallCount < 6) {
        return { data: createPage(pageCallCount, 1000), error: null };
      } else if (pageCallCount === 6) {
        return { data: createPage(pageCallCount, 500), error: null };
      }
      return { data: [], error: null };
    });

    await useExpenseStore.getState().fetchExpenses();

    expect(setOfflineSpy).not.toHaveBeenCalledWith(true);
    expect(mockIsOffline).toBe(false);
    expect(useExpenseStore.getState().expenses.length).toBe(5500);
    expect(useExpenseStore.getState().isExpensesLoaded).toBe(true);

    // Verify cache has all 5500 rows
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    expect(cached).not.toBeNull();
    expect(JSON.parse(cached!).length).toBe(5500);
  });

  it('(b) true network failure still sets offline and loads the cache', async () => {
    // Seed pre-existing cache
    const initialCache: Expense[] = [
      {
        id: 'cached-1',
        user_id: TEST_USER_ID,
        amount: 250,
        expense_date: '2026-09-30',
        payment_mode: 'upi',
        type: 'expense',
      },
    ];
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(initialCache));

    // Simulate true network disconnection: NetInfo reports offline
    vi.spyOn(NetInfo, 'fetch').mockResolvedValue({
      type: NetInfoStateType.none,
      isConnected: false,
      isInternetReachable: false,
      details: null,
    });

    rangeMock.mockRejectedValue(new Error('Network request failed'));

    const fetchPromise = useExpenseStore.getState().fetchExpenses();
    await vi.runAllTimersAsync();
    await fetchPromise;

    // App must be marked offline
    expect(setOfflineSpy).toHaveBeenCalledWith(true);
    expect(mockIsOffline).toBe(true);

    // Cache must be loaded into state
    const stateExpenses = useExpenseStore.getState().expenses;
    expect(stateExpenses.length).toBe(1);
    expect(stateExpenses[0].id).toBe('cached-1');
    expect(useExpenseStore.getState().isExpensesLoaded).toBe(true);
  });

  it('(c) a failure on page N leaves existing expenses and cache untouched (no partial overwrite)', async () => {
    // Seed pre-existing cache
    const originalCache: Expense[] = [
      {
        id: 'original-cached-item',
        user_id: TEST_USER_ID,
        amount: 999,
        expense_date: '2026-09-20',
        payment_mode: 'card',
        type: 'expense',
      },
    ];
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(originalCache));
    useExpenseStore.setState({ expenses: [...originalCache], isExpensesLoaded: true });

    // Page 1 and Page 2 succeed (1000 items each), but Page 3 fails repeatedly
    let pageCallCount = 0;
    rangeMock.mockImplementation(async () => {
      pageCallCount++;
      if (pageCallCount === 1) {
        return { data: createPage(1, 1000), error: null };
      }
      if (pageCallCount === 2) {
        return { data: createPage(2, 1000), error: null };
      }
      // Page 3 fails repeatedly
      throw new Error('Database connection reset on page 3');
    });

    const fetchPromise = useExpenseStore.getState().fetchExpenses();
    await vi.runAllTimersAsync();
    await fetchPromise;

    // Because NetInfo is online, app is NOT falsely marked offline
    expect(setOfflineSpy).not.toHaveBeenCalledWith(true);
    expect(mockIsOffline).toBe(false);

    // Invariant 1: State must NOT contain partial 2000 rows! It must preserve the 1 original cached item
    const stateExpenses = useExpenseStore.getState().expenses;
    expect(stateExpenses.length).toBe(1);
    expect(stateExpenses[0].id).toBe('original-cached-item');

    // Cache must remain untouched (still 1 original item, not 2000 partial items)
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    expect(JSON.parse(cached!).length).toBe(1);
    expect(JSON.parse(cached!)[0].id).toBe('original-cached-item');
  });

  it('(d) a late-finishing loop after cancellation does not mutate state', async () => {
    let resolvePage1Started: () => void = () => {};
    const page1Started = new Promise<void>((r) => {
      resolvePage1Started = r;
    });

    let resolvePage1Data: (val: any) => void = () => {};
    const page1DataPromise = new Promise((r) => {
      resolvePage1Data = r;
    });

    rangeMock.mockImplementation(() => {
      resolvePage1Started();
      return page1DataPromise;
    });

    // Start fetchExpenses #1 (it will wait at page 1)
    const fetchPromise = useExpenseStore.getState().fetchExpenses();

    // Wait until rangeMock is entered
    await page1Started;

    // User signs out or resets store while fetch #1 is in flight
    useExpenseStore.getState().resetExpenses();
    expect(useExpenseStore.getState().expenses).toEqual([]);

    // Now page 1 finally resolves late
    resolvePage1Data({ data: createPage(1, 1000), error: null });
    await fetchPromise;

    // State must still be empty! The cancelled fetch must NOT write its data
    expect(useExpenseStore.getState().expenses).toEqual([]);
    expect(useExpenseStore.getState().isExpensesLoaded).toBe(false);
  });
});
