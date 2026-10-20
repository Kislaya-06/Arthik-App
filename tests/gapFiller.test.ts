import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock react-native and lucide-react-native
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
  Sparkles: () => null,
  Plus: () => null,
  PiggyBank: () => null,
}));

// Setup in-memory AsyncStorage
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

// Mock expo-crypto
let depositIdCounter = 1;
vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => `20000000-0000-4000-8000-${String(depositIdCounter++).padStart(12, '0')}`),
}));

// Mock Supabase
const createQueryBuilder = () => {
  const builder: any = {
    insert: vi.fn().mockResolvedValue({ error: null }),
    delete: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
  };
  return builder;
};

vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => createQueryBuilder()),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user_budget_test_1', created_at: '2026-09-01T00:00:00Z' } } },
      }),
    },
  },
}));

// Mock AuthStore
let mockUser: any = { id: 'user_budget_test_1', created_at: '2026-09-01T00:00:00Z' };
vi.mock('../src/store/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      user: mockUser,
    })),
  },
  registerStoreResetCallback: vi.fn(),
}));

import { findInactiveGapDays } from '../src/lib/gapFiller';
import { useDailyBudgetStore } from '../src/store/dailyBudgetStore';
import type { Expense } from '../src/store/expense/types';
import type { DailyRecord } from '../src/lib/budgetCalculations';

const mockExpense = (id: string, date: string, amount: number): Expense => ({
  id,
  user_id: 'user_1',
  amount,
  expense_date: date,
  payment_mode: 'cash',
  transaction_class: 'normal',
});

describe('gapFiller (pure helper)', () => {
  const todayStr = '2026-10-21';
  const baseParams = {
    todayStr,
    userCreatedAt: '2026-10-01',
    planChanges: [],
    dailyRecords: {} as Record<string, DailyRecord>,
    expenses: [] as Expense[],
    dismissedDates: [],
    isBudgetModeEnabled: true,
    isAutoRenew: true,
    dailyBudgetAmount: 500,
    lookbackDays: 7,
  };

  it('returns empty when Budget Mode is disabled', () => {
    const gaps = findInactiveGapDays({
      ...baseParams,
      isBudgetModeEnabled: false,
    });
    expect(gaps).toEqual([]);
  });

  it('returns empty when auto-renew is disabled', () => {
    const gaps = findInactiveGapDays({
      ...baseParams,
      isAutoRenew: false,
    });
    expect(gaps).toEqual([]);
  });

  it('returns empty when daily budget amount is zero', () => {
    const gaps = findInactiveGapDays({
      ...baseParams,
      dailyBudgetAmount: 0,
    });
    expect(gaps).toEqual([]);
  });

  it('finds inactive gap days within lookback when no activity occurred', () => {
    // Yesterday (2026-10-20) and 2 days ago (2026-10-19) had no activity
    const gaps = findInactiveGapDays({
      ...baseParams,
      lookbackDays: 2,
    });
    expect(gaps).toEqual(['2026-10-19', '2026-10-20']);
  });

  it('skips days that already have an expense logged', () => {
    const expenses = [
      mockExpense('exp_1', '2026-10-20', 150),
    ];
    const gaps = findInactiveGapDays({
      ...baseParams,
      expenses,
      lookbackDays: 3,
    });
    // 2026-10-20 has expense, so only 18 and 19 should be returned
    expect(gaps).toEqual(['2026-10-18', '2026-10-19']);
  });

  it('skips days that already have a daily record', () => {
    const dailyRecords: Record<string, DailyRecord> = {
      '2026-10-20': {
        date: '2026-10-20',
        budget: 500,
        spent: 0,
        saved: 500,
        isFinalized: true,
        status: 'saved',
      },
    };
    const gaps = findInactiveGapDays({
      ...baseParams,
      dailyRecords,
      lookbackDays: 2,
    });
    // 2026-10-20 already has record
    expect(gaps).toEqual(['2026-10-19']);
  });

  it('does not include dates before userCreatedAt', () => {
    const gaps = findInactiveGapDays({
      ...baseParams,
      userCreatedAt: '2026-10-20',
      lookbackDays: 7,
    });
    // User joined on 2026-10-20, so only 2026-10-20 can be a gap day
    expect(gaps).toEqual(['2026-10-20']);
  });

  it('skips dates that have been dismissed', () => {
    const gaps = findInactiveGapDays({
      ...baseParams,
      dismissedDates: ['2026-10-20'],
      lookbackDays: 3,
    });
    expect(gaps).toEqual(['2026-10-18', '2026-10-19']);
  });

  it('skips dates governed by weekly/monthly plans', () => {
    const planChanges = [
      {
        id: 'plan_0',
        userId: 'user_1',
        effectiveFrom: '2026-10-01',
        isEnabled: true,
        cadence: 'daily' as const,
        amount: 500,
      },
      {
        id: 'plan_1',
        userId: 'user_1',
        effectiveFrom: '2026-10-19',
        isEnabled: true,
        cadence: 'weekly' as const,
        amount: 3500,
      },
    ];
    const gaps = findInactiveGapDays({
      ...baseParams,
      planChanges,
      lookbackDays: 3,
    });
    // 19 and 20 are weekly-owned, so neither should be a daily gap day
    expect(gaps).toEqual(['2026-10-18']);
  });

  it('caps lookback at lookbackDays', () => {
    const gaps = findInactiveGapDays({
      ...baseParams,
      lookbackDays: 4,
    });
    expect(gaps.length).toBe(4);
    expect(gaps).toEqual(['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20']);
  });
});

describe('dailyBudgetStore gap filler actions', () => {
  beforeEach(() => {
    useDailyBudgetStore.getState().resetDailyBudget();
  });

  it('saveGapDaysToGullak creates finalized saved records and updates savings', async () => {
    const store = useDailyBudgetStore.getState();
    store.setBudgetModeEnabled(true);
    store.toggleAutoRenew(true);
    store.setDailyBudget(400);

    const initialSavings = useDailyBudgetStore.getState().totalAccumulatedSavings;

    await useDailyBudgetStore.getState().saveGapDaysToGullak(['2026-10-19', '2026-10-20']);

    const updated = useDailyBudgetStore.getState();
    const rec19 = updated.dailyRecords['2026-10-19'];
    const rec20 = updated.dailyRecords['2026-10-20'];

    expect(rec19).toBeDefined();
    expect(rec19.budget).toBe(400);
    expect(rec19.saved).toBe(400);
    expect(rec19.spent).toBe(0);
    expect(rec19.status).toBe('saved');
    expect(rec19.isFinalized).toBe(true);

    expect(rec20).toBeDefined();
    expect(rec20.budget).toBe(400);
    expect(rec20.saved).toBe(400);
    expect(rec20.spent).toBe(0);
    expect(rec20.status).toBe('saved');
    expect(rec20.isFinalized).toBe(true);

    // Accumulated savings must have increased by 800 (2 days * 400)
    expect(updated.totalAccumulatedSavings).toBe(initialSavings + 800);
  });

  it('dismissGapDays updates dismissedGapDates state', async () => {
    await useDailyBudgetStore.getState().dismissGapDays(['2026-10-18', '2026-10-19']);
    expect(useDailyBudgetStore.getState().dismissedGapDates).toEqual(['2026-10-18', '2026-10-19']);

    // Dismissing additional dates merges them uniquely
    await useDailyBudgetStore.getState().dismissGapDays(['2026-10-19', '2026-10-20']);
    expect(useDailyBudgetStore.getState().dismissedGapDates).toEqual(['2026-10-18', '2026-10-19', '2026-10-20']);
  });
});
