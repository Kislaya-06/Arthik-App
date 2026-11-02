/**
 * OPT-60 .. OPT-64: offline safety round (no money logic touched, no stored format changed).
 * OPT-60 write-ahead queue + save timeout · OPT-61 queue lock · OPT-62 idempotent add + offline copy
 * OPT-63 stale-cache guard (tested in dailyBudgetHydrate.test.ts) · OPT-64 1,000-row paging guard
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory AsyncStorage with a small delay, so overlapping read→write races can actually happen.
const storageMap = new Map<string, string>();
const tick = () => new Promise((r) => setTimeout(r, 1));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => {
      await tick();
      return storageMap.get(key) ?? null;
    }),
    setItem: vi.fn(async (key: string, val: string) => {
      await tick();
      storageMap.set(key, val);
    }),
    removeItem: vi.fn(async (key: string) => {
      storageMap.delete(key);
    }),
    multiGet: vi.fn(async (keys: string[]) => keys.map((k) => [k, storageMap.get(k) ?? null])),
  },
}));

let uuidCounter = 1;
vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => `60000000-0000-4000-8000-${String(uuidCounter++).padStart(12, '0')}`),
}));

// Supabase: each test decides what the add request does.
let upsertImpl: (payload: any) => Promise<{ data: any; error: any }> = async (payload) => ({ data: payload, error: null });
const mockUpsert = vi.fn((payload: any) => ({
  select: () => ({ maybeSingle: () => upsertImpl(payload), single: () => upsertImpl(payload) }),
}));
let updateImpl: () => Promise<{ error: any }> = async () => ({ error: null });
const mockUpdate = vi.fn(() => ({ eq: vi.fn(() => updateImpl()) }));
let deleteImpl: () => Promise<{ error: any }> = async () => ({ error: null });
const mockDelete = vi.fn(() => ({ eq: vi.fn(() => deleteImpl()) }));

vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: mockUpsert,
      update: mockUpdate,
      delete: mockDelete,
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u_opt60' } } } }) },
  },
}));

vi.mock('../src/store/authStore', () => ({
  useAuthStore: { getState: vi.fn(() => ({ user: { id: 'u_opt60' } })) },
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

let mockIsOffline = false;
const setOfflineSpy = vi.fn((v: boolean) => {
  mockIsOffline = v;
});
const offlineAlertSpy = vi.fn();
vi.mock('../src/store/networkStore', () => ({
  useNetworkStore: {
    getState: vi.fn(() => ({
      isOffline: mockIsOffline,
      setOffline: setOfflineSpy,
      triggerOfflineAlert: offlineAlertSpy,
    })),
  },
  registerSyncCallback: vi.fn(),
}));

import { runExclusive } from '../src/lib/queueLock';
import { fetchAllPages } from '../src/lib/supabasePaging';
import {
  enqueuePendingDelete,
  removePendingDelete,
  readPendingUpdate,
  savePendingUpdateOffline,
  settlePendingUpdate,
  removePendingAddIfUnchanged,
  stableStringify,
} from '../src/store/expense/pendingQueues';
import { useExpenseStore, SAVE_TIMEOUT_MS } from '../src/store/expenseStore';
import { areExpensesFreshFromServer } from '../src/store/dailyBudget/expenseBridge';

const USER = 'u_opt60';
const ADDS = `@arthik_pending_expenses_${USER}`;
const UPDATES = `@arthik_pending_updates_${USER}`;
const DELETES = `@arthik_pending_deletes_${USER}`;
const CACHE = `@arthik_cached_expenses_${USER}`;
const read = (k: string) => JSON.parse(storageMap.get(k) || '[]');

beforeEach(() => {
  storageMap.clear();
  vi.clearAllMocks();
  vi.useRealTimers();
  mockIsOffline = false;
  uuidCounter = 1;
  upsertImpl = async (payload) => ({ data: payload, error: null });
  updateImpl = async () => ({ error: null });
  deleteImpl = async () => ({ error: null });
  useExpenseStore.getState().resetExpenses();
});

describe('OPT-61: queue lock', () => {
  it('ten overlapping read→change→write calls on one key keep all ten items', async () => {
    const key = 'k';
    storageMap.set(key, '[]');
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        runExclusive(key, async () => {
          const list = JSON.parse((await AsyncStorage.getItem(key)) || '[]');
          list.push(i);
          await AsyncStorage.setItem(key, JSON.stringify(list));
        })
      )
    );
    expect(read(key)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('a failing writer does not block the next one', async () => {
    await expect(runExclusive('x', async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(runExclusive('x', async () => 7)).resolves.toBe(7);
  });

  it('savePendingUpdateOffline calls that overlap keep every edit (merged, newest wins)', async () => {
    await Promise.all([
      savePendingUpdateOffline(USER, 'a', { amount: 1 } as any),
      savePendingUpdateOffline(USER, 'b', { amount: 2 } as any),
      savePendingUpdateOffline(USER, 'a', { note: 'n' } as any),
    ]);
    const list = read(UPDATES);
    expect(list.find((u: any) => u.id === 'a').payload).toEqual({ amount: 1, note: 'n' });
    expect(list.find((u: any) => u.id === 'b').payload).toEqual({ amount: 2 });
  });
});

describe('OPT-60 helpers: queue entries are only removed when they are still what was written', () => {
  it('removePendingAddIfUnchanged keeps an entry that was edited meanwhile', async () => {
    const e: any = { id: 'x1', user_id: USER, amount: 10, pending: true };
    storageMap.set(ADDS, JSON.stringify([{ ...e, amount: 99 }]));
    await removePendingAddIfUnchanged(USER, e);
    expect(read(ADDS)).toHaveLength(1);
    storageMap.set(ADDS, JSON.stringify([e]));
    await removePendingAddIfUnchanged(USER, e);
    expect(read(ADDS)).toHaveLength(0);
  });

  it('settlePendingUpdate restores the older entry, removes when none, and leaves a changed entry alone', async () => {
    storageMap.set(UPDATES, JSON.stringify([{ id: 'u', payload: { amount: 5, note: 'n' } }]));
    await settlePendingUpdate(USER, 'u', { amount: 5, note: 'n' } as any, { id: 'u', payload: { note: 'n' } } as any);
    expect(read(UPDATES)).toEqual([{ id: 'u', payload: { note: 'n' } }]);
    await settlePendingUpdate(USER, 'u', { note: 'n' } as any, null);
    expect(read(UPDATES)).toEqual([]);
    storageMap.set(UPDATES, JSON.stringify([{ id: 'u', payload: { amount: 7 } }]));
    await settlePendingUpdate(USER, 'u', { amount: 5 } as any, null);
    expect(read(UPDATES)).toEqual([{ id: 'u', payload: { amount: 7 } }]);
  });

  it('enqueuePendingDelete reports whether it added the id; removePendingDelete takes it out', async () => {
    expect(await enqueuePendingDelete(USER, 'd')).toBe(true);
    expect(await enqueuePendingDelete(USER, 'd')).toBe(false);
    expect(read(DELETES)).toHaveLength(1);
    await removePendingDelete(USER, 'd');
    expect(read(DELETES)).toHaveLength(0);
  });

  it('readPendingUpdate returns the queued entry or null; stableStringify ignores key order', async () => {
    expect(await readPendingUpdate(USER, 'none')).toBeNull();
    expect(stableStringify({ a: 1, b: { c: 2, d: 3 } })).toBe(stableStringify({ b: { d: 3, c: 2 }, a: 1 }));
  });
});

describe('OPT-60 / OPT-62: addExpense online', () => {
  it('is in the offline queue WHILE the request is in flight, and gone after the server confirms', async () => {
    let release!: () => void;
    upsertImpl = (payload) =>
      new Promise((resolve) => {
        release = () => resolve({ data: payload, error: null });
      });
    useExpenseStore.setState({ isExpensesLoaded: true }); // list already loaded (normal app state)
    const saving = useExpenseStore.getState().addExpense(120, null, 'Lunch', 'upi', '2026-10-31', 'expense');
    await vi.waitFor(() => expect(mockUpsert).toHaveBeenCalled());
    expect(read(ADDS)).toHaveLength(1); // written ahead: an app kill now loses nothing
    release();
    await saving;
    expect(read(ADDS)).toHaveLength(0);
    expect(useExpenseStore.getState().expenses[0].pending).toBe(false);
    await vi.waitFor(() => expect(read(CACHE).map((e: any) => e.amount)).toEqual([120]));
  });

  it('a row that is already on the server (ignored duplicate, data = null) counts as saved, not as a failure', async () => {
    upsertImpl = async () => ({ data: null, error: null });
    await useExpenseStore.getState().addExpense(50, null, 'Tea', 'cash', '2026-10-31', 'expense');
    const [e] = useExpenseStore.getState().expenses;
    expect(e.pending).toBe(false);
    expect(e.amount).toBe(50);
    expect(read(ADDS)).toHaveLength(0);
  });

  it('a refused save is taken out of the queue and rolled back (as before)', async () => {
    upsertImpl = async () => ({ data: null, error: { message: 'check constraint', status: 400 } });
    await expect(
      useExpenseStore.getState().addExpense(5, null, 'x', 'cash', '2026-10-31', 'expense')
    ).rejects.toBeTruthy();
    expect(useExpenseStore.getState().expenses).toHaveLength(0);
    expect(read(ADDS)).toHaveLength(0);
  });

  it('a hanging request stops waiting after SAVE_TIMEOUT_MS: stays pending + queued, no offline mode, no banner', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let release!: () => void;
    upsertImpl = (payload) =>
      new Promise((resolve) => {
        release = () => resolve({ data: payload, error: null });
      });
    const saving = useExpenseStore.getState().addExpense(70, null, 'Cab', 'upi', '2026-10-31', 'expense');
    await vi.advanceTimersByTimeAsync(50); // queue writes
    await vi.advanceTimersByTimeAsync(SAVE_TIMEOUT_MS);
    await saving;
    expect(useExpenseStore.getState().expenses[0].pending).toBe(true);
    expect(read(ADDS)).toHaveLength(1);
    expect(setOfflineSpy).not.toHaveBeenCalled();
    expect(offlineAlertSpy).not.toHaveBeenCalled();

    // The late answer still counts.
    release();
    await vi.advanceTimersByTimeAsync(50);
    expect(useExpenseStore.getState().expenses[0].pending).toBe(false);
    expect(read(ADDS)).toHaveLength(0);
  });

  it('deleting a timed-out add before its late answer also queues the server delete', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let release!: () => void;
    upsertImpl = (payload) =>
      new Promise((resolve) => {
        release = () => resolve({ data: payload, error: null });
      });
    const saving = useExpenseStore.getState().addExpense(70, null, 'Cab', 'upi', '2026-10-31', 'expense');
    await vi.advanceTimersByTimeAsync(SAVE_TIMEOUT_MS + 50);
    await saving;
    const id = useExpenseStore.getState().expenses[0].id;
    const deleting = useExpenseStore.getState().deleteExpense(id);
    await vi.advanceTimersByTimeAsync(50);
    await deleting;
    expect(read(DELETES).map((d: any) => d.id)).toContain(id);
    release(); // insert lands late: the queued delete still removes it on the next sync
    await vi.advanceTimersByTimeAsync(50);
    expect(read(DELETES).map((d: any) => d.id)).toContain(id);
    expect(useExpenseStore.getState().expenses).toHaveLength(0);
  });
});

describe('OPT-60: updateExpense / deleteExpense online', () => {
  const seed = () =>
    useExpenseStore.setState({
      expenses: [
        { id: 'e1', user_id: USER, amount: 10, note: '', payment_mode: 'cash', expense_date: '2026-10-30', type: 'expense', category_id: null } as any,
      ],
    });

  it('edit: queued while in flight, cleared after success', async () => {
    seed();
    let release!: () => void;
    updateImpl = () => new Promise((r) => (release = () => r({ error: null })));
    const saving = useExpenseStore.getState().updateExpense('e1', 20, null, '', 'cash', '2026-10-30', 'expense');
    await vi.waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(read(UPDATES)).toHaveLength(1);
    release();
    await saving;
    expect(read(UPDATES)).toHaveLength(0);
  });

  it('edit with an older queued edit: the merged entry stays queued (older fields still have to be sent)', async () => {
    seed();
    storageMap.set(UPDATES, JSON.stringify([{ id: 'e1', payload: { category_id: null, note: 'old' } }]));
    await useExpenseStore.getState().updateExpense('e1', 20, undefined, 'new', 'cash', '2026-10-30', 'expense');
    const [entry] = read(UPDATES);
    expect(entry.payload.note).toBe('new');
    expect(entry.payload.amount).toBe(20);
    expect(entry.payload.category_id).toBeNull();
  });

  it('refused edit: queue put back exactly as before, and the change is rolled back', async () => {
    seed();
    const before = [{ id: 'e1', payload: { note: 'older' } }];
    storageMap.set(UPDATES, JSON.stringify(before));
    updateImpl = async () => ({ error: { message: 'denied', status: 403 } });
    await expect(
      useExpenseStore.getState().updateExpense('e1', 20, null, '', 'cash', '2026-10-30', 'expense')
    ).rejects.toBeTruthy();
    expect(read(UPDATES)).toEqual(before);
    expect(useExpenseStore.getState().expenses[0].amount).toBe(10);
  });

  it('delete: queued while in flight, cleared after success; refused delete is taken out and rolled back', async () => {
    seed();
    let release!: () => void;
    deleteImpl = () => new Promise((r) => (release = () => r({ error: null })));
    const del = useExpenseStore.getState().deleteExpense('e1');
    await vi.waitFor(() => expect(mockDelete).toHaveBeenCalled());
    expect(read(DELETES)).toHaveLength(1);
    release();
    await del;
    expect(read(DELETES)).toHaveLength(0);

    seed();
    deleteImpl = async () => ({ error: { message: 'fk', status: 409 } });
    await expect(useExpenseStore.getState().deleteExpense('e1')).rejects.toBeTruthy();
    expect(read(DELETES)).toHaveLength(0);
    expect(useExpenseStore.getState().expenses).toHaveLength(1);
  });
});

describe('OPT-61: sync keeps an edit that arrived while the older one was being sent', () => {
  it('a newer merged edit is not dropped when the older payload is confirmed', async () => {
    storageMap.set(UPDATES, JSON.stringify([{ id: 'e9', payload: { amount: 100 } }]));
    updateImpl = async () => {
      // the user edits again while the sync is sending the older value
      await savePendingUpdateOffline(USER, 'e9', { amount: 200 } as any);
      return { error: null };
    };
    await useExpenseStore.getState().syncPendingExpenses();
    expect(read(UPDATES)).toEqual([{ id: 'e9', payload: { amount: 200 } }]);
  });
});

describe('OPT-62: the offline copy is never replaced by a partial list', () => {
  it('no cache write while the list has not been loaded yet', async () => {
    storageMap.set(CACHE, JSON.stringify([{ id: 'old1' }, { id: 'old2' }]));
    await useExpenseStore.getState().addExpense(9, null, 'x', 'cash', '2026-10-31', 'expense');
    await new Promise((r) => setTimeout(r, 30));
    expect(read(CACHE).map((e: any) => e.id)).toEqual(['old1', 'old2']);
  });
});

describe('OPT-62: one expense is never shown twice after a cold start', () => {
  it('cache rows already in the pending list are skipped', async () => {
    const row = { id: 'dup', user_id: USER, amount: 10, expense_date: '2026-10-31', type: 'expense' };
    storageMap.set(ADDS, JSON.stringify([{ ...row, pending: true }]));
    storageMap.set(CACHE, JSON.stringify([row, { ...row, id: 'other' }]));
    mockIsOffline = true;
    await useExpenseStore.getState().loadPendingExpenses();
    await useExpenseStore.getState().fetchExpenses();
    const ids = useExpenseStore.getState().expenses.map((e) => e.id);
    expect(ids).toEqual(['dup', 'other']);
  });
});

describe('OPT-63: fresh-from-server flag', () => {
  it('is false after sign-out / cache-only load, true after a server fetch', async () => {
    expect(areExpensesFreshFromServer()).toBe(false);
    mockIsOffline = true;
    await useExpenseStore.getState().fetchExpenses();
    expect(areExpensesFreshFromServer()).toBe(false);
    mockIsOffline = false;
    await useExpenseStore.getState().fetchExpenses();
    expect(areExpensesFreshFromServer()).toBe(true);
    useExpenseStore.getState().resetExpenses();
    expect(areExpensesFreshFromServer()).toBe(false);
  });
});

describe('OPT-64: 1,000-row paging guard', () => {
  const makeQuery = (rows: number[], calls: any[], failFrom?: number) => () => {
    const q: any = {
      orders: [] as string[],
      order(col: string) {
        q.orders.push(col);
        return q;
      },
      range: async (from: number, to: number) => {
        calls.push({ from, to, orders: [...q.orders] });
        if (failFrom !== undefined && from >= failFrom) return { data: null, error: new Error('x') };
        return { data: rows.slice(from, to + 1), error: null };
      },
      then: undefined,
    };
    return q;
  };

  it('below 1,000 rows: exactly one request, same rows', async () => {
    const calls: any[] = [];
    const res = await fetchAllPages(makeQuery([1, 2, 3], calls), { tieBreaker: 'id', pageSize: 5 });
    expect(res.data).toEqual([1, 2, 3]);
    expect(calls).toHaveLength(1);
    expect(calls[0].orders).toEqual([]);
  });

  it('full first page: reads everything with the tie-breaker', async () => {
    const calls: any[] = [];
    const rows = Array.from({ length: 12 }, (_, i) => i);
    const res = await fetchAllPages(makeQuery(rows, calls), { tieBreaker: 'id', pageSize: 5 });
    expect(res.data).toEqual(rows);
    expect(calls.slice(1).every((c) => c.orders.includes('id'))).toBe(true);
  });

  it('a later page failing returns the first page (exactly the old result)', async () => {
    const calls: any[] = [];
    const rows = Array.from({ length: 12 }, (_, i) => i);
    const res = await fetchAllPages(makeQuery(rows, calls, 5), { pageSize: 5 });
    expect(res.data).toEqual([0, 1, 2, 3, 4]);
  });
});
