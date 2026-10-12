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
import {
  useDailyBudgetStore,
  registerExpensesLoadedGetter,
  registerExpenseGetter,
} from '../src/store/dailyBudgetStore';
import { Expense } from '../src/store/expenseStore';

/**
 * Existing users: what the older OTA wrote into their phone (daily records and weekly/monthly periods
 * where INCOME had been added into the saved amount) must come back correct after this update,
 * and Gullak / income balances must follow: budget -> income -> Gullak.
 */
const USER = 'user_waterfall_1';
const TODAY = '2026-10-12';

const mk = (o: Partial<Expense> & { id: string; amount: number; expense_date: string }): Expense =>
  ({ user_id: USER, payment_mode: 'upi', created_at: `${o.expense_date}T10:00:00Z`, type: 'expense', ...o } as Expense);
const income = (id: string, amount: number, date: string) => mk({ id, amount, expense_date: date, type: 'income' });
const spend = (id: string, amount: number, date: string) => mk({ id, amount, expense_date: date });

const dailyPlan = [{ id: 'p', userId: USER, effectiveFrom: '2026-10-01', isEnabled: true, cadence: 'daily' as const, amount: 500, createdAt: '2026-10-01T00:00:00Z' }];

const setup = (expenses: Expense[], state: Record<string, any> = {}) => {
  registerExpensesLoadedGetter(() => true);
  registerExpenseGetter(() => expenses);
  useDailyBudgetStore.setState({
    ownerUserId: USER, hydratedForUserId: USER, isBudgetModeEnabled: true, budgetCadence: 'daily',
    dailyBudgetAmount: 500, isAutoRenew: true, budgetPeriods: {}, planChanges: dailyPlan, gullakDeposits: [],
    ...state,
  });
};

describe('Existing users after the update (self-heal + waterfall in the real store)', () => {
  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
    useDailyBudgetStore.getState().resetDailyBudget();
  });

  it('a finalized day that the old OTA inflated with income is corrected (saved = unspent BUDGET only)', () => {
    const expenses = [income('i', 1000, '2026-10-10'), spend('e', 100, '2026-10-10')];
    setup(expenses, {
      dailyRecords: { '2026-10-10': { date: '2026-10-10', budget: 500, spent: 100, saved: 1400, isFinalized: true, status: 'saved' } },
    });
    useDailyBudgetStore.getState().checkAndRollover(expenses);
    const rec = useDailyBudgetStore.getState().dailyRecords['2026-10-10'];
    expect(rec.saved).toBe(400);
    expect(rec.budget).toBe(500);
    expect(rec.spent).toBe(100);
  });

  it('income NEVER enters Gullak: big income, nothing spent', () => {
    const expenses = [income('i', 5000, '2026-10-10')];
    setup(expenses, {
      dailyRecords: { '2026-10-10': { date: '2026-10-10', budget: 500, spent: 0, saved: 5500, isFinalized: true, status: 'saved' } },
    });
    useDailyBudgetStore.getState().checkAndRollover(expenses);
    const s = useDailyBudgetStore.getState();
    expect(s.dailyRecords['2026-10-10'].saved).toBe(500);
    expect(s.totalAccumulatedSavings).toBe(500);
    expect(s.getAvailableIncomeBalance()).toBe(5000);
  });

  it('an overspend that income covered does NOT reduce Gullak', () => {
    const expenses = [income('i', 1000, '2026-10-09'), spend('a', 200, '2026-10-10'), spend('b', 900, '2026-10-11')];
    setup(expenses, { dailyRecords: {} });
    useDailyBudgetStore.getState().checkAndRollover(expenses);
    const s = useDailyBudgetStore.getState();
    expect(s.dailyRecords['2026-10-10'].saved).toBe(300);
    expect(s.dailyRecords['2026-10-11'].saved).toBe(0);
    expect(s.totalAccumulatedSavings).toBe(300);          // the 400 overspend came from income
    expect(s.getAvailableIncomeBalance()).toBe(600);      // 1000 - 400
  });

  it('with no income, the overspend comes out of Gullak', () => {
    const expenses = [spend('a', 200, '2026-10-10'), spend('b', 900, '2026-10-11')];
    setup(expenses, { dailyRecords: {} });
    useDailyBudgetStore.getState().checkAndRollover(expenses);
    expect(useDailyBudgetStore.getState().totalAccumulatedSavings).toBe(0); // 300 saved - 400 overspend, floored at 0
  });

  it("income that arrives today is not eaten by an old overspend (All pill)", () => {
    const expenses = [spend('old', 900, '2026-10-10'), income('today', 300, TODAY)];
    setup(expenses, { dailyRecords: {} });
    useDailyBudgetStore.getState().checkAndRollover(expenses);
    expect(useDailyBudgetStore.getState().getAvailableIncomeBalance()).toBe(300);
  });

  it("today's live overspend uses income first, then Gullak", () => {
    const expenses = [spend('past', 100, '2026-10-10'), income('i', 150, TODAY), spend('t', 800, TODAY)];
    setup(expenses, { dailyRecords: {} });
    useDailyBudgetStore.getState().checkAndRollover(expenses);
    useDailyBudgetStore.getState().syncWithExpenses(expenses);
    const s = useDailyBudgetStore.getState();
    expect(s.getAvailableIncomeBalance()).toBe(0);
    // saved 400 from the past day, 150 of today's 300 overspend comes from Gullak
    expect(s.totalAccumulatedSavings).toBe(250);
  });

  describe('weekly / monthly periods saved by the old OTA', () => {
    const weeklyPlan = [{ id: 'w', userId: USER, effectiveFrom: '2026-10-05', isEnabled: true, cadence: 'weekly' as const, amount: 1000, createdAt: '2026-10-05T00:00:00Z' }];
    const corrupted = {
      weekly_2026_10_05: {
        id: 'weekly_2026_10_05', userId: USER, cadence: 'weekly' as const, periodStart: '2026-10-05', periodEnd: '2026-10-11',
        activeStart: '2026-10-05', activeEnd: '2026-10-11', budgetAmount: 1500, spentAmount: 800, amountSaved: 700,
        status: 'saved' as const, isProrated: false, carriedOverAmount: 0, createdAt: '2026-10-12',
      },
    };

    it('an already finalized week with income inside is repaired once, without a duplicate', () => {
      const expenses = [income('i', 500, '2026-10-07'), spend('a', 500, '2026-10-05'), spend('b', 300, '2026-10-08')];
      setup(expenses, { planChanges: weeklyPlan, budgetCadence: 'weekly', weeklyBudgetAmount: 1000, dailyRecords: {}, budgetPeriods: { 'weekly_2026-10-05': { ...corrupted.weekly_2026_10_05, id: 'weekly_2026-10-05' } } });
      useDailyBudgetStore.getState().checkAndRollover(expenses);
      useDailyBudgetStore.getState().checkAndRollover(expenses); // second run changes nothing
      const periods = Object.values(useDailyBudgetStore.getState().budgetPeriods);
      expect(periods).toHaveLength(1);
      expect(periods[0].id).toBe('weekly_2026-10-05');
      expect(periods[0].budgetAmount).toBe(1000);
      expect(periods[0].amountSaved).toBe(200);
      expect(useDailyBudgetStore.getState().totalAccumulatedSavings).toBe(200);
    });

    it('is NOT touched while expenses are still loading (never turns spending into 0)', () => {
      const expenses: Expense[] = [];
      registerExpensesLoadedGetter(() => false);
      registerExpenseGetter(() => expenses);
      useDailyBudgetStore.setState({
        ownerUserId: USER, hydratedForUserId: USER, isBudgetModeEnabled: true, budgetCadence: 'weekly', weeklyBudgetAmount: 1000,
        planChanges: weeklyPlan, dailyRecords: {}, gullakDeposits: [], budgetPeriods: { 'weekly_2026-10-05': { ...corrupted.weekly_2026_10_05, id: 'weekly_2026-10-05' } },
      });
      useDailyBudgetStore.getState().checkAndRollover(expenses);
      expect(useDailyBudgetStore.getState().budgetPeriods['weekly_2026-10-05'].amountSaved).toBe(700);
    });
  });

  it('Gullak deposits: "From Income" lowers income, "External" does not; both count in Gullak', () => {
    const expenses = [income('i', 1000, '2026-10-10')];
    setup(expenses, {
      dailyRecords: {},
      gullakDeposits: [
        { id: 'd1', amount: 300, date: '2026-10-11', source: 'income', created_at: '2026-10-11T10:00:00Z' },
        { id: 'd2', amount: 200, date: '2026-10-11', source: 'external', created_at: '2026-10-11T10:00:00Z' },
      ],
    });
    useDailyBudgetStore.getState().checkAndRollover(expenses);
    const s = useDailyBudgetStore.getState();
    expect(s.getAvailableIncomeBalance()).toBe(700);
  });
});
