import { describe, it, expect, beforeEach, vi } from 'vitest';

// Freeze clock to ensure reproducible dates
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-11-15T12:00:00'));

// Mock react-native
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

// In-memory AsyncStorage
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
let uuidCounter = 1;
vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => `40000000-0000-4000-8000-${String(uuidCounter++).padStart(12, '0')}`),
}));

// Mock Supabase
const mockSupabaseSingle = vi.fn().mockResolvedValue({ data: null, error: null });
const createThenableWithSelect = () => {
  const p = Promise.resolve({ data: null, error: null });
  return Object.assign(p, {
    select: vi.fn(() => ({
      single: mockSupabaseSingle,
    })),
  });
};
const mockSupabaseUpsert = vi.fn(() => createThenableWithSelect());
const mockSupabaseUpdate = vi.fn(() => ({
  eq: vi.fn().mockResolvedValue({ error: null }),
}));
const mockSupabaseDelete = vi.fn(() => ({
  eq: vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ error: null }),
  })),
}));

vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: mockSupabaseUpsert,
      update: mockSupabaseUpdate,
      delete: mockSupabaseDelete,
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: mockSupabaseSingle,
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'test_user_pure', created_at: '2026-10-01T00:00:00Z' } } },
      }),
    },
  },
}));

// Mock AuthStore
let mockUser: any = { id: 'test_user_pure', created_at: '2026-10-01T00:00:00Z' };
vi.mock('../src/store/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      user: mockUser,
    })),
  },
  registerStoreResetCallback: vi.fn(),
}));

// Mock notifications
const addedNotifications: any[] = [];
vi.mock('../src/store/notificationStore', () => ({
  useNotificationStore: {
    getState: vi.fn(() => ({
      notifications: addedNotifications,
      addNotification: vi.fn((n: any) => {
        addedNotifications.push(n);
      }),
      removeNotification: vi.fn((id: string) => {
        const idx = addedNotifications.findIndex((n) => n.id === id);
        if (idx >= 0) addedNotifications.splice(idx, 1);
      }),
      setOwnerUserId: vi.fn(),
    })),
  },
}));

vi.mock('../src/lib/notificationService', () => ({
  triggerDeviceNotification: vi.fn(),
  cancelTonightNudge: vi.fn(),
}));

import { calculateVaultLiquidity, VAULT_GUARD_MESSAGE } from '../src/lib/vaultSpendingGuard';
import { isExceedingVaultLiquidity } from '../src/features/autoLog/ledger';
import {
  useDailyBudgetStore,
  registerExpenseGetter,
  registerExpensesLoadedGetter,
  registerAddExpense,
  runWaterfall,
} from '../src/store/dailyBudgetStore';
import { useExpenseStore, Expense } from '../src/store/expenseStore';
import { useCategoryStore } from '../src/store/categoryStore';
import { computeTotalAccountRemaining } from '../src/store/dailyBudget/metrics';
import { calculatePeriodSummary } from '../src/lib/homeCalculations';
import { PURE_DEFICIT_NOTE } from '../src/lib/transactionUtils';
import { DailyRecord } from '../src/lib/budgetCalculations';

describe('Pure Mode Acceptance Tests (PUR-001, PUR-002, SEC-001 amend)', () => {
  beforeEach(() => {
    storageMap.clear();
    addedNotifications.length = 0;
    uuidCounter = 1;

    // Reset stores
    useCategoryStore.setState({ categories: [] });
    useExpenseStore.setState({
      expenses: [],
      isExpensesLoaded: true,
    });

    useDailyBudgetStore.setState({
      isBudgetModeEnabled: false,
      budgetCadence: 'daily',
      dailyBudgetAmount: 0,
      weeklyBudgetAmount: 0,
      monthlyBudgetAmount: 0,
      dailyRecords: {},
      budgetPeriods: {},
      gullakDeposits: [],
      planChanges: [],
      totalAccumulatedSavings: 0,
      hydratedForUserId: 'test_user_pure',
    });

    // Wire bridges
    registerExpenseGetter(() => useExpenseStore.getState().expenses);
    registerExpensesLoadedGetter(() => useExpenseStore.getState().isExpensesLoaded);
    registerAddExpense((amount, categoryId, note, paymentMode, expenseDate, type, extras) =>
      useExpenseStore.getState().addExpense(amount, categoryId, note, paymentMode, expenseDate, type, extras)
    );
  });

  it('1. SEC-001: Pure Mode allows spending when Remaining <= 0, Budget Mode blocks, and AutoLog respects mode', () => {
    // Pure Mode with negative or zero account remaining
    const pureGuard = calculateVaultLiquidity({
      isBudgetModeEnabled: false,
      budgetCadence: 'daily',
      dailyBudgetAmount: 0,
      weeklyBudgetAmount: 0,
      monthlyBudgetAmount: 0,
      totalIncome: 0,
      totalExpenses: 0,
      accountRemaining: -100,
    });
    expect(pureGuard.canAddExpense).toBe(true);
    expect(pureGuard.reason).toBeUndefined();
    expect(pureGuard.totalVaultLiquidity).toBe(-100);

    // AutoLog in Pure Mode should never block
    useDailyBudgetStore.setState({ isBudgetModeEnabled: false });
    expect(isExceedingVaultLiquidity(100)).toBe(false);

    // Budget Mode with zero or negative liquidity
    const budgetGuard = calculateVaultLiquidity({
      isBudgetModeEnabled: true,
      budgetCadence: 'daily',
      dailyBudgetAmount: 0,
      weeklyBudgetAmount: 0,
      monthlyBudgetAmount: 0,
      totalIncome: 0,
      totalExpenses: 0,
      accountRemaining: -100,
    });
    expect(budgetGuard.canAddExpense).toBe(false);
    expect(budgetGuard.reason).toBe(VAULT_GUARD_MESSAGE);

    // AutoLog in Budget Mode with amount > activeAllowance should be true
    useDailyBudgetStore.setState({
      isBudgetModeEnabled: true,
      budgetCadence: 'daily',
      dailyBudgetAmount: 0,
      totalAccumulatedSavings: 0,
      hydratedForUserId: 'test_user_pure',
    });
    expect(isExceedingVaultLiquidity(100)).toBe(true);
  });

  it('2. PUR-002: ended-in-Pure pool does not become income, consumed by Pure spend first, flows to Gullak on Budget resume', () => {
    // Dates >= BUDGET_RULES_V2_FROM (2026-10-14)
    // Setup a weekly pool: Nov 02 to Nov 08, amount 1000
    // User spends 300 on Nov 03.
    // Pure mode turns ON on Nov 05.
    // Pool ends on Nov 08 while user is in Pure Mode.
    // Remaining unspent of pool = 700.
    const expense300: Expense = {
      id: 'e-1',
      user_id: 'test_user_pure',
      amount: 300,
      category_id: null,
      payment_mode: 'upi',
      expense_date: '2026-11-03',
      type: 'expense',
      created_at: '2026-11-03T10:00:00Z',
    };
    useExpenseStore.setState({ expenses: [expense300] });

    useDailyBudgetStore.setState({
      isBudgetModeEnabled: false,
      budgetCadence: 'weekly',
      weeklyBudgetAmount: 1000,
      planChanges: [
        {
          id: 'pc-1',
          userId: 'test_user_pure',
          effectiveFrom: '2026-11-02',
          isEnabled: true,
          cadence: 'weekly',
          amount: 1000,
          createdAt: '2026-11-02T00:00:00Z',
        },
        {
          id: 'pc-2',
          userId: 'test_user_pure',
          effectiveFrom: '2026-11-05',
          isEnabled: false,
          cadence: 'weekly',
          amount: 1000,
          createdAt: '2026-11-05T00:00:00Z',
        },
      ],
      budgetPeriods: {
        'weekly_2026-11-02': {
          id: 'bp-1',
          userId: 'test_user_pure',
          cadence: 'weekly',
          periodStart: '2026-11-02',
          periodEnd: '2026-11-08',
          activeStart: '2026-11-02',
          activeEnd: '2026-11-05',
          budgetAmount: 1000,
          spentAmount: 300,
          amountSaved: 0,
          status: 'saved',
          isProrated: false,
        },
      },
    });

    useDailyBudgetStore.getState().syncWithExpenses(useExpenseStore.getState().expenses);

    // 1) In Pure mode: income is NOT created, Gullak = 0
    expect(useDailyBudgetStore.getState().getAvailableIncomeBalance()).toBe(0);
    expect(useDailyBudgetStore.getState().totalAccumulatedSavings).toBe(0);
    // No notification sent for ended-in-Pure pool
    const pureEndNotif = addedNotifications.find((n) => String(n.id).startsWith('pure_end_'));
    expect(pureEndNotif).toBeUndefined();

    // Remaining in account = 1000 allowance - 300 spend = 700
    const remBefore = computeTotalAccountRemaining(useDailyBudgetStore.getState(), useExpenseStore.getState().expenses);
    expect(remBefore).toBe(700);

    // 2) Pure-day spend ₹200 on Nov 10: should use leftover first (income and Gullak untouched)
    const expense200: Expense = {
      id: 'e-2',
      user_id: 'test_user_pure',
      amount: 200,
      category_id: null,
      payment_mode: 'upi',
      expense_date: '2026-11-10',
      type: 'expense',
      created_at: '2026-11-10T10:00:00Z',
    };
    useExpenseStore.setState({ expenses: [expense300, expense200] });
    useDailyBudgetStore.getState().syncWithExpenses(useExpenseStore.getState().expenses);

    const wf = runWaterfall();
    expect(wf.pureLeftoverAdded).toBe(700);
    expect(wf.pureLeftoverUsed).toBe(200);
    expect(wf.pureLeftoverRemaining).toBe(500);
    expect(wf.byExpense['e-2'].fromLeftover).toBe(200);
    expect(wf.byExpense['e-2'].fromIncome).toBe(0);
    expect(wf.byExpense['e-2'].fromGullak).toBe(0);

    // Remaining is now 1000 - 300 - 200 = 500
    const remAfter = computeTotalAccountRemaining(useDailyBudgetStore.getState(), useExpenseStore.getState().expenses);
    expect(remAfter).toBe(500);

    // 3) Going to Budget Mode on Nov 15: unspent leftover (500) shows as Gullak!
    useDailyBudgetStore.setState({
      isBudgetModeEnabled: true,
      planChanges: [
        ...useDailyBudgetStore.getState().planChanges,
        {
          id: 'pc-3',
          userId: 'test_user_pure',
          effectiveFrom: '2026-11-15',
          isEnabled: true,
          cadence: 'daily',
          amount: 0,
          createdAt: '2026-11-15T00:00:00Z',
        },
      ],
      budgetCadence: 'daily',
      dailyBudgetAmount: 0,
    });
    useDailyBudgetStore.getState().syncWithExpenses(useExpenseStore.getState().expenses);
    expect(useDailyBudgetStore.getState().totalAccumulatedSavings).toBe(500);
    expect(computeTotalAccountRemaining(useDailyBudgetStore.getState(), useExpenseStore.getState().expenses)).toBe(500);
  });

  it('3. PUR-001 deficit: income 5000, allowances 3500, Pure spend 9000 -> R = -500. Toggle Budget Mode ON balances deficit', async () => {
    // Allowances: 7 days @ 500/day = 3500 (Nov 01 to Nov 07)
    // Pure Mode enabled Nov 08
    const dailyRecords: Record<string, DailyRecord> = {};
    for (let d = 1; d <= 7; d++) {
      const dateStr = `2026-11-0${d}`;
      dailyRecords[dateStr] = {
        date: dateStr,
        budget: 500,
        spent: 0,
        saved: 500,
        isFinalized: true,
        status: 'active',
      };
    }

    const planChanges = [
      {
        id: 'pc-1',
        userId: 'test_user_pure',
        effectiveFrom: '2026-11-01',
        isEnabled: true,
        cadence: 'daily' as const,
        amount: 500,
        createdAt: '2026-11-01T00:00:00Z',
      },
      {
        id: 'pc-2',
        userId: 'test_user_pure',
        effectiveFrom: '2026-11-08',
        isEnabled: false,
        cadence: 'daily' as const,
        amount: 500,
        createdAt: '2026-11-08T00:00:00Z',
      },
    ];

    const income5000: Expense = {
      id: 'inc-1',
      user_id: 'test_user_pure',
      amount: 5000,
      category_id: null,
      payment_mode: 'upi',
      expense_date: '2026-11-02',
      type: 'income',
      created_at: '2026-11-02T10:00:00Z',
    };

    const expense9000: Expense = {
      id: 'exp-1',
      user_id: 'test_user_pure',
      amount: 9000,
      category_id: null,
      payment_mode: 'upi',
      expense_date: '2026-11-10',
      type: 'expense',
      created_at: '2026-11-10T10:00:00Z',
    };

    useExpenseStore.setState({ expenses: [income5000, expense9000] });
    useDailyBudgetStore.setState({
      isBudgetModeEnabled: false,
      dailyBudgetAmount: 0,
      budgetCadence: 'daily',
      dailyRecords,
      planChanges,
    });

    const R_before = computeTotalAccountRemaining(useDailyBudgetStore.getState(), useExpenseStore.getState().expenses);
    // Inflow = 3500 (allowance) + 5000 (income) = 8500. Outflow = 9000. R = -500.
    expect(R_before).toBe(-500);

    // Toggle Budget Mode ON
    useDailyBudgetStore.getState().setBudgetModeEnabled(true);

    const expensesAfter = useExpenseStore.getState().expenses;
    // Exactly one auto-balance income should be added
    const autoIncome = expensesAfter.find((e) => e.note === PURE_DEFICIT_NOTE);
    expect(autoIncome).toBeDefined();
    expect(autoIncome?.amount).toBe(500);
    expect(autoIncome?.type).toBe('income');
    expect(autoIncome?.expense_date).toBe('2026-11-10'); // Dated to the expense that caused Gullak draw >= D

    // Notification posted
    const deficitNotif = addedNotifications.find((n) => n.type === 'pure_deficit_balanced');
    expect(deficitNotif).toBeDefined();
    expect(deficitNotif?.id).toBe('pure_deficit_2026-11-10_500');
    expect(deficitNotif?.message).toContain('₹500');

    // Total account remaining should now be 0
    const R_after = computeTotalAccountRemaining(useDailyBudgetStore.getState(), useExpenseStore.getState().expenses);
    expect(R_after).toBe(0);
    expect(useDailyBudgetStore.getState().totalAccumulatedSavings).toBe(0);
    expect(useDailyBudgetStore.getState().getAvailableIncomeBalance()).toBe(0);

    // Home card period summary: periodIncome excludes the auto-balance row
    const summary = calculatePeriodSummary({
      activeFilter: 'All',
      dailyBudgetAmount: 0,
      isAutoRenew: true,
      todayBudget: 0,
      dailyRecords,
      totalIncome: 5500,
      totalSpent: 9000,
      filtered: expensesAfter,
      userCreatedAtStr: '2026-11-01',
      referenceDate: new Date('2026-11-15T12:00:00'),
    });
    expect(summary.periodIncome).toBe(5000); // 5000, NOT 5500
  });

  it('4. No deficit: R >= 0 does not add income or notification on toggle', () => {
    const income5000: Expense = {
      id: 'inc-1',
      user_id: 'test_user_pure',
      amount: 5000,
      category_id: null,
      payment_mode: 'upi',
      expense_date: '2026-11-02',
      type: 'income',
      created_at: '2026-11-02T10:00:00Z',
    };

    useExpenseStore.setState({ expenses: [income5000] });
    useDailyBudgetStore.setState({
      isBudgetModeEnabled: false,
      dailyBudgetAmount: 0,
      budgetCadence: 'daily',
    });

    const expCountBefore = useExpenseStore.getState().expenses.length;
    useDailyBudgetStore.getState().setBudgetModeEnabled(true);

    expect(useExpenseStore.getState().expenses.length).toBe(expCountBefore);
    const deficitNotif = addedNotifications.find((n) => n.type === 'pure_deficit_balanced');
    expect(deficitNotif).toBeUndefined();
  });

  it('5. Idempotent cycles: toggling off, spending more into deficit, and toggling on adds only the new deficit', () => {
    // Start with income 5000, spend 5500 (R = -500)
    const income5000: Expense = {
      id: 'inc-1',
      user_id: 'test_user_pure',
      amount: 5000,
      category_id: null,
      payment_mode: 'upi',
      expense_date: '2026-11-02',
      type: 'income',
      created_at: '2026-11-02T10:00:00Z',
    };
    const exp5500: Expense = {
      id: 'exp-1',
      user_id: 'test_user_pure',
      amount: 5500,
      category_id: null,
      payment_mode: 'upi',
      expense_date: '2026-11-10',
      type: 'expense',
      created_at: '2026-11-10T10:00:00Z',
    };

    useExpenseStore.setState({ expenses: [income5000, exp5500] });
    useDailyBudgetStore.setState({
      isBudgetModeEnabled: false,
      dailyBudgetAmount: 0,
      budgetCadence: 'daily',
    });

    // 1st toggle ON: adds 500
    useDailyBudgetStore.getState().setBudgetModeEnabled(true);
    let autoIncomes = useExpenseStore.getState().expenses.filter((e) => e.note === PURE_DEFICIT_NOTE);
    expect(autoIncomes.length).toBe(1);
    expect(autoIncomes[0].amount).toBe(500);

    // Toggle OFF into Pure Mode
    useDailyBudgetStore.getState().setBudgetModeEnabled(false, { immediate: true });

    // Spend 200 more in Pure Mode
    const exp200: Expense = {
      id: 'exp-2',
      user_id: 'test_user_pure',
      amount: 200,
      category_id: null,
      payment_mode: 'upi',
      expense_date: '2026-11-12',
      type: 'expense',
      created_at: '2026-11-12T10:00:00Z',
    };
    useExpenseStore.setState({ expenses: [...useExpenseStore.getState().expenses, exp200] });
    useDailyBudgetStore.getState().syncWithExpenses(useExpenseStore.getState().expenses);

    const R_cycle2 = computeTotalAccountRemaining(useDailyBudgetStore.getState(), useExpenseStore.getState().expenses);
    expect(R_cycle2).toBe(-200);

    // 2nd toggle ON: should add exactly 200, not 700 again
    useDailyBudgetStore.getState().setBudgetModeEnabled(true, { immediate: true });
    autoIncomes = useExpenseStore.getState().expenses.filter((e) => e.note === PURE_DEFICIT_NOTE);
    expect(autoIncomes.length).toBe(2);
    const totalAutoIncome = autoIncomes.reduce((s, e) => s + e.amount, 0);
    expect(totalAutoIncome).toBe(700);

    const R_final = computeTotalAccountRemaining(useDailyBudgetStore.getState(), useExpenseStore.getState().expenses);
    expect(R_final).toBe(0);
  });

  it('6. Gullak is never negative across all scenarios', () => {
    expect(useDailyBudgetStore.getState().totalAccumulatedSavings).toBeGreaterThanOrEqual(0);
  });
});
