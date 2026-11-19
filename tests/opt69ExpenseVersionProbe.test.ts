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
    multiGet: vi.fn(async (keys: string[]) => keys.map((k) => [k, storageMap.get(k) ?? null])),
    clear: vi.fn(async () => {
      storageMap.clear();
    }),
  },
}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => '10000000-0000-4000-8000-000000000001'),
}));

// Supabase: records the order of calls, serves pages and the version counter.
const calls: string[] = [];
let serverRows: any[] = [];
let rpcAnswer: () => Promise<{ data: unknown; error: unknown }> = async () => ({ data: 0, error: null });
let pageError: unknown = null;

vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn((_table: string) => {
      const query: any = {
        select: () => query,
        eq: () => query,
        or: () => query,
        order: () => query,
        // A queued add cannot reach the server in these tests (network error), so it stays "sync pending".
        upsert: () => ({
          select: () => ({
            maybeSingle: async () => ({ data: null, error: { message: 'Network request failed' } }),
          }),
        }),
        range: async (from: number, to: number) => {
          calls.push(`page:${from}`);
          if (pageError) return { data: null, error: pageError };
          return { data: serverRows.slice(from, to + 1), error: null };
        },
      };
      return query;
    }),
    rpc: vi.fn((name: string, args: Record<string, unknown>) => {
      calls.push(`rpc:${name}:${String(args?.p_user_id)}`);
      return rpcAnswer();
    }),
    auth: {
      getSession: vi.fn(async () => {
        calls.push('sync');
        return { data: { session: { user: { id: 'user_test_123', email: 'test@example.com' } } } };
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

const syncWithExpensesSpy = vi.fn();
vi.mock('../src/store/dailyBudgetStore', () => ({
  useDailyBudgetStore: {
    getState: vi.fn(() => ({
      syncWithExpenses: syncWithExpensesSpy,
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
import { useExpenseStore, Expense, getPendingStorageKey } from '../src/store/expenseStore';
import {
  canReuseExpenseList,
  parseExpensesVersion,
  probeExpensesVersion,
  resetVersionProbeForTests,
} from '../src/store/expense/versionProbe';
import { supabase } from '../src/config/supabase';

const USER = 'user_test_123';
const row = (id: string, amount = 100): Expense =>
  ({ id, user_id: USER, amount, expense_date: '2026-10-01', created_at: '2026-10-01T10:00:00Z', payment_mode: 'upi', type: 'expense' }) as Expense;

const fetch = () => useExpenseStore.getState().fetchExpenses();
const pageCalls = () => calls.filter((c) => c.startsWith('page:')).length;
const rpcCalls = () => calls.filter((c) => c.startsWith('rpc:')).length;
const version = (v: unknown) => {
  rpcAnswer = async () => ({ data: v, error: null });
};

describe('OPT-69: skip the expense download when the server says nothing changed', () => {
  beforeEach(() => {
    storageMap.clear();
    calls.length = 0;
    serverRows = [row('e1'), row('e2', 250)];
    pageError = null;
    version(7);
    vi.clearAllMocks();
    resetVersionProbeForTests();
    useExpenseStore.getState().resetExpenses();
    vi.spyOn(NetInfo, 'fetch').mockResolvedValue({
      type: NetInfoStateType.wifi,
      isConnected: true,
      isInternetReachable: true,
      details: null,
    } as any);
  });

  it('first download of a session sends the same requests as before (no counter request)', async () => {
    await fetch();
    expect(rpcCalls()).toBe(0);
    expect(pageCalls()).toBe(1);
    expect(useExpenseStore.getState().expenses.map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('second fetch reads the counter after sync and before the download; third fetch skips the download', async () => {
    await fetch();
    calls.length = 0;

    await fetch(); // no baseline yet: counter + full download
    expect(calls).toEqual(['sync', `rpc:arthik_expenses_version:${USER}`, 'page:0']);

    const listBefore = useExpenseStore.getState().expenses;
    calls.length = 0;
    syncWithExpensesSpy.mockClear();

    await fetch(); // same counter: nothing downloaded
    expect(calls).toEqual(['sync', `rpc:arthik_expenses_version:${USER}`]);
    expect(useExpenseStore.getState().expenses).toBe(listBefore); // same array, no re-render
    expect(useExpenseStore.getState().loading).toBe(false);
    expect(useExpenseStore.getState().isExpensesLoaded).toBe(true);
    expect(syncWithExpensesSpy).toHaveBeenCalledWith(listBefore);
  });

  it('a changed counter downloads again and shows the new rows; then skips again', async () => {
    await fetch();
    await fetch(); // baseline 7

    serverRows = [row('e3', 75), ...serverRows]; // another phone added an expense
    version(8);
    calls.length = 0;
    await fetch();
    expect(pageCalls()).toBe(1);
    expect(useExpenseStore.getState().expenses.map((e) => e.id)).toEqual(['e3', 'e1', 'e2']);

    calls.length = 0;
    await fetch();
    expect(pageCalls()).toBe(0);
    expect(useExpenseStore.getState().expenses.map((e) => e.id)).toEqual(['e3', 'e1', 'e2']);
  });

  it('a counter of 0 is never trusted (a server without the trigger would always answer 0)', async () => {
    version(0);
    await fetch();
    await fetch();
    calls.length = 0;
    await fetch();
    expect(pageCalls()).toBe(1);
  });

  it('function not installed on the server: downloads as before and stops asking', async () => {
    rpcAnswer = async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.arthik_expenses_version' } });
    await fetch();
    await fetch();
    await fetch();
    await fetch();
    expect(rpcCalls()).toBe(1);
    expect(pageCalls()).toBe(4);
    expect(useExpenseStore.getState().expenses.map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('counter request fails (network): downloads as before and asks again next time', async () => {
    rpcAnswer = async () => ({ data: null, error: { message: 'Network request failed' } });
    await fetch();
    await fetch();
    expect(pageCalls()).toBe(2);

    version(7);
    await fetch(); // counter readable again → baseline
    calls.length = 0;
    await fetch();
    expect(rpcCalls()).toBe(1);
    expect(pageCalls()).toBe(0);
  });

  it('counter request that throws or hangs never blocks the download', async () => {
    rpcAnswer = async () => {
      throw new Error('boom');
    };
    await fetch();
    await fetch();
    expect(pageCalls()).toBe(2);

    vi.useFakeTimers();
    try {
      rpcAnswer = () => new Promise(() => {}); // never answers
      const pending = fetch();
      await vi.advanceTimersByTimeAsync(2600);
      await pending;
    } finally {
      vi.useRealTimers();
    }
    expect(pageCalls()).toBe(3);
  });

  it('a counter whose download failed is never remembered: the next refresh downloads', async () => {
    await fetch();
    await fetch(); // baseline 7
    version(8); // something changed …
    pageError = { message: 'Network request failed' }; // … but the download fails
    await fetch();
    expect(useExpenseStore.getState().loading).toBe(false);

    pageError = null;
    calls.length = 0;
    await fetch(); // counter 8 again, but 8 was never downloaded
    expect(pageCalls()).toBe(1);
    calls.length = 0;
    await fetch();
    expect(pageCalls()).toBe(0);
  });

  it('sign-out (resetExpenses) forgets the baseline', async () => {
    await fetch();
    await fetch(); // baseline 7
    useExpenseStore.getState().resetExpenses();
    calls.length = 0;
    await fetch(); // first download of the new session
    expect(rpcCalls()).toBe(0);
    expect(pageCalls()).toBe(1);
  });

  it('an expense still waiting to sync stays in the list when the download is skipped', async () => {
    await fetch();
    await fetch(); // baseline 7
    const pending = { ...row('p1', 40), pending: true } as Expense;
    useExpenseStore.setState((s) => ({ expenses: [pending, ...s.expenses] }));
    storageMap.set(getPendingStorageKey(USER), JSON.stringify([pending]));
    // The queued add cannot reach the server in this test (the mock answers with a network error), so the counter stays 7.
    calls.length = 0;
    await fetch();
    expect(pageCalls()).toBe(0);
    expect(useExpenseStore.getState().expenses.map((e) => e.id)).toEqual(['p1', 'e1', 'e2']);
  });
});

describe('OPT-69 helpers', () => {
  beforeEach(() => {
    resetVersionProbeForTests();
    calls.length = 0;
  });

  it('canReuseExpenseList: only the same counter, known on both sides, and at least 1', () => {
    expect(canReuseExpenseList(7, 7)).toBe(true);
    expect(canReuseExpenseList(1, 1)).toBe(true);
    expect(canReuseExpenseList(7, 8)).toBe(false);
    expect(canReuseExpenseList(8, 7)).toBe(false);
    expect(canReuseExpenseList(0, 0)).toBe(false);
    expect(canReuseExpenseList(null, 7)).toBe(false);
    expect(canReuseExpenseList(7, null)).toBe(false);
    expect(canReuseExpenseList(undefined, undefined)).toBe(false);
  });

  it('parseExpensesVersion accepts whole numbers only', () => {
    expect(parseExpensesVersion(0)).toBe(0);
    expect(parseExpensesVersion(12)).toBe(12);
    expect(parseExpensesVersion('12')).toBe(12);
    for (const bad of [null, undefined, '', 'abc', '1.5', 1.5, -1, '-1', NaN, Infinity, {}, [], true, 2 ** 60]) {
      expect(parseExpensesVersion(bad), String(bad)).toBeNull();
    }
  });

  it('probeExpensesVersion asks for the signed-in user only and returns null without the function', async () => {
    version('42');
    expect(await probeExpensesVersion(USER)).toBe(42);
    expect(supabase.rpc).toHaveBeenLastCalledWith('arthik_expenses_version', { p_user_id: USER });

    const original = (supabase as any).rpc;
    (supabase as any).rpc = undefined; // a client without rpc (older test mocks)
    try {
      expect(await probeExpensesVersion(USER)).toBeNull();
    } finally {
      (supabase as any).rpc = original;
    }
  });
});
