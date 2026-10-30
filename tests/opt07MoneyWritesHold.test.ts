import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Freeze date so todayStr = '2026-03-15'
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-03-15T12:00:00Z'));

// Mock react-native and icons
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
  randomUUID: vi.fn(() => '60000000-0000-4000-8000-000000000001'),
}));

vi.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: vi.fn().mockResolvedValue(undefined),
}));

const {
  storageMap,
  mockAuthState,
  mockNotifications,
  mockSupabaseSpies,
} = vi.hoisted(() => {
  return {
    storageMap: new Map<string, string>(),
    mockAuthState: { user: { id: 'user_rollover_test_1', created_at: '2026-03-01T00:00:00Z' } as any },
    mockNotifications: {
      mockTriggerDeviceNotification: vi.fn(),
      mockAddNotification: vi.fn(),
      mockSetOwnerUserId: vi.fn(),
    },
    mockSupabaseSpies: {
      upsert: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    },
  };
});

// In-memory AsyncStorage
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

// Auth store mock
vi.mock('../src/store/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      user: mockAuthState.user,
    })),
  },
  registerStoreResetCallback: vi.fn(),
}));

// Category store mock
vi.mock('../src/store/categoryStore', () => ({
  useCategoryStore: {
    getState: vi.fn(() => ({
      categories: [],
    })),
  },
}));

// Notification service & store mock
vi.mock('../src/lib/notificationService', () => ({
  triggerDeviceNotification: (...args: any[]) => mockNotifications.mockTriggerDeviceNotification(...args),
}));

vi.mock('../src/store/notificationStore', () => ({
  useNotificationStore: {
    getState: vi.fn(() => ({
      addNotification: (...args: any[]) => mockNotifications.mockAddNotification(...args),
      setOwnerUserId: (...args: any[]) => mockNotifications.mockSetOwnerUserId(...args),
    })),
  },
}));

// Supabase mock
vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => {
      const builder: any = {
        select: vi.fn(() => builder),
        update: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        upsert: mockSupabaseSpies.upsert,
        insert: mockSupabaseSpies.insert,
        then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
      };
      return builder;
    }),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: mockAuthState.user } },
      }),
    },
  },
}));

import {
  useDailyBudgetStore,
  registerExpensesLoadedGetter,
  registerExpenseGetter,
} from '../src/store/dailyBudgetStore';
import {
  holdMoneyWrites,
  releaseMoneyWrites,
  isMoneyWritesHeld,
  resetMoneyWritesHold,
} from '../src/store/dailyBudget/hydrationHold';
import { runHeldBackMoneyWork } from '../src/store/dailyBudget/hydrate';

// OPT-07 / ROL-005: while Home is shown from cache, no finalization, scheduled plan, auto-renew or upload may run on
// the cached copy; the same work runs once the server copy is in. Not held (the default) = unchanged behaviour.

const USER_ID = 'user_rollover_test_1';
const seed = () =>
  useDailyBudgetStore.setState({
    ownerUserId: USER_ID,
    hydratedForUserId: USER_ID,
    dailyBudgetAmount: 500,
    isAutoRenew: true,
    isBudgetModeEnabled: true,
    dailyRecords: {
      '2026-03-14': { date: '2026-03-14', budget: 500, spent: 100, saved: 400, isFinalized: false, status: 'active' },
      '2026-03-15': { date: '2026-03-15', budget: 500, spent: 0, saved: 500, isFinalized: false, status: 'active' },
    },
    planChanges: [
      { id: 'p', userId: USER_ID, effectiveFrom: '2026-03-01', isEnabled: true, cadence: 'daily', amount: 500, createdAt: '2026-03-01' },
    ],
  } as any);
const yesterday = () => useDailyBudgetStore.getState().dailyRecords['2026-03-14'];

beforeEach(() => {
  storageMap.clear();
  vi.clearAllMocks();
  mockAuthState.user = { id: USER_ID, created_at: '2026-03-01T00:00:00Z' };
  mockSupabaseSpies.upsert.mockResolvedValue({ error: null });
  registerExpensesLoadedGetter(() => true);
  registerExpenseGetter(() => []);
  resetMoneyWritesHold();
  useDailyBudgetStore.getState().resetDailyBudget();
});
afterEach(() => {
  resetMoneyWritesHold();
  useDailyBudgetStore.getState().resetDailyBudget();
});

describe('hold bookkeeping', () => {
  it('only the held user is held; release reports whether a hold existed; reset clears it', () => {
    expect(isMoneyWritesHeld(USER_ID)).toBe(false);
    expect(isMoneyWritesHeld(null)).toBe(false);
    holdMoneyWrites(USER_ID);
    expect(isMoneyWritesHeld(USER_ID)).toBe(true);
    expect(isMoneyWritesHeld('someone_else')).toBe(false);
    expect(releaseMoneyWrites('someone_else')).toBe(false);
    expect(releaseMoneyWrites(USER_ID)).toBe(true);
    expect(releaseMoneyWrites(USER_ID)).toBe(false);
    holdMoneyWrites(USER_ID);
    resetMoneyWritesHold();
    expect(isMoneyWritesHeld(USER_ID)).toBe(false);
  });
});

describe('checkAndRollover / uploads with the hold', () => {
  it('control: without a hold, yesterday is finalized (unchanged behaviour)', () => {
    seed();
    useDailyBudgetStore.getState().checkAndRollover([], true);
    expect(yesterday().isFinalized).toBe(true);
  });

  it('held: nothing is finalized, nothing is uploaded; after release the same work runs once', async () => {
    seed();
    holdMoneyWrites(USER_ID);
    useDailyBudgetStore.getState().checkAndRollover([], true);
    await useDailyBudgetStore.getState().uploadPendingDailyRecords();
    expect(yesterday().isFinalized).toBe(false);
    expect(mockSupabaseSpies.upsert).not.toHaveBeenCalled();

    expect(releaseMoneyWrites(USER_ID)).toBe(true);
    runHeldBackMoneyWork(useDailyBudgetStore.getState);
    expect(yesterday().isFinalized).toBe(true);
    await vi.waitFor(() => expect(mockSupabaseSpies.upsert).toHaveBeenCalled());
  });

  it('held for ANOTHER user does not block this user', () => {
    seed();
    holdMoneyWrites('someone_else');
    useDailyBudgetStore.getState().checkAndRollover([], true);
    expect(yesterday().isFinalized).toBe(true);
  });

  it('held: the Gullak queue is not uploaded; after release it is', async () => {
    seed();
    const dep = { id: '70000000-0000-4000-8000-000000000001', amount: 50, date: '2026-03-15', note: null, source: 'external', created_at: '2026-03-15T10:00:00Z' };
    storageMap.set(`@arthik_pending_gullak_adds_${USER_ID}`, JSON.stringify([dep]));
    holdMoneyWrites(USER_ID);
    await useDailyBudgetStore.getState().syncPendingGullakDeposits();
    expect(mockSupabaseSpies.upsert).not.toHaveBeenCalled();
    releaseMoneyWrites(USER_ID);
    await useDailyBudgetStore.getState().syncPendingGullakDeposits();
    expect(mockSupabaseSpies.upsert).toHaveBeenCalledTimes(1);
  });

  it('a store reset (sign-out) clears the hold', () => {
    holdMoneyWrites(USER_ID);
    useDailyBudgetStore.getState().resetDailyBudget();
    expect(isMoneyWritesHeld(USER_ID)).toBe(false);
  });
});
