import { describe, it, expect, beforeEach, vi } from 'vitest';

// These scenarios were written for "today = 2026-09-30" (see comments below). Using the real clock made
// them fail once another full week had passed. Freeze ONLY Date (timers stay real) so results never
// depend on the day the suite runs.
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-10-05T12:00:00'));

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
import { useDailyBudgetStore, registerExpensesLoadedGetter, registerExpenseGetter, registerSharesGetter } from '../src/store/dailyBudgetStore';
import { Expense } from '../src/store/expenseStore';
import { format, addDays, parseISO } from 'date-fns';
import { getCurrentPeriodSummary } from '../src/lib/budgetPeriods';
import { calculatePeriodSummary, getCarryCoveredByDate } from '../src/lib/homeCalculations';
import { dailyCarryForDate } from '../src/lib/budgetPeriods';
import { buildNotificationPlan, carryCoverCopy, PlanContext } from '../src/lib/notificationPolicy';

/**
 * Day-by-day simulator of the real store: every day the app is "opened" (rollover + sync), like a phone.
 */
export const USER = 'user_waterfall_1';
export const mk = (id: string, amount: number, date: string, type: 'expense' | 'income' = 'expense'): Expense =>
  ({ id, user_id: USER, amount, expense_date: date, payment_mode: 'upi', created_at: `${date}T10:00:00Z`, type } as Expense);
export const st = () => useDailyBudgetStore.getState();
export const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
export const setDay = (d: string) => vi.setSystemTime(new Date(`${d}T12:00:00`));

export interface World { expenses: Expense[]; seq: number }
export const newWorld = (hugeIncome = true): World => ({ expenses: hugeIncome ? [mk('inc0', 100000, '2026-10-01', 'income')] : [], seq: 0 });

export const openDay = (w: World, day: string) => {
  setDay(day);
  registerExpenseGetter(() => w.expenses);
  st().checkAndRollover(w.expenses);
  st().syncWithExpenses(w.expenses);
};

/** Opens the app every day in [from, to] and spends `perDay` each day (0 = no spending). */
export const runDays = (w: World, from: string, to: string, perDay: number) => {
  for (let d = parseISO(from); ymd(d) <= to; d = addDays(d, 1)) {
    const ds = ymd(d);
    if (perDay > 0) w.expenses.push(mk(`e${++w.seq}`, perDay, ds));
    openDay(w, ds);
  }
};

export type Mode = 'pure' | 'daily' | 'weekly' | 'monthly';
export const fresh = (mode: Mode, o: { daily?: number; weekly?: number; monthly?: number; from?: string } = {}) => {
  storageMap.clear();
  st().resetDailyBudget();
  registerExpensesLoadedGetter(() => true);
  registerSharesGetter(() => []);
  const cad = mode === 'pure' ? 'daily' : mode;
  const d = o.daily ?? 500, wk = o.weekly ?? 2100, mo = o.monthly ?? 9000;
  const amt = cad === 'weekly' ? wk : cad === 'monthly' ? mo : d;
  useDailyBudgetStore.setState({
    ownerUserId: USER, hydratedForUserId: USER, isBudgetModeEnabled: mode !== 'pure', budgetCadence: cad as any,
    dailyBudgetAmount: d, weeklyBudgetAmount: wk, monthlyBudgetAmount: mo, isAutoRenew: mode !== 'pure',
    budgetPeriods: {}, gullakDeposits: [], dailyRecords: {}, lastRenewedPeriodKey: null,
    planChanges: mode === 'pure' ? [] : [{ id: 'p0', userId: USER, effectiveFrom: o.from ?? '2026-10-01', isEnabled: true, cadence: cad as any, amount: amt, createdAt: '2026-10-01T00:00:00Z' }],
  } as any);
};

beforeEach(() => { vi.clearAllMocks(); });

describe('Bug 1: a weekly / monthly user gets NO daily budget on top', () => {
  it('weekly 2100 + a leftover daily setting of 500, 18 days of 200/day: Gullak is only the weekly leftover', () => {
    const w = newWorld();
    fresh('weekly', { daily: 500, weekly: 2100 });
    runDays(w, '2026-10-02', '2026-10-20', 200);
    const s = st();
    // weeks: 10-01..10-04 (partial, full budget) leftover 1500; 10-05..10-11: 700; 10-12..10-18: 700
    expect(Object.values(s.budgetPeriods).reduce((a, p) => a + p.amountSaved, 0)).toBe(2900);
    expect(s.totalAccumulatedSavings).toBe(2900);
    // no day carries a daily budget
    expect(Object.values(s.dailyRecords).filter((r) => r.budget > 0)).toHaveLength(0);
  });

  it('monthly user: same', () => {
    const w = newWorld();
    fresh('monthly', { daily: 500, monthly: 9000 });
    runDays(w, '2026-10-02', '2026-11-03', 200);
    expect(st().totalAccumulatedSavings).toBe(9000 - 200 * 30); // October: days 2..31 spent (1 Oct no spend)
    expect(Object.values(st().dailyRecords).filter((r) => r.budget > 0)).toHaveLength(0);
  });

  it('daily user is unchanged', () => {
    const w = newWorld();
    fresh('daily', { daily: 500 });
    runDays(w, '2026-10-02', '2026-10-10', 200);
    expect(st().totalAccumulatedSavings).toBe(8 * 300);
  });

  it('an old user with NO plan history (legacy daily user) still gets daily records', () => {
    const w = newWorld();
    fresh('daily', { daily: 500 });
    useDailyBudgetStore.setState({ planChanges: [] } as any);
    runDays(w, '2026-10-02', '2026-10-08', 200);
    expect(st().totalAccumulatedSavings).toBe(6 * 300);
  });

  it('daily -> weekly: from the first weekly day there is no daily budget any more', () => {
    const w = newWorld();
    fresh('daily', { daily: 500, weekly: 2100 });
    runDays(w, '2026-10-02', '2026-10-07', 200);
    setDay('2026-10-07');
    st().setBudgetCadence('weekly', { amount: 2100 });
    runDays(w, '2026-10-08', '2026-10-13', 200);
    const recs = st().dailyRecords;
    expect(recs['2026-10-08'].budget).toBe(0);
    expect(recs['2026-10-10'].budget).toBe(0);
    // Gullak: daily days 10-02..10-07 (6 x 300) + weekly slice 10-08..10-11 (2100 - 800 = 1300)
    expect(st().totalAccumulatedSavings).toBe(1800 + 1300);
  });

  it('weekly -> daily: today (still weekly) gets no daily record, tomorrow does', () => {
    const w = newWorld();
    fresh('weekly', { daily: 500, weekly: 2100 });
    runDays(w, '2026-10-02', '2026-10-07', 200);
    setDay('2026-10-07');
    st().setBudgetCadence('daily', { amount: 500 });
    openDay(w, '2026-10-07');
    expect(st().dailyRecords['2026-10-07'].budget).toBe(0);
    runDays(w, '2026-10-08', '2026-10-09', 200);
    expect(st().dailyRecords['2026-10-08'].budget).toBe(500);
  });

  it('HEAL: an existing weekly user whose phone already holds wrong daily rows is corrected', () => {
    const w = newWorld();
    fresh('weekly', { daily: 500, weekly: 2100 });
    // what the old version wrote: a daily row for every day, inflating Gullak
    const bad: Record<string, any> = {};
    for (let d = parseISO('2026-10-02'); ymd(d) <= '2026-10-12'; d = addDays(d, 1)) {
      bad[ymd(d)] = { date: ymd(d), budget: 500, spent: 200, saved: 300, isFinalized: true, status: 'saved' };
      w.expenses.push(mk(`e${++w.seq}`, 200, ymd(d)));
    }
    useDailyBudgetStore.setState({ dailyRecords: bad } as any);
    openDay(w, '2026-10-13');
    const s = st();
    expect(Object.values(s.dailyRecords).filter((r) => r.budget > 0)).toHaveLength(0);
    expect(Object.values(s.dailyRecords).filter((r) => r.forceOverwrite || r.needsUpload).length).toBeGreaterThan(0);
    expect(s.totalAccumulatedSavings).toBe(1500 + 700); // only the two finished weekly periods
  });
});

describe('Bug 2: additive carry-over is added ONCE (first period only)', () => {
  it('monthly -> weekly, additive 300: first week 2400, every later week 2100', () => {
    const w = newWorld();
    fresh('monthly', { weekly: 2100, monthly: 9000 });
    runDays(w, '2026-10-02', '2026-10-07', 0);
    setDay('2026-10-07');
    st().setBudgetCadence('weekly', { amount: 2100, carryMode: 'additive', carriedOverAmount: 300 });
    runDays(w, '2026-10-08', '2026-11-16', 0);
    const weekly = Object.values(st().budgetPeriods).filter((p) => p.cadence === 'weekly').sort((a, b) => a.activeStart.localeCompare(b.activeStart));
    expect(weekly.length).toBeGreaterThanOrEqual(5);
    expect(weekly[0].budgetAmount).toBe(2400);
    for (const p of weekly.slice(1)) expect(p.budgetAmount).toBe(2100);
  });

  it('the live period summary (hero card) also adds it only in the first week', () => {
    const w = newWorld();
    fresh('monthly', { weekly: 2100, monthly: 9000 });
    runDays(w, '2026-10-02', '2026-10-07', 0);
    setDay('2026-10-07');
    st().setBudgetCadence('weekly', { amount: 2100, carryMode: 'additive', carriedOverAmount: 300 });
    runDays(w, '2026-10-08', '2026-10-10', 0);
    expect(getCurrentPeriodSummary(st().planChanges, {}, '2026-10-10')?.budget).toBe(2400);
    expect(getCurrentPeriodSummary(st().planChanges, {}, '2026-10-14')?.budget).toBe(2100);
  });

  it('allocation never adds anything', () => {
    const w = newWorld();
    fresh('monthly', { weekly: 2100, monthly: 9000 });
    runDays(w, '2026-10-02', '2026-10-07', 0);
    setDay('2026-10-07');
    st().setBudgetCadence('weekly', { amount: 2100, carryMode: 'allocation', carriedOverAmount: 300 });
    runDays(w, '2026-10-08', '2026-10-20', 0);
    for (const p of Object.values(st().budgetPeriods).filter((p) => p.cadence === 'weekly')) expect(p.budgetAmount).toBe(2100);
  });

  it('HEAL: periods already saved with the repeated carry (2400 every week) are corrected', () => {
    const w = newWorld();
    fresh('weekly', { weekly: 2100 });
    useDailyBudgetStore.setState({
      planChanges: [{ id: 'w', userId: USER, effectiveFrom: '2026-10-08', isEnabled: true, cadence: 'weekly', amount: 2100, carryMode: 'additive', carriedOverAmount: 300, createdAt: '2026-10-07T00:00:00Z' }],
      budgetPeriods: {
        'weekly_2026-10-08': { id: 'weekly_2026-10-08', userId: USER, cadence: 'weekly', periodStart: '2026-10-05', periodEnd: '2026-10-11', activeStart: '2026-10-08', activeEnd: '2026-10-11', budgetAmount: 2400, spentAmount: 0, amountSaved: 2400, status: 'saved', isProrated: false, carriedOverAmount: 300, createdAt: '2026-10-12' },
        'weekly_2026-10-12': { id: 'weekly_2026-10-12', userId: USER, cadence: 'weekly', periodStart: '2026-10-12', periodEnd: '2026-10-18', activeStart: '2026-10-12', activeEnd: '2026-10-18', budgetAmount: 2400, spentAmount: 0, amountSaved: 2400, status: 'saved', isProrated: false, carriedOverAmount: 300, createdAt: '2026-10-19' },
      },
    } as any);
    openDay(w, '2026-10-20');
    const p = st().budgetPeriods;
    expect(p['weekly_2026-10-08'].budgetAmount).toBe(2400);   // first period keeps it
    expect(p['weekly_2026-10-12'].budgetAmount).toBe(2100);   // repeated one is removed
    expect(p['weekly_2026-10-12'].amountSaved).toBe(2100);
  });
});

describe('Bug 6: All pill counts only days the app really tracked', () => {
  it('5 days nobody opened the app add NO budget (they have no record and no Gullak entry)', () => {
    const base: any = {
      activeFilter: 'All', dailyBudgetAmount: 500, isAutoRenew: true, todayBudget: 500, totalIncome: 0, totalSpent: 0,
      filtered: [], userCreatedAtStr: '2026-10-01', referenceDate: new Date(2026, 9, 8), externalDepositsInPeriod: 0,
      planChanges: [{ id: 'p', userId: 'u', effectiveFrom: '2026-10-01', isEnabled: true, cadence: 'daily', amount: 500 }],
    };
    const tracked = (d: string) => ({ date: d, budget: 500, spent: 0, saved: 500, isFinalized: true, status: 'saved' as const });
    // opened on 1, 2, 3 and today (8): days 4..7 were never opened
    const r = calculatePeriodSummary({ ...base, dailyRecords: { '2026-10-01': tracked('2026-10-01'), '2026-10-02': tracked('2026-10-02'), '2026-10-03': tracked('2026-10-03') } });
    expect(r.periodBudgetPool).toBe(4 * 500); // 3 tracked + today
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Bug 5 / ADR 0012: ONE budget per calendar period. Pure Mode keeps the same books.
// (November 2026: these rules apply to periods that start on/after 2026-10-14; older ones keep their numbers.)
// ─────────────────────────────────────────────────────────────────────────────────────────────────
const pureOn = (day: string) => { setDay(day); st().setBudgetModeEnabled(false); };
const pureOff = (day: string) => { setDay(day); st().setBudgetModeEnabled(true); };

describe('Bug 5: monthly budget, Pure Mode in the middle (the product-owner example)', () => {
  const build = (toggle: boolean) => {
    const w = newWorld();
    fresh('monthly', { monthly: 9000, from: '2026-11-01' });
    runDays(w, '2026-11-02', '2026-11-08', 200);          // budget on: 7 x 200 = 1400
    if (toggle) pureOn('2026-11-08');
    runDays(w, '2026-11-09', '2026-11-23', 200);          // 15 x 200 = 3000 (Pure Mode when toggled)
    if (toggle) pureOff('2026-11-23');
    runDays(w, '2026-11-24', '2026-11-30', 200);          // 7 x 200 = 1400
    return w;
  };

  it('toggling Pure Mode and back never changes what ends up in Gullak (3200 either way)', () => {
    const a = build(false);
    runDays(a, '2026-12-01', '2026-12-02', 0);
    const withoutToggle = st().totalAccumulatedSavings;
    const b = build(true);
    runDays(b, '2026-12-01', '2026-12-02', 0);
    expect(withoutToggle).toBe(9000 - 5800);
    expect(st().totalAccumulatedSavings).toBe(withoutToggle);
  });

  it('coming back on 24 Nov: the SAME pool continues: 4600 left of 9000 (not a fresh 9000)', () => {
    const w = newWorld();
    fresh('monthly', { monthly: 9000, from: '2026-11-01' });
    runDays(w, '2026-11-02', '2026-11-08', 200);
    pureOn('2026-11-08');
    runDays(w, '2026-11-09', '2026-11-23', 200);
    pureOff('2026-11-23');
    openDay(w, '2026-11-24');
    const spentByDate: Record<string, number> = {};
    for (const e of w.expenses) if (e.type === 'expense') spentByDate[e.expense_date] = (spentByDate[e.expense_date] || 0) + e.amount;
    const sum = getCurrentPeriodSummary(st().planChanges, spentByDate, '2026-11-24');
    expect(sum?.budget).toBe(9000);
    expect(sum?.spent).toBe(4400);       // 1400 + 3000 (the 24th has no spending yet)
    expect(sum?.remaining).toBe(4600);
  });

  it('nothing is taken from income or Gullak while the pool still has money', () => {
    build(true);
    expect(st().getAvailableIncomeBalance()).toBe(100000);
  });
});

describe('Bug 5: Pure Mode spends budget -> income -> Gullak (same books as Budget Mode)', () => {
  it('Pure spending beyond the pool uses income, then Gullak; back in Budget Mode it shows exactly that', () => {
    const w = newWorld(false);
    w.expenses.push(mk('inc', 500, '2026-11-01', 'income'));
    fresh('monthly', { monthly: 9000, from: '2026-11-01' });
    useDailyBudgetStore.setState({ gullakDeposits: [{ id: 'g', amount: 1000, date: '2026-11-01', source: 'external', created_at: '' }] } as any);
    runDays(w, '2026-11-02', '2026-11-02', 0);
    pureOn('2026-11-02');
    // one big Pure expense of 10,500 = 9000 pool + 500 income + 1000 Gullak
    w.expenses.push(mk('big', 10500, '2026-11-03'));
    openDay(w, '2026-11-03');
    expect(st().getAvailableIncomeBalance()).toBe(0);
    expect(st().totalAccumulatedSavings).toBe(0);
    pureOff('2026-11-04');
    openDay(w, '2026-11-04');
    expect(st().getAvailableIncomeBalance()).toBe(0);
    expect(st().totalAccumulatedSavings).toBe(0);
  });

  it('a Pure expense inside the pool leaves income and Gullak untouched', () => {
    const w = newWorld(false);
    w.expenses.push(mk('inc', 500, '2026-11-01', 'income'));
    fresh('monthly', { monthly: 9000, from: '2026-11-01' });
    useDailyBudgetStore.setState({ gullakDeposits: [{ id: 'g', amount: 1000, date: '2026-11-01', source: 'external', created_at: '' }] } as any);
    runDays(w, '2026-11-02', '2026-11-02', 0);
    pureOn('2026-11-02');
    w.expenses.push(mk('e', 7000, '2026-11-03'));
    openDay(w, '2026-11-03');
    expect(st().getAvailableIncomeBalance()).toBe(500);
    expect(st().totalAccumulatedSavings).toBe(1000);
  });

  it('a Pure user who never had a budget: expenses come from income, then Gullak', () => {
    const w = newWorld(false);
    w.expenses.push(mk('inc', 1000, '2026-11-01', 'income'));
    fresh('pure');
    useDailyBudgetStore.setState({ gullakDeposits: [{ id: 'g', amount: 200, date: '2026-11-01', source: 'external', created_at: '' }] } as any);
    w.expenses.push(mk('e', 1100, '2026-11-02'));
    openDay(w, '2026-11-02');
    expect(st().getAvailableIncomeBalance()).toBe(0);
    expect(st().totalAccumulatedSavings).toBe(100);
  });
});

describe('Bug 5: the period ends while the user is in Pure Mode', () => {
  it('what is left of the pool becomes INCOME, nothing goes to Gullak', () => {
    const w = newWorld(false);
    fresh('monthly', { monthly: 9000, from: '2026-11-01' });
    runDays(w, '2026-11-02', '2026-11-09', 200);        // 8 x 200 = 1600 used, 7400 left
    pureOn('2026-11-09');
    runDays(w, '2026-11-10', '2026-12-03', 0);          // November ends in Pure Mode
    expect(st().totalAccumulatedSavings).toBe(0);       // Pure Mode has no Gullak
    expect(st().getAvailableIncomeBalance()).toBe(7400);
  });

  it('coming back in the NEXT period starts normally with a fresh budget', () => {
    const w = newWorld(false);
    fresh('monthly', { monthly: 9000, from: '2026-11-01' });
    runDays(w, '2026-11-02', '2026-11-09', 200);
    pureOn('2026-11-09');
    runDays(w, '2026-11-10', '2026-12-03', 0);
    pureOff('2026-12-03');
    openDay(w, '2026-12-03');
    const sum = getCurrentPeriodSummary(st().planChanges, {}, '2026-12-03');
    expect(sum?.budget).toBe(9000);
    expect(sum?.remaining).toBe(9000);
  });
});

describe('Bug 5: weekly -> daily -> weekly inside the SAME week', () => {
  it('the weekly budget was carried to daily: coming back leaves nothing, spending comes from income', () => {
    const w = newWorld(false);
    w.expenses.push(mk('inc', 5000, '2026-11-01', 'income'));
    fresh('weekly', { weekly: 2100, daily: 500, from: '2026-11-02' }); // Mon 2 Nov
    runDays(w, '2026-11-02', '2026-11-04', 200);                        // Mon-Wed
    setDay('2026-11-04'); st().setBudgetCadence('daily', { amount: 500 });   // daily from Thu
    runDays(w, '2026-11-05', '2026-11-06', 0);
    setDay('2026-11-06'); st().setBudgetCadence('weekly', { amount: 2100 }); // weekly again from Sat
    w.expenses.push(mk('sat', 300, '2026-11-07'));
    openDay(w, '2026-11-07');
    // Saturday is back in the same (closed) weekly pool: nothing left there -> paid from income
    expect(st().getAvailableIncomeBalance()).toBe(5000 - 300);
  });
});

describe('Bug 5: guard in Pure Mode counts unspent budget money', () => {
  it('7,600 of pool left, no income at all: Pure Mode may still spend', () => {
    const w = newWorld(false);
    fresh('monthly', { monthly: 9000, from: '2026-11-01' });
    runDays(w, '2026-11-02', '2026-11-08', 200);
    pureOn('2026-11-08');
    expect(st().getTotalAccountRemaining()).toBe(9000 - 1400);
  });
});


// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Bug 3 / Bug 4: carrying money when the cadence changes
// ─────────────────────────────────────────────────────────────────────────────────────────────────
/** Weekly 2100 from Mon 2 Nov, ₹200/day Mon-Wed -> ₹1500 left on Wednesday 4 Nov (switch effective Thursday). */
const weeklyToDaily = (carryMode: 'additive' | 'allocation', daily: number, wanted = 1500, spendPerDay = 200) => {
  const w = newWorld();
  fresh('weekly', { weekly: 2100, daily, from: '2026-11-02' });
  runDays(w, '2026-11-02', '2026-11-04', spendPerDay);
  setDay('2026-11-04');
  st().setDailyBudget(daily);
  st().setBudgetCadence('daily', { amount: daily, carryMode, carriedOverAmount: wanted });
  return w;
};
const recBudget = (d: string) => st().dailyRecords[d]?.budget;

describe('Bug 3: weekly / monthly -> daily keeps the left-over money (carry)', () => {
  it('only the money that REALLY is left can be carried (never more than the pool holds)', () => {
    weeklyToDaily('allocation', 100, 99999);
    const plan = st().planChanges[st().planChanges.length - 1];
    expect(plan.cadence).toBe('daily');
    expect(plan.carriedOverAmount).toBe(1500);
  });

  it('SPREAD: 100/day, 1500 left -> days 1..15 are paid from it, the user adds nothing', () => {
    weeklyToDaily('allocation', 100);
    const plans = st().planChanges;
    const rb = (d: string) => recBudget(d);
    const first = dailyCarryForDate(plans, rb, 100, '2026-11-05')!;
    expect(first).toMatchObject({ mode: 'spread', funded: 100, toAdd: 0, remainingAfter: 1400 });
    const d15 = dailyCarryForDate(plans, rb, 100, '2026-11-19')!;
    expect(d15).toMatchObject({ funded: 100, toAdd: 0, remainingAfter: 0 });
    // day 16 (20 Nov): normal daily, the user adds the full 100
    expect(dailyCarryForDate(plans, rb, 100, '2026-11-20')).toMatchObject({ funded: 0, toAdd: 100 });
  });

  it('SPREAD with 1550 left: day 16 only needs 50 from the user (the example)', () => {
    weeklyToDaily('allocation', 100, 1550, 200);   // Mon-Wed spent 600 of 2100 = 1500; use a bigger pool below
    // 1500 left in this build; assert the general rule with an explicit plan instead
    const plans: any[] = [{ id: 'd', userId: 'u', effectiveFrom: '2026-11-05', isEnabled: true, cadence: 'daily', amount: 100, carryMode: 'allocation', carriedOverAmount: 1550, createdAt: '2026-11-04T10:00:00Z' }];
    const rb = () => 100;
    expect(dailyCarryForDate(plans, rb, 100, '2026-11-19')).toMatchObject({ funded: 100, toAdd: 0, remainingAfter: 50 });
    expect(dailyCarryForDate(plans, rb, 100, '2026-11-20')).toMatchObject({ funded: 50, toAdd: 50, remainingAfter: 0 });
    expect(dailyCarryForDate(plans, rb, 100, '2026-11-21')).toMatchObject({ funded: 0, toAdd: 100 });
  });

  it('NEXT DAY: the first daily day gets the carry on top; unused money goes to Gullak that night', () => {
    const w = weeklyToDaily('additive', 100);
    runDays(w, '2026-11-05', '2026-11-06', 0);          // 5 Nov: nothing spent
    expect(recBudget('2026-11-05')).toBe(1600);
    expect(recBudget('2026-11-06')).toBe(100);          // only the FIRST day
    // the whole 1600 was unspent -> Gullak (plus the weekly leftover logic: switch itself gave 0)
    expect(st().dailyRecords['2026-11-05'].saved).toBe(1600);
    expect(st().totalAccumulatedSavings).toBe(1600);
  });

  it('SPREAD: an unspent daily budget goes to Gullak like any daily day', () => {
    const w = weeklyToDaily('allocation', 100);
    runDays(w, '2026-11-05', '2026-11-07', 0);
    expect(st().totalAccumulatedSavings).toBe(200);     // 5th and 6th finalized: 2 x 100
  });

  it('the All pill does not count carried money twice (it is already inside the old weekly budget)', () => {
    weeklyToDaily('allocation', 100);
    const rec = (d: string) => ({ date: d, budget: 100, spent: 0, saved: 100, isFinalized: true, status: 'saved' as const });
    const covered = getCarryCoveredByDate(st().planChanges, { '2026-11-05': rec('2026-11-05') as any }, 100, '2026-11-05');
    expect(covered['2026-11-05']).toBe(100);
    const base: any = {
      activeFilter: 'All', dailyBudgetAmount: 100, isAutoRenew: true, todayBudget: 100, totalIncome: 0, totalSpent: 0,
      filtered: [], userCreatedAtStr: '2026-11-05', referenceDate: new Date(2026, 10, 6), externalDepositsInPeriod: 0,
      planChanges: st().planChanges, dailyRecords: { '2026-11-05': rec('2026-11-05') },
    };
    const without = calculatePeriodSummary({ ...base, carryCoveredByDate: undefined });
    const withCover = calculatePeriodSummary({ ...base, carryCoveredByDate: { '2026-11-05': 100, '2026-11-06': 100 } });
    expect(without.periodBudgetPool - withCover.periodBudgetPool).toBeGreaterThan(0);
  });

  it('a daily budget changed later: the carry keeps paying whatever the day\'s budget is', () => {
    const plans: any[] = [{ id: 'd', userId: 'u', effectiveFrom: '2026-11-05', isEnabled: true, cadence: 'daily', amount: 100, carryMode: 'allocation', carriedOverAmount: 300, createdAt: '2026-11-04T10:00:00Z' }];
    const rb = (d: string) => (d <= '2026-11-05' ? 100 : 200);
    expect(dailyCarryForDate(plans, rb, 200, '2026-11-05')).toMatchObject({ funded: 100, remainingAfter: 200 });
    expect(dailyCarryForDate(plans, rb, 200, '2026-11-06')).toMatchObject({ funded: 200, toAdd: 0, remainingAfter: 0 });
  });

  it('old plans (before the rule date) are NOT touched: their carry is still ignored for daily', () => {
    const old: any[] = [{ id: 'd', userId: 'u', effectiveFrom: '2026-10-08', isEnabled: true, cadence: 'daily', amount: 100, carryMode: 'allocation', carriedOverAmount: 1500, createdAt: '2026-10-07T10:00:00Z' }];
    expect(dailyCarryForDate(old, () => 100, 100, '2026-10-09')).toBeNull();
  });

  it('carry still unused can move on to the next cadence (spread, then switch again)', () => {
    const w = weeklyToDaily('allocation', 100);
    runDays(w, '2026-11-05', '2026-11-08', 100);       // 5..8 Nov paid from carry: 1500 - 400 = 1100 left
    setDay('2026-11-08');
    expect(st().getCarryableAmount()).toBe(1100);
  });
});

describe('Bug 4: switching FROM daily carries nothing (today\'s leftover goes to Gullak tonight)', () => {
  it('daily -> weekly / monthly with a carry request: dropped', () => {
    const w = newWorld();
    fresh('daily', { daily: 500, weekly: 2100 });
    runDays(w, '2026-11-02', '2026-11-04', 200);
    setDay('2026-11-04');
    st().setBudgetCadence('weekly', { amount: 2100, carryMode: 'additive', carriedOverAmount: 300 });
    const plan = st().planChanges[st().planChanges.length - 1];
    expect(plan.carryMode).toBeUndefined();
    expect(plan.carriedOverAmount).toBeUndefined();
  });

  it('the money is counted ONCE: the day\'s leftover reaches Gullak, the weekly budget stays 2100', () => {
    const w = newWorld();
    fresh('daily', { daily: 500, weekly: 2100 });
    runDays(w, '2026-11-02', '2026-11-04', 200);
    setDay('2026-11-04');
    st().setBudgetCadence('weekly', { amount: 2100, carryMode: 'additive', carriedOverAmount: 300 });
    runDays(w, '2026-11-05', '2026-11-09', 0);
    const weekly = Object.values(st().budgetPeriods).filter((p) => p.cadence === 'weekly');
    expect(weekly[0].budgetAmount).toBe(2100);
    // Mon-Wed daily: 3 x 300 = 900;  Thu-Sun weekly slice: 2100 - 0 = 2100
    expect(st().totalAccumulatedSavings).toBe(900 + 2100);
  });

  it('weekly -> monthly still carries (the money left in the running budget)', () => {
    const w = newWorld();
    fresh('weekly', { weekly: 2100, monthly: 9000, from: '2026-11-02' });
    runDays(w, '2026-11-02', '2026-11-04', 200);
    setDay('2026-11-04');
    st().setBudgetCadence('monthly', { amount: 9000, carryMode: 'additive', carriedOverAmount: 99999 });
    expect(st().planChanges[st().planChanges.length - 1].carriedOverAmount).toBe(1500);
  });
});

describe('Carry cover notification ("how much to add today")', () => {
  const baseCtx = (carryDays: PlanContext['carryDays']): PlanContext => ({
    now: new Date(2026, 10, 4, 22, 0, 0), profile: 'gullak', cadence: 'daily', loggedToday: true, dailyBudget: 100, todaySpent: 0, streak: 0,
    week: { txnCount: 0, spent: 0, prevSpent: 0, topCategory: null, daysTracked: 0, daysUnderBudget: 0, savedToGullak: 0 },
    month: { txnCount: 0, spent: 0, prevSpent: 0, topCategory: null, daysTracked: 0, daysUnderBudget: 0, savedToGullak: 0 },
    period: null, monthName: 'November', carryDays,
  });

  it('spread, fully covered: "Nothing to add today"', () => {
    const c = carryCoverCopy({ date: '2026-11-05', mode: 'spread', budget: 100, funded: 100, toAdd: 0, remainingAfter: 1400 });
    expect(c.title).toBe('Nothing to add today');
    expect(c.body).toContain('₹1,400 left');
  });
  it('spread, half covered: "Add only ₹50 today"', () => {
    const c = carryCoverCopy({ date: '2026-11-20', mode: 'spread', budget: 100, funded: 50, toAdd: 50, remainingAfter: 0 });
    expect(c.title).toBe('Add only ₹50 today');
  });
  it('next day: budget 1600, add only 100', () => {
    const c = carryCoverCopy({ date: '2026-11-05', mode: 'next_day', budget: 1600, funded: 1500, toAdd: 100, remainingAfter: 0 });
    expect(c.title).toBe('Add only ₹100 today');
    expect(c.body).toContain('₹1,600');
  });
  it('the planner schedules one 8:00 message per carried day, and only for those days', () => {
    const plan = buildNotificationPlan(baseCtx([
      { date: '2026-11-05', mode: 'spread', budget: 100, funded: 100, toAdd: 0, remainingAfter: 1400 },
      { date: '2026-11-06', mode: 'spread', budget: 100, funded: 100, toAdd: 0, remainingAfter: 1300 },
    ]));
    const carry = plan.filter((p) => p.type === 'carry_cover');
    expect(carry.map((p) => p.id)).toEqual(['carry_2026-11-05', 'carry_2026-11-06']);
    expect(carry[0].fireAt.getHours()).toBe(8);
    expect(buildNotificationPlan(baseCtx(undefined)).filter((p) => p.type === 'carry_cover')).toHaveLength(0);
  });
});

describe('Welcome back / Pure period ended messages', () => {
  it('switching Budget Mode back on inside the month says what is left of the SAME budget', () => {
    const w = newWorld();
    mockAddNotification.mockClear();
    fresh('monthly', { monthly: 9000, from: '2026-11-01' });
    runDays(w, '2026-11-02', '2026-11-08', 200);
    pureOn('2026-11-08');
    runDays(w, '2026-11-09', '2026-11-23', 200);
    pureOff('2026-11-23');
    const msg = mockAddNotification.mock.calls.map((c: any[]) => c[0]).find((n: any) => String(n.id).startsWith('resumed_'));
    expect(msg?.title).toBe('Welcome back');
    expect(msg?.message).toContain('₹4,600');
    expect(msg?.message).toContain('₹9,000');
  });

  it('a month that ends in Pure Mode tells the user the unused part became income', () => {
    const w = newWorld(false);
    mockAddNotification.mockClear();
    fresh('monthly', { monthly: 9000, from: '2026-11-01' });
    runDays(w, '2026-11-02', '2026-11-09', 200);
    pureOn('2026-11-09');
    runDays(w, '2026-11-10', '2026-12-03', 0);
    const msg = mockAddNotification.mock.calls.map((c: any[]) => c[0]).find((n: any) => String(n.id).startsWith('pure_end_'));
    expect(msg?.message).toContain('₹7,400');
    expect(msg?.message).toContain('Nothing went to Gullak');
  });
});
