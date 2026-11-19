import { describe, it, expect, beforeEach, vi } from 'vitest';

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

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => '10000000-0000-4000-8000-000000000001'),
}));

// Records the ORDER BY columns and the range of every expense page request.
interface PageCall {
  table: string;
  orders: { column: string; ascending: boolean | undefined }[];
  from: number;
  to: number;
}
const pageCalls: PageCall[] = [];
let servePage: (from: number, to: number) => { data: unknown[] | null; error: unknown } = () => ({ data: [], error: null });

vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      const orders: PageCall['orders'] = [];
      const query: any = {
        select: () => query,
        eq: () => query,
        or: () => query,
        order: (column: string, options?: { ascending?: boolean }) => {
          orders.push({ column, ascending: options?.ascending });
          return query;
        },
        range: async (from: number, to: number) => {
          pageCalls.push({ table, orders: [...orders], from, to });
          return servePage(from, to);
        },
      };
      return query;
    }),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user_test_123', email: 'test@example.com' } } },
      }),
    },
  },
}));

vi.mock('../src/store/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      user: { id: 'user_test_123', email: 'test@example.com' },
    })),
  },
  registerStoreResetCallback: vi.fn(),
}));

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

vi.mock('../src/store/networkStore', () => ({
  useNetworkStore: {
    getState: vi.fn(() => ({
      isOffline: false,
      setOffline: vi.fn(),
      triggerOfflineAlert: vi.fn(),
    })),
  },
  registerSyncCallback: vi.fn(),
}));

import NetInfo, { NetInfoStateType } from '@react-native-community/netinfo';
import { useExpenseStore, Expense } from '../src/store/expenseStore';

const EXPECTED_ORDER = [
  { column: 'expense_date', ascending: false },
  { column: 'created_at', ascending: false },
  { column: 'id', ascending: false },
];

const makeRows = (count: number): Expense[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `e${String(i).padStart(5, '0')}`,
    user_id: 'user_test_123',
    amount: 10,
    expense_date: '2026-10-01',
    // Every row saved in the same moment: the case where only `id` can keep the order fixed.
    created_at: '2026-10-01T10:00:00.000000+00:00',
    payment_mode: 'upi',
    type: 'expense',
  })) as Expense[];

describe('OPT-70: the expense list is paged with a unique last sort key', () => {
  beforeEach(() => {
    storageMap.clear();
    pageCalls.length = 0;
    useExpenseStore.getState().resetExpenses();
    vi.spyOn(NetInfo, 'fetch').mockResolvedValue({
      type: NetInfoStateType.wifi,
      isConnected: true,
      isInternetReachable: true,
      details: null,
    } as any);
  });

  it('one page: ordered by expense_date, created_at, then id (all newest first)', async () => {
    const rows = makeRows(3);
    servePage = () => ({ data: rows, error: null });

    await useExpenseStore.getState().fetchExpenses();

    const expensePages = pageCalls.filter((c) => c.table === 'expenses');
    expect(expensePages).toHaveLength(1);
    expect(expensePages[0].orders).toEqual(EXPECTED_ORDER);
    expect([expensePages[0].from, expensePages[0].to]).toEqual([0, 999]);
    expect(useExpenseStore.getState().expenses.map((e) => e.id)).toEqual(rows.map((e) => e.id));
  });

  it('many pages: every page uses the same full order, and each row arrives exactly once', async () => {
    const all = makeRows(2001);
    servePage = (from, to) => ({ data: all.slice(from, to + 1), error: null });

    await useExpenseStore.getState().fetchExpenses();

    const expensePages = pageCalls.filter((c) => c.table === 'expenses');
    expect(expensePages.map((c) => [c.from, c.to])).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
    for (const call of expensePages) expect(call.orders).toEqual(EXPECTED_ORDER);

    const ids = useExpenseStore.getState().expenses.map((e) => e.id);
    expect(ids).toHaveLength(2001);
    expect(new Set(ids).size).toBe(2001);
    expect(ids).toEqual(all.map((e) => e.id));
  });
});
