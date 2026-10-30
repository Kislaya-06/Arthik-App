import { describe, it, expect, beforeEach, vi } from 'vitest';

// OPT-60 shared fetch clock · OPT-61 single download · OPT-64 cache stringify skip ·
// OPT-66 keyset pages · OPT-69 change-version reuse. None of these may change what ends up in the list.

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
    clear: vi.fn(async () => storageMap.clear()),
  },
}));

vi.mock('expo-crypto', () => ({ randomUUID: vi.fn(() => '10000000-0000-4000-8000-000000000001') }));

type Call = { or: string | null; range: [number, number]; orders: string[] };
const net = vi.hoisted(() => ({
  rows: [] as any[],
  calls: [] as Call[],
  rpc: vi.fn(),
  pageGate: null as null | Promise<void>,
}));

vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => {
      const call: Call = { or: null, range: [0, 0], orders: [] };
      const b: any = {
        select: () => b,
        eq: () => b,
        or: (f: string) => {
          call.or = f;
          return b;
        },
        order: (col: string, o: { ascending: boolean }) => {
          call.orders.push(`${col}.${o.ascending ? 'asc' : 'desc'}`);
          return b;
        },
        range: async (from: number, to: number) => {
          call.range = [from, to];
          net.calls.push(call);
          if (net.pageGate) await net.pageGate;
          return { data: servePage(call), error: null };
        },
      };
      return b;
    }),
    rpc: (...args: any[]) => net.rpc(...args),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }) },
  },
}));

// The fake server applies the keyset filter the same way Postgres does, so pagination is really exercised.
function servePage(call: Call): any[] {
  const ordered = [...net.rows].sort(
    (a, b) =>
      b.expense_date.localeCompare(a.expense_date) ||
      (a.created_at === null ? -1 : 0) - (b.created_at === null ? -1 : 0) ||
      (b.created_at || '').localeCompare(a.created_at || '') ||
      b.id.localeCompare(a.id)
  );
  let list = ordered;
  if (call.or) {
    const d = /expense_date\.lt\.([0-9-]+)/.exec(call.or)![1];
    const id = /id\.lt\.([0-9a-f-]+)\)/.exec(call.or)![1];
    const t = /created_at\.lt\."([^"]+)"/.exec(call.or)?.[1] ?? null;
    const idx = ordered.findIndex((r) => r.expense_date === d && r.id === id && (t === null || r.created_at === t));
    list = ordered.slice(idx + 1);
  }
  return list.slice(call.range[0], call.range[1] + 1).map((r) => ({ ...r }));
}

vi.mock('../src/store/authStore', () => ({
  useAuthStore: { getState: vi.fn(() => ({ user: { id: 'u1' } })) },
  registerStoreResetCallback: vi.fn(),
}));

const syncWithExpenses = vi.fn();
vi.mock('../src/store/dailyBudgetStore', () => ({
  useDailyBudgetStore: {
    getState: vi.fn(() => ({
      syncWithExpenses,
      uploadPendingDailyRecords: vi.fn().mockResolvedValue(undefined),
      syncPendingGullakDeposits: vi.fn().mockResolvedValue(undefined),
    })),
  },
  registerExpenseGetter: vi.fn(),
  registerExpensesLoadedGetter: vi.fn(),
  registerAddExpense: vi.fn(),
}));

vi.mock('../src/store/networkStore', () => ({
  useNetworkStore: { getState: vi.fn(() => ({ isOffline: false, setOffline: vi.fn(), triggerOfflineAlert: vi.fn() })) },
  registerSyncCallback: vi.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useExpenseStore, getLastExpensesFetchAt, getCachedStorageKey, getPendingDeletesKey } from '../src/store/expenseStore';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const makeRows = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: uuid(i + 1),
    user_id: 'u1',
    amount: (i % 40) + 1,
    type: 'expense',
    payment_mode: 'upi',
    // few dates and few timestamps => many ties, plus some NULL created_at
    expense_date: `2026-10-0${(i % 3) + 1}`,
    created_at: i % 13 === 0 ? null : `2026-10-01T10:00:00.12345${i % 4}+00:00`,
  }));

const cacheWrites = () =>
  (AsyncStorage.setItem as any).mock.calls.filter((c: any[]) => c[0] === getCachedStorageKey('u1')).length;

beforeEach(() => {
  storageMap.clear();
  vi.clearAllMocks();
  net.rows = makeRows(5);
  net.calls = [];
  net.pageGate = null;
  net.rpc.mockResolvedValue({ data: 7, error: null });
  useExpenseStore.getState().resetExpenses();
});

describe('OPT-60 shared fetch clock', () => {
  it('every fetch stamps one app-wide clock; sign-out resets it', async () => {
    expect(getLastExpensesFetchAt()).toBe(0);
    const before = Date.now();
    await useExpenseStore.getState().fetchExpenses();
    expect(getLastExpensesFetchAt()).toBeGreaterThanOrEqual(before);
    useExpenseStore.getState().resetExpenses();
    expect(getLastExpensesFetchAt()).toBe(0);
  });
});

describe('OPT-61 one download at a time', () => {
  it('two normal calls at the same time share ONE download', async () => {
    let open!: () => void;
    net.pageGate = new Promise<void>((r) => (open = r));
    const a = useExpenseStore.getState().fetchExpenses();
    const b = useExpenseStore.getState().fetchExpenses();
    expect(b).toBe(a);
    open();
    await Promise.all([a, b]);
    expect(net.calls.length).toBe(1);
    expect(useExpenseStore.getState().expenses.length).toBe(5);
  });

  it('a forced refresh always starts its own download and the older one stops (as before)', async () => {
    const a = useExpenseStore.getState().fetchExpenses();
    const b = useExpenseStore.getState().fetchExpenses({ force: true });
    expect(b).not.toBe(a);
    await Promise.all([a, b]);
    // The older call is cancelled by the sequence check before its first page (unchanged behaviour),
    // so only the forced call downloads.
    expect(net.calls.length).toBe(1);
    expect(useExpenseStore.getState().expenses.length).toBe(5);
  });

  it('after a download finishes, the next normal call starts a new one (nothing stays joined)', async () => {
    await useExpenseStore.getState().fetchExpenses();
    await useExpenseStore.getState().fetchExpenses({ force: true });
    expect(net.calls.length).toBe(2);
  });
});

describe('OPT-66 keyset pages', () => {
  it('reads 2,500 rows in 3 keyset pages, same rows and order as one read, no duplicates', async () => {
    net.rows = makeRows(2500);
    await useExpenseStore.getState().fetchExpenses();
    expect(net.calls.length).toBe(3);
    expect(net.calls[0].or).toBeNull();
    expect(net.calls[0].range).toEqual([0, 999]);
    expect(net.calls[1].or).not.toBeNull();
    expect(net.calls[1].range).toEqual([0, 999]); // a cursor page always starts at 0
    expect(net.calls[0].orders).toEqual(['expense_date.desc', 'created_at.desc', 'id.desc']);
    const ids = useExpenseStore.getState().expenses.map((e) => e.id);
    expect(new Set(ids).size).toBe(2500);
    const oneRead = servePage({ or: null, range: [0, 99999], orders: [] }).map((r) => r.id);
    expect(ids).toEqual(oneRead);
  });

  it('a row the cursor cannot describe falls back to the old offset for the next page', async () => {
    net.rows = makeRows(1500);
    // The LAST row of page 1 comes back with a non-UUID id (never happens on the server, but must stay safe).
    const realRange = (await import('../src/config/supabase')).supabase.from as any;
    const original = realRange.getMockImplementation();
    realRange.mockImplementation(() => {
      const b = original();
      const range = b.range;
      b.range = async (from: number, to: number) => {
        const res = await range(from, to);
        if (from === 0 && res.data.length === 1000) res.data[999] = { ...res.data[999], id: 'not a uuid!' };
        return res;
      };
      return b;
    });
    await useExpenseStore.getState().fetchExpenses();
    realRange.mockImplementation(original);
    expect(net.calls[1].or).toBeNull();
    expect(net.calls[1].range).toEqual([1000, 1999]);
    expect(useExpenseStore.getState().expenses.length).toBe(1500);
  });
});

describe('OPT-69 change-version reuse', () => {
  it('first download of a session never asks; the second asks and downloads; the third reuses', async () => {
    await useExpenseStore.getState().fetchExpenses();
    expect(net.rpc).not.toHaveBeenCalled();
    expect(net.calls.length).toBe(1);

    await useExpenseStore.getState().fetchExpenses();
    expect(net.rpc).toHaveBeenCalledTimes(1);
    expect(net.rpc).toHaveBeenCalledWith('arthik_expenses_version', { p_user_id: 'u1' });
    expect(net.calls.length).toBe(2);

    const listBefore = useExpenseStore.getState().expenses;
    const writesBefore = cacheWrites();
    const stringify = vi.spyOn(JSON, 'stringify');
    await useExpenseStore.getState().fetchExpenses();
    const wholeListStringifies = stringify.mock.calls.filter((c) => Array.isArray(c[0]) && c[0].length === 5).length;
    stringify.mockRestore();
    expect(net.rpc).toHaveBeenCalledTimes(2);
    expect(net.calls.length).toBe(2); // no page downloaded
    expect(useExpenseStore.getState().expenses).toBe(listBefore); // same array
    // Only the pending-sync step rewrites the cache (it does that on every fetch, unchanged); fetchExpenses
    // itself neither writes nor even stringifies the list again (OPT-64).
    expect(cacheWrites()).toBe(writesBefore + 1);
    expect(wholeListStringifies).toBe(1);
    expect(JSON.parse(storageMap.get(getCachedStorageKey('u1'))!).length).toBe(5);
    expect(syncWithExpenses).toHaveBeenLastCalledWith(listBefore);
  });

  it('a different version downloads again and shows the new data', async () => {
    await useExpenseStore.getState().fetchExpenses();
    await useExpenseStore.getState().fetchExpenses(); // snapshot at version 7
    net.rows = [...net.rows, { ...makeRows(1)[0], id: uuid(99), expense_date: '2026-10-09' }];
    net.rpc.mockResolvedValue({ data: 8, error: null });
    await useExpenseStore.getState().fetchExpenses();
    expect(net.calls.length).toBe(3);
    expect(useExpenseStore.getState().expenses.map((e) => e.id)).toContain(uuid(99));
  });

  it('a forced refresh never asks and always downloads', async () => {
    await useExpenseStore.getState().fetchExpenses();
    await useExpenseStore.getState().fetchExpenses();
    const rpcCalls = net.rpc.mock.calls.length;
    await useExpenseStore.getState().fetchExpenses({ force: true });
    expect(net.rpc.mock.calls.length).toBe(rpcCalls);
    expect(net.calls.length).toBe(3);
  });

  it('reused rows still go through the pending queues exactly like a download', async () => {
    await useExpenseStore.getState().fetchExpenses();
    await useExpenseStore.getState().fetchExpenses(); // snapshot
    // a delete waiting in the offline queue (it fails to sync: the fake server has no delete)
    storageMap.set(getPendingDeletesKey('u1'), JSON.stringify([uuid(2)]));
    const reused = (async () => {
      await useExpenseStore.getState().fetchExpenses();
      return useExpenseStore.getState().expenses.map((e) => e.id);
    })();
    const viaReuse = await reused;

    // the same situation, forced full download
    await useExpenseStore.getState().fetchExpenses({ force: true });
    const viaDownload = useExpenseStore.getState().expenses.map((e) => e.id);
    expect(viaReuse).toEqual(viaDownload);
  });

  it('no version (error / timeout / SQL not run) means a full download', async () => {
    net.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await useExpenseStore.getState().fetchExpenses();
    await useExpenseStore.getState().fetchExpenses();
    await useExpenseStore.getState().fetchExpenses();
    expect(net.calls.length).toBe(3);
  });

  it('a missing function (PGRST202) is not asked again in this session', async () => {
    net.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'not found' } });
    await useExpenseStore.getState().fetchExpenses();
    await useExpenseStore.getState().fetchExpenses();
    await useExpenseStore.getState().fetchExpenses();
    expect(net.rpc).toHaveBeenCalledTimes(1);
    expect(net.calls.length).toBe(3);
  });

  it('sign-out forgets the snapshot (next user starts fresh)', async () => {
    await useExpenseStore.getState().fetchExpenses();
    await useExpenseStore.getState().fetchExpenses();
    useExpenseStore.getState().resetExpenses();
    await useExpenseStore.getState().fetchExpenses();
    expect(net.calls.length).toBe(3); // first download of the new session: full, no probe
  });
});
