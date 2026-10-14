import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ─── 1. Setup in-memory AsyncStorage ──────────────────────────────────────────
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

// ─── 2. Mock expo-crypto ─────────────────────────────────────────────────────
let uuidCounter = 1;
vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => `a0000000-0000-4000-8000-${String(uuidCounter++).padStart(12, '0')}`),
}));

// ─── 3. Spy & tracking for side-effect call order ─────────────────────────────
const callOrder: string[] = [];

let onUpsertHook: (() => Promise<void>) | null = null;
const mockUpsert = vi.fn((payload: any, _options: any) => {
  callOrder.push('supabase:upsert');
  return {
    select: vi.fn().mockReturnValue({
      single: vi.fn(async () => {
        if (onUpsertHook) await onUpsertHook();
        return { data: { ...payload, pending: false }, error: null };
      }),
    }),
  };
});

let onUpdateHook: (() => Promise<void>) | null = null;
const mockUpdate = vi.fn((_payload: any) => {
  callOrder.push('supabase:update');
  return {
    eq: vi.fn(async (_col: string, _val: any) => {
      if (onUpdateHook) await onUpdateHook();
      return { error: null };
    }),
  };
});

let onDeleteHook: (() => Promise<void>) | null = null;
const mockDelete = vi.fn(() => ({
  eq: vi.fn(async (_col: string, _val: any) => {
    callOrder.push('supabase:delete');
    if (onDeleteHook) await onDeleteHook();
    return { error: null };
  }),
}));

const mockProfilesUpdate = vi.fn((payload: any) => ({
  eq: vi.fn(async (_col: string, _val: any) => {
    if (payload.daily_budget !== undefined || payload.is_auto_renew !== undefined) {
      callOrder.push('supabase:settings');
    } else {
      callOrder.push('supabase:profile');
    }
    return { error: null };
  }),
}));

let mockUser: { id: string; email: string } | null = { id: 'user_sync_test', email: 'sync@example.com' };

vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return { update: mockProfilesUpdate };
      }
      return {
        delete: mockDelete,
        upsert: mockUpsert,
        update: mockUpdate,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }),
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: mockUser ? { user: mockUser } : null },
      })),
    },
  },
}));

// ─── 4. Mock AuthStore ───────────────────────────────────────────────────────
vi.mock('../src/store/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      user: mockUser,
    })),
  },
  registerStoreResetCallback: vi.fn(),
}));

// ─── 5. Mock DailyBudgetStore ─────────────────────────────────────────────────
const mockUploadPendingDailyRecords = vi.fn(async () => {
  callOrder.push('dailyBudget:uploadDailyRecords');
});
const mockSyncPendingGullakDeposits = vi.fn(async () => {
  callOrder.push('dailyBudget:syncGullakDeposits');
});
const mockSyncWithExpenses = vi.fn((_expenses: any) => {
  callOrder.push('dailyBudget:syncWithExpenses');
});

vi.mock('../src/store/dailyBudgetStore', () => ({
  useDailyBudgetStore: {
    getState: vi.fn(() => ({
      uploadPendingDailyRecords: mockUploadPendingDailyRecords,
      syncPendingGullakDeposits: mockSyncPendingGullakDeposits,
      syncWithExpenses: mockSyncWithExpenses,
    })),
  },
  registerExpenseGetter: vi.fn(),
  registerExpensesLoadedGetter: vi.fn(),
}));

// ─── 6. Mock CategoryStore ───────────────────────────────────────────────────
const mockSyncPendingCategories = vi.fn(async () => {
  callOrder.push('category:syncCategories');
});

vi.mock('../src/store/categoryStore', () => ({
  useCategoryStore: {
    getState: vi.fn(() => ({
      categories: [],
      syncPendingCategories: mockSyncPendingCategories,
    })),
  },
  registerCategoryDeleteCallback: vi.fn(),
}));

// ─── 7. Mock NetworkStore ────────────────────────────────────────────────────
let mockIsOffline = false;
vi.mock('../src/store/networkStore', () => ({
  useNetworkStore: {
    getState: vi.fn(() => ({
      isOffline: mockIsOffline,
      setOffline: vi.fn((val: boolean) => {
        mockIsOffline = val;
      }),
      triggerOfflineAlert: vi.fn(),
    })),
  },
  registerSyncCallback: vi.fn(),
}));

import { useExpenseStore, Expense } from '../src/store/expenseStore';

describe('expenseSyncPending (Seam: syncPendingExpenses)', () => {
  const TEST_UID = 'user_sync_test';
  const PENDING_ADDS_KEY = `@arthik_pending_expenses_${TEST_UID}`;
  const PENDING_DELETES_KEY = `@arthik_pending_deletes_${TEST_UID}`;
  const PENDING_UPDATES_KEY = `@arthik_pending_updates_${TEST_UID}`;
  const PENDING_SETTINGS_KEY = `@arthik_pending_settings_${TEST_UID}`;
  const PENDING_PROFILE_KEY = `@arthik_pending_profile_${TEST_UID}`;
  const CACHED_EXPENSES_KEY = `@arthik_cached_expenses_${TEST_UID}`;
  const FAILED_SYNC_KEY = `@arthik_failed_sync_${TEST_UID}`;

  beforeEach(() => {
    storageMap.clear();
    callOrder.length = 0;
    vi.clearAllMocks();
    mockUser = { id: TEST_UID, email: 'sync@example.com' };
    mockIsOffline = false;
    onUpsertHook = null;
    onUpdateHook = null;
    onDeleteHook = null;

    useExpenseStore.setState({
      expenses: [],
      failedSyncItems: [],
      loading: false,
      isExpensesLoaded: true,
      transactionType: 'expense',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Case A: Sequence of side effects ─────────────────────────────────────
  it('A. executes queues in strict sequential order: deletes -> adds -> updates -> settings -> daily records -> gullak -> categories -> profile -> cache write & store sync', async () => {
    // 1 delete
    storageMap.set(PENDING_DELETES_KEY, JSON.stringify(['del-1']));
    // 1 add
    const addExpense: Expense = {
      id: 'a0000000-0000-4000-8000-000000000001',
      user_id: TEST_UID,
      amount: 150,
      note: 'Coffee',
      payment_mode: 'upi',
      expense_date: '2026-10-14',
      type: 'expense',
      category_id: null,
      pending: true,
    };
    storageMap.set(PENDING_ADDS_KEY, JSON.stringify([addExpense]));
    useExpenseStore.setState({ expenses: [addExpense] });
    // 1 update
    storageMap.set(
      PENDING_UPDATES_KEY,
      JSON.stringify([{ id: 'upd-1', payload: { amount: 200, note: 'Updated Coffee' } }])
    );
    // 1 settings
    storageMap.set(PENDING_SETTINGS_KEY, JSON.stringify({ daily_budget: 300, is_auto_renew: true }));
    // 1 profile
    storageMap.set(PENDING_PROFILE_KEY, JSON.stringify({ full_name: 'Arthik User' }));

    await useExpenseStore.getState().syncPendingExpenses();

    expect(callOrder).toEqual([
      'supabase:delete',
      'supabase:upsert',
      'supabase:update',
      'supabase:settings',
      'dailyBudget:uploadDailyRecords',
      'dailyBudget:syncGullakDeposits',
      'category:syncCategories',
      'supabase:profile',
      'dailyBudget:syncWithExpenses',
    ]);

    // Cache was written with confirmed expense
    const cached = JSON.parse(storageMap.get(CACHED_EXPENSES_KEY) || '[]');
    expect(cached.length).toBe(1);
    expect(cached[0].id).toBe(addExpense.id);
    expect(cached[0].pending).toBe(false);

    // Settings and profile pending keys were cleared on success
    expect(storageMap.get(PENDING_SETTINGS_KEY)).toBeUndefined();
    expect(storageMap.get(PENDING_PROFILE_KEY)).toBeUndefined();
  });

  // ─── Case B: Deletes error handling & backoff ─────────────────────────────
  it('B. deletes: success clears queue; network error keeps item with incremented retry count; skips within backoff; moves to failed-sync after 5 retries', async () => {
    vi.useFakeTimers();
    const startTime = 1000000;
    vi.setSystemTime(startTime);

    // 1. Success delete
    storageMap.set(PENDING_DELETES_KEY, JSON.stringify(['del-success']));
    await useExpenseStore.getState().syncPendingExpenses();
    const remainingAfterSuccess = JSON.parse(storageMap.get(PENDING_DELETES_KEY) || '[]');
    expect(remainingAfterSuccess).toEqual([]);

    // 2. Network error delete
    mockDelete.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValueOnce({
        error: { message: 'network request failed', status: 0 },
      }),
    });
    storageMap.set(PENDING_DELETES_KEY, JSON.stringify(['del-network-fail']));
    await useExpenseStore.getState().syncPendingExpenses();

    const queueAfterFail = JSON.parse(storageMap.get(PENDING_DELETES_KEY) || '[]');
    expect(queueAfterFail).toHaveLength(1);
    expect(queueAfterFail[0].id).toBe('del-network-fail');
    expect(queueAfterFail[0].retryCount).toBe(1);
    expect(queueAfterFail[0].lastRetryAt).toBe(startTime);

    // 3. Next immediate call inside backoff (delay for retry 1 is 5000ms; advance only 1000ms)
    vi.advanceTimersByTime(1000);
    callOrder.length = 0;
    await useExpenseStore.getState().syncPendingExpenses();
    // Delete was skipped because within backoff window
    expect(callOrder).not.toContain('supabase:delete');

    // 4. Exhaust 5 retries -> moves to failed-sync
    storageMap.set(
      PENDING_DELETES_KEY,
      JSON.stringify([{ id: 'del-exhaust', retryCount: 4, lastRetryAt: 0 }])
    );
    mockDelete.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValueOnce({
        error: { message: 'network request failed', status: 0 },
      }),
    });
    await useExpenseStore.getState().syncPendingExpenses();

    const finalDeletes = JSON.parse(storageMap.get(PENDING_DELETES_KEY) || '[]');
    expect(finalDeletes.find((d: any) => d.id === 'del-exhaust')).toBeUndefined();
    const failedItems = JSON.parse(storageMap.get(FAILED_SYNC_KEY) || '[]');
    expect(failedItems.some((f: any) => f.id === 'del-exhaust' && f.type === 'delete')).toBe(true);
  });

  // ─── Case C: Adds upsert params & fake category handling ──────────────────
  it('C. adds: calls upsert with onConflict: "id" and ignoreDuplicates: true; clears pending flag; purges fake category id ("1".."7")', async () => {
    const validExpense: Expense = {
      id: 'b0000000-0000-4000-8000-000000000002',
      user_id: TEST_UID,
      amount: 450,
      note: 'Lunch',
      payment_mode: 'card',
      expense_date: '2026-10-14',
      type: 'expense',
      category_id: 'c0000000-0000-4000-8000-000000000003',
      pending: true,
    };
    const fakeCatExpense: Expense = {
      id: 'b0000000-0000-4000-8000-000000000004',
      user_id: TEST_UID,
      amount: 99,
      note: 'Legacy Fake Category',
      payment_mode: 'cash',
      expense_date: '2026-10-14',
      type: 'expense',
      category_id: '3', // fake non-UUID
      pending: true,
    };

    storageMap.set(PENDING_ADDS_KEY, JSON.stringify([validExpense, fakeCatExpense]));
    useExpenseStore.setState({ expenses: [validExpense, fakeCatExpense] });

    await useExpenseStore.getState().syncPendingExpenses();

    // Verify upsert was called with onConflict 'id' and ignoreDuplicates true
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: validExpense.id }),
      { onConflict: 'id', ignoreDuplicates: true }
    );

    // Fake category item was purged from queue and from store state
    const remainingAdds = JSON.parse(storageMap.get(PENDING_ADDS_KEY) || '[]');
    expect(remainingAdds).toEqual([]);
    const stateExpenses = useExpenseStore.getState().expenses;
    expect(stateExpenses.find((e) => e.id === fakeCatExpense.id)).toBeUndefined();
    // Valid item has pending: false in store
    const confirmedValid = stateExpenses.find((e) => e.id === validExpense.id);
    expect(confirmedValid?.pending).toBe(false);

    // Fake category item moved to failed-sync
    const failedSync = JSON.parse(storageMap.get(FAILED_SYNC_KEY) || '[]');
    expect(failedSync.some((f: any) => f.id === fakeCatExpense.id && f.errorReason.includes('Invalid category'))).toBe(true);
  });

  // ─── Case D: Adds network failure vs non-network error ─────────────────────
  it('D. adds: network failure keeps item queued without moving to failed-sync; non-network error removes from queue and moves to failed-sync', async () => {
    const netFailItem: Expense = {
      id: 'd0000000-0000-4000-8000-000000000001',
      user_id: TEST_UID,
      amount: 100,
      note: 'Net Fail',
      payment_mode: 'upi',
      expense_date: '2026-10-14',
      type: 'expense',
      category_id: null,
      pending: true,
    };
    const dbRejectItem: Expense = {
      id: 'd0000000-0000-4000-8000-000000000002',
      user_id: TEST_UID,
      amount: 200,
      note: 'DB Reject',
      payment_mode: 'upi',
      expense_date: '2026-10-14',
      type: 'expense',
      category_id: null,
      pending: true,
    };

    // 1. Network failure
    mockUpsert.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'network request failed', status: 0 },
        }),
      }),
    } as any);

    storageMap.set(PENDING_ADDS_KEY, JSON.stringify([netFailItem]));
    useExpenseStore.setState({ expenses: [netFailItem] });
    await useExpenseStore.getState().syncPendingExpenses();

    const queueAfterNetFail = JSON.parse(storageMap.get(PENDING_ADDS_KEY) || '[]');
    expect(queueAfterNetFail).toHaveLength(1);
    expect(queueAfterNetFail[0].id).toBe(netFailItem.id);
    expect(queueAfterNetFail[0].retryCount).toBe(1);
    // NOT moved to failed sync
    const failedAfterNet = JSON.parse(storageMap.get(FAILED_SYNC_KEY) || '[]');
    expect(failedAfterNet.find((f: any) => f.id === netFailItem.id)).toBeUndefined();

    // 2. Permanent DB rejection (e.g. 400 check constraint)
    mockUpsert.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'check constraint violation: amount must be > 0', status: 400 },
        }),
      }),
    } as any);

    storageMap.set(PENDING_ADDS_KEY, JSON.stringify([dbRejectItem]));
    useExpenseStore.setState({ expenses: [dbRejectItem] });
    await useExpenseStore.getState().syncPendingExpenses();

    const queueAfterDbReject = JSON.parse(storageMap.get(PENDING_ADDS_KEY) || '[]');
    expect(queueAfterDbReject.find((e: any) => e.id === dbRejectItem.id)).toBeUndefined();
    const failedAfterDb = JSON.parse(storageMap.get(FAILED_SYNC_KEY) || '[]');
    expect(failedAfterDb.some((f: any) => f.id === dbRejectItem.id)).toBe(true);
  });

  // ─── Case E: Updates success and failure handling ─────────────────────────
  it('E. updates: success clears from queue; network failure keeps item queued with incremented retry', async () => {
    const successUpd = { id: 'upd-ok', payload: { amount: 350 } };
    const failUpd = { id: 'upd-fail', payload: { amount: 500 } };

    mockUpdate.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValueOnce({ error: null }),
    } as any);
    mockUpdate.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValueOnce({
        error: { message: 'network request failed', status: 0 },
      }),
    } as any);

    storageMap.set(PENDING_UPDATES_KEY, JSON.stringify([successUpd, failUpd]));
    await useExpenseStore.getState().syncPendingExpenses();

    const remainingUpdates = JSON.parse(storageMap.get(PENDING_UPDATES_KEY) || '[]');
    expect(remainingUpdates.find((u: any) => u.id === 'upd-ok')).toBeUndefined();
    const failedUpdate = remainingUpdates.find((u: any) => u.id === 'upd-fail');
    expect(failedUpdate).toBeDefined();
    expect(failedUpdate.retryCount).toBe(1);
  });

  // ─── Case F: P0.12 Concurrency safety (re-read before save) ───────────────
  it('F. P0.12 concurrency: preserves newly queued deletes, adds, and updates added while sync is in-flight', async () => {
    // 1. Adds concurrency test
    const inFlightAdd: Expense = {
      id: 'f0000000-0000-4000-8000-000000000001',
      user_id: TEST_UID,
      amount: 100,
      note: 'In Flight Add',
      payment_mode: 'upi',
      expense_date: '2026-10-14',
      type: 'expense',
      category_id: null,
      pending: true,
    };
    const concurrentAdd: Expense = {
      id: 'f0000000-0000-4000-8000-000000000002',
      user_id: TEST_UID,
      amount: 200,
      note: 'Concurrent Add While Syncing',
      payment_mode: 'cash',
      expense_date: '2026-10-14',
      type: 'expense',
      category_id: null,
      pending: true,
    };

    storageMap.set(PENDING_ADDS_KEY, JSON.stringify([inFlightAdd]));
    useExpenseStore.setState({ expenses: [inFlightAdd] });

    onUpsertHook = async () => {
      // Simulate user adding a new expense concurrently while upsert promise is active
      const current = JSON.parse(storageMap.get(PENDING_ADDS_KEY) || '[]');
      storageMap.set(PENDING_ADDS_KEY, JSON.stringify([...current, concurrentAdd]));
    };

    await useExpenseStore.getState().syncPendingExpenses();

    // The in-flight add synced and was removed, but concurrentAdd MUST still be in the queue
    const remainingAdds = JSON.parse(storageMap.get(PENDING_ADDS_KEY) || '[]');
    expect(remainingAdds.some((e: any) => e.id === inFlightAdd.id)).toBe(false);
    expect(remainingAdds.some((e: any) => e.id === concurrentAdd.id)).toBe(true);
  });

  it('F2. P0.12 concurrency for deletes: preserves concurrent delete queued during sync', async () => {
    storageMap.set(PENDING_DELETES_KEY, JSON.stringify(['del-in-flight']));

    onDeleteHook = async () => {
      // User deletes another item concurrently
      const current = JSON.parse(storageMap.get(PENDING_DELETES_KEY) || '[]');
      storageMap.set(PENDING_DELETES_KEY, JSON.stringify([...current, 'del-concurrent']));
    };

    await useExpenseStore.getState().syncPendingExpenses();

    const remainingDeletes = JSON.parse(storageMap.get(PENDING_DELETES_KEY) || '[]');
    expect(remainingDeletes.some((d: any) => d.id === 'del-in-flight')).toBe(false);
    expect(remainingDeletes.some((d: any) => d.id === 'del-concurrent')).toBe(true);
  });

  it('F3. P0.12 concurrency for updates: preserves concurrent update queued during sync', async () => {
    storageMap.set(PENDING_UPDATES_KEY, JSON.stringify([{ id: 'upd-in-flight', payload: { amount: 10 } }]));

    onUpdateHook = async () => {
      const current = JSON.parse(storageMap.get(PENDING_UPDATES_KEY) || '[]');
      storageMap.set(
        PENDING_UPDATES_KEY,
        JSON.stringify([...current, { id: 'upd-concurrent', payload: { amount: 20 } }])
      );
    };

    await useExpenseStore.getState().syncPendingExpenses();

    const remainingUpdates = JSON.parse(storageMap.get(PENDING_UPDATES_KEY) || '[]');
    expect(remainingUpdates.some((u: any) => u.id === 'upd-in-flight')).toBe(false);
    expect(remainingUpdates.some((u: any) => u.id === 'upd-concurrent')).toBe(true);
  });

  // ─── Case G: Empty queues ─────────────────────────────────────────────────
  it('G. completes cleanly when queues are empty without calling supabase for expenses, updates, or deletes', async () => {
    await useExpenseStore.getState().syncPendingExpenses();

    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    // Daily budget records and gullak/category steps still run
    expect(mockUploadPendingDailyRecords).toHaveBeenCalledTimes(1);
    expect(mockSyncPendingGullakDeposits).toHaveBeenCalledTimes(1);
    expect(mockSyncPendingCategories).toHaveBeenCalledTimes(1);
  });

  // ─── Case H: Early exit when no user / session ────────────────────────────
  it('H. exits early and does nothing if user/session is null', async () => {
    mockUser = null;
    storageMap.set(PENDING_DELETES_KEY, JSON.stringify(['del-1']));

    await useExpenseStore.getState().syncPendingExpenses();

    expect(mockDelete).not.toHaveBeenCalled();
    expect(callOrder).toHaveLength(0);
  });

  // ─── Case I: Failure isolation ────────────────────────────────────────────
  it('I. failure isolation: later steps still execute even if gullak, category, or profile step throws', async () => {
    mockSyncPendingGullakDeposits.mockRejectedValueOnce(new Error('Gullak network failure'));
    mockSyncPendingCategories.mockRejectedValueOnce(new Error('Category fetch failure'));

    storageMap.set(PENDING_PROFILE_KEY, JSON.stringify({ full_name: 'Isolated User' }));

    await useExpenseStore.getState().syncPendingExpenses();

    // Profile update and final store sync still ran
    expect(callOrder).toContain('supabase:profile');
    expect(callOrder).toContain('dailyBudget:syncWithExpenses');
  });

  // ─── Case J: Mixed scenario snapshot ──────────────────────────────────────
  it('J. final state snapshot matches after a mixed scenario (2 deletes, 3 adds, 2 updates)', async () => {
    const add1: Expense = {
      id: 'e0000000-0000-4000-8000-000000000001',
      user_id: TEST_UID,
      amount: 110,
      note: 'Item 1',
      payment_mode: 'upi',
      expense_date: '2026-10-14',
      type: 'expense',
      category_id: null,
      pending: true,
    };
    const add2: Expense = {
      id: 'e0000000-0000-4000-8000-000000000002',
      user_id: TEST_UID,
      amount: 220,
      note: 'Item 2',
      payment_mode: 'card',
      expense_date: '2026-10-14',
      type: 'expense',
      category_id: null,
      pending: true,
    };
    const add3NetFail: Expense = {
      id: 'e0000000-0000-4000-8000-000000000003',
      user_id: TEST_UID,
      amount: 330,
      note: 'Item 3 Fail',
      payment_mode: 'cash',
      expense_date: '2026-10-14',
      type: 'expense',
      category_id: null,
      pending: true,
    };

    storageMap.set(PENDING_DELETES_KEY, JSON.stringify(['del-a', 'del-b']));
    storageMap.set(PENDING_ADDS_KEY, JSON.stringify([add1, add2, add3NetFail]));
    storageMap.set(
      PENDING_UPDATES_KEY,
      JSON.stringify([
        { id: 'upd-a', payload: { amount: 50 } },
        { id: 'upd-b', payload: { amount: 75 } },
      ])
    );
    useExpenseStore.setState({ expenses: [add1, add2, add3NetFail] });

    // Make add3 fail with network error
    let upsertCount = 0;
    mockUpsert.mockImplementation((payload: any) => {
      upsertCount++;
      if (payload.id === add3NetFail.id) {
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'network request failed', status: 0 },
            }),
          }),
        } as any;
      }
      return {
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { ...payload, pending: false },
            error: null,
          }),
        }),
      } as any;
    });

    await useExpenseStore.getState().syncPendingExpenses();

    const remainingDeletes = JSON.parse(storageMap.get(PENDING_DELETES_KEY) || '[]');
    const remainingAdds = JSON.parse(storageMap.get(PENDING_ADDS_KEY) || '[]');
    const remainingUpdates = JSON.parse(storageMap.get(PENDING_UPDATES_KEY) || '[]');
    const storeExpenses = useExpenseStore.getState().expenses;

    expect({
      remainingDeletes,
      remainingAddsCount: remainingAdds.length,
      failedAddId: remainingAdds[0]?.id,
      remainingUpdates,
      confirmedStoreExpensesCount: storeExpenses.filter((e) => !e.pending).length,
      pendingStoreExpensesCount: storeExpenses.filter((e) => e.pending).length,
    }).toMatchInlineSnapshot(`
      {
        "confirmedStoreExpensesCount": 2,
        "failedAddId": "e0000000-0000-4000-8000-000000000003",
        "pendingStoreExpensesCount": 1,
        "remainingAddsCount": 1,
        "remainingDeletes": [],
        "remainingUpdates": [],
      }
    `);
  });
});
