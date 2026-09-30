import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock react-native and lucide-react-native to avoid Flow parse errors in node
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

// 1. Setup in-memory AsyncStorage
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

// 2. Mock expo-crypto
let uuidCounter = 1;
vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => `30000000-0000-4000-8000-${String(uuidCounter++).padStart(12, '0')}`),
}));

// 3. Mock Supabase
const mockSupabaseUpsert = vi.fn().mockResolvedValue({ error: null });
const mockSupabaseUpdate = vi.fn().mockResolvedValue({ error: null });
const mockSupabaseInsert = vi.fn().mockResolvedValue({ error: null });
const mockSupabaseDelete = vi.fn().mockResolvedValue({ error: null });

vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockSupabaseInsert,
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: mockSupabaseDelete,
        })),
      })),
      update: vi.fn(() => ({
        eq: mockSupabaseUpdate,
      })),
      upsert: mockSupabaseUpsert,
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user_modes_test_1', created_at: '2026-09-01T00:00:00Z' } } },
      }),
    },
  },
}));

// 4. Mock AuthStore
let mockUser: any = { id: 'user_modes_test_1', created_at: '2026-09-01T00:00:00Z' };
vi.mock('../src/store/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      user: mockUser,
    })),
  },
  registerStoreResetCallback: vi.fn(),
}));

// 5. Mock CategoryStore
vi.mock('../src/store/categoryStore', () => ({
  useCategoryStore: {
    getState: vi.fn(() => ({
      categories: [],
    })),
  },
}));

// 6. Mock NotificationService & NotificationStore
const mockTriggerDeviceNotification = vi.fn();
const mockAddNotification = vi.fn();
vi.mock('../src/lib/notificationService', () => ({
  triggerDeviceNotification: (...args: any[]) => mockTriggerDeviceNotification(...args),
}));
vi.mock('../src/store/notificationStore', () => ({
  useNotificationStore: {
    getState: vi.fn(() => ({
      addNotification: (...args: any[]) => mockAddNotification(...args),
      setOwnerUserId: vi.fn(),
    })),
  },
}));

// Import store & helpers
import {
  useDailyBudgetStore,
  registerExpensesLoadedGetter,
  registerExpenseGetter,
  getPendingPlanChangesKey,
  savePendingPlanChangeOffline,
  savePendingSettingsOffline,
  clearPendingSettingsOffline,
} from '../src/store/dailyBudgetStore';
import { format, subDays } from 'date-fns';
import { Expense } from '../src/store/expenseStore';

describe('Budget Modes & Cadence Integration (dailyBudgetStore)', () => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
    mockUser = { id: 'user_modes_test_1', created_at: '2026-09-01T00:00:00Z' };
    uuidCounter = 1;
    registerExpensesLoadedGetter(() => true);
    registerExpenseGetter(() => []);
    useDailyBudgetStore.getState().resetDailyBudget();
  });

  describe('1. Persist Migration (v-old -> v3)', () => {
    it('safely migrates old persisted payload missing budget mode fields without crashing', () => {
      const persistOptions = (useDailyBudgetStore as any).persist?.getOptions();
      expect(persistOptions.version).toBe(3);

      const oldPayloadV1 = {
        dailyBudgetAmount: 500,
        isAutoRenew: true,
        dailyRecords: {
          '2026-09-20': { date: '2026-09-20', budget: 500, spent: 300, saved: 200, status: 'saved', isFinalized: true },
        },
        gullakDeposits: [{ id: 'dep-1', amount: 100, date: '2026-09-20', source: 'external', created_at: '2026-09-20T10:00:00Z' }],
        bestStreak: 7,
        totalAccumulatedSavings: 300,
      };

      const migrated = persistOptions.migrate(oldPayloadV1, 2);

      // Verify defaults and inferred mode
      expect(migrated.isBudgetModeEnabled).toBe(true); // Inferred from isAutoRenew + saved record
      expect(migrated.budgetCadence).toBe('daily');
      expect(migrated.weeklyBudgetAmount).toBe(0);
      expect(migrated.monthlyBudgetAmount).toBe(0);
      expect(migrated.planChanges).toEqual([]);
      expect(migrated.budgetPeriods).toEqual({});
      expect(migrated.bestStreakByCadence).toEqual({ daily: 7, weekly: 0, monthly: 0 });
      expect(migrated.lastPeriodWarningKey).toBeNull();
      expect(migrated.lastPeriodExceededKey).toBeNull();
      expect(migrated.lastPeriodRolloverKey).toBeNull();
    });

    it('infers isBudgetModeEnabled as false for fresh install / empty state without history', () => {
      const persistOptions = (useDailyBudgetStore as any).persist?.getOptions();
      const emptyOldPayload = {
        dailyBudgetAmount: 100,
        isAutoRenew: false,
        dailyRecords: {},
        gullakDeposits: [],
        bestStreak: 0,
      };

      const migrated = persistOptions.migrate(emptyOldPayload, 1);
      expect(migrated.isBudgetModeEnabled).toBe(false);
      expect(migrated.budgetCadence).toBe('daily');
    });
  });

  describe('2. Daily-Only User Regression Check', () => {
    it('produces identical metrics and daily behavior before and after multi-cadence changes', () => {
      useDailyBudgetStore.setState({
        ownerUserId: 'user_modes_test_1',
        hydratedForUserId: 'user_modes_test_1',
        isBudgetModeEnabled: true,
        budgetCadence: 'daily',
        dailyBudgetAmount: 500,
        isAutoRenew: true,
        budgetPeriods: {},
        planChanges: [
          {
            id: 'plan-daily',
            userId: 'user_modes_test_1',
            effectiveFrom: '2026-09-01',
            isEnabled: true,
            cadence: 'daily',
            amount: 500,
            createdAt: '2026-09-01T00:00:00Z',
          },
        ],
      });

      const expenses: Expense[] = [
        {
          id: 'exp-yesterday',
          user_id: 'user_modes_test_1',
          amount: 200,
          expense_date: yesterdayStr,
          payment_mode: 'cash',
        },
      ];

      useDailyBudgetStore.getState().checkAndRollover(expenses);

      const state = useDailyBudgetStore.getState();
      expect(state.dailyRecords[yesterdayStr]).toBeDefined();
      expect(state.dailyRecords[yesterdayStr].budget).toBe(500);
      expect(state.dailyRecords[yesterdayStr].spent).toBe(200);
      expect(state.dailyRecords[yesterdayStr].saved).toBe(300);
      expect(state.dailyRecords[yesterdayStr].status).toBe('saved');
      expect(state.totalAccumulatedSavings).toBe(300);
      expect(state.savingsStreak).toBe(1);
      expect(state.bestStreak).toBe(1);
      expect(state.bestStreakByCadence.daily).toBe(1);
      expect(Object.keys(state.budgetPeriods).length).toBe(0);
    });
  });

  describe('3. Weekly User Period Finalization & Gullak Growth', () => {
    it('finalizes completed weekly period, increases Gullak total, and creates NO daily records for that week', () => {
      // Historical week: Mon 2026-09-21 to Sun 2026-09-27
      // Today is past that week (we will use a date past 2026-09-27)
      const weeklyPlan = {
        id: 'plan-weekly-1',
        userId: 'user_modes_test_1',
        effectiveFrom: '2026-09-21',
        isEnabled: true,
        cadence: 'weekly' as const,
        amount: 7000,
        createdAt: '2026-09-21T00:00:00Z',
      };

      useDailyBudgetStore.setState({
        ownerUserId: 'user_modes_test_1',
        hydratedForUserId: 'user_modes_test_1',
        isBudgetModeEnabled: true,
        budgetCadence: 'weekly',
        weeklyBudgetAmount: 7000,
        planChanges: [weeklyPlan],
        dailyRecords: {},
        budgetPeriods: {},
      });

      // 3 expenses during the week 2026-09-21 to 2026-09-27, totaling 4500
      const expenses: Expense[] = [
        { id: 'w1', user_id: 'user_modes_test_1', amount: 1500, expense_date: '2026-09-22', payment_mode: 'upi' },
        { id: 'w2', user_id: 'user_modes_test_1', amount: 2000, expense_date: '2026-09-24', payment_mode: 'upi' },
        { id: 'w3', user_id: 'user_modes_test_1', amount: 1000, expense_date: '2026-09-26', payment_mode: 'cash' },
      ];

      // Assuming todayStr is > 2026-09-27 (the system date is 2026-09-30)
      useDailyBudgetStore.getState().checkAndRollover(expenses);

      const state = useDailyBudgetStore.getState();
      const periodKey = 'weekly_2026-09-21';
      expect(state.budgetPeriods[periodKey]).toBeDefined();

      const period = state.budgetPeriods[periodKey];
      expect(period.cadence).toBe('weekly');
      expect(period.periodStart).toBe('2026-09-21');
      expect(period.periodEnd).toBe('2026-09-27');
      expect(period.budgetAmount).toBe(7000);
      expect(period.spentAmount).toBe(4500);
      expect(period.amountSaved).toBe(2500);
      expect(period.status).toBe('saved');

      // Gullak accumulated savings must include the 2500 saved from this period
      expect(state.totalAccumulatedSavings).toBe(2500);

      // Verify that NO daily records were created for dates governed by weekly cadence
      expect(state.dailyRecords['2026-09-21']).toBeUndefined();
      expect(state.dailyRecords['2026-09-22']).toBeUndefined();
      expect(state.dailyRecords['2026-09-24']).toBeUndefined();
      expect(state.dailyRecords['2026-09-26']).toBeUndefined();
      expect(state.dailyRecords['2026-09-27']).toBeUndefined();
    });
  });

  describe('4. Mode OFF (Pure Expense Tracker)', () => {
    it('sends NO warning/exceeded/rollover notifications, creates no records, and leaves manual deposits untouched', () => {
      useDailyBudgetStore.setState({
        ownerUserId: 'user_modes_test_1',
        hydratedForUserId: 'user_modes_test_1',
        isBudgetModeEnabled: false,
        budgetCadence: 'daily',
        dailyBudgetAmount: 500,
        gullakDeposits: [
          { id: 'dep-safe', amount: 1200, date: '2026-09-10', source: 'external', created_at: '2026-09-10T12:00:00Z' },
        ],
        dailyRecords: {},
      });

      // Big expense that would otherwise trigger warning or exceeded
      const expenses: Expense[] = [
        {
          id: 'exp-big',
          user_id: 'user_modes_test_1',
          amount: 2500,
          expense_date: todayStr,
          payment_mode: 'upi',
        },
      ];

      useDailyBudgetStore.getState().syncWithExpenses(expenses);

      // Assert no notifications fired
      expect(mockAddNotification).not.toHaveBeenCalled();
      expect(mockTriggerDeviceNotification).not.toHaveBeenCalled();

      // Gullak deposit must be completely preserved
      const state = useDailyBudgetStore.getState();
      expect(state.gullakDeposits.length).toBe(1);
      expect(state.gullakDeposits[0].amount).toBe(1200);
      expect(state.totalAccumulatedSavings).toBe(1200);
    });

    it('turning OFF via setBudgetModeEnabled does NOT delete records or Gullak deposits', () => {
      useDailyBudgetStore.setState({
        ownerUserId: 'user_modes_test_1',
        hydratedForUserId: 'user_modes_test_1',
        isBudgetModeEnabled: true,
        budgetCadence: 'daily',
        dailyBudgetAmount: 500,
        gullakDeposits: [
          { id: 'dep-1', amount: 500, date: '2026-09-15', source: 'external', created_at: '2026-09-15T10:00:00Z' },
        ],
        dailyRecords: {
          '2026-09-15': { date: '2026-09-15', budget: 500, spent: 200, saved: 300, status: 'saved', isFinalized: true },
        },
        totalAccumulatedSavings: 800,
      });

      useDailyBudgetStore.getState().setBudgetModeEnabled(false);

      const state = useDailyBudgetStore.getState();
      expect(state.isBudgetModeEnabled).toBe(false);
      // Historical records and deposits must remain intact
      expect(state.gullakDeposits.length).toBe(1);
      expect(state.dailyRecords['2026-09-15']).toBeDefined();
      expect(state.dailyRecords['2026-09-15'].saved).toBe(300);
    });
  });

  describe('5. Offline Queueing & Reconnect Sync', () => {
    it('queues plan changes and settings offline in AsyncStorage and flushes on sync', async () => {
      const userId = 'user_modes_test_1';
      const planChange = {
        id: 'plan-offline-1',
        userId,
        effectiveFrom: '2026-10-01',
        isEnabled: true,
        cadence: 'monthly' as const,
        amount: 25000,
        createdAt: '2026-09-30T10:00:00Z',
      };

      // 1. Save offline
      await savePendingSettingsOffline(userId, {
        is_budget_mode_enabled: true,
        budget_cadence: 'monthly',
        monthly_budget: 25000,
      });
      await savePendingPlanChangeOffline(userId, planChange);

      // Verify stored in AsyncStorage
      const storedPlanChanges = storageMap.get(getPendingPlanChangesKey(userId));
      expect(storedPlanChanges).toBeDefined();
      expect(JSON.parse(storedPlanChanges!)).toHaveLength(1);
      expect(JSON.parse(storedPlanChanges!)[0].amount).toBe(25000);

      // 2. Sync online
      useDailyBudgetStore.setState({
        ownerUserId: userId,
        hydratedForUserId: userId,
      });

      await useDailyBudgetStore.getState().syncPendingPlanChanges();

      // Verify Supabase upsert was called
      expect(mockSupabaseUpsert).toHaveBeenCalled();

      // Verify queue is cleared after successful sync
      const remainingChanges = storageMap.get(getPendingPlanChangesKey(userId));
      expect(JSON.parse(remainingChanges || '[]')).toHaveLength(0);
    });
  });

  describe('6. Sign-Out Reset', () => {
    it('resets every multi-cadence field on resetDailyBudget', () => {
      useDailyBudgetStore.setState({
        isBudgetModeEnabled: true,
        budgetCadence: 'monthly',
        weeklyBudgetAmount: 7000,
        monthlyBudgetAmount: 30000,
        planChanges: [
          {
            id: 'c1',
            userId: 'user_1',
            effectiveFrom: '2026-10-01',
            isEnabled: true,
            cadence: 'monthly',
            amount: 30000,
            createdAt: '2026-09-30T00:00:00Z',
          },
        ],
        budgetPeriods: {
          'monthly_2026-09-01': {
            id: 'monthly_2026-09-01',
            userId: 'user_1',
            cadence: 'monthly',
            periodStart: '2026-09-01',
            periodEnd: '2026-09-30',
            activeStart: '2026-09-01',
            activeEnd: '2026-09-30',
            budgetAmount: 30000,
            spentAmount: 20000,
            amountSaved: 10000,
            status: 'saved',
            isProrated: false,
          },
        },
        bestStreakByCadence: { daily: 5, weekly: 3, monthly: 2 },
        lastPeriodWarningKey: 'monthly_2026-09-01',
        lastPeriodExceededKey: 'monthly_2026-09-01',
        lastPeriodRolloverKey: 'monthly_2026-09-01',
      });

      useDailyBudgetStore.getState().resetDailyBudget();

      const state = useDailyBudgetStore.getState();
      expect(state.isBudgetModeEnabled).toBe(false);
      expect(state.budgetCadence).toBe('daily');
      expect(state.weeklyBudgetAmount).toBe(0);
      expect(state.monthlyBudgetAmount).toBe(0);
      expect(state.planChanges).toEqual([]);
      expect(state.budgetPeriods).toEqual({});
      expect(state.bestStreakByCadence).toEqual({ daily: 0, weekly: 0, monthly: 0 });
      expect(state.lastPeriodWarningKey).toBeNull();
      expect(state.lastPeriodExceededKey).toBeNull();
      expect(state.lastPeriodRolloverKey).toBeNull();
    });
  });
});
