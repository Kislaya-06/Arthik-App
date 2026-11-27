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
        range: vi.fn(() => builder),
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
import { registerExpensesFreshGetter, registerAddExpense } from '../src/store/dailyBudget/expenseBridge';
import { supabase } from '../src/config/supabase';

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
    registerExpensesFreshGetter(() => true);
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

    it('OPT-63: with expenses only from the on-phone cache, computes the same local record but rewrites NO server row', async () => {
      registerExpensesFreshGetter(() => false); // list came from the cache, not yet from the server
      mockSupabaseData.profiles = { daily_budget: 300, is_auto_renew: true, is_budget_mode_enabled: true };
      mockSupabaseData.savingsLogs = [
        { date: '2026-03-14', budget_amount: null, amount_saved: 400, spent_amount: 100, status: 'saved' },
      ];
      registerExpenseGetter(() => [
        { id: 'exp_corrupt', user_id: USER_ID, amount: 100, expense_date: '2026-03-14', payment_mode: 'cash' } as any,
      ]);
      useDailyBudgetStore.setState({
        dailyBudgetAmount: 300,
        dailyRecords: {
          '2026-03-14': { date: '2026-03-14', budget: 300, spent: 100, saved: 200, isFinalized: true, status: 'saved' },
        },
      });

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      const state = useDailyBudgetStore.getState();
      // Local record: exactly what the fresh case computes (screens unchanged)
      expect(state.dailyRecords['2026-03-14'].budget).toBe(300);
      expect(state.dailyRecords['2026-03-14'].saved).toBe(200);
      expect(state.dailyRecords['2026-03-14'].status).toBe('saved');
      // Server row: not touched
      expect(mockSupabaseSpies.upsert).not.toHaveBeenCalledWith(
        expect.objectContaining({ date: '2026-03-14' }),
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
  // -------------------------------------------------------------------------
  // 3. Scheduled Budget Mode switch reaching a cold start (PUR-003, AGENTS.md section 8.1)
  //    Bug: Budget Mode was scheduled "from tomorrow", the app was closed overnight, and the next cold start
  //    showed Budget Mode ON with the allowance still paused (isAutoRenew = false, today's budget = 0).
  // -------------------------------------------------------------------------
  describe('PUR-003: scheduled Budget Mode switch on a cold start', () => {
    const PURE_ROW = { id: 'p1', effective_from: '2026-01-01', is_enabled: false, cadence: 'daily', amount: 0 };
    // Settings writes only: the last-opened day is saved on its own (ROL-004).
    const profileUpdates = () => mockSupabaseSpies.update.mock.calls.map((c) => c[0]).filter((u) => !('last_open_day' in u));

    it('turns auto-save ON and gives today the daily budget when Pure -> Budget Mode matures while the app was closed', async () => {
      mockSupabaseData.profiles = { daily_budget: 100, is_auto_renew: false, is_budget_mode_enabled: false, budget_cadence: 'daily' };
      mockSupabaseData.planChanges = [
        PURE_ROW,
        { id: 'p2', effective_from: TODAY_STR, is_enabled: true, cadence: 'daily', amount: 100 },
      ];

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      const state = useDailyBudgetStore.getState();
      expect(state.isBudgetModeEnabled).toBe(true);
      expect(state.isAutoRenew).toBe(true);
      expect(state.dailyBudgetAmount).toBe(100);
      expect(state.dailyRecords[TODAY_STR].budget).toBe(100);
      expect(state.dailyRecords[TODAY_STR].status).toBe('active');
    });

    it('uses the unsynced offline-queued settings too (Pure-mode setDailyBudget saves is_auto_renew=false)', async () => {
      storageMap.set(
        getPendingSettingsKey(USER_ID),
        JSON.stringify({ daily_budget: 100, is_auto_renew: false })
      );
      mockSupabaseData.profiles = { daily_budget: 250, is_auto_renew: false, is_budget_mode_enabled: false, budget_cadence: 'daily' };
      mockSupabaseData.planChanges = [
        PURE_ROW,
        { id: 'p2', effective_from: TODAY_STR, is_enabled: true, cadence: 'daily', amount: 100 },
      ];

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      const state = useDailyBudgetStore.getState();
      expect(state.isAutoRenew).toBe(true);
      expect(state.dailyBudgetAmount).toBe(100);
      expect(state.dailyRecords[TODAY_STR].budget).toBe(100);
    });

    it('saves the activation to the profile; Budget Mode always has its allowance (rule 15)', async () => {
      mockSupabaseData.profiles = { daily_budget: 100, is_auto_renew: false, is_budget_mode_enabled: false, budget_cadence: 'daily' };
      mockSupabaseData.planChanges = [
        PURE_ROW,
        { id: 'p2', effective_from: TODAY_STR, is_enabled: true, cadence: 'daily', amount: 100 },
      ];

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      expect(profileUpdates()).toContainEqual(
        expect.objectContaining({ is_budget_mode_enabled: true, is_auto_renew: true, daily_budget: 100 })
      );

      // Next cold start: the server now says "Budget Mode on", and the user paused auto-save in between.
      storageMap.clear();
      useDailyBudgetStore.getState().resetDailyBudget();
      mockSupabaseSpies.update.mockClear();
      mockSupabaseData.profiles = { daily_budget: 100, is_auto_renew: false, is_budget_mode_enabled: true, budget_cadence: 'daily' };

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      const state = useDailyBudgetStore.getState();
      expect(state.isBudgetModeEnabled).toBe(true);
      expect(state.isAutoRenew).toBe(true);
      expect(state.dailyRecords[TODAY_STR].budget).toBe(100);
      expect(state.dailyRecords[TODAY_STR].status).toBe('active');
    });

    it('rule 15: an old paused allowance in Budget Mode gets its allowance again', async () => {
      mockSupabaseData.profiles = { daily_budget: 100, is_auto_renew: false, is_budget_mode_enabled: true, budget_cadence: 'daily' };
      mockSupabaseData.planChanges = [
        { id: 'p0', effective_from: '2026-03-01', is_enabled: true, cadence: 'daily', amount: 100 },
      ];

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      const state = useDailyBudgetStore.getState();
      expect(state.isBudgetModeEnabled).toBe(true);
      expect(state.isAutoRenew).toBe(true);
      expect(state.dailyRecords[TODAY_STR].budget).toBe(100);
      expect(profileUpdates()).toHaveLength(0);
    });

    it('does not touch auto-save when the plan change is still in the future (today stays in Pure Mode)', async () => {
      mockSupabaseData.profiles = { daily_budget: 100, is_auto_renew: false, is_budget_mode_enabled: false, budget_cadence: 'daily' };
      mockSupabaseData.planChanges = [
        PURE_ROW,
        { id: 'p2', effective_from: '2026-03-16', is_enabled: true, cadence: 'daily', amount: 100 },
      ];

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      const state = useDailyBudgetStore.getState();
      expect(state.isBudgetModeEnabled).toBe(false);
      expect(state.isAutoRenew).toBe(false);
      expect(state.dailyRecords[TODAY_STR].budget).toBe(0);
      expect(profileUpdates()).toHaveLength(0);
    });

    it('turns auto-save ON for a weekly plan that matures while the app was closed', async () => {
      mockSupabaseData.profiles = { daily_budget: 100, weekly_budget: 700, is_auto_renew: false, is_budget_mode_enabled: false, budget_cadence: 'daily' };
      mockSupabaseData.planChanges = [
        PURE_ROW,
        { id: 'p2', effective_from: TODAY_STR, is_enabled: true, cadence: 'weekly', amount: 700 },
      ];

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      const state = useDailyBudgetStore.getState();
      expect(state.isBudgetModeEnabled).toBe(true);
      expect(state.budgetCadence).toBe('weekly');
      expect(state.isAutoRenew).toBe(true);
      expect(state.weeklyBudgetAmount).toBe(700);
      expect(profileUpdates()).toContainEqual(
        expect.objectContaining({ is_budget_mode_enabled: true, is_auto_renew: true })
      );
    });

    it('turns auto-save OFF when Budget Mode -> Pure Mode matures while the app was closed', async () => {
      mockSupabaseData.profiles = { daily_budget: 100, is_auto_renew: true, is_budget_mode_enabled: true, budget_cadence: 'daily' };
      mockSupabaseData.planChanges = [
        { id: 'p0', effective_from: '2026-03-01', is_enabled: true, cadence: 'daily', amount: 100 },
        { id: 'p2', effective_from: TODAY_STR, is_enabled: false, cadence: 'daily', amount: 100 },
      ];

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      const state = useDailyBudgetStore.getState();
      expect(state.isBudgetModeEnabled).toBe(false);
      expect(state.isAutoRenew).toBe(false);
      expect(state.dailyRecords[TODAY_STR].budget).toBe(0);
      expect(profileUpdates()).toContainEqual(
        expect.objectContaining({ is_budget_mode_enabled: false, is_auto_renew: false })
      );
    });

    it('offline cold start: the first rollover still activates Budget Mode with auto-save ON', async () => {
      mockNetworkState.isOffline = true;
      useDailyBudgetStore.setState({
        isBudgetModeEnabled: false,
        isAutoRenew: false,
        dailyBudgetAmount: 100,
        planChanges: [
          { id: 'p1', userId: USER_ID, effectiveFrom: '2026-01-01', isEnabled: false, cadence: 'daily', amount: 0 },
          { id: 'p2', userId: USER_ID, effectiveFrom: TODAY_STR, isEnabled: true, cadence: 'daily', amount: 100 },
        ],
      });

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);
      useDailyBudgetStore.getState().checkAndRollover([]);

      const state = useDailyBudgetStore.getState();
      expect(state.isBudgetModeEnabled).toBe(true);
      expect(state.isAutoRenew).toBe(true);
      expect(state.dailyBudgetAmount).toBe(100);
    });
  });
  // -------------------------------------------------------------------------
  // 4. One hydration per user at a time (splash + Home + sign-in listener can all ask within the same second)
  // -------------------------------------------------------------------------
  describe('single-flight hydration', () => {
    const planRequests = () =>
      vi.mocked(supabase.from).mock.calls.filter((c) => c[0] === 'budget_plan_changes').length;

    it('two overlapping hydrateFromSupabase calls share one run (one set of server requests)', async () => {
      mockSupabaseData.profiles = { daily_budget: 100, is_auto_renew: true, is_budget_mode_enabled: true, budget_cadence: 'daily' };
      const store = useDailyBudgetStore.getState();

      const first = store.hydrateFromSupabase(USER_ID);
      const second = store.hydrateFromSupabase(USER_ID);
      await Promise.all([first, second]);

      expect(planRequests()).toBe(1);
      expect(useDailyBudgetStore.getState().hydratedForUserId).toBe(USER_ID);
    });

    it('a call after the first run finished starts a fresh run', async () => {
      mockSupabaseData.profiles = { daily_budget: 100, is_auto_renew: true, is_budget_mode_enabled: true, budget_cadence: 'daily' };
      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);
      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);
      expect(planRequests()).toBe(2);
    });

    it('a different user never joins the run of another user', async () => {
      mockSupabaseData.profiles = { daily_budget: 100, is_auto_renew: true, is_budget_mode_enabled: true, budget_cadence: 'daily' };
      const a = useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);
      const b = useDailyBudgetStore.getState().hydrateFromSupabase('someone_else');
      await Promise.all([a, b]);
      expect(planRequests()).toBe(2);
    });
  });
  // -------------------------------------------------------------------------
  // 5. Same switch while the app was OPEN at midnight (PUR-003, FIN-16): mode and auto-save came on but today's
  //    unfinalized record kept budget 0, so the first Budget Mode day had no allowance at all.
  // -------------------------------------------------------------------------
  describe('PUR-003: scheduled Budget Mode switch maturing while the app is open', () => {
    const seedPureDay = (overrides: Record<string, unknown> = {}) => {
      useDailyBudgetStore.setState({
        hydratedForUserId: USER_ID,
        ownerUserId: USER_ID,
        isBudgetModeEnabled: false,
        isAutoRenew: false,
        dailyBudgetAmount: 100,
        planChanges: [
          { id: 'p1', userId: USER_ID, effectiveFrom: '2026-01-01', isEnabled: false, cadence: 'daily', amount: 0 },
          { id: 'p2', userId: USER_ID, effectiveFrom: TODAY_STR, isEnabled: true, cadence: 'daily', amount: 100 },
        ],
        dailyRecords: {
          [TODAY_STR]: { date: TODAY_STR, budget: 0, spent: 0, saved: 0, isFinalized: false, status: 'unknown' },
        },
        ...overrides,
      });
    };

    it('gives today the daily budget at once when the rollover turns Budget Mode on', () => {
      seedPureDay();

      useDailyBudgetStore.getState().checkAndRollover([]);

      const state = useDailyBudgetStore.getState();
      expect(state.isBudgetModeEnabled).toBe(true);
      expect(state.isAutoRenew).toBe(true);
      expect(state.dailyRecords[TODAY_STR].budget).toBe(100);
      expect(state.dailyRecords[TODAY_STR].status).toBe('active');
      expect(state.dailyRecords[TODAY_STR].saved).toBe(100);
    });

    it('counts what was already spent today against the new daily budget', () => {
      const spentToday = [
        { id: 'e1', user_id: USER_ID, amount: 30, category_id: null, note: '', payment_mode: 'cash', expense_date: TODAY_STR, created_at: `${TODAY_STR}T08:00:00Z` },
      ] as any[];
      registerExpenseGetter(() => spentToday);
      seedPureDay({
        // Gullak money already covers the ₹30, so this scenario has no Pure Mode deficit to auto-balance (PUR-001).
        gullakDeposits: [
          { id: 'g1', amount: 1000, date: '2026-03-01', note: '', source: 'external', created_at: '2026-03-01T10:00:00Z' },
        ],
        dailyRecords: {
          [TODAY_STR]: { date: TODAY_STR, budget: 0, spent: 30, saved: 0, isFinalized: false, status: 'unknown' },
        },
      });

      useDailyBudgetStore.getState().checkAndRollover(spentToday);

      const rec = useDailyBudgetStore.getState().dailyRecords[TODAY_STR];
      expect(rec.budget).toBe(100);
      expect(rec.spent).toBe(30);
      expect(rec.saved).toBe(70);
    });

    it('syncWithExpenses heals a zero allowance when Budget Mode and auto-save are on', () => {
      seedPureDay({ isBudgetModeEnabled: true, isAutoRenew: true });

      useDailyBudgetStore.getState().syncWithExpenses([]);

      expect(useDailyBudgetStore.getState().dailyRecords[TODAY_STR].budget).toBe(100);
    });

    it('syncWithExpenses never fills a paused allowance (auto-save OFF stays 0, section 8.1)', () => {
      seedPureDay({ isBudgetModeEnabled: true, isAutoRenew: false });

      useDailyBudgetStore.getState().syncWithExpenses([]);

      expect(useDailyBudgetStore.getState().dailyRecords[TODAY_STR].budget).toBe(0);
    });

    it('never overwrites a real budget that is already set for today', () => {
      seedPureDay({
        isBudgetModeEnabled: true,
        isAutoRenew: true,
        dailyBudgetAmount: 100,
        dailyRecords: {
          [TODAY_STR]: { date: TODAY_STR, budget: 250, spent: 0, saved: 250, isFinalized: false, status: 'active' },
        },
      });

      useDailyBudgetStore.getState().syncWithExpenses([]);

      expect(useDailyBudgetStore.getState().dailyRecords[TODAY_STR].budget).toBe(250);
    });

    it('does not give a daily budget to a day owned by a weekly plan', () => {
      seedPureDay({
        isBudgetModeEnabled: true,
        isAutoRenew: true,
        budgetCadence: 'weekly',
        weeklyBudgetAmount: 700,
        planChanges: [
          { id: 'p1', userId: USER_ID, effectiveFrom: '2026-01-01', isEnabled: false, cadence: 'daily', amount: 0 },
          { id: 'p2', userId: USER_ID, effectiveFrom: TODAY_STR, isEnabled: true, cadence: 'weekly', amount: 700 },
        ],
      });

      useDailyBudgetStore.getState().syncWithExpenses([]);

      expect(useDailyBudgetStore.getState().dailyRecords[TODAY_STR].budget).toBe(0);
    });

    it('does not touch a finalized day', () => {
      seedPureDay({
        isBudgetModeEnabled: true,
        isAutoRenew: true,
        dailyRecords: {
          [TODAY_STR]: { date: TODAY_STR, budget: 0, spent: 0, saved: 0, isFinalized: true, status: 'unknown' },
        },
      });

      useDailyBudgetStore.getState().syncWithExpenses([]);

      expect(useDailyBudgetStore.getState().dailyRecords[TODAY_STR].budget).toBe(0);
    });
  });
  // -------------------------------------------------------------------------
  // 6. PUR-001 on a cold start: the Pure -> Budget deficit auto-balance for a switch that matured while the app was
  //    closed. It waits for expenses that come FROM THE SERVER (a stale saved list could invent a deficit) and measures
  //    the deficit before today's new allowance, exactly like the switch does when the app is open.
  // -------------------------------------------------------------------------
  describe('PUR-001: deficit auto-balance for a switch that matured on a cold start', () => {
    const DEFICIT_KEY = `@arthik_pending_deficit_check_${USER_ID}`;
    const spend500 = [
      { id: 'e1', user_id: USER_ID, amount: 500, category_id: null, note: '', payment_mode: 'cash', expense_date: '2026-03-10', created_at: '2026-03-10T08:00:00Z' },
    ] as any[];
    let expenses: any[] = [];
    let fresh = true;
    const addSpy = vi.fn(async () => {});

    const maturedPlans = () => {
      mockSupabaseData.profiles = { daily_budget: 100, is_auto_renew: false, is_budget_mode_enabled: false, budget_cadence: 'daily' };
      mockSupabaseData.planChanges = [
        { id: 'p1', effective_from: '2026-01-01', is_enabled: false, cadence: 'daily', amount: 0 },
        { id: 'p2', effective_from: TODAY_STR, is_enabled: true, cadence: 'daily', amount: 100 },
      ];
    };

    beforeEach(() => {
      expenses = spend500;
      fresh = true;
      addSpy.mockClear();
      registerExpenseGetter(() => expenses);
      registerExpensesFreshGetter(() => fresh);
      registerAddExpense(addSpy as any);
    });

    it('adds the deficit income once, measured before the new daily allowance, when expenses are fresh', async () => {
      maturedPlans();

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      expect(addSpy).toHaveBeenCalledTimes(1);
      const call = addSpy.mock.calls[0] as unknown as unknown[];
      expect(call[0]).toBe(500); // not 400: the new ₹100 daily allowance is not counted against the old overspend
      expect(call[1]).toBeNull();
      expect(call[5]).toBe('income');
      expect(storageMap.has(DEFICIT_KEY)).toBe(false);
    });

    it('waits while the expenses are only the saved copy, then runs once when the server copy arrives', async () => {
      maturedPlans();
      fresh = false;

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);
      expect(addSpy).not.toHaveBeenCalled();
      expect(storageMap.get(DEFICIT_KEY)).toBe(TODAY_STR); // remembered, survives a restart

      fresh = true;
      useDailyBudgetStore.getState().checkAndRollover(expenses);
      expect(addSpy).toHaveBeenCalledTimes(1);

      useDailyBudgetStore.getState().checkAndRollover(expenses);
      expect(addSpy).toHaveBeenCalledTimes(1); // never twice
    });

    it('a restart in between keeps the check (it is read back from the phone)', async () => {
      maturedPlans();
      fresh = false;
      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);
      expect(addSpy).not.toHaveBeenCalled();

      // App restarted: store state is rebuilt, the saved marker is still there.
      useDailyBudgetStore.getState().resetDailyBudget();
      fresh = true;
      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      expect(addSpy).toHaveBeenCalledTimes(1);
    });

    it('adds nothing when the money covers the spending (no deficit)', async () => {
      maturedPlans();
      useDailyBudgetStore.setState({
        gullakDeposits: [
          { id: 'g1', amount: 1000, date: '2026-03-01', note: '', source: 'external', created_at: '2026-03-01T10:00:00Z' },
        ],
      });
      mockSupabaseData.deposits = [
        { id: 'g1', amount: 1000, date: '2026-03-01', note: '', source: 'external', created_at: '2026-03-01T10:00:00Z' },
      ];

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      expect(addSpy).not.toHaveBeenCalled();
      expect(storageMap.has(DEFICIT_KEY)).toBe(false);
    });

    it('a Budget Mode that was already on does not start a deficit check', async () => {
      mockSupabaseData.profiles = { daily_budget: 100, is_auto_renew: true, is_budget_mode_enabled: true, budget_cadence: 'daily' };
      mockSupabaseData.planChanges = [
        { id: 'p0', effective_from: '2026-03-01', is_enabled: true, cadence: 'daily', amount: 100 },
      ];

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      expect(addSpy).not.toHaveBeenCalled();
      expect(storageMap.has(DEFICIT_KEY)).toBe(false);
    });

    it('a Budget Mode to Pure Mode switch never starts a deficit check', async () => {
      mockSupabaseData.profiles = { daily_budget: 100, is_auto_renew: true, is_budget_mode_enabled: true, budget_cadence: 'daily' };
      mockSupabaseData.planChanges = [
        { id: 'p0', effective_from: '2026-03-01', is_enabled: true, cadence: 'daily', amount: 100 },
        { id: 'p2', effective_from: TODAY_STR, is_enabled: false, cadence: 'daily', amount: 100 },
      ];

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      expect(addSpy).not.toHaveBeenCalled();
      expect(storageMap.has(DEFICIT_KEY)).toBe(false);
    });

    it('drops an old marker without adding anything when the app is in Pure Mode', async () => {
      storageMap.set(DEFICIT_KEY, '2026-03-10');
      mockSupabaseData.profiles = { daily_budget: 100, is_auto_renew: false, is_budget_mode_enabled: false, budget_cadence: 'daily' };
      mockSupabaseData.planChanges = [
        { id: 'p1', effective_from: '2026-01-01', is_enabled: false, cadence: 'daily', amount: 0 },
      ];

      await useDailyBudgetStore.getState().hydrateFromSupabase(USER_ID);

      expect(addSpy).not.toHaveBeenCalled();
      expect(storageMap.has(DEFICIT_KEY)).toBe(false);
    });
  });
});
