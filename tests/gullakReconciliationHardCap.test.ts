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

// Mock expo-crypto
let depositIdCounter = 1;
vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => `20000000-0000-4000-8000-${String(depositIdCounter++).padStart(12, '0')}`),
}));

// In-memory mock storage
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

// Mock CategoryStore
vi.mock('../src/store/categoryStore', () => ({
  useCategoryStore: {
    getState: vi.fn(() => ({
      categories: [],
    })),
  },
}));

// Mock NotificationService & NotificationStore
vi.mock('../src/lib/notificationService', () => ({
  triggerDeviceNotification: vi.fn(),
}));
vi.mock('../src/store/notificationStore', () => ({
  useNotificationStore: {
    getState: vi.fn(() => ({
      addNotification: vi.fn(),
      setOwnerUserId: vi.fn(),
    })),
  },
}));

import { useDailyBudgetStore, registerExpenseGetter } from '../src/store/dailyBudgetStore';
import { calculateSavingsMetrics, DailyRecord } from '../src/lib/budgetCalculations';
import { Expense } from '../src/store/expenseStore';

describe('Gullak Reconciliation & Real-Money Invariant Hard Cap', () => {
  const TODAY_STR = '2026-10-10';
  const FIXED_REF_DATE = new Date(2026, 9, 10);
  const USER_CREATED = '2026-10-01';

  beforeEach(() => {
    vi.clearAllMocks();
    useDailyBudgetStore.getState().resetDailyBudget();
  });

  describe('1. Pure Function calculateSavingsMetrics with totalAccountRemaining', () => {
    it('caps totalAccumulatedSavings at totalAccountRemaining when remaining cash is lower than saved records', () => {
      const records: Record<string, DailyRecord> = {
        '2026-10-05': {
          date: '2026-10-05',
          budget: 500,
          spent: 100,
          saved: 400,
          isFinalized: true,
          status: 'saved',
        },
        '2026-10-06': {
          date: '2026-10-06',
          budget: 500,
          spent: 100,
          saved: 400,
          isFinalized: true,
          status: 'saved',
        },
      };

      // Raw savings = 400 + 400 = 800.
      // But user's total remaining cash across the account is only 350.
      const metrics = calculateSavingsMetrics(
        records,
        TODAY_STR,
        USER_CREATED,
        FIXED_REF_DATE,
        0, // manual deposits
        0, // available income
        350 // totalAccountRemaining cap
      );

      expect(metrics.totalAccumulatedSavings).toBe(350);
    });

    it('does not artificially lower totalAccumulatedSavings if totalAccountRemaining is higher', () => {
      const records: Record<string, DailyRecord> = {
        '2026-10-05': {
          date: '2026-10-05',
          budget: 500,
          spent: 100,
          saved: 400,
          isFinalized: true,
          status: 'saved',
        },
      };

      // Raw savings = 400, Account remaining = 1500
      const metrics = calculateSavingsMetrics(
        records,
        TODAY_STR,
        USER_CREATED,
        FIXED_REF_DATE,
        0,
        0,
        1500
      );

      expect(metrics.totalAccumulatedSavings).toBe(400);
    });

    it('clamps totalAccumulatedSavings to 0 when totalAccountRemaining is 0 or negative', () => {
      const records: Record<string, DailyRecord> = {
        '2026-10-05': {
          date: '2026-10-05',
          budget: 500,
          spent: 100,
          saved: 400,
          isFinalized: true,
          status: 'saved',
        },
      };

      const metricsZero = calculateSavingsMetrics(
        records,
        TODAY_STR,
        USER_CREATED,
        FIXED_REF_DATE,
        0,
        0,
        0
      );
      expect(metricsZero.totalAccumulatedSavings).toBe(0);

      const metricsNegative = calculateSavingsMetrics(
        records,
        TODAY_STR,
        USER_CREATED,
        FIXED_REF_DATE,
        0,
        0,
        -200
      );
      expect(metricsNegative.totalAccumulatedSavings).toBe(0);
    });
  });

  describe('2. Store-Level Invariant: Gullak <= Total Account Remaining', () => {
    it('automatically caps Gullak when user spends money in Pure Mode or untracked days', () => {
      // User had budget ₹500 for 2 past days = ₹1,000 budget.
      // Saved ₹400 on each of 2 past days = ₹800 saved in Gullak.
      // Then user switched Budget Mode OFF (Pure Mode) and spent ₹700 on 2026-10-09.
      // Total Inflow = ₹1,000 (past active budget).
      // Total Outflow = 100 + 100 + 700 = ₹900.
      // Total Account Remaining = 1,000 - 900 = ₹100.
      const expenses: Expense[] = [
        { id: 'e1', user_id: 'user_budget_test_1', amount: 100, type: 'expense', expense_date: '2026-10-05', category_id: null, payment_mode: 'upi', created_at: '2026-10-05' },
        { id: 'e2', user_id: 'user_budget_test_1', amount: 100, type: 'expense', expense_date: '2026-10-06', category_id: null, payment_mode: 'upi', created_at: '2026-10-06' },
        { id: 'e3', user_id: 'user_budget_test_1', amount: 700, type: 'expense', expense_date: '2026-10-09', category_id: null, payment_mode: 'upi', created_at: '2026-10-09' },
      ];
      registerExpenseGetter(() => expenses);

      useDailyBudgetStore.setState({
        dailyBudgetAmount: 100,
        isBudgetModeEnabled: false, // Pure Mode
        isAutoRenew: false,
        dailyRecords: {
          '2026-10-05': { date: '2026-10-05', budget: 500, spent: 100, saved: 400, isFinalized: true, status: 'saved' },
          '2026-10-06': { date: '2026-10-06', budget: 500, spent: 100, saved: 400, isFinalized: true, status: 'saved' },
          '2026-10-09': { date: '2026-10-09', budget: 0, spent: 700, saved: 0, isFinalized: true, status: 'unknown' },
        },
      });

      useDailyBudgetStore.getState().syncWithExpenses(expenses);

      // Raw Gullak is 400 + 400 = 800 (since unknown days contribute 0 to overspend).
      // Total Account Remaining is: (1,000 inflow) - (900 spent) = ₹100.
      // Reconciled Gullak MUST be capped at ₹100!
      expect(useDailyBudgetStore.getState().totalAccumulatedSavings).toBe(100);
    });

    it('caps Gullak in Pure Mode when user deposited manual funds but spent account cash', () => {
      // Pure mode (budget mode disabled):
      // Income = ₹10,000.
      // Manual Gullak Deposit = ₹5,000.
      // User spent ₹9,200 on expenses.
      // Total Account Remaining = 10,000 - 9,200 = ₹800.
      const expenses: Expense[] = [
        { id: 'inc1', user_id: 'user_budget_test_1', amount: 10000, type: 'income', expense_date: '2026-10-01', category_id: null, payment_mode: 'upi', created_at: '2026-10-01' },
        { id: 'exp1', user_id: 'user_budget_test_1', amount: 9200, type: 'expense', expense_date: '2026-10-05', category_id: null, payment_mode: 'upi', created_at: '2026-10-05' },
      ];
      registerExpenseGetter(() => expenses);

      useDailyBudgetStore.setState({
        isBudgetModeEnabled: false,
        dailyRecords: {},
        gullakDeposits: [
          { id: 'dep1', amount: 5000, date: '2026-10-02', source: 'income', created_at: '2026-10-02' },
        ],
      });

      useDailyBudgetStore.getState().syncWithExpenses(expenses);

      // Remaining cash is only ₹800. Gullak cannot have ₹5,000 when only ₹800 exists!
      expect(useDailyBudgetStore.getState().totalAccumulatedSavings).toBe(800);
    });

    it('drops Gullak to 0 when user is in overall deficit across the account', () => {
      const expenses: Expense[] = [
        { id: 'exp1', user_id: 'user_budget_test_1', amount: 3500, type: 'expense', expense_date: '2026-10-05', category_id: null, payment_mode: 'upi', created_at: '2026-10-05' },
      ];
      registerExpenseGetter(() => expenses);

      useDailyBudgetStore.setState({
        dailyBudgetAmount: 500,
        isBudgetModeEnabled: true,
        isAutoRenew: true,
        dailyRecords: {
          '2026-10-04': { date: '2026-10-04', budget: 500, spent: 100, saved: 400, isFinalized: true, status: 'saved' },
        },
      });

      useDailyBudgetStore.getState().syncWithExpenses(expenses);

      // Inflow = 500 budget. Spent = 3500. Total Remaining = 0 (deficit of 3000).
      // Gullak must be 0!
      expect(useDailyBudgetStore.getState().totalAccumulatedSavings).toBe(0);
    });
  });
});
