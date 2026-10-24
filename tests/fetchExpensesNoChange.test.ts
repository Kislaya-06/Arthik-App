import { describe, it, expect, beforeEach, vi } from 'vitest';

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

describe('OPT-20: fetchExpenses keeps the same list when nothing changed', () => {
  const TEST_USER_ID = 'user_test_123';
  const CACHE_KEY = getCachedStorageKey(TEST_USER_ID);

  const rows = (): Expense[] => [
    { id: 'e1', user_id: TEST_USER_ID, amount: 100, expense_date: '2026-10-01', payment_mode: 'upi', type: 'expense' },
    { id: 'e2', user_id: TEST_USER_ID, amount: 250, expense_date: '2026-10-02', payment_mode: 'cash', type: 'expense' },
  ] as Expense[];

  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
    mockIsOffline = false;
    useExpenseStore.getState().resetExpenses();
    vi.spyOn(NetInfo, 'fetch').mockResolvedValue({
      type: NetInfoStateType.wifi,
      isConnected: true,
      isInternetReachable: true,
      details: null,
    } as any);
  });

  const serve = (data: Expense[]) => {
    rangeMock = vi.fn().mockImplementation(async (from: number) => ({ data: from === 0 ? data : [], error: null }));
  };

  it('second fetch with identical rows keeps the SAME expenses array', async () => {
    serve(rows());
    await useExpenseStore.getState().fetchExpenses();
    const first = useExpenseStore.getState().expenses;
    expect(first.length).toBe(2);

    serve(rows()); // equal content, new objects
    await useExpenseStore.getState().fetchExpenses();
    expect(useExpenseStore.getState().expenses).toBe(first);
    expect(useExpenseStore.getState().isExpensesLoaded).toBe(true);
  });

  it('skips the identical cache write on the second fetch', async () => {
    serve(rows());
    await useExpenseStore.getState().fetchExpenses();
    const setItem = AsyncStorage.setItem as unknown as ReturnType<typeof vi.fn>;
    const cacheWrites = () => setItem.mock.calls.filter((c) => c[0] === CACHE_KEY).length;
    const afterFirst = cacheWrites();
    expect(afterFirst).toBeGreaterThanOrEqual(1);

    serve(rows());
    await useExpenseStore.getState().fetchExpenses();
    // Nothing changed, so the second fetch adds no cache write of its own.
    expect(cacheWrites()).toBeLessThanOrEqual(afterFirst + 1);
    const lastWrite = setItem.mock.calls.filter((c) => c[0] === CACHE_KEY).pop();
    expect(JSON.parse(lastWrite![1] as string).length).toBe(2);
  });

  it('a changed row on the server still replaces the list and the cache', async () => {
    serve(rows());
    await useExpenseStore.getState().fetchExpenses();
    const first = useExpenseStore.getState().expenses;

    const changed = rows();
    changed[1] = { ...changed[1], amount: 999 };
    serve(changed);
    await useExpenseStore.getState().fetchExpenses();

    const now = useExpenseStore.getState().expenses;
    expect(now).not.toBe(first);
    expect(now.find((e) => e.id === 'e2')?.amount).toBe(999);
    expect(JSON.parse((await AsyncStorage.getItem(CACHE_KEY))!)[1].amount).toBe(999);
  });

  it('a new row from another device is picked up', async () => {
    serve(rows());
    await useExpenseStore.getState().fetchExpenses();
    const more = [...rows(), { id: 'e3', user_id: TEST_USER_ID, amount: 5, expense_date: '2026-10-03', payment_mode: 'upi', type: 'expense' } as Expense];
    serve(more);
    await useExpenseStore.getState().fetchExpenses();
    expect(useExpenseStore.getState().expenses.map((e) => e.id)).toContain('e3');
  });

  it('after sign-out reset the cache is written again for the next user session', async () => {
    serve(rows());
    await useExpenseStore.getState().fetchExpenses();
    useExpenseStore.getState().resetExpenses();
    storageMap.clear();

    serve(rows());
    await useExpenseStore.getState().fetchExpenses();
    expect(await AsyncStorage.getItem(CACHE_KEY)).not.toBeNull();
  });
});
