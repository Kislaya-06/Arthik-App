import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  order: [] as string[],
  keys: [] as string[],
  budget: {
    state: { ownerUserId: 'u1', hydratedForUserId: 'u1', dailyRecords: { '2026-03-15': {} } as Record<string, unknown> },
  },
  cat: { isFetched: false },
  fetchCategoriesImpl: vi.fn(),
  fetchExpensesImpl: vi.fn(),
  hydrateImpl: vi.fn(),
  lockInit: vi.fn(),
  preload: vi.fn(),
  loadPending: vi.fn(),
  runHeld: vi.fn(),
}));

vi.mock('react-native', () => ({ Platform: { OS: 'android' }, AppState: { addEventListener: vi.fn() } }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getAllKeys: vi.fn(async () => h.keys), getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));
vi.mock('../src/config/supabase', () => ({ supabase: {} }));
vi.mock('../src/store/dailyBudget/metrics', () => ({ getTodayDateStr: () => '2026-03-15' }));
vi.mock('../src/store/dailyBudgetStore', () => ({
  useDailyBudgetStore: {
    getState: () => ({ ...h.budget.state, hydrateFromSupabase: (id: string) => h.hydrateImpl(id) }),
    subscribe: () => () => {},
  },
}));
vi.mock('../src/store/dailyBudget/hydrate', () => ({
  waitForPersistHydration: async () => {},
  runHeldBackMoneyWork: (...a: unknown[]) => h.runHeld(...a),
}));
vi.mock('../src/store/expenseStore', () => ({
  getCachedStorageKey: (id: string) => `exp_${id}`,
  preloadCachedExpenses: () => h.preload(),
  useExpenseStore: { getState: () => ({ loadPendingExpenses: () => h.loadPending(), fetchExpenses: () => h.fetchExpensesImpl() }) },
}));
const catListeners = new Set<() => void>();
vi.mock('../src/store/categoryStore', () => ({
  useCategoryStore: {
    getState: () => ({ isFetched: h.cat.isFetched, fetchCategories: () => h.fetchCategoriesImpl() }),
    subscribe: (cb: () => void) => {
      catListeners.add(cb);
      return () => catListeners.delete(cb);
    },
  },
}));
vi.mock('../src/store/appLockStore', () => ({ useAppLockStore: { getState: () => ({ init: (id: string) => h.lockInit(id) }) } }));

import { canShowHomeFromCache, startHomeFromCache, waitForStoreState, HOLD_WATCHDOG_MS } from '../src/lib/warmStart';
import { isMoneyWritesHeld, resetMoneyWritesHold } from '../src/store/dailyBudget/hydrationHold';
import { getLastExpensesFetchAt, __resetExpenseServerSyncForTests } from '../src/store/expense/serverSync';

const goodKeys = () => ['exp_u1', '@arthik_cached_categories_u1'];
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  h.order.length = 0;
  h.keys = goodKeys();
  h.budget.state = { ownerUserId: 'u1', hydratedForUserId: 'u1', dailyRecords: { '2026-03-15': {} } };
  h.cat.isFetched = false;
  resetMoneyWritesHold();
  __resetExpenseServerSyncForTests();
  h.loadPending.mockImplementation(async () => void h.order.push('loadPending'));
  h.fetchCategoriesImpl.mockImplementation(async () => {
    h.order.push('categories:cache');
    h.cat.isFetched = true;
    catListeners.forEach((l) => l());
    await Promise.resolve();
    h.order.push('categories:network');
  });
  h.preload.mockImplementation(async () => void h.order.push('preloadExpenses'));
  h.lockInit.mockImplementation(async () => void h.order.push('appLock'));
  h.fetchExpensesImpl.mockImplementation(async () => void h.order.push('fetchExpenses'));
  h.hydrateImpl.mockImplementation(async () => void h.order.push('hydrate'));
});
afterEach(() => vi.useRealTimers());

describe('canShowHomeFromCache (only when every condition holds)', () => {
  it('true: same user, hydrated before, today already has a record, both caches exist', async () => {
    expect(await canShowHomeFromCache('u1')).toBe(true);
  });
  it('false: another user owns the saved state, or it was never hydrated', async () => {
    h.budget.state.ownerUserId = 'other';
    expect(await canShowHomeFromCache('u1')).toBe(false);
    h.budget.state = { ownerUserId: 'u1', hydratedForUserId: null as any, dailyRecords: { '2026-03-15': {} } };
    expect(await canShowHomeFromCache('u1')).toBe(false);
  });
  it('false: first open of the day (no record for today) always waits as before', async () => {
    h.budget.state.dailyRecords = { '2026-03-14': {} };
    expect(await canShowHomeFromCache('u1')).toBe(false);
  });
  it('false: expense cache or category cache missing', async () => {
    h.keys = ['@arthik_cached_categories_u1'];
    expect(await canShowHomeFromCache('u1')).toBe(false);
    h.keys = ['exp_u1'];
    expect(await canShowHomeFromCache('u1')).toBe(false);
  });
});

describe('startHomeFromCache', () => {
  it('fills the stores from cache in a safe order, holds money writes, and returns before the network work finishes', async () => {
    let finishNetwork!: () => void;
    h.fetchExpensesImpl.mockImplementation(() => new Promise<void>((r) => (finishNetwork = r)));
    await startHomeFromCache('u1');
    // returned: caches are in, app lock known, hold is on, no refresh result yet
    const at = (step: string) => h.order.indexOf(step);
    for (const step of ['loadPending', 'categories:cache', 'preloadExpenses', 'appLock']) expect(at(step)).toBeGreaterThanOrEqual(0);
    expect(at('loadPending')).toBeLessThan(at('categories:cache'));
    expect(at('categories:cache')).toBeLessThan(at('preloadExpenses')); // classifier needs the categories first
    expect(at('preloadExpenses')).toBeLessThan(at('appLock'));
    expect(h.order).not.toContain('fetchExpenses'); // the refresh result is still pending
    expect(isMoneyWritesHeld('u1')).toBe(true);
    expect(getLastExpensesFetchAt()).toBeGreaterThan(0);
    await flush();
    expect(h.runHeld).not.toHaveBeenCalled();
    finishNetwork();
    await flush();
    expect(h.hydrateImpl).toHaveBeenCalledWith('u1');
    // categories network first, then expenses + hydration (the original order)
    expect(h.order.indexOf('categories:network')).toBeLessThan(h.order.indexOf('hydrate'));
    expect(isMoneyWritesHeld('u1')).toBe(false);
    expect(h.runHeld).toHaveBeenCalledTimes(1);
  });

  it('app lock is known before Home can be shown', async () => {
    h.lockInit.mockImplementation(() => new Promise<void>(() => {}));
    let returned = false;
    void startHomeFromCache('u1').then(() => (returned = true));
    await flush();
    expect(returned).toBe(false);
  });

  it('a failing cache step still starts the refresh and always releases the hold', async () => {
    h.preload.mockRejectedValue(new Error('boom'));
    await startHomeFromCache('u1');
    await flush();
    expect(h.fetchExpensesImpl).toHaveBeenCalled();
    expect(h.hydrateImpl).toHaveBeenCalled();
    expect(isMoneyWritesHeld('u1')).toBe(false);
  });

  it('a failing refresh releases the hold and runs the held-back work', async () => {
    h.hydrateImpl.mockRejectedValue(new Error('offline'));
    await startHomeFromCache('u1');
    await flush();
    expect(isMoneyWritesHeld('u1')).toBe(false);
    expect(h.runHeld).toHaveBeenCalledTimes(1);
  });

  it('a refresh that never answers is released by the watchdog, once', async () => {
    h.hydrateImpl.mockImplementation(() => new Promise<void>(() => {}));
    await startHomeFromCache('u1');
    await flush();
    expect(isMoneyWritesHeld('u1')).toBe(true);
    await vi.advanceTimersByTimeAsync(HOLD_WATCHDOG_MS + 1);
    expect(isMoneyWritesHeld('u1')).toBe(false);
    expect(h.runHeld).toHaveBeenCalledTimes(1);
  });
});

describe('waitForStoreState', () => {
  it('resolves at once when true, when it becomes true, or after the time limit', async () => {
    const store = { s: { v: 1 }, l: new Set<() => void>(), getState() { return this.s; }, subscribe(cb: () => void) { this.l.add(cb); return () => this.l.delete(cb); } };
    await waitForStoreState(store, (s) => s.v === 1, 1000);
    let done = false;
    void waitForStoreState(store, (s) => s.v === 2, 1000).then(() => (done = true));
    await flush();
    expect(done).toBe(false);
    store.s = { v: 2 };
    store.l.forEach((l) => l());
    await flush();
    expect(done).toBe(true);
    let timedOut = false;
    void waitForStoreState(store, (s) => s.v === 3, 500).then(() => (timedOut = true));
    await vi.advanceTimersByTimeAsync(501);
    expect(timedOut).toBe(true);
    expect(store.l.size).toBe(0);
  });
});
