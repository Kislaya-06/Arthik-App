import { describe, it, expect, beforeEach, vi } from 'vitest';

// 1. Mock react-native & lucide-react-native for Node test runner
vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
  Appearance: {
    getColorScheme: vi.fn(() => 'light'),
    addChangeListener: vi.fn(),
  },
}));

vi.mock('lucide-react-native', () => ({
  Wallet: () => null,
  CheckSquare: () => null,
  CreditCard: () => null,
  HelpCircle: () => null,
}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => '50000000-0000-4000-8000-000000000001'),
}));

vi.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: vi.fn().mockResolvedValue(undefined),
}));

// 2. In-memory AsyncStorage
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

// 3. Track calls to supabase.from() to test call order
const fromCalls: string[] = [];

const mockGullakSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    order: vi.fn().mockResolvedValue({
      data: [
        { id: 'dep_remote_1', amount: 500, date: '2026-10-22', source: 'external', note: 'Gift', created_at: '2026-10-22T10:00:00Z' },
      ],
      error: null,
    }),
  }),
});

const mockProfilesSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        daily_budget: 300,
        is_auto_renew: true,
        is_budget_mode_enabled: true,
        budget_cadence: 'daily',
        weekly_budget: 2100,
        monthly_budget: 9000,
      },
      error: null,
    }),
  }),
});

const mockLogsSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  }),
});

const mockPlansSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  }),
});

const mockPeriodsSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  }),
});

const mockInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      fromCalls.push(table);
      if (table === 'gullak_deposits') {
        return {
          select: mockGullakSelect,
          insert: mockInsert,
        };
      }
      if (table === 'profiles') {
        return { select: mockProfilesSelect };
      }
      if (table === 'daily_savings_log') {
        return { select: mockLogsSelect };
      }
      if (table === 'budget_plan_changes') {
        return { select: mockPlansSelect };
      }
      if (table === 'budget_periods') {
        return { select: mockPeriodsSelect };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }),
  },
}));

import {
  fetchGullakDepositsRaw,
  mergeGullakDeposits,
  hydrateGullakDeposits,
  runHydrateFromSupabase,
} from '../src/store/dailyBudget/hydrate';
import { useDailyBudgetStore } from '../src/store/dailyBudgetStore';

describe('OPT-06: Parallel Gullak Deposits Hydration', () => {
  const userId = 'user_opt06_test';

  beforeEach(() => {
    storageMap.clear();
    fromCalls.length = 0;
    vi.clearAllMocks();
  });

  it('fetchGullakDepositsRaw queries gullak_deposits with user_id and desc order', async () => {
    const raw = await fetchGullakDepositsRaw(userId);
    expect(fromCalls).toContain('gullak_deposits');
    expect(raw.data).toHaveLength(1);
    expect(raw.data?.[0].id).toBe('dep_remote_1');
  });

  it('mergeGullakDeposits preserves local deposits and merges remote server deposits', async () => {
    const local = [
      { id: 'local_dep_2', amount: 200, date: '2026-10-23', source: 'external' as const, created_at: '2026-10-23T11:00:00Z' },
    ];
    const rawResult = {
      data: [
        { id: 'dep_remote_1', amount: 500, date: '2026-10-22', source: 'external', note: 'Gift', created_at: '2026-10-22T10:00:00Z' },
      ],
      error: null,
    };

    const merged = await mergeGullakDeposits(userId, local, rawResult as any);
    expect(merged).toHaveLength(2);
    // Sorted by date descending
    expect(merged[0].id).toBe('local_dep_2');
    expect(merged[1].id).toBe('dep_remote_1');

    // Missing on server should trigger insert
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'local_dep_2',
        user_id: userId,
        amount: 200,
      })
    );
  });

  it('hydrateGullakDeposits wraps fetchGullakDepositsRaw and mergeGullakDeposits correctly', async () => {
    const deposits = await hydrateGullakDeposits(userId, []);
    expect(deposits).toHaveLength(1);
    expect(deposits[0].id).toBe('dep_remote_1');
  });

  it('calls gullak_deposits BEFORE or simultaneously with the other 4 tables in runHydrateFromSupabase', async () => {
    const storeLike = {
      persist: {
        hasHydrated: () => true,
        onFinishHydration: () => () => {},
      },
    };

    let state = useDailyBudgetStore.getState();
    const set = (partial: any) => {
      state = typeof partial === 'function' ? { ...state, ...partial(state) } : { ...state, ...partial };
    };

    await runHydrateFromSupabase({
      get: () => state,
      set,
      userId,
      store: storeLike,
    });

    // Verify all 5 tables were called
    expect(fromCalls).toContain('gullak_deposits');
    expect(fromCalls).toContain('profiles');
    expect(fromCalls).toContain('daily_savings_log');
    expect(fromCalls).toContain('budget_plan_changes');
    expect(fromCalls).toContain('budget_periods');

    // Verify gullak_deposits was called first or along with the batch (index 0 because depositsRawPromise starts before fetchRemoteBudgetData)
    expect(fromCalls[0]).toBe('gullak_deposits');

    // Verify final state has gullakDeposits
    expect(state.gullakDeposits).toBeDefined();
    expect(state.gullakDeposits?.[0].id).toBe('dep_remote_1');
  });
});
