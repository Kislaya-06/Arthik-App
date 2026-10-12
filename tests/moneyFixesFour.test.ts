import { describe, it, expect, beforeEach, vi } from 'vitest';

// These scenarios were written for "today = 2026-09-30" (see comments below). Using the real clock made
// them fail once another full week had passed. Freeze ONLY Date (timers stay real) so results never
// depend on the day the suite runs.
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-10-12T12:00:00'));

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
        data: { session: { user: { id: 'user_waterfall_1', created_at: '2026-10-01T00:00:00Z' } } },
      }),
    },
  },
}));

// 4. Mock AuthStore
let mockUser: any = { id: 'user_waterfall_1', created_at: '2026-10-01T00:00:00Z' };
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
import { useDailyBudgetStore, registerExpensesLoadedGetter, registerExpenseGetter } from '../src/store/dailyBudgetStore';
import { Expense } from '../src/store/expenseStore';
import { calculatePeriodSummary } from '../src/lib/homeCalculations';
import { calculateVaultLiquidity } from '../src/lib/vaultSpendingGuard';
import { calculateExpenseFunding } from '../src/lib/transactionFunding';

const USER = 'user_waterfall_1';
const TODAY = '2026-10-12'; // Monday

const mk = (o: Partial<Expense> & { id: string; amount: number; expense_date: string }): Expense =>
  ({ user_id: USER, payment_mode: 'upi', created_at: `${o.expense_date}T10:00:00Z`, type: 'expense', ...o } as Expense);
const income = (id: string, amount: number, date: string) => mk({ id, amount, expense_date: date, type: 'income' });
const spend = (id: string, amount: number, date: string) => mk({ id, amount, expense_date: date });

// ───────────────────────────────────────────────────────────────────────────
describe('Fix 1: All pill for weekly / monthly cadence users', () => {
  const base = {
    activeFilter: 'All' as const, dailyBudgetAmount: 0, isAutoRenew: true, todayBudget: 0, dailyRecords: {},
    totalIncome: 0, externalDepositsInPeriod: 0,
  };

  it('weekly budget 1000, spent 300 -> "Total Remaining 700" (it used to say "Total Spent 300" with budget 0)', () => {
    const r = calculatePeriodSummary({
      ...base, totalSpent: 300, filtered: [{ expense_date: '2026-10-06' }], userCreatedAtStr: '2026-10-05',
      referenceDate: new Date(2026, 9, 7), todaySpent: 0, spentByDate: { '2026-10-06': 300 },
      planChanges: [{ id: 'w', userId: 'u', effectiveFrom: '2026-10-05', isEnabled: true, cadence: 'weekly', amount: 1000 }] as any,
    } as any);
    expect(r.periodBudgetPool).toBe(1000);
    expect(r.primaryLabel).toBe('Total Remaining');
    expect(r.primaryAmount).toBe(700);
  });

  it('each week is counted ONCE (two weeks = 2000, not 7 x or 14 x)', () => {
    const r = calculatePeriodSummary({
      ...base, totalSpent: 500, filtered: [{ expense_date: '2026-10-06' }], userCreatedAtStr: '2026-10-05',
      referenceDate: new Date(2026, 9, 14), todaySpent: 0, spentByDate: { '2026-10-06': 500 },
      planChanges: [{ id: 'w', userId: 'u', effectiveFrom: '2026-10-05', isEnabled: true, cadence: 'weekly', amount: 1000 }] as any,
    } as any);
    expect(r.periodBudgetPool).toBe(2000); // weeks of 5 Oct and 12 Oct
    expect(r.primaryAmount).toBe(1500);
  });

  it('monthly budget 20000 is counted once for the month', () => {
    const r = calculatePeriodSummary({
      ...base, totalSpent: 4000, filtered: [{ expense_date: '2026-10-03' }], userCreatedAtStr: '2026-10-01',
      referenceDate: new Date(2026, 9, 20), todaySpent: 0, spentByDate: { '2026-10-03': 4000 },
      planChanges: [{ id: 'm', userId: 'u', effectiveFrom: '2026-10-01', isEnabled: true, cadence: 'monthly', amount: 20000 }] as any,
    } as any);
    expect(r.periodBudgetPool).toBe(20000);
    expect(r.primaryAmount).toBe(16000);
  });

  it('daily budget days first, then weekly: both are counted', () => {
    const r = calculatePeriodSummary({
      ...base, dailyBudgetAmount: 500,
      dailyRecords: { '2026-10-05': { date: '2026-10-05', budget: 500, spent: 100, saved: 400, isFinalized: true, status: 'saved' } } as any,
      totalSpent: 100, filtered: [{ expense_date: '2026-10-05' }], userCreatedAtStr: '2026-10-05',
      referenceDate: new Date(2026, 9, 7), todaySpent: 0, spentByDate: { '2026-10-05': 100 },
      planChanges: [
        { id: 'd', userId: 'u', effectiveFrom: '2026-10-05', isEnabled: true, cadence: 'daily', amount: 500 },
        { id: 'w', userId: 'u', effectiveFrom: '2026-10-06', isEnabled: true, cadence: 'weekly', amount: 1000 },
      ] as any,
    } as any);
    expect(r.periodBudgetPool).toBe(1500); // 500 (5 Oct) + 1000 (week of 6 Oct)
  });

  it('a DAILY user is exactly as before (no change)', () => {
    const r = calculatePeriodSummary({
      ...base, dailyBudgetAmount: 500, todayBudget: 500, totalSpent: 300, filtered: [{ expense_date: '2026-10-12' }],
      userCreatedAtStr: '2026-10-12', referenceDate: new Date(2026, 9, 12), todaySpent: 300, spentByDate: { [TODAY]: 300 },
      planChanges: [{ id: 'd', userId: 'u', effectiveFrom: '2026-10-12', isEnabled: true, cadence: 'daily', amount: 500 }] as any,
    } as any);
    expect(r.periodBudgetPool).toBe(500);
    expect(r.primaryAmount).toBe(200);
  });

  it('a paused period adds no budget', () => {
    const r = calculatePeriodSummary({
      ...base, totalSpent: 300, filtered: [{ expense_date: '2026-10-06' }], userCreatedAtStr: '2026-10-05',
      referenceDate: new Date(2026, 9, 7), todaySpent: 0, spentByDate: { '2026-10-06': 300 },
      planChanges: [{ id: 'w', userId: 'u', effectiveFrom: '2026-10-05', isEnabled: false, cadence: 'weekly', amount: 1000 }] as any,
    } as any);
    expect(r.periodBudgetPool).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('Fix 2: vault guard (blocking an expense when no money is left)', () => {
  const p = { isBudgetModeEnabled: true, budgetCadence: 'daily' as const, dailyBudgetAmount: 500, weeklyBudgetAmount: 0, monthlyBudgetAmount: 0, totalIncome: 0, totalExpenses: 0 };

  it('budget mode: uses what is REALLY left; zero or less blocks', () => {
    expect(calculateVaultLiquidity({ ...p, accountRemaining: 0 }).canAddExpense).toBe(false);
    expect(calculateVaultLiquidity({ ...p, accountRemaining: -120 }).canAddExpense).toBe(false);
    expect(calculateVaultLiquidity({ ...p, accountRemaining: 250 }).canAddExpense).toBe(true);
    expect(calculateVaultLiquidity({ ...p, accountRemaining: 250 }).totalVaultLiquidity).toBe(250);
  });

  it('without the new input it behaves as before (other callers unchanged)', () => {
    expect(calculateVaultLiquidity({ ...p }).canAddExpense).toBe(true);
    expect(calculateVaultLiquidity({ ...p, dailyBudgetAmount: 0 }).canAddExpense).toBe(false);
  });

  it('Pure Mode is unchanged: income - expenses', () => {
    expect(calculateVaultLiquidity({ ...p, isBudgetModeEnabled: false, totalIncome: 1000, totalExpenses: 400 }).totalVaultLiquidity).toBe(600);
    expect(calculateVaultLiquidity({ ...p, isBudgetModeEnabled: false, totalIncome: 100, totalExpenses: 400 }).canAddExpense).toBe(false);
  });
});

describe('Fix 2 (store): getTotalAccountRemaining', () => {
  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
    useDailyBudgetStore.getState().resetDailyBudget();
  });
  const setup = (expenses: Expense[], state: Record<string, any> = {}) => {
    registerExpensesLoadedGetter(() => true);
    registerExpenseGetter(() => expenses);
    useDailyBudgetStore.setState({
      ownerUserId: USER, hydratedForUserId: USER, isBudgetModeEnabled: true, budgetCadence: 'daily', dailyBudgetAmount: 500,
      isAutoRenew: true, budgetPeriods: {}, planChanges: [], gullakDeposits: [], dailyRecords: {}, ...state,
    });
  };

  it('all budgets + income - spent', () => {
    setup([income('i', 1000, '2026-10-10'), spend('e', 1200, '2026-10-10')], {
      dailyRecords: {
        '2026-10-10': { date: '2026-10-10', budget: 500, spent: 1200, saved: 0, isFinalized: true, status: 'exceeded' },
        '2026-10-11': { date: '2026-10-11', budget: 500, spent: 0, saved: 500, isFinalized: true, status: 'saved' },
      },
    });
    expect(useDailyBudgetStore.getState().getTotalAccountRemaining()).toBe(800); // 1000 budgets + 1000 income - 1200
  });

  it('"From income" Gullak deposits are NOT new money (no double count), external ones are', () => {
    setup([income('i', 1000, '2026-10-10')], {
      gullakDeposits: [
        { id: 'a', amount: 300, date: '2026-10-11', source: 'income', created_at: '' },
        { id: 'b', amount: 200, date: '2026-10-11', source: 'external', created_at: '' },
      ],
    });
    expect(useDailyBudgetStore.getState().getTotalAccountRemaining()).toBe(1200);
  });

  it('a running weekly budget counts (it is real money before the week ends)', () => {
    setup([spend('e', 300, '2026-10-13')], {
      budgetCadence: 'weekly', weeklyBudgetAmount: 1000,
      planChanges: [{ id: 'w', userId: USER, effectiveFrom: '2026-10-12', isEnabled: true, cadence: 'weekly', amount: 1000, createdAt: '' }],
    });
    expect(useDailyBudgetStore.getState().getTotalAccountRemaining()).toBe(700);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('Fix 3: "limit exceeded" alert follows the budget, not budget + income', () => {
  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
    useDailyBudgetStore.getState().resetDailyBudget();
  });

  it('income does not delay the alert: budget 500, income 1000, spent 600 -> alert fires', () => {
    const expenses = [income('i', 1000, TODAY), spend('e', 600, TODAY)];
    registerExpensesLoadedGetter(() => true);
    registerExpenseGetter(() => expenses);
    useDailyBudgetStore.setState({
      ownerUserId: USER, hydratedForUserId: USER, isBudgetModeEnabled: true, budgetCadence: 'daily', dailyBudgetAmount: 500,
      isAutoRenew: true, budgetPeriods: {}, gullakDeposits: [], dailyRecords: {}, lastExceededNotifiedDate: null,
      planChanges: [{ id: 'p', userId: USER, effectiveFrom: '2026-10-01', isEnabled: true, cadence: 'daily', amount: 500, createdAt: '' }],
    } as any);
    useDailyBudgetStore.getState().syncWithExpenses(expenses);
    expect(useDailyBudgetStore.getState().lastExceededNotifiedDate).toBe(TODAY);
  });

  it('within budget: no alert even with income', () => {
    const expenses = [income('i', 1000, TODAY), spend('e', 100, TODAY)];
    registerExpensesLoadedGetter(() => true);
    registerExpenseGetter(() => expenses);
    useDailyBudgetStore.setState({
      ownerUserId: USER, hydratedForUserId: USER, isBudgetModeEnabled: true, budgetCadence: 'daily', dailyBudgetAmount: 500,
      isAutoRenew: true, budgetPeriods: {}, gullakDeposits: [], dailyRecords: {}, lastExceededNotifiedDate: null,
      planChanges: [{ id: 'p', userId: USER, effectiveFrom: '2026-10-01', isEnabled: true, cadence: 'daily', amount: 500, createdAt: '' }],
    } as any);
    useDailyBudgetStore.getState().syncWithExpenses(expenses);
    expect(useDailyBudgetStore.getState().lastExceededNotifiedDate).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('Fix 4: Pure Mode expense detail never says "Paid from Gullak"', () => {
  const cats: any[] = [{ id: 'food', name: 'Food' }, { id: 'sal', name: 'Salary' }];
  it('Pure Mode: nothing is taken from income / Gullak; label is "Your balance"', () => {
    const e = spend('e', 500, TODAY);
    const f = calculateExpenseFunding({
      expense: e, allExpenses: [income('i', 300, TODAY), e], categories: cats, isBudgetModeEnabled: false, todayStr: TODAY,
    });
    expect(f.coveredByGullak).toBe(0);
    expect(f.coveredByIncome).toBe(0);
    expect(f.summaryLabel).toBe('Your balance');
    expect(f.explanation).not.toContain('Gullak');
  });

  it('Budget Mode is unchanged (income, then Gullak)', () => {
    const e = spend('e', 800, TODAY);
    const f = calculateExpenseFunding({
      expense: e, allExpenses: [income('i', 150, TODAY), e], categories: cats, todayBudget: 500, dailyBudgetAmount: 500,
      isBudgetModeEnabled: true, todayStr: TODAY,
    });
    expect(f).toMatchObject({ coveredByBudget: 500, coveredByIncome: 150, coveredByGullak: 150 });
  });
});
