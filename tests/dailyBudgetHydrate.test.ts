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
  randomUUID: vi.fn(() => '50000000-0000-4000-8000-000000000001'),
}));

vi.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: vi.fn().mockResolvedValue(undefined),
}));

const {
  storageMap,
  mockNetworkState,
  mockAuthState,
  mockNotifications,
  mockSupabaseData,
  mockSupabaseSpies,
} = vi.hoisted(() => {
  return {
    storageMap: new Map<string, string>(),
    mockNetworkState: { isOffline: false },
    mockAuthState: { user: { id: 'user_hydrate_test_1', created_at: '2026-01-01T00:00:00Z' } as any },
    mockNotifications: {
      mockTriggerDeviceNotification: vi.fn(),
      mockAddNotification: vi.fn(),
      mockSetOwnerUserId: vi.fn(),
    },
    mockSupabaseData: {
      profiles: null as any,
      savingsLogs: [] as any[],
      planChanges: [] as any[],
      periods: [] as any[],
      deposits: [] as any[],
    },
    mockSupabaseSpies: {
      upsert: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockResolvedValue({ error: null }),
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

// Network store mock
vi.mock('../src/store/networkStore', () => ({
  useNetworkStore: {
    getState: vi.fn(() => ({
      isOffline: mockNetworkState.isOffline,
      checkConnectivity: vi.fn().mockResolvedValue(!mockNetworkState.isOffline),
      setOffline: vi.fn(),
    })),
  },
  registerSyncCallback: vi.fn(),
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

vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      const builder: any = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => {
          if (table === 'profiles') {
            return { data: mockSupabaseData.profiles, error: null };
          }
          return { data: null, error: null };
        }),
        single: vi.fn(async () => {
          if (table === 'profiles') {
            return { data: mockSupabaseData.profiles, error: null };
          }
          return { data: null, error: null };
        }),
        upsert: mockSupabaseSpies.upsert,
        insert: mockSupabaseSpies.insert,
        update: vi.fn((data: any) => {
          mockSupabaseSpies.update(data);
          return builder;
        }),
        then: (resolve: any) => {
          let resolvedData: any = [];
          if (table === 'daily_savings_log') resolvedData = mockSupabaseData.savingsLogs;
          else if (table === 'budget_plan_changes') resolvedData = mockSupabaseData.planChanges;
          else if (table === 'budget_periods') resolvedData = mockSupabaseData.periods;
          else if (table === 'gullak_deposits') resolvedData = mockSupabaseData.deposits;
          return Promise.resolve({ data: resolvedData, error: null }).then(resolve);
        },
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
  getPendingSettingsKey,
  getPendingPlanChangesKey,
  getPendingBudgetPeriodsKey,
  GullakDeposit,
} from '../src/store/dailyBudgetStore';

describe('dailyBudgetStore — hydrateFromSupabase Characterization & Safety Net', () => {
  const USER_ID = 'user_hydrate_test_1';
  const TODAY_STR = '2026-03-15';

  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
    mockNetworkState.isOffline = false;
    mockAuthState.user = { id: USER_ID, created_at: '2026-01-01T00:00:00Z' };
    mockSupabaseData.profiles = null;
    mockSupabaseData.savingsLogs = [];
    mockSupabaseData.planChanges = [];
    mockSupabaseData.periods = [];
    mockSupabaseData.deposits = [];

    registerExpensesLoadedGetter(() => true);
    registerExpenseGetter(() => []);
    useDailyBudgetStore.getState().resetDailyBudget();
  });

  afterEach(() => {
    useDailyBudgetStore.getState().resetDailyBudget();
  });

  // -------------------------------------------------------------------------
  // 1. P0.1 Persist-wait timeout & P0.2 Owner change reset
  // -------------------------------------------------------------------------
  describe('P0.1 & P0.2: Startup Guards & Owner Reset', () => {
    it('times out safely after 500ms when zustand persist has not finished hydrating', async () => {
      // Simulate persist.hasHydrated returning false and onFinishHydration never firing
      const persistObj = (useDailyBudgetStore as any).persist;
      const originalHasHydrated = persistObj.hasHydrated;
      const originalOnFinish = persistObj.onFinishHydration;

      persistObj.hasHydrated = vi.fn(() => false);
      persistObj.onFinishHydration = vi.fn(() => () => {});

      mockSupabaseData.profiles = { daily_budget: 400, is_auto_renew: true, is_budget_mode_enabled: true };

      // hydrateFromSupabase should race the 500ms timeout and complete
      const hydratePromise = useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);
      await vi.advanceTimersByTimeAsync(600);
      await hydratePromise;

      expect(useDailyBudgetStore.getState().hydratedForUserId).toBe(USER_ID);
      expect(useDailyBudgetStore.getState().dailyBudgetAmount).toBe(400);

      // Restore
      persistObj.hasHydrated = originalHasHydrated;
      persistObj.onFinishHydration = originalOnFinish;
    });

    it('resets daily budget state when ownerUserId changes from previous user', async () => {
      // Set previous user's state
      useDailyBudgetStore.setState({
        ownerUserId: 'previous_user_999',
        dailyBudgetAmount: 750,
        dailyRecords: {
          '2026-03-14': { date: '2026-03-14', budget: 750, spent: 200, saved: 550, isFinalized: true, status: 'saved' },
        },
      });

      mockSupabaseData.profiles = { daily_budget: 300, is_auto_renew: true, is_budget_mode_enabled: true };

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      const state = useDailyBudgetStore.getState();
      expect(state.ownerUserId).toBe(USER_ID);
      expect(state.hydratedForUserId).toBe(USER_ID);
      expect(state.dailyBudgetAmount).toBe(300);
      // Previous user's records must have been wiped by resetDailyBudget
      expect(state.dailyRecords['2026-03-14']).toBeUndefined();
      expect(mockNotifications.mockSetOwnerUserId).toHaveBeenCalledWith(USER_ID);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Offline Fast-Path for EACH of the 6 pending settings fields
  // -------------------------------------------------------------------------
  describe('Offline Fast-Path: 6 Pending Settings Fields', () => {
    it('applies all 6 pending settings fields offline from AsyncStorage', async () => {
      mockNetworkState.isOffline = true;

      // Seed pending settings in AsyncStorage
      const pendingSettings = {
        daily_budget: 450,
        is_auto_renew: true,
        is_budget_mode_enabled: true,
        budget_cadence: 'weekly',
        weekly_budget: 3150,
        monthly_budget: 13500,
      };
      storageMap.set(getPendingSettingsKey(USER_ID), JSON.stringify(pendingSettings));

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      const state = useDailyBudgetStore.getState();
      expect(state.dailyBudgetAmount).toBe(450);
      expect(state.isAutoRenew).toBe(true);
      expect(state.isBudgetModeEnabled).toBe(true);
      expect(state.budgetCadence).toBe('weekly');
      expect(state.weeklyBudgetAmount).toBe(3150);
      expect(state.monthlyBudgetAmount).toBe(13500);
      expect(state.hydratedForUserId).toBe(USER_ID);
    });

    it('offline fast-path creates today record when missing with resolved budget and active status', async () => {
      mockNetworkState.isOffline = true;
      storageMap.set(
        getPendingSettingsKey(USER_ID),
        JSON.stringify({ daily_budget: 300, is_auto_renew: true, is_budget_mode_enabled: true })
      );

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      const state = useDailyBudgetStore.getState();
      const todayRec = state.dailyRecords[TODAY_STR];
      expect(todayRec).toBeDefined();
      expect(todayRec.budget).toBe(300);
      expect(todayRec.spent).toBe(0);
      expect(todayRec.saved).toBe(300);
      expect(todayRec.status).toBe('active');
      expect(todayRec.isFinalized).toBe(false);
    });

    it('offline fast-path Pure-mode branch sets today record budget to 0 and status to unknown', async () => {
      mockNetworkState.isOffline = true;
      storageMap.set(
        getPendingSettingsKey(USER_ID),
        JSON.stringify({ is_budget_mode_enabled: false, daily_budget: 500 })
      );

      // Pre-populate an unfinalized today record with old budget
      useDailyBudgetStore.setState({
        dailyRecords: {
          [TODAY_STR]: { date: TODAY_STR, budget: 500, spent: 100, saved: 400, isFinalized: false, status: 'active' },
        },
      });

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      const state = useDailyBudgetStore.getState();
      expect(state.isBudgetModeEnabled).toBe(false);
      const todayRec = state.dailyRecords[TODAY_STR];
      expect(todayRec.budget).toBe(0);
      expect(todayRec.saved).toBe(0);
      expect(todayRec.status).toBe('unknown');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Remote 3500ms Timeout Fallback
  // -------------------------------------------------------------------------
  describe('Remote 3500ms Timeout Fallback', () => {
    it('safely falls back without crashing when remote query times out after 3500ms', async () => {
      // Use full fake timers including setTimeout for this test
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-15T12:00:00Z'));

      useDailyBudgetStore.setState({
        dailyBudgetAmount: 250,
        isAutoRenew: true,
        isBudgetModeEnabled: true,
      });

      // Cause remote queries in Promise.all to never resolve
      const originalProfiles = mockSupabaseData.profiles;
      mockSupabaseData.profiles = new Promise(() => {}) as any;

      const hydratePromise = useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);
      // Fast-forward 3600ms to trigger the 3500ms Promise.race timeout
      await vi.advanceTimersByTimeAsync(3600);
      await hydratePromise;

      const state = useDailyBudgetStore.getState();
      expect(state.hydratedForUserId).toBe(USER_ID);
      expect(state.dailyBudgetAmount).toBe(250); // Preserved local baseline

      // Cleanup
      mockSupabaseData.profiles = originalProfiles;
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-03-15T12:00:00Z'));
    });
  });

  // -------------------------------------------------------------------------
  // 4. Pending Plan Changes & Periods Merge
  // -------------------------------------------------------------------------
  describe('Pending Plan Changes & Periods Offline Merge', () => {
    it('merges pending offline plan changes from AsyncStorage without duplicating or losing changes', async () => {
      mockSupabaseData.profiles = { daily_budget: 500, is_budget_mode_enabled: true };
      mockSupabaseData.planChanges = [
        {
          id: 'plan_server_1',
          effective_from: '2026-03-01',
          is_enabled: true,
          cadence: 'daily',
          amount: 500,
          created_at: '2026-03-01T00:00:00Z',
        },
      ];

      const pendingOfflinePlan = {
        id: 'plan_offline_new',
        userId: USER_ID,
        effectiveFrom: '2026-03-16',
        isEnabled: true,
        cadence: 'weekly' as const,
        amount: 3500,
        createdAt: '2026-03-15T10:00:00Z',
      };
      storageMap.set(getPendingPlanChangesKey(USER_ID), JSON.stringify([pendingOfflinePlan]));

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      const state = useDailyBudgetStore.getState();
      expect(state.planChanges.length).toBe(2);
      expect(state.planChanges.find((p) => p.id === 'plan_offline_new')).toBeDefined();
      expect(state.planChanges.find((p) => p.id === 'plan_server_1')).toBeDefined();
    });

    it('merges pending offline budget periods from AsyncStorage into store budgetPeriods', async () => {
      mockSupabaseData.profiles = { daily_budget: 500, is_budget_mode_enabled: true };
      mockSupabaseData.periods = [
        {
          id: 'weekly_2026-03-02',
          cadence: 'weekly',
          period_start: '2026-03-02',
          period_end: '2026-03-08',
          active_start: '2026-03-02',
          active_end: '2026-03-08',
          budget_amount: 3500,
          spent_amount: 2000,
          amount_saved: 1500,
          status: 'saved',
          is_prorated: false,
          created_at: '2026-03-02T00:00:00Z',
        },
      ];

      const pendingPeriod = {
        id: 'weekly_2026-03-09',
        userId: USER_ID,
        cadence: 'weekly' as const,
        periodStart: '2026-03-09',
        periodEnd: '2026-03-15',
        activeStart: '2026-03-09',
        activeEnd: '2026-03-15',
        budgetAmount: 3500,
        spentAmount: 1800,
        amountSaved: 1700,
        status: 'saved' as const,
        isProrated: false,
        createdAt: '2026-03-09T00:00:00Z',
      };
      storageMap.set(getPendingBudgetPeriodsKey(USER_ID), JSON.stringify([pendingPeriod]));

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      const state = useDailyBudgetStore.getState();
      expect(state.budgetPeriods['weekly_2026-03-02']).toBeDefined();
      expect(state.budgetPeriods['weekly_2026-03-09']).toBeDefined();
      expect(state.budgetPeriods['weekly_2026-03-09'].amountSaved).toBe(1700);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Self-Healing 500 Sentinel Recovery
  // -------------------------------------------------------------------------
  describe('Self-Healing 500 Sentinel Recovery', () => {
    it('detects original 250 budget from savings logs when remote profile was reset to migration default 500', async () => {
      // Remote profile has default 500
      mockSupabaseData.profiles = { daily_budget: 500, is_auto_renew: true, is_budget_mode_enabled: true };

      // Historical savings logs and expenses reveal consistent 250 allowance
      mockSupabaseData.savingsLogs = [
        { date: '2026-03-10', budget_amount: 250, amount_saved: 150, spent_amount: 100, status: 'saved' },
        { date: '2026-03-11', budget_amount: 250, amount_saved: 50, spent_amount: 200, status: 'saved' },
        { date: '2026-03-12', budget_amount: 250, amount_saved: 100, spent_amount: 150, status: 'saved' },
      ];

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      const state = useDailyBudgetStore.getState();
      // True 250 budget must be restored
      expect(state.dailyBudgetAmount).toBe(250);
      // Profile in Supabase must have been updated to 250
      expect(mockSupabaseSpies.update).toHaveBeenCalledWith({ daily_budget: 250 });
    });
  });

  // -------------------------------------------------------------------------
  // 6. Self-Healing Corrupted daily_savings_log Row (All 3 Sub-Steps)
  // -------------------------------------------------------------------------
  describe('Self-Healing Corrupted daily_savings_log Row', () => {
    it('resolves true day budget, recalculates saved/status, and upserts corrected row to Supabase', async () => {
      mockSupabaseData.profiles = { daily_budget: 300, is_auto_renew: true, is_budget_mode_enabled: true };

      // Corrupted row: server log has missing budget_amount (null) and wrong amount_saved (400) for 2026-03-14
      mockSupabaseData.savingsLogs = [
        { date: '2026-03-14', budget_amount: null, amount_saved: 400, spent_amount: 100, status: 'saved' },
      ];

      // Register expense of 100 on 2026-03-14 matching spent_amount
      registerExpenseGetter(() => [
        { id: 'exp_corrupt', user_id: USER_ID, amount: 100, expense_date: '2026-03-14', payment_mode: 'cash' } as any,
      ]);

      // Local store has true budget 300
      useDailyBudgetStore.setState({
        dailyBudgetAmount: 300,
        dailyRecords: {
          '2026-03-14': { date: '2026-03-14', budget: 300, spent: 100, saved: 200, isFinalized: true, status: 'saved' },
        },
      });

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      const state = useDailyBudgetStore.getState();
      // 1. True day budget locked from local record
      expect(state.dailyRecords['2026-03-14'].budget).toBe(300);
      // 2. Saved recalculated to 300 - 100 = 200
      expect(state.dailyRecords['2026-03-14'].saved).toBe(200);
      expect(state.dailyRecords['2026-03-14'].status).toBe('saved');

      // 3. Supabase upsert called with corrected values
      expect(mockSupabaseSpies.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: USER_ID,
          date: '2026-03-14',
          budget_amount: 300,
          amount_saved: 200,
          spent_amount: 100,
          status: 'saved',
        }),
        { onConflict: 'user_id,date' }
      );
    });
  });

  // -------------------------------------------------------------------------
  // 7. Today's Record Online Ensure
  // -------------------------------------------------------------------------
  describe('Online Today Record Ensure', () => {
    it('creates active today record with resolved budget during online hydration when missing', async () => {
      mockSupabaseData.profiles = { daily_budget: 400, is_auto_renew: true, is_budget_mode_enabled: true };
      mockSupabaseData.savingsLogs = [];

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      const state = useDailyBudgetStore.getState();
      const todayRec = state.dailyRecords[TODAY_STR];
      expect(todayRec).toBeDefined();
      expect(todayRec.budget).toBe(400);
      expect(todayRec.spent).toBe(0);
      expect(todayRec.saved).toBe(400);
      expect(todayRec.status).toBe('active');
    });
  });

  // -------------------------------------------------------------------------
  // 8. Gullak Deposits Merge (Local Pending Adds Preserved)
  // -------------------------------------------------------------------------
  describe('Gullak Deposits Merge', () => {
    it('preserves local deposits missing on server and inserts them into Supabase without loss', async () => {
      mockSupabaseData.profiles = { daily_budget: 300, is_auto_renew: true, is_budget_mode_enabled: true };

      // Server has 1 deposit
      mockSupabaseData.deposits = [
        {
          id: 'dep_server_1',
          amount: 500,
          date: '2026-03-10',
          note: 'Server deposit',
          source: 'external',
          created_at: '2026-03-10T10:00:00Z',
        },
      ];

      // Local store has server deposit + a local-only deposit
      const localOnlyDeposit: GullakDeposit = {
        id: 'dep_local_only',
        amount: 800,
        date: '2026-03-14',
        note: 'Cash gift',
        source: 'external',
        created_at: '2026-03-14T15:00:00Z',
      };
      useDailyBudgetStore.setState({
        gullakDeposits: [
          { id: 'dep_server_1', amount: 500, date: '2026-03-10', note: 'Server deposit', source: 'external', created_at: '2026-03-10T10:00:00Z' },
          localOnlyDeposit,
        ],
      });

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      const state = useDailyBudgetStore.getState();
      // Both deposits must be present in state
      expect(state.gullakDeposits.length).toBe(2);
      expect(state.gullakDeposits.find((d) => d.id === 'dep_local_only')).toBeDefined();
      expect(state.gullakDeposits.find((d) => d.id === 'dep_server_1')).toBeDefined();

      // Missing local deposit must have been inserted into Supabase
      expect(mockSupabaseSpies.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'dep_local_only',
          user_id: USER_ID,
          amount: 800,
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // 9. Ending Sequence: checkAndRollover & uploadPendingDailyRecords
  // -------------------------------------------------------------------------
  describe('Hydration Ending Sequence', () => {
    it('executes checkAndRollover with skipRolloverNotification=true and flushes pending uploads', async () => {
      mockSupabaseData.profiles = { daily_budget: 500, is_auto_renew: true, is_budget_mode_enabled: true };

      // Register an expense of 200 on 2026-03-14
      registerExpenseGetter(() => [
        {
          id: 'exp_yesterday',
          user_id: USER_ID,
          amount: 200,
          expense_date: '2026-03-14',
          payment_mode: 'cash',
        } as any,
      ]);

      // Set an unfinalized past record marked needsUpload
      useDailyBudgetStore.setState({
        dailyRecords: {
          '2026-03-14': {
            date: '2026-03-14',
            budget: 500,
            spent: 200,
            saved: 300,
            isFinalized: true,
            status: 'saved',
            needsUpload: true,
          },
        },
      });

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      // 1. checkAndRollover finalized yesterday with notification suppressed
      expect(mockNotifications.mockAddNotification).not.toHaveBeenCalled();

      // 2. uploadPendingDailyRecords flushed the record to Supabase
      expect(mockSupabaseSpies.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: USER_ID,
          date: '2026-03-14',
          amount_saved: 300,
          spent_amount: 200,
        }),
        expect.any(Object)
      );
    });
  });
});
