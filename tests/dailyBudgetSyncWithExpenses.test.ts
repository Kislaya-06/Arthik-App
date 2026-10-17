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
  randomUUID: vi.fn(() => '70000000-0000-4000-8000-000000000001'),
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
    mockAuthState: { user: { id: 'user_sync_test_1', created_at: '2026-03-01T00:00:00Z' } as any },
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
import { Expense } from '../src/store/expenseStore';

describe('dailyBudgetStore — syncWithExpenses Characterization & Safety Net', () => {
  const USER_ID = 'user_sync_test_1';
  const PAST_DATE = '2026-03-12';

  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
    mockAuthState.user = { id: USER_ID, created_at: '2026-03-01T00:00:00Z' };

    registerExpensesLoadedGetter(() => true);
    registerExpenseGetter(() => []);
    useDailyBudgetStore.getState().resetDailyBudget();
  });

  afterEach(() => {
    useDailyBudgetStore.getState().resetDailyBudget();
  });

  // -------------------------------------------------------------------------
  // 1. Edit past expense updates finalized day from saved to missed
  // -------------------------------------------------------------------------
  it('recomputes past finalized day from saved to missed when an existing past expense is increased', () => {
    // Past day 2026-03-12 was finalized with budget: 500, spent: 200, saved: 300, status: 'saved'
    useDailyBudgetStore.setState({
      ownerUserId: USER_ID,
      hydratedForUserId: USER_ID,
      dailyBudgetAmount: 500,
      isAutoRenew: true,
      isBudgetModeEnabled: true,
      dailyRecords: {
        [PAST_DATE]: {
          date: PAST_DATE,
          budget: 500,
          spent: 200,
          saved: 300,
          isFinalized: true,
          status: 'saved',
        },
      },
      totalAccumulatedSavings: 300,
    });

    // User edits past expense: amount increases from 200 to 700 (over budget by 200)
    const updatedExpenses: Expense[] = [
      { id: 'exp_edited', user_id: USER_ID, amount: 700, expense_date: PAST_DATE, payment_mode: 'card' },
    ];

    useDailyBudgetStore.getState().syncWithExpenses(updatedExpenses);

    const record = useDailyBudgetStore.getState().dailyRecords[PAST_DATE];
    expect(record.spent).toBe(700);
    expect(record.saved).toBe(0);
    expect(record.status).toBe('missed');
    expect(record.needsUpload).toBe(true);

    // Total accumulated savings is updated from 300 down to 0
    expect(useDailyBudgetStore.getState().totalAccumulatedSavings).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 2. Delete past expense updates finalized day from exceeded to saved
  // -------------------------------------------------------------------------
  it('recomputes past finalized day from exceeded to saved when a past expense is deleted', () => {
    // Past day was exceeded with spent 600, saved 0
    useDailyBudgetStore.setState({
      ownerUserId: USER_ID,
      hydratedForUserId: USER_ID,
      dailyBudgetAmount: 500,
      isAutoRenew: true,
      isBudgetModeEnabled: true,
      dailyRecords: {
        [PAST_DATE]: {
          date: PAST_DATE,
          budget: 500,
          spent: 600,
          saved: 0,
          isFinalized: true,
          status: 'missed',
        },
      },
      totalAccumulatedSavings: 0,
    });

    // Past expense was deleted (now empty expenses list)
    useDailyBudgetStore.getState().syncWithExpenses([]);

    const record = useDailyBudgetStore.getState().dailyRecords[PAST_DATE];
    expect(record.spent).toBe(0);
    expect(record.saved).toBe(500); // 500 - 0 = 500
    expect(record.status).toBe('saved');
    expect(record.needsUpload).toBe(true);

    // Total accumulated savings increases back to 500
    expect(useDailyBudgetStore.getState().totalAccumulatedSavings).toBe(500);
  });
});
