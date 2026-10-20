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

vi.mock('../../src/config/supabase', () => ({
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
vi.mock('../../src/store/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      user: mockUser,
    })),
  },
  registerStoreResetCallback: vi.fn(),
}));

// 5. Mock CategoryStore
vi.mock('../../src/store/categoryStore', () => ({
  useCategoryStore: {
    getState: vi.fn(() => ({
      categories: [],
    })),
  },
}));

// 6. Mock NotificationService & NotificationStore
const mockTriggerDeviceNotification = vi.fn();
const mockAddNotification = vi.fn();
vi.mock('../../src/lib/notificationService', () => ({
  triggerDeviceNotification: (...args: any[]) => mockTriggerDeviceNotification(...args),
}));
vi.mock('../../src/store/notificationStore', () => ({
  useNotificationStore: {
    getState: vi.fn(() => ({
      addNotification: (...args: any[]) => mockAddNotification(...args),
      setOwnerUserId: vi.fn(),
    })),
  },
}));

// Import store & helpers
import { useDailyBudgetStore, registerExpensesLoadedGetter, registerExpenseGetter } from '../../src/store/dailyBudgetStore';
import { Expense } from '../../src/store/expenseStore';

import { limitCopy } from '../../src/lib/notificationPolicy';

const USER = 'user_waterfall_1';
const TODAY = '2026-10-12'; // Monday

const mk = (o: Partial<Expense> & { id: string; amount: number; expense_date: string }): Expense =>
  ({ user_id: USER, payment_mode: 'upi', created_at: `${o.expense_date}T10:00:00Z`, type: 'expense', ...o } as Expense);
const income = (id: string, amount: number, date: string) => mk({ id, amount, expense_date: date, type: 'income' });
const spend = (id: string, amount: number, date: string) => mk({ id, amount, expense_date: date });

const startDailyUser = (expenses: Expense[]) => {
  registerExpensesLoadedGetter(() => true);
  registerExpenseGetter(() => expenses);
  useDailyBudgetStore.setState({
    ownerUserId: USER, hydratedForUserId: USER, isBudgetModeEnabled: true, budgetCadence: 'daily', dailyBudgetAmount: 100,
    isAutoRenew: true, budgetPeriods: {}, gullakDeposits: [], dailyRecords: {}, lastExceededNotifiedDate: null,
    planChanges: [{ id: 'p', userId: USER, effectiveFrom: '2026-10-01', isEnabled: true, cadence: 'daily', amount: 100, createdAt: '' }],
  } as any);
};

describe('"limit exceeded" alert: who paid the overspend comes from the waterfall (WAT-001, NOT-001)', () => {
  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
    useDailyBudgetStore.getState().resetDailyBudget();
  });

  it('income 150 arrived yesterday, budget 100, spent 400 today: income paid 150, Gullak paid 150', () => {
    // The old alert asked "how much income is left RIGHT NOW?". The waterfall had already used that income up
    // for this very overspend, so it answered 0 and the alert said "Gullak paid all 300".
    const expenses = [income('i', 150, '2026-10-11'), spend('e', 400, TODAY)];
    startDailyUser(expenses);
    useDailyBudgetStore.getState().syncWithExpenses(expenses);

    expect(useDailyBudgetStore.getState().lastExceededNotifiedDate).toBe(TODAY);
    const sent = mockAddNotification.mock.calls.map((call) => call[0]).find((n: any) => n.type === 'budget_exceeded');
    expect(sent).toBeDefined();
    const expected = limitCopy({
      kind: 'exceeded', cadence: 'daily', spent: 400, budget: 100, remaining: 0, incomeCovered: 150, gullakCovered: 150,
    } as any);
    expect(sent.message).toBe(expected.body);
  });

  it('no income at all: Gullak pays the whole overspend', () => {
    const expenses = [spend('e', 400, TODAY)];
    startDailyUser(expenses);
    useDailyBudgetStore.getState().syncWithExpenses(expenses);

    const sent = mockAddNotification.mock.calls.map((call) => call[0]).find((n: any) => n.type === 'budget_exceeded');
    const expected = limitCopy({
      kind: 'exceeded', cadence: 'daily', spent: 400, budget: 100, remaining: 0, incomeCovered: 0, gullakCovered: 300,
    } as any);
    expect(sent.message).toBe(expected.body);
  });
});
