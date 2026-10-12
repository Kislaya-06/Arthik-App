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
  registerSharesGetter,
} from '../src/store/dailyBudgetStore';
import { Expense } from '../src/store/expenseStore';
import { computeWaterfallFromState, summarizeScope } from '../src/lib/moneyWaterfall';
import { splitRepaymentLabel, findExactSplitCandidates } from '../src/lib/shares';

/**
 * SPLIT REPAYMENT RULES (product owner):
 *  - A friend paying back their share settles that split.
 *  - The money goes back to where the expense was paid from, "jitna jahan ka tha wahan":
 *      Gullak part -> Gullak,  income part -> income,  budget part -> unspent budget.
 *  - Nothing is counted twice.
 */
const USER = 'user_waterfall_1';
const TODAY = '2026-10-12';

const mk = (o: Partial<Expense> & { id: string; amount: number; expense_date: string }): Expense =>
  ({ user_id: USER, payment_mode: 'upi', created_at: `${o.expense_date}T10:00:00Z`, type: 'expense', ...o } as Expense);
const income = (id: string, amount: number, date: string) => mk({ id, amount, expense_date: date, type: 'income' });
const spend = (id: string, amount: number, date: string, at = '10:00:00') =>
  mk({ id, amount, expense_date: date, created_at: `${date}T${at}Z` });
const repay = (id: string, amount: number, date: string, shareId: string | null) =>
  mk({ id, amount, expense_date: date, type: 'income', transaction_class: 'reimbursement', reimburses_share_id: shareId });

const cats: any[] = [];
const state = (expenses: Expense[], shares: Array<{ id: string; expense_id: string }>, budget = 500) =>
  computeWaterfallFromState({
    expenses, shares, categories: cats, isBudgetModeEnabled: true, isAutoRenew: true,
    todayStr: TODAY, dailyBudgetAmount: budget, todayBudget: budget,
  });

describe('split repayment: money goes back to where it came from (pure engine)', () => {
  // 10-09 income 300. 10-10 expense 1000 with budget 500 -> 500 budget + 300 income + 200 Gullak.
  const base = [income('inc', 300, '2026-10-09'), spend('big', 1000, '2026-10-10')];
  const shares = [{ id: 'sh1', expense_id: 'big' }];

  it('before any repayment: budget 500, income 300, Gullak 200', () => {
    const w = state(base, shares);
    expect(w.byExpense.big).toMatchObject({ fromBudget: 500, fromIncome: 300, fromGullak: 200 });
    expect(w.incomeRemaining).toBe(0);
    expect(w.gullakDrawn).toBe(200);
  });

  it('friend pays back 600 of 1000: 180 back to income, 120 back to Gullak, 300 to budget (same proportion)', () => {
    const w = state([...base, repay('r1', 600, TODAY, 'sh1')], shares);
    expect(w.byReimbursement.r1).toEqual({ expenseId: 'big', toBudget: 300, toIncome: 180, toGullak: 120 });
    expect(w.incomeRemaining).toBe(180);
    expect(w.gullakDrawn).toBe(80); // 200 - 120
    expect(w.reimbBudgetByDate[TODAY]).toBe(300);
  });

  it('paid fully by the friend (1000): everything goes back, nothing left drawn from income / Gullak', () => {
    const w = state([...base, repay('r1', 1000, TODAY, 'sh1')], shares);
    expect(w.byReimbursement.r1).toEqual({ expenseId: 'big', toBudget: 500, toIncome: 300, toGullak: 200 });
    expect(w.incomeRemaining).toBe(300);
    expect(w.gullakDrawn).toBe(0);
  });

  it('two partial repayments add up to the same result as one', () => {
    const w = state([...base, repay('r1', 400, '2026-10-11', 'sh1'), repay('r2', 600, TODAY, 'sh1')], shares);
    expect(w.incomeRemaining).toBe(300);
    expect(w.gullakDrawn).toBe(0);
  });

  it('expense paid ONLY from the budget: income and Gullak are untouched by the repayment', () => {
    const w = state([income('inc', 300, '2026-10-09'), spend('small', 400, '2026-10-10'), repay('r1', 150, TODAY, 'shS')], [{ id: 'shS', expense_id: 'small' }]);
    expect(w.byReimbursement.r1).toEqual({ expenseId: 'small', toBudget: 150, toIncome: 0, toGullak: 0 });
    expect(w.incomeRemaining).toBe(300);
    expect(w.gullakDrawn).toBe(0);
  });

  it('expense paid ONLY from Gullak (budget already used by another expense, no income): all of it goes back to Gullak', () => {
    const w = state(
      [spend('first', 500, '2026-10-10', '08:00:00'), spend('over', 200, '2026-10-10', '20:00:00'), repay('r1', 200, TODAY, 'shG')],
      [{ id: 'shG', expense_id: 'over' }]
    );
    expect(w.byExpense.over).toMatchObject({ fromBudget: 0, fromIncome: 0, fromGullak: 200 });
    expect(w.byReimbursement.r1).toEqual({ expenseId: 'over', toBudget: 0, toIncome: 0, toGullak: 200 });
    expect(w.gullakDrawn).toBe(0);
  });

  it('expense paid partly from budget and partly from Gullak: split in the same proportion', () => {
    const w = state([spend('over', 700, '2026-10-10'), repay('r1', 350, TODAY, 'shG')], [{ id: 'shG', expense_id: 'over' }]);
    expect(w.byReimbursement.r1).toEqual({ expenseId: 'over', toBudget: 250, toIncome: 0, toGullak: 100 });
    expect(w.gullakDrawn).toBe(100);
  });

  it('expense paid ONLY from income: the whole repayment goes back to income', () => {
    const w = state([income('inc', 400, '2026-10-09'), spend('over', 900, '2026-10-10'), repay('r1', 400, TODAY, 'shI')], [{ id: 'shI', expense_id: 'over' }]);
    expect(w.byExpense.over).toMatchObject({ fromBudget: 500, fromIncome: 400, fromGullak: 0 });
    // 400 of 900 comes back: 400*400/900 = 177.78 to income, 222.22 to budget
    expect(w.byReimbursement.r1).toEqual({ expenseId: 'over', toBudget: 222.22, toIncome: 177.78, toGullak: 0 });
    expect(w.incomeRemaining).toBe(177.78);
  });

  it('repayment on the SAME day as the expense is split by how that expense was paid', () => {
    const w = state([income('inc', 300, TODAY), spend("big", 1000, TODAY), repay('r1', 500, TODAY, 'sh1')], shares);
    expect(w.byReimbursement.r1.expenseId).toBe('big');
    expect(w.byReimbursement.r1.toBudget + w.byReimbursement.r1.toIncome + w.byReimbursement.r1.toGullak).toBe(500);
    expect(w.byReimbursement.r1.toGullak).toBe(100);
    expect(w.byReimbursement.r1.toIncome).toBe(150);
  });

  it('a repayment that is NOT linked to a split keeps the old behaviour (adds to that day\'s budget)', () => {
    const w = state([spend('e', 650, TODAY), repay('r1', 200, TODAY, null)], []);
    expect(w.byReimbursement.r1).toEqual({ expenseId: null, toBudget: 200, toIncome: 0, toGullak: 0 });
    expect(w.byExpense.e).toMatchObject({ fromBudget: 650, fromGullak: 0 });
  });

  it('every rupee is accounted for: budget + income + Gullak parts = repayment', () => {
    for (const amt of [1, 33.33, 250, 600, 999.99]) {
      const w = state([...base, repay('r1', amt, TODAY, 'sh1')], shares);
      const r = w.byReimbursement.r1;
      expect(Math.round((r.toBudget + r.toIncome + r.toGullak) * 100) / 100).toBe(amt);
    }
  });

  it('Daily pill on the repayment day shows the income that came back; Gullak badge shrinks', () => {
    const w = state([...base, repay('r1', 600, TODAY, 'sh1')], shares);
    const today = summarizeScope(w, (d) => d === TODAY);
    expect(today.incomeRemaining).toBe(180);
    const all = summarizeScope(w, () => true, true);
    expect(all.incomeRemaining).toBe(180);
    expect(all.gullakDrawn).toBe(80);
  });
});

describe('split helpers', () => {
  it('only an EXACT match with an unsettled share is worth asking about', () => {
    const shares = [{ share: { id: 's', user_id: 'u', expense_id: 'e', friend_label: 'Rahul', amount_owed: 500 }, expenseDate: '2026-10-10', expenseAmount: 1000 }];
    expect(findExactSplitCandidates(shares, {}, { amount: 500, date: TODAY })).toHaveLength(1);
    expect(findExactSplitCandidates(shares, {}, { amount: 499, date: TODAY })).toHaveLength(0);
    expect(findExactSplitCandidates(shares, {}, { amount: 300, date: TODAY })).toHaveLength(0);       // partial: not asked
    expect(findExactSplitCandidates(shares, { s: 500 }, { amount: 500, date: TODAY })).toHaveLength(0); // already settled
    expect(findExactSplitCandidates(shares, {}, { amount: 500, date: '2026-10-09' })).toHaveLength(0);  // before the expense
  });

  it('label for Home recent / History', () => {
    const l = splitRepaymentLabel(
      { transaction_class: 'reimbursement', reimburses_share_id: 's' },
      [{ id: 's', expense_id: 'e', friend_label: 'Rahul' }],
      [{ id: 'e', expense_date: '2026-10-10' }]
    );
    expect(l?.title).toBe('Split repayment · Rahul');
    expect(l?.sub).toContain('split created on');
    expect(l?.sub).toContain('10');
    expect(splitRepaymentLabel({ transaction_class: 'normal' }, [], [])).toBeNull();
    expect(splitRepaymentLabel({ transaction_class: 'reimbursement', reimburses_share_id: 'x' }, [], [])?.title).toBe('Split repayment');
  });
});

describe('split repayment in the real store (Gullak, income, saved days)', () => {
  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
    useDailyBudgetStore.getState().resetDailyBudget();
  });

  const setup = (expenses: Expense[], shares: Array<{ id: string; expense_id: string }>) => {
    registerExpensesLoadedGetter(() => true);
    registerExpenseGetter(() => expenses);
    registerSharesGetter(() => shares);
    useDailyBudgetStore.setState({
      ownerUserId: USER, hydratedForUserId: USER, isBudgetModeEnabled: true, budgetCadence: 'daily',
      dailyBudgetAmount: 500, isAutoRenew: true, budgetPeriods: {}, gullakDeposits: [],
      planChanges: [{ id: 'p', userId: USER, effectiveFrom: '2026-10-01', isEnabled: true, cadence: 'daily', amount: 500, createdAt: '2026-10-01T00:00:00Z' }],
      dailyRecords: { '2026-10-08': { date: '2026-10-08', budget: 500, spent: 0, saved: 500, isFinalized: true, status: 'saved' } },
    });
  };

  const base = [income('inc', 300, '2026-10-09'), spend('big', 1000, '2026-10-10')];
  const shares = [{ id: 'sh1', expense_id: 'big' }];

  it('before repayment: Gullak 300 (500 saved - 200 drawn), income 0', () => {
    setup(base, shares);
    useDailyBudgetStore.getState().checkAndRollover(base);
    const s = useDailyBudgetStore.getState();
    expect(s.totalAccumulatedSavings).toBe(300);
    expect(s.getAvailableIncomeBalance()).toBe(0);
  });

  it('after the friend pays 600: 120 back into Gullak, 180 back into income', () => {
    const all = [...base, repay('r1', 600, TODAY, 'sh1')];
    setup(all, shares);
    useDailyBudgetStore.getState().checkAndRollover(all);
    useDailyBudgetStore.getState().syncWithExpenses(all);
    const s = useDailyBudgetStore.getState();
    expect(s.totalAccumulatedSavings).toBe(420);
    expect(s.getAvailableIncomeBalance()).toBe(180);
  });

  it('only the BUDGET part of the repayment adds to that day\'s unspent budget (nothing is counted twice)', () => {
    const all = [...base, repay('r1', 600, TODAY, 'sh1')];
    setup(all, shares);
    useDailyBudgetStore.getState().syncWithExpenses(all);
    // today: budget 500 + 300 (budget part of 600) = 800 would roll over; income/Gullak parts are NOT in it
    expect(useDailyBudgetStore.getState().dailyRecords[TODAY].saved).toBe(800);
  });

  it('settled completely: Gullak and income are exactly as if the expense had never happened', () => {
    const all = [...base, repay('r1', 1000, TODAY, 'sh1')];
    setup(all, shares);
    useDailyBudgetStore.getState().checkAndRollover(all);
    useDailyBudgetStore.getState().syncWithExpenses(all);
    const s = useDailyBudgetStore.getState();
    expect(s.totalAccumulatedSavings).toBe(500);       // only the 10-08 saving
    expect(s.getAvailableIncomeBalance()).toBe(300);   // the full income is back
  });
});
