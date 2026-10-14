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
  getPendingBudgetPeriodsKey,
} from '../src/store/dailyBudgetStore';
import { Expense } from '../src/store/expenseStore';

describe('dailyBudgetStore — checkAndRollover Characterization & Safety Net', () => {
  const USER_ID = 'user_rollover_test_1';
  const YESTERDAY_STR = '2026-03-14';

  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
    mockAuthState.user = { id: USER_ID, created_at: '2026-03-01T00:00:00Z' };
    mockSupabaseSpies.upsert.mockResolvedValue({ error: null });

    registerExpensesLoadedGetter(() => true);
    registerExpenseGetter(() => []);
    useDailyBudgetStore.getState().resetDailyBudget();
  });

  afterEach(() => {
    useDailyBudgetStore.getState().resetDailyBudget();
  });

  // -------------------------------------------------------------------------
  // 1. Gap-Fill Invariant: Real activity only, NO phantom days
  // -------------------------------------------------------------------------
  it('does NOT create phantom daily records across inactive calendar gaps with zero activity', () => {
    // User had a record on 2026-03-10.
    // Days 2026-03-11, 2026-03-12, 2026-03-13, 2026-03-14 had zero activity, zero records, and zero expenses.
    useDailyBudgetStore.setState({
      ownerUserId: USER_ID,
      hydratedForUserId: USER_ID,
      dailyBudgetAmount: 500,
      isAutoRenew: true,
      isBudgetModeEnabled: true,
      dailyRecords: {
        '2026-03-10': {
          date: '2026-03-10',
          budget: 500,
          spent: 200,
          saved: 300,
          isFinalized: true,
          status: 'saved',
        },
      },
      planChanges: [
        {
          id: 'plan_daily',
          userId: USER_ID,
          effectiveFrom: '2026-03-01',
          isEnabled: true,
          cadence: 'daily',
          amount: 500,
          createdAt: '2026-03-01',
        },
      ],
    });

    useDailyBudgetStore.getState().checkAndRollover([], true);

    const records = useDailyBudgetStore.getState().dailyRecords;
    // Strict gap-fill invariant: intermediate zero-activity days must NEVER be fabricated as phantom days
    expect(records['2026-03-11']).toBeUndefined();
    expect(records['2026-03-12']).toBeUndefined();
    expect(records['2026-03-13']).toBeUndefined();
    expect(records['2026-03-14']).toBeUndefined();
    // Only original day remains
    expect(Object.keys(records)).toEqual(['2026-03-10']);
  });

  // -------------------------------------------------------------------------
  // 2. Pre-Account Registration Dates Skipped
  // -------------------------------------------------------------------------
  it('deletes and skips records for dates prior to user account creation', () => {
    // User account created on 2026-03-05
    mockAuthState.user = { id: USER_ID, created_at: '2026-03-05T00:00:00Z' };

    // Accidental or backdated record on 2026-03-02
    useDailyBudgetStore.setState({
      ownerUserId: USER_ID,
      hydratedForUserId: USER_ID,
      dailyBudgetAmount: 500,
      isAutoRenew: true,
      isBudgetModeEnabled: true,
      dailyRecords: {
        '2026-03-02': {
          date: '2026-03-02',
          budget: 500,
          spent: 100,
          saved: 400,
          isFinalized: false,
          status: 'active',
        },
      },
    });

    const expenses: Expense[] = [
      { id: 'exp_pre', user_id: USER_ID, amount: 100, expense_date: '2026-03-02', payment_mode: 'cash' },
    ];

    useDailyBudgetStore.getState().checkAndRollover(expenses, true);

    const records = useDailyBudgetStore.getState().dailyRecords;
    // Pre-account record must be deleted
    expect(records['2026-03-02']).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // 3. Untracked Day Preservation
  // -------------------------------------------------------------------------
  it('preserves historical untracked day with status unknown and 0 budget/saved', () => {
    useDailyBudgetStore.setState({
      ownerUserId: USER_ID,
      hydratedForUserId: USER_ID,
      dailyBudgetAmount: 500,
      isAutoRenew: true,
      isBudgetModeEnabled: true,
      dailyRecords: {
        '2026-03-12': {
          date: '2026-03-12',
          budget: 0,
          spent: 300,
          saved: 0,
          isFinalized: true,
          status: 'unknown',
        },
      },
    });

    const expenses: Expense[] = [
      { id: 'exp1', user_id: USER_ID, amount: 300, expense_date: '2026-03-12', payment_mode: 'upi' },
    ];

    useDailyBudgetStore.getState().checkAndRollover(expenses, true);

    const record = useDailyBudgetStore.getState().dailyRecords['2026-03-12'];
    expect(record.status).toBe('unknown');
    expect(record.budget).toBe(0);
    expect(record.saved).toBe(0);
    expect(record.spent).toBe(300);
  });

  // -------------------------------------------------------------------------
  // 4. Budget Locked from Existing Record
  // -------------------------------------------------------------------------
  it('locks past day budget from existing record regardless of current dailyBudgetAmount', () => {
    // Yesterday was created when allowance was 400
    useDailyBudgetStore.setState({
      ownerUserId: USER_ID,
      hydratedForUserId: USER_ID,
      dailyBudgetAmount: 800, // User currently changed allowance to 800
      isAutoRenew: true,
      isBudgetModeEnabled: true,
      dailyRecords: {
        [YESTERDAY_STR]: {
          date: YESTERDAY_STR,
          budget: 400,
          spent: 150,
          saved: 0,
          isFinalized: false,
          status: 'active',
        },
      },
    });

    const expenses: Expense[] = [
      { id: 'e_y', user_id: USER_ID, amount: 150, expense_date: YESTERDAY_STR, payment_mode: 'cash' },
    ];

    useDailyBudgetStore.getState().checkAndRollover(expenses, true);

    const record = useDailyBudgetStore.getState().dailyRecords[YESTERDAY_STR];
    // Must lock to 400, NOT the new 800
    expect(record.budget).toBe(400);
    expect(record.saved).toBe(250); // 400 - 150 = 250
    expect(record.status).toBe('saved');
    expect(record.isFinalized).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 5. Zero Budget + Zero Spent Skipped
  // -------------------------------------------------------------------------
  it('skips finalization when both budget and spent are zero on an unrecorded past day', () => {
    useDailyBudgetStore.setState({
      ownerUserId: USER_ID,
      hydratedForUserId: USER_ID,
      dailyBudgetAmount: 0, // Budget mode off or 0 budget
      isAutoRenew: false,
      isBudgetModeEnabled: false,
      dailyRecords: {},
      planChanges: [
        { id: 'p1', userId: USER_ID, effectiveFrom: '2026-03-01', isEnabled: true, cadence: 'daily', amount: 0, createdAt: '2026-03-01' },
      ],
    });

    // An unrecorded past date with an expense of 0 amount and 0 budget
    const expenses: Expense[] = [
      { id: 'exp_zero', user_id: USER_ID, amount: 0, expense_date: '2026-03-12', payment_mode: 'cash' },
    ];
    useDailyBudgetStore.getState().checkAndRollover(expenses, true);

    const records = useDailyBudgetStore.getState().dailyRecords;
    expect(records['2026-03-12']).toBeUndefined();
    expect(Object.keys(records)).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 6. Supabase Upload Failure Leaves needsUpload True
  // -------------------------------------------------------------------------
  it('leaves needsUpload true on record when Supabase upsert fails or encounters network error', async () => {
    // Simulate Supabase upsert failure
    mockSupabaseSpies.upsert.mockResolvedValueOnce({ error: { message: 'Network offline' } });

    useDailyBudgetStore.setState({
      ownerUserId: USER_ID,
      hydratedForUserId: USER_ID,
      dailyBudgetAmount: 500,
      isAutoRenew: true,
      isBudgetModeEnabled: true,
      dailyRecords: {
        [YESTERDAY_STR]: {
          date: YESTERDAY_STR,
          budget: 500,
          spent: 200,
          saved: 0,
          isFinalized: false,
          status: 'active',
        },
      },
    });

    const expenses: Expense[] = [
      { id: 'e1', user_id: USER_ID, amount: 200, expense_date: YESTERDAY_STR, payment_mode: 'upi' },
    ];

    useDailyBudgetStore.getState().checkAndRollover(expenses, true);

    // Yield macro-task for promise
    await new Promise((r) => setTimeout(r, 10));

    const record = useDailyBudgetStore.getState().dailyRecords[YESTERDAY_STR];
    expect(record.isFinalized).toBe(true);
    expect(record.needsUpload).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 7. Yesterday Savings Notification Triggered & Deduped
  // -------------------------------------------------------------------------
  describe('Yesterday Savings Notification', () => {
    it('triggers rollover notification for yesterday savings and dedupes on repeat runs', () => {
      useDailyBudgetStore.setState({
        ownerUserId: USER_ID,
        hydratedForUserId: USER_ID,
        dailyBudgetAmount: 500,
        isAutoRenew: true,
        isBudgetModeEnabled: true,
        dailyRecords: {
          [YESTERDAY_STR]: {
            date: YESTERDAY_STR,
            budget: 500,
            spent: 200,
            saved: 0,
            isFinalized: false,
            status: 'active',
          },
        },
        lastRolloverNotifiedDate: null,
      });

      const expenses: Expense[] = [
        { id: 'e1', user_id: USER_ID, amount: 200, expense_date: YESTERDAY_STR, payment_mode: 'upi' },
      ];

      // 1. First run with skipRolloverNotification = false triggers notification
      useDailyBudgetStore.getState().checkAndRollover(expenses, false);

      expect(mockNotifications.mockAddNotification).toHaveBeenCalledTimes(1);
      expect(mockNotifications.mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          id: `rollover_${YESTERDAY_STR}`,
          type: 'savings_rollover',
        })
      );
      expect(useDailyBudgetStore.getState().lastRolloverNotifiedDate).toBe(YESTERDAY_STR);

      // 2. Second run with same date does NOT re-trigger notification
      useDailyBudgetStore.getState().checkAndRollover(expenses, false);
      expect(mockNotifications.mockAddNotification).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // 8. Period Upload Offline Queue
  // -------------------------------------------------------------------------
  it('queues finalized weekly period in AsyncStorage offline during checkAndRollover', async () => {
    const historicalPlan = {
      id: 'plan_w_queue',
      userId: USER_ID,
      effectiveFrom: '2026-03-02',
      isEnabled: true,
      cadence: 'weekly' as const,
      amount: 7000,
      createdAt: '2026-03-02T00:00:00Z',
    };

    useDailyBudgetStore.setState({
      ownerUserId: USER_ID,
      hydratedForUserId: USER_ID,
      isBudgetModeEnabled: true,
      budgetCadence: 'weekly',
      weeklyBudgetAmount: 7000,
      planChanges: [historicalPlan],
      dailyRecords: {},
      budgetPeriods: {},
    });

    const expenses: Expense[] = [
      { id: 'w1', user_id: USER_ID, amount: 4500, expense_date: '2026-03-04', payment_mode: 'upi' },
    ];

    useDailyBudgetStore.getState().checkAndRollover(expenses, true);

    // Yield macro-task for async savePendingBudgetPeriodOffline
    await new Promise((r) => setTimeout(r, 10));

    // Period key for Mon Mar 2 - Sun Mar 8
    const periodKey = 'weekly_2026-03-02';
    const period = useDailyBudgetStore.getState().budgetPeriods[periodKey];
    expect(period).toBeDefined();
    expect(period.amountSaved).toBe(2500); // 7000 - 4500 = 2500

    // Must be queued in AsyncStorage under pending budget periods
    const pendingKey = getPendingBudgetPeriodsKey(USER_ID);
    const stored = storageMap.get(pendingKey);
    expect(stored).toBeDefined();
    const queuedList = JSON.parse(stored!);
    expect(queuedList.length).toBeGreaterThanOrEqual(1);
    expect(queuedList.find((p: any) => p.id === periodKey)).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 9. Multi-Day Deterministic Scenario Snapshot
  // -------------------------------------------------------------------------
  it('matches inline snapshot for a multi-day rollover scenario', () => {
    useDailyBudgetStore.setState({
      ownerUserId: USER_ID,
      hydratedForUserId: USER_ID,
      dailyBudgetAmount: 500,
      isAutoRenew: true,
      isBudgetModeEnabled: true,
      dailyRecords: {
        '2026-03-12': {
          date: '2026-03-12',
          budget: 500,
          spent: 100,
          saved: 0,
          isFinalized: false,
          status: 'active',
        },
        '2026-03-13': {
          date: '2026-03-13',
          budget: 500,
          spent: 600,
          saved: 0,
          isFinalized: false,
          status: 'active',
        },
        '2026-03-14': {
          date: '2026-03-14',
          budget: 500,
          spent: 500,
          saved: 0,
          isFinalized: false,
          status: 'active',
        },
      },
    });

    const expenses: Expense[] = [
      { id: 'e12', user_id: USER_ID, amount: 100, expense_date: '2026-03-12', payment_mode: 'cash' },
      { id: 'e13', user_id: USER_ID, amount: 600, expense_date: '2026-03-13', payment_mode: 'card' },
      { id: 'e14', user_id: USER_ID, amount: 500, expense_date: '2026-03-14', payment_mode: 'upi' },
    ];

    useDailyBudgetStore.getState().checkAndRollover(expenses, true);

    const state = useDailyBudgetStore.getState();
    expect(state.totalAccumulatedSavings).toBe(400); // 400 from Mar 12 + 0 from Mar 13 + 0 from Mar 14

    // Inline snapshot of finalized dailyRecords
    expect({
      '2026-03-12': state.dailyRecords['2026-03-12'],
      '2026-03-13': state.dailyRecords['2026-03-13'],
      '2026-03-14': state.dailyRecords['2026-03-14'],
    }).toMatchInlineSnapshot(`
      {
        "2026-03-12": {
          "budget": 500,
          "date": "2026-03-12",
          "isFinalized": true,
          "needsUpload": true,
          "saved": 400,
          "spent": 100,
          "status": "saved",
        },
        "2026-03-13": {
          "budget": 500,
          "date": "2026-03-13",
          "isFinalized": true,
          "needsUpload": true,
          "saved": 0,
          "spent": 600,
          "status": "exceeded",
        },
        "2026-03-14": {
          "budget": 500,
          "date": "2026-03-14",
          "isFinalized": true,
          "needsUpload": true,
          "saved": 0,
          "spent": 500,
          "status": "even",
        },
      }
    `);
  });
});
