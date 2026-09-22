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
let depositIdCounter = 1;
vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => `20000000-0000-4000-8000-${String(depositIdCounter++).padStart(12, '0')}`),
}));

// 3. Mock Supabase
vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user_budget_test_1', created_at: '2026-09-01T00:00:00Z' } } },
      }),
    },
  },
}));

// 4. Mock AuthStore
let mockUser: any = { id: 'user_budget_test_1', created_at: '2026-09-01T00:00:00Z' };
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
vi.mock('../src/lib/notificationService', () => ({
  triggerDeviceNotification: vi.fn(),
}));
vi.mock('../src/store/notificationStore', () => ({
  useNotificationStore: {
    getState: vi.fn(() => ({
      addNotification: vi.fn(),
    })),
  },
}));

// Import store
import {
  useDailyBudgetStore,
  registerExpensesLoadedGetter,
  registerExpenseGetter,
} from '../src/store/dailyBudgetStore';
import { format, subDays } from 'date-fns';

describe('dailyBudgetStore (Seam: useDailyBudgetStore)', () => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
    mockUser = { id: 'user_budget_test_1', created_at: '2026-09-01T00:00:00Z' };
    depositIdCounter = 1;
    registerExpensesLoadedGetter(() => true);
    registerExpenseGetter(() => []);
    useDailyBudgetStore.getState().resetDailyBudget();
  });

  describe('Slice 1: P0.1 User Isolation Guard', () => {
    it('does NOT run checkAndRollover if store is not hydrated for current user', () => {
      // Set store hydrated for a different user
      useDailyBudgetStore.setState({
        hydratedForUserId: 'different_user_999',
        dailyRecords: {},
        dailyBudgetAmount: 500,
        isAutoRenew: true,
      });

      const expenses = [
        {
          id: 'exp1',
          user_id: 'user_budget_test_1',
          amount: 200,
          expense_date: yesterdayStr,
          payment_mode: 'cash' as const,
        },
      ];

      useDailyBudgetStore.getState().checkAndRollover(expenses);

      // Records must remain untouched because of P0.1 guard
      expect(useDailyBudgetStore.getState().dailyRecords).toEqual({});
    });

    it('does NOT run checkAndRollover if currentUser is null', () => {
      mockUser = null;
      useDailyBudgetStore.setState({
        hydratedForUserId: 'user_budget_test_1',
        dailyRecords: {},
      });

      useDailyBudgetStore.getState().checkAndRollover([]);

      expect(useDailyBudgetStore.getState().dailyRecords).toEqual({});
    });
  });

  describe('Slice 2: Rollover & Finalization on Hydrated User', () => {
    it('finalizes yesterday record when spending is under budget (status: saved)', () => {
      useDailyBudgetStore.setState({
        hydratedForUserId: 'user_budget_test_1',
        dailyBudgetAmount: 500,
        isAutoRenew: true,
        dailyRecords: {
          [yesterdayStr]: {
            date: yesterdayStr,
            budget: 500,
            spent: 200,
            saved: 300,
            status: 'active',
            isFinalized: false,
          },
        },
      });

      const expenses = [
        {
          id: 'exp1',
          user_id: 'user_budget_test_1',
          amount: 200,
          expense_date: yesterdayStr,
          payment_mode: 'cash' as const,
        },
      ];

      useDailyBudgetStore.getState().checkAndRollover(expenses, true);

      const records = useDailyBudgetStore.getState().dailyRecords;
      expect(records[yesterdayStr]).toBeDefined();
      expect(records[yesterdayStr].isFinalized).toBe(true);
      expect(records[yesterdayStr].saved).toBe(300);
      expect(records[yesterdayStr].status).toBe('saved');
    });

    it('finalizes yesterday record when spending exceeds budget (status: exceeded)', () => {
      useDailyBudgetStore.setState({
        hydratedForUserId: 'user_budget_test_1',
        dailyBudgetAmount: 500,
        isAutoRenew: true,
        dailyRecords: {
          [yesterdayStr]: {
            date: yesterdayStr,
            budget: 500,
            spent: 600,
            saved: 0,
            status: 'active',
            isFinalized: false,
          },
        },
      });

      const expenses = [
        {
          id: 'exp1',
          user_id: 'user_budget_test_1',
          amount: 600,
          expense_date: yesterdayStr,
          payment_mode: 'card' as const,
        },
      ];

      useDailyBudgetStore.getState().checkAndRollover(expenses, true);

      const records = useDailyBudgetStore.getState().dailyRecords;
      expect(records[yesterdayStr].isFinalized).toBe(true);
      expect(records[yesterdayStr].saved).toBe(0);
      expect(records[yesterdayStr].status).toBe('exceeded');
    });
  });

  describe('Slice 3: Custom Today Allowance (setTodayBudget & addToTodayBudget)', () => {
    it('updates today budget without changing profile dailyBudgetAmount', () => {
      useDailyBudgetStore.setState({
        hydratedForUserId: 'user_budget_test_1',
        dailyBudgetAmount: 500,
        isAutoRenew: true,
      });

      useDailyBudgetStore.getState().setTodayBudget(800);

      const state = useDailyBudgetStore.getState();
      expect(state.dailyBudgetAmount).toBe(500); // Baseline unchanged
      expect(state.dailyRecords[todayStr].budget).toBe(800);
    });

    it('adds delta to today budget', () => {
      useDailyBudgetStore.setState({
        hydratedForUserId: 'user_budget_test_1',
        dailyBudgetAmount: 500,
        dailyRecords: {
          [todayStr]: {
            date: todayStr,
            budget: 500,
            spent: 0,
            saved: 500,
            status: 'active',
            isFinalized: false,
          },
        },
      });

      useDailyBudgetStore.getState().addToTodayBudget(250);

      const state = useDailyBudgetStore.getState();
      expect(state.dailyRecords[todayStr].budget).toBe(750);
    });
  });

  describe('Slice 4: Gullak Deposits', () => {
    it('adds gullak deposit and includes it in accumulated savings metrics', () => {
      useDailyBudgetStore.setState({
        hydratedForUserId: 'user_budget_test_1',
        dailyBudgetAmount: 500,
        gullakDeposits: [],
        dailyRecords: {},
      });

      useDailyBudgetStore.getState().addGullakDeposit(1000, 'Diwali gift');

      const state = useDailyBudgetStore.getState();
      expect(state.gullakDeposits.length).toBe(1);
      expect(state.gullakDeposits[0].amount).toBe(1000);
      expect(state.gullakDeposits[0].note).toBe('Diwali gift');
      expect(state.totalAccumulatedSavings).toBeGreaterThanOrEqual(1000);
    });

    it('removes gullak deposit by id', () => {
      const deposit = {
        id: 'dep-test-1',
        amount: 500,
        date: todayStr,
        created_at: new Date().toISOString(),
      };
      useDailyBudgetStore.setState({
        hydratedForUserId: 'user_budget_test_1',
        gullakDeposits: [deposit],
      });

      useDailyBudgetStore.getState().removeGullakDeposit('dep-test-1');

      expect(useDailyBudgetStore.getState().gullakDeposits.length).toBe(0);
    });
  });

  describe('Slice 5: Store Reset on Sign-out', () => {
    it('clears all records, deposits, and hydration on resetDailyBudget', () => {
      useDailyBudgetStore.setState({
        hydratedForUserId: 'user_budget_test_1',
        dailyBudgetAmount: 700,
        isAutoRenew: true,
        dailyRecords: {
          [todayStr]: {
            date: todayStr,
            budget: 700,
            spent: 100,
            saved: 600,
            status: 'active',
            isFinalized: false,
          },
        },
        gullakDeposits: [
          {
            id: 'dep1',
            amount: 200,
            date: todayStr,
            created_at: new Date().toISOString(),
          },
        ],
        totalAccumulatedSavings: 800,
      });

      useDailyBudgetStore.getState().resetDailyBudget();

      const state = useDailyBudgetStore.getState();
      expect(state.hydratedForUserId).toBeNull();
      expect(state.dailyRecords).toEqual({});
      expect(state.gullakDeposits).toEqual([]);
      expect(state.totalAccumulatedSavings).toBe(0);
    });
  });
});
