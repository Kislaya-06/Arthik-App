import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'android' }, AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) } }));
vi.mock('expo-crypto', () => ({ randomUUID: vi.fn(() => '50000000-0000-4000-8000-000000000001') }));
vi.mock('expo-notifications', () => ({ cancelAllScheduledNotificationsAsync: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => {}), removeItem: vi.fn(async () => {}) },
}));

const h = vi.hoisted(() => ({
  fromCalls: [] as string[],
  rpc: vi.fn(),
  direct: {
    profiles: { daily_budget: 300, is_auto_renew: true, is_budget_mode_enabled: true, budget_cadence: 'daily', weekly_budget: 0, monthly_budget: 0 },
    daily_savings_log: [{ date: '2026-10-01', amount_saved: 10, spent_amount: 290, status: 'saved', budget_amount: 300 }],
    budget_plan_changes: [] as any[],
    budget_periods: [] as any[],
    gullak_deposits: [{ id: 'g-direct', amount: 5, date: '2026-10-01', note: null, source: 'external', created_at: '2026-10-01T10:00:00+00:00' }],
  } as Record<string, any>,
}));

vi.mock('../src/config/supabase', () => ({
  supabase: {
    rpc: (...a: any[]) => h.rpc(...a),
    from: vi.fn((table: string) => {
      h.fromCalls.push(table);
      const b: any = {
        select: () => b,
        eq: () => b,
        order: () => b,
        insert: () => ({ then: () => {} }),
        maybeSingle: async () => ({ data: h.direct[table], error: null }),
        then: (res: any) => Promise.resolve({ data: h.direct[table], error: null }).then(res),
      };
      return b;
    }),
  },
}));

import { fetchRemoteBudgetData, fetchGullakDepositsRaw, __resetReadRpcAvailabilityForTests } from '../src/store/dailyBudget/hydrate';

const rpcBundle = {
  profile: { daily_budget: 450, is_auto_renew: false, is_budget_mode_enabled: true, budget_cadence: 'weekly', weekly_budget: 2100, monthly_budget: 0 },
  logs: [{ date: '2026-10-02', amount_saved: 1, spent_amount: 2, status: 'saved', budget_amount: 3 }],
  plans: [{ id: 'p1', effective_from: '2026-10-01', is_enabled: true, cadence: 'weekly', amount: 2100, carry_mode: null, carried_over_amount: 0, created_at: '2026-10-01T00:00:00+00:00' }],
  periods: [],
};

beforeEach(() => {
  h.fromCalls.length = 0;
  h.rpc.mockReset();
  __resetReadRpcAvailabilityForTests();
});
afterEach(() => vi.useRealTimers());

describe('OPT-68 one-call budget bootstrap', () => {
  it('uses the one-call read when it works: same shape, no direct table queries', async () => {
    h.rpc.mockResolvedValue({ data: rpcBundle, error: null });
    const r = await fetchRemoteBudgetData('u1');
    expect(h.rpc).toHaveBeenCalledWith('arthik_budget_bootstrap', { p_user_id: 'u1' });
    expect(r).toEqual({ profileData: rpcBundle.profile, logsData: rpcBundle.logs, plansData: rpcBundle.plans, periodsData: [] });
    expect(h.fromCalls).toEqual([]);
  });

  it('a null profile from the one-call read stays null (same as maybeSingle with no row)', async () => {
    h.rpc.mockResolvedValue({ data: { ...rpcBundle, profile: null }, error: null });
    expect((await fetchRemoteBudgetData('u1')).profileData).toBeNull();
  });

  it('an error falls back to the exact old four queries', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: '500', message: 'boom' } });
    const r = await fetchRemoteBudgetData('u1');
    expect(h.fromCalls.sort()).toEqual(['budget_periods', 'budget_plan_changes', 'daily_savings_log', 'profiles']);
    expect(r.profileData).toEqual(h.direct.profiles);
    expect(r.logsData).toEqual(h.direct.daily_savings_log);
    // a normal error is retried next time
    await fetchRemoteBudgetData('u1');
    expect(h.rpc).toHaveBeenCalledTimes(2);
  });

  it('a malformed answer falls back too', async () => {
    h.rpc.mockResolvedValue({ data: { profile: null, logs: 'x' }, error: null });
    const r = await fetchRemoteBudgetData('u1');
    expect(r.logsData).toEqual(h.direct.daily_savings_log);
  });

  it('a missing function (SQL not run) is not asked again in this session', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    await fetchRemoteBudgetData('u1');
    await fetchRemoteBudgetData('u1');
    expect(h.rpc).toHaveBeenCalledTimes(1);
    expect(h.fromCalls.filter((t) => t === 'profiles').length).toBe(2);
  });

  it('keeps the 3.5 s limit: a hanging call gives the same all-null answer as before', async () => {
    vi.useFakeTimers();
    h.rpc.mockReturnValue(new Promise(() => {}));
    const p = fetchRemoteBudgetData('u1');
    await vi.advanceTimersByTimeAsync(3500);
    expect(await p).toEqual({ profileData: null, logsData: null, plansData: null, periodsData: null });
  });
});

describe('OPT-67 one-call Gullak deposits', () => {
  it('uses the one-call read when it works', async () => {
    const rows = [{ id: 'g-rpc', amount: 9, date: '2026-10-02', note: null, source: 'income', created_at: '2026-10-02T10:00:00+00:00' }];
    h.rpc.mockResolvedValue({ data: rows, error: null });
    const r = await fetchGullakDepositsRaw('u1');
    expect(h.rpc).toHaveBeenCalledWith('arthik_gullak_deposits', { p_user_id: 'u1' });
    expect(r).toEqual({ data: rows, error: null });
    expect(h.fromCalls).toEqual([]);
  });

  it('falls back to the exact old query', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    const r = await fetchGullakDepositsRaw('u1');
    expect(h.fromCalls).toEqual(['gullak_deposits']);
    expect(r.data).toEqual(h.direct.gullak_deposits);
  });

  it('keeps the 3.5 s limit', async () => {
    vi.useFakeTimers();
    h.rpc.mockReturnValue(new Promise(() => {}));
    const p = fetchGullakDepositsRaw('u1');
    await vi.advanceTimersByTimeAsync(3500);
    const r = await p;
    expect(r.data).toBeNull();
    expect((r.error as Error).message).toBe('timeout');
  });
});
