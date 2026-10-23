import { describe, it, expect, beforeEach, vi } from 'vitest';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { addDays } from 'date-fns/addDays';

vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-11-02T12:00:00'));

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
        data: { session: { user: { id: 'user_carry_test', created_at: '2026-10-01T00:00:00Z' } } },
      }),
    },
  },
}));

// Mock AuthStore
let mockUser: any = { id: 'user_carry_test', created_at: '2026-10-01T00:00:00Z' };
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
  registerCategoryDeleteCallback: vi.fn(),
}));

// Mock NotificationService & NotificationStore
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

import {
  periodCarryForPeriod,
  periodCarryRemaining,
  buildBudgetPools,
  carryForPeriod,
} from '../src/lib/budgetPeriods';
import { BudgetPlanChange } from '../src/types';
import { calculatePeriodSummary } from '../src/lib/homeCalculations';
import {
  useDailyBudgetStore,
  registerExpensesLoadedGetter,
  registerExpenseGetter,
} from '../src/store/dailyBudgetStore';
import { Expense } from '../src/store/expenseStore';
import { buildNotificationPlan, periodCarryCoverCopy, PlanContext } from '../src/lib/notificationPolicy';
import { buildPlanContext } from '../src/lib/notificationSync';
import { buildCadenceSwitchPlan } from '../src/lib/cadenceSwitch';

export const USER = 'user_carry_test';
export const mk = (id: string, amount: number, date: string, type: 'expense' | 'income' = 'expense'): Expense =>
  ({ id, user_id: USER, amount, expense_date: date, payment_mode: 'upi', created_at: `${date}T10:00:00Z`, type } as Expense);
export const st = () => useDailyBudgetStore.getState();
export const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
export const setDay = (d: string) => vi.setSystemTime(new Date(`${d}T12:00:00`));

export interface World { expenses: Expense[]; seq: number }
export const newWorld = (hugeIncome = true): World => ({
  expenses: hugeIncome ? [mk('inc0', 100000, '2026-10-01', 'income')] : [],
  seq: 0,
});

export const openDay = (w: World, day: string) => {
  setDay(day);
  registerExpenseGetter(() => w.expenses);
  st().checkAndRollover(w.expenses);
  st().syncWithExpenses(w.expenses);
};

export const runDays = (w: World, from: string, to: string, perDay: number) => {
  for (let d = parseISO(from); ymd(d) <= to; d = addDays(d, 1)) {
    const ds = ymd(d);
    if (perDay > 0) w.expenses.push(mk(`e${++w.seq}`, perDay, ds));
    openDay(w, ds);
  }
};

export const fresh = (mode: 'pure' | 'daily' | 'weekly' | 'monthly', o: { daily?: number; weekly?: number; monthly?: number; from?: string } = {}) => {
  storageMap.clear();
  st().resetDailyBudget();
  registerExpensesLoadedGetter(() => true);
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CAR-001 Mode B (Allocation) for Weekly / Monthly targets', () => {
  // Test 1: Monthly→Weekly, U=15000, B=5000: periods 1–3 funded=5000, toAdd=0, remainingAfter 10000/5000/0; period 4 null
  it('CAR-001 Acceptance 1: Monthly→Weekly, U=15000, B=5000 -> periods 1-3 funded 5000 each, period 4 null', () => {
    const plans: BudgetPlanChange[] = [
      {
        id: 'p1',
        userId: USER,
        effectiveFrom: '2026-11-02', // Monday
        isEnabled: true,
        cadence: 'weekly',
        amount: 5000,
        carryMode: 'allocation',
        carriedOverAmount: 15000,
        createdAt: '2026-11-01T10:00:00Z',
      },
    ];

    // Period 1: Week starting 2026-11-02
    const p1 = periodCarryForPeriod(plans, '2026-11-02');
    expect(p1).toEqual({
      funded: 5000,
      toAdd: 0,
      remainingAfter: 10000,
      base: 5000,
    });
    expect(periodCarryRemaining(plans, '2026-11-04')).toBe(10000);

    // Period 2: Week starting 2026-11-09
    const p2 = periodCarryForPeriod(plans, '2026-11-09');
    expect(p2).toEqual({
      funded: 5000,
      toAdd: 0,
      remainingAfter: 5000,
      base: 5000,
    });
    expect(periodCarryRemaining(plans, '2026-11-10')).toBe(5000);

    // Period 3: Week starting 2026-11-16
    const p3 = periodCarryForPeriod(plans, '2026-11-16');
    expect(p3).toEqual({
      funded: 5000,
      toAdd: 0,
      remainingAfter: 0,
      base: 5000,
    });
    expect(periodCarryRemaining(plans, '2026-11-17')).toBe(0);

    // Period 4: Week starting 2026-11-23 (carry exhausted)
    const p4 = periodCarryForPeriod(plans, '2026-11-23');
    expect(p4).toBeNull();
    expect(periodCarryRemaining(plans, '2026-11-24')).toBe(0);
  });

  // Test 2: U=12000, B=5000: period 3 funded=2000, toAdd=3000, then null
  it('CAR-001 Acceptance 2: Monthly→Weekly, U=12000, B=5000 -> period 3 funded 2000, toAdd 3000, period 4 null', () => {
    const plans: BudgetPlanChange[] = [
      {
        id: 'p1',
        userId: USER,
        effectiveFrom: '2026-11-02',
        isEnabled: true,
        cadence: 'weekly',
        amount: 5000,
        carryMode: 'allocation',
        carriedOverAmount: 12000,
        createdAt: '2026-11-01T10:00:00Z',
      },
    ];

    expect(periodCarryForPeriod(plans, '2026-11-02')).toEqual({
      funded: 5000,
      toAdd: 0,
      remainingAfter: 7000,
      base: 5000,
    });
    expect(periodCarryForPeriod(plans, '2026-11-09')).toEqual({
      funded: 5000,
      toAdd: 0,
      remainingAfter: 2000,
      base: 5000,
    });
    expect(periodCarryForPeriod(plans, '2026-11-16')).toEqual({
      funded: 2000,
      toAdd: 3000,
      remainingAfter: 0,
      base: 5000,
    });
    expect(periodCarryForPeriod(plans, '2026-11-23')).toBeNull();
  });

  // Test 3: Weekly→Monthly, U=7000, B=3000: months 1–2 fully funded, month 3 funded 1000 / gap 2000
  it('CAR-001 Acceptance 3: Weekly→Monthly, U=7000, B=3000 -> months 1-2 fully funded, month 3 funded 1000 / gap 2000', () => {
    const plans: BudgetPlanChange[] = [
      {
        id: 'p1',
        userId: USER,
        effectiveFrom: '2026-11-01',
        isEnabled: true,
        cadence: 'monthly',
        amount: 3000,
        carryMode: 'allocation',
        carriedOverAmount: 7000,
        createdAt: '2026-10-31T10:00:00Z',
      },
    ];

    // Month 1 (Nov 2026)
    expect(periodCarryForPeriod(plans, '2026-11-01')).toEqual({
      funded: 3000,
      toAdd: 0,
      remainingAfter: 4000,
      base: 3000,
    });
    // Month 2 (Dec 2026)
    expect(periodCarryForPeriod(plans, '2026-12-01')).toEqual({
      funded: 3000,
      toAdd: 0,
      remainingAfter: 1000,
      base: 3000,
    });
    // Month 3 (Jan 2027)
    expect(periodCarryForPeriod(plans, '2027-01-01')).toEqual({
      funded: 1000,
      toAdd: 2000,
      remainingAfter: 0,
      base: 3000,
    });
    // Month 4 (Feb 2027)
    expect(periodCarryForPeriod(plans, '2027-02-01')).toBeNull();
  });

  // Test 4: U < B (e.g. 800 vs 5000): period 1 funded 800, gap 4200, then normal
  it('CAR-001 Acceptance 4: U < B (800 vs 5000) -> period 1 funded 800, gap 4200, period 2 null', () => {
    const plans: BudgetPlanChange[] = [
      {
        id: 'p1',
        userId: USER,
        effectiveFrom: '2026-11-02',
        isEnabled: true,
        cadence: 'weekly',
        amount: 5000,
        carryMode: 'allocation',
        carriedOverAmount: 800,
        createdAt: '2026-11-01T10:00:00Z',
      },
    ];

    expect(periodCarryForPeriod(plans, '2026-11-02')).toEqual({
      funded: 800,
      toAdd: 4200,
      remainingAfter: 0,
      base: 5000,
    });
    expect(periodCarryForPeriod(plans, '2026-11-09')).toBeNull();
  });

  // Test 5: All-pill invariant: Remaining before switch == Remaining right after switch == after each funded period start (no growth); after user adds gap, Remaining grows by exactly that amount
  it('CAR-001 Acceptance 5: All-pill invariant: Remaining before switch == Remaining right after switch == after each funded period start (no growth)', () => {
    const w = newWorld(false);
    // User starts January 2027 with Monthly budget 15000 (Jan 31 2027 is Sunday; Feb 1 2027 is Monday)
    fresh('monthly', { monthly: 15000, from: '2027-01-01' });
    setDay('2027-01-15');
    w.expenses.push(mk('jan1', 2000, '2027-01-15'));
    openDay(w, '2027-01-15');

    // On Sunday 2027-01-31: January ends with 2,000 spent out of 15,000 -> Remaining is 13,000
    setDay('2027-01-31');
    openDay(w, '2027-01-31');

    const summaryJan = calculatePeriodSummary({
      activeFilter: 'All',
      dailyBudgetAmount: 500,
      isAutoRenew: true,
      todayBudget: 0,
      totalIncome: 0,
      totalSpent: 2000,
      filtered: w.expenses,
      userCreatedAtStr: '2027-01-01',
      referenceDate: new Date('2027-01-31T12:00:00'),
      externalDepositsInPeriod: 0,
      planChanges: st().planChanges,
      dailyRecords: st().dailyRecords,
    });
    const remainingBeforeSwitch = summaryJan.primaryAmount;
    expect(remainingBeforeSwitch).toBe(13000);

    // Switch to Weekly with B = 5000, Allocation mode, effective Monday 2027-02-01
    st().setBudgetCadence('weekly', { amount: 5000, carryMode: 'allocation', carriedOverAmount: 13000 });

    // Monday 2027-02-01: Week 1 start (funded 5000, remainingAfter 8000)
    setDay('2027-02-01');
    openDay(w, '2027-02-01');
    const summaryWeek1 = calculatePeriodSummary({
      activeFilter: 'All',
      dailyBudgetAmount: 500,
      isAutoRenew: true,
      todayBudget: 0,
      totalIncome: 0,
      totalSpent: 2000,
      filtered: w.expenses,
      userCreatedAtStr: '2027-01-01',
      referenceDate: new Date('2027-02-01T12:00:00'),
      externalDepositsInPeriod: 0,
      planChanges: st().planChanges,
      dailyRecords: st().dailyRecords,
    });
    // ZERO growth on switch / funded period start
    expect(summaryWeek1.primaryAmount).toBe(remainingBeforeSwitch);

    // Monday 2027-02-08: Week 2 start (funded 5000, remainingAfter 3000)
    setDay('2027-02-08');
    openDay(w, '2027-02-08');
    const summaryWeek2 = calculatePeriodSummary({
      activeFilter: 'All',
      dailyBudgetAmount: 500,
      isAutoRenew: true,
      todayBudget: 0,
      totalIncome: 0,
      totalSpent: 2000,
      filtered: w.expenses,
      userCreatedAtStr: '2027-01-01',
      referenceDate: new Date('2027-02-08T12:00:00'),
      externalDepositsInPeriod: 0,
      planChanges: st().planChanges,
      dailyRecords: st().dailyRecords,
    });
    expect(summaryWeek2.primaryAmount).toBe(remainingBeforeSwitch);

    // Monday 2027-02-15: Week 3 start (funded 3000, gap 2000)
    setDay('2027-02-15');
    openDay(w, '2027-02-15');
    const summaryWeek3Before = calculatePeriodSummary({
      activeFilter: 'All',
      dailyBudgetAmount: 500,
      isAutoRenew: true,
      todayBudget: 0,
      totalIncome: 0,
      totalSpent: 2000,
      filtered: w.expenses,
      userCreatedAtStr: '2027-01-01',
      referenceDate: new Date('2027-02-15T12:00:00'),
      externalDepositsInPeriod: 0,
      planChanges: st().planChanges,
      dailyRecords: st().dailyRecords,
    });
    // Week 3 is funded 3,000 from carry; the 2,000 gap is part of the week's budget and counts like any budget
    // (only the carry-funded part is left out, CAR-001). It must be the SAME number everywhere.
    expect(summaryWeek3Before.primaryAmount).toBe(remainingBeforeSwitch + 2000);

    // Now user adds the gap: deposits 2,000 (as real income)
    w.expenses.push(mk('inc1', 2000, '2027-02-15', 'income'));
    openDay(w, '2027-02-15');
    const summaryWeek3After = calculatePeriodSummary({
      activeFilter: 'All',
      dailyBudgetAmount: 500,
      isAutoRenew: true,
      todayBudget: 0,
      totalIncome: 2000,
      totalSpent: 2000,
      filtered: w.expenses,
      userCreatedAtStr: '2027-01-01',
      referenceDate: new Date('2027-02-15T12:00:00'),
      externalDepositsInPeriod: 0,
      planChanges: st().planChanges,
      dailyRecords: st().dailyRecords,
    });
    // Real money the user adds grows it by exactly that amount, on top of the gap budget
    expect(summaryWeek3After.primaryAmount).toBe(17000);
  });

  // Test 6: Period budget stays B (never B + carry); unspent B at period end goes to Gullak once (BUD-003)
  it('CAR-001 Acceptance 6: Period budget stays B (never B + carry); unspent B at period end goes to Gullak once', () => {
    const plans: BudgetPlanChange[] = [
      {
        id: 'p1',
        userId: USER,
        effectiveFrom: '2026-11-02',
        isEnabled: true,
        cadence: 'weekly',
        amount: 5000,
        carryMode: 'allocation',
        carriedOverAmount: 15000,
        createdAt: '2026-11-01T10:00:00Z',
      },
    ];

    // Pool budget is B (5,000), NOT B + carry (20,000)
    const pools = buildBudgetPools(plans, '2026-11-02');
    const pool = pools['weekly_2026-11-02'];
    expect(pool).toBeDefined();
    expect(pool.budget).toBe(5000);

    // End-of-period unspent rollover
    const w = newWorld(false);
    fresh('weekly', { weekly: 5000, from: '2026-11-02' });
    useDailyBudgetStore.setState({
      planChanges: [
        {
          id: 'p1',
          userId: USER,
          effectiveFrom: '2026-11-02',
          isEnabled: true,
          cadence: 'weekly',
          amount: 5000,
          carryMode: 'allocation',
          carriedOverAmount: 15000,
          createdAt: '2026-11-01T10:00:00Z',
        },
      ],
    } as any);

    // Rollover to Week 2 with 1000 spent during Week 1
    runDays(w, '2026-11-02', '2026-11-03', 0);
    w.expenses.push(mk('w1', 1000, '2026-11-04'));
    runDays(w, '2026-11-04', '2026-11-09', 0);
    // Unspent 4000 went to Gullak once
    expect(st().totalAccumulatedSavings).toBe(4000);
  });

  // Test 7: Multi-switch cascade: allocation carry still unused when user switches again is carried into next plan
  it('CAR-001 Acceptance 7: Multi-switch cascade: unused allocation carry is carried into next plan (periodCarryRemaining)', () => {
    const w = newWorld(false);
    // User in weekly with 15000 carry, 5000/week from 2026-11-02
    fresh('weekly', { weekly: 5000, from: '2026-11-02' });
    useDailyBudgetStore.setState({
      planChanges: [
        {
          id: 'p1',
          userId: USER,
          effectiveFrom: '2026-11-02',
          isEnabled: true,
          cadence: 'weekly',
          amount: 5000,
          carryMode: 'allocation',
          carriedOverAmount: 15000,
          createdAt: '2026-11-01T10:00:00Z',
        },
      ],
    } as any);

    // On Wednesday 2026-11-04, user spent 2,000 of Week 1 pool
    w.expenses.push(mk('e_wed', 2000, '2026-11-04'));
    openDay(w, '2026-11-04');

    // Carryable amount = unspent in Week 1 pool (3,000) + future carry (10,000) = 13,000
    const carryable = st().getCarryableAmount();
    expect(carryable).toBe(13000);

    // User switches to Daily (100/day, Allocation)
    st().setDailyBudget(100);
    st().setBudgetCadence('daily', { amount: 100, carryMode: 'allocation', carriedOverAmount: carryable });

    const latestPlan = st().planChanges[st().planChanges.length - 1];
    expect(latestPlan.cadence).toBe('daily');
    expect(latestPlan.carriedOverAmount).toBe(13000);
  });

  // Test 8: Additive mode results identical to current tests
  it('CAR-001 Acceptance 8: Additive mode results identical to current tests (carryForPeriod only additive)', () => {
    const additivePlan: BudgetPlanChange = {
      id: 'p_add',
      userId: USER,
      effectiveFrom: '2026-11-02',
      isEnabled: true,
      cadence: 'weekly',
      amount: 5000,
      carryMode: 'additive',
      carriedOverAmount: 3000,
      createdAt: '2026-11-01T10:00:00Z',
    };

    // carryForPeriod returns 3000 on first period, 0 on second
    expect(carryForPeriod(additivePlan, '2026-11-02')).toBe(3000);
    expect(carryForPeriod(additivePlan, '2026-11-09')).toBe(0);

    // periodCarryForPeriod returns null for additive mode
    expect(periodCarryForPeriod([additivePlan], '2026-11-02')).toBeNull();

    // Pool budget is B + carry (8,000)
    const pools = buildBudgetPools([additivePlan], '2026-11-02');
    expect(pools['weekly_2026-11-02'].budget).toBe(8000);
  });

  // Test 9: Switching from Daily carries nothing; Gullak deposit on switch night is 0 in all cases
  it('CAR-001 Acceptance 9: Switching from Daily carries nothing; Gullak deposit on switch night is 0 in all cases', () => {
    const plan = buildCadenceSwitchPlan({
      currentCadence: 'daily',
      targetCadence: 'weekly',
      currentBudget: 500,
      currentSpent: 200,
      targetAmount: 3500,
      carryMode: 'allocation',
      todayStr: '2026-11-04',
    });

    // Gullak deposit on switch night is strictly 0
    expect(plan.gullakDeposit).toBe(0);

    // Store carryable check for daily user: today's unused daily goes to Gullak tonight, so 0 carry
    const w = newWorld(false);
    fresh('daily', { daily: 500, from: '2026-11-01' });
    openDay(w, '2026-11-04');
    expect(st().getCarryableAmount()).toBe(0);
  });

  // Test 10: Notifications: first funded day message, gap-period message, silence after carry hits 0, no duplicate ids, one carry message per period
  it('CAR-001 Acceptance 10: Notifications: first funded day message, gap-period message, silence after carry hits 0', () => {
    // 1) Fully funded week copy
    const fundedCopy = periodCarryCoverCopy({
      periodStart: '2026-11-02',
      cadence: 'weekly',
      budget: 5000,
      funded: 5000,
      toAdd: 0,
      remainingAfter: 10000,
    });
    expect(fundedCopy.title).toBe("This week's budget covered");
    expect(fundedCopy.body).toBe("This week's ₹5,000 is funded from your carried balance. ₹10,000 left.");

    // 2) Partial gap week copy
    const gapCopy = periodCarryCoverCopy({
      periodStart: '2026-11-16',
      cadence: 'weekly',
      budget: 5000,
      funded: 2000,
      toAdd: 3000,
      remainingAfter: 0,
    });
    expect(gapCopy.title).toBe('Add only ₹3,000 this week');
    expect(gapCopy.body).toBe('₹2,000 funded from carry. Add ₹3,000 to complete this week\'s budget.');

    // 3) Planner generates carry_cover for funded periods, cut off when remaining hits 0
    const ctx: PlanContext = {
      now: new Date('2026-11-02T06:00:00'),
      profile: 'gullak',
      cadence: 'weekly',
      loggedToday: false,
      dailyBudget: 0,
      todaySpent: 0,
      streak: 5,
      week: { txnCount: 0, spent: 0, prevSpent: 0, topCategory: null, daysTracked: 0, daysUnderBudget: 0, savedToGullak: 0 },
      month: { txnCount: 0, spent: 0, prevSpent: 0, topCategory: null, daysTracked: 0, daysUnderBudget: 0, savedToGullak: 0 },
      period: null,
      monthName: 'November',
      carryPeriods: [
        { periodStart: '2026-11-02', cadence: 'weekly', budget: 5000, funded: 5000, toAdd: 0, remainingAfter: 10000 },
        { periodStart: '2026-11-09', cadence: 'weekly', budget: 5000, funded: 5000, toAdd: 0, remainingAfter: 5000 },
        { periodStart: '2026-11-16', cadence: 'weekly', budget: 5000, funded: 2000, toAdd: 3000, remainingAfter: 0 },
      ],
    };

    const planned = buildNotificationPlan(ctx);
    const carryNotes = planned.filter((n) => n.type === 'carry_cover');
    // Exactly 3 carry messages for the 3 funded periods, unique ids
    expect(carryNotes).toHaveLength(3);
    expect(carryNotes.map((n) => n.id)).toEqual(['carry_2026-11-02', 'carry_2026-11-09', 'carry_2026-11-16']);
    // No carry notification for week 4 (permanent cutoff)
    expect(carryNotes.find((n) => n.id === 'carry_2026-11-23')).toBeUndefined();
  });

  // Test 11: Non-positive plan amount (<= 0) safely terminates without infinite loop
  it('CAR-001 Edge Case: Non-positive plan amount (<= 0) safely terminates without infinite loop', () => {
    const corruptPlans: BudgetPlanChange[] = [
      {
        id: 'p_zero',
        userId: USER,
        effectiveFrom: '2026-11-02',
        isEnabled: true,
        cadence: 'weekly',
        amount: 0,
        carryMode: 'allocation',
        carriedOverAmount: 5000,
        createdAt: '2026-11-01T10:00:00Z',
      },
    ];

    expect(periodCarryForPeriod(corruptPlans, '2026-11-02')).toBeNull();
    expect(periodCarryRemaining(corruptPlans, '2026-11-04')).toBe(0);
  });

  // Test 12: Pre-schedules future carry notifications when cadence switch is effective on upcoming date
  it('CAR-001 Notification Timing: Pre-schedules future carry notifications when cadence switch is effective on upcoming date', () => {
    // Today is Friday 2026-11-06. User switches to Weekly (5000, Allocation, 10000 carry) effective next Monday 2026-11-09.
    fresh('weekly', { weekly: 5000, from: '2026-11-09' });
    useDailyBudgetStore.setState({
      planChanges: [
        {
          id: 'p_old',
          userId: USER,
          effectiveFrom: '2026-11-01',
          isEnabled: true,
          cadence: 'daily',
          amount: 500,
          createdAt: '2026-10-31T10:00:00Z',
        },
        {
          id: 'p_future',
          userId: USER,
          effectiveFrom: '2026-11-09',
          isEnabled: true,
          cadence: 'weekly',
          amount: 5000,
          carryMode: 'allocation',
          carriedOverAmount: 10000,
          createdAt: '2026-11-06T10:00:00Z',
        },
      ],
    } as any);

    // Call buildPlanContext on Friday 2026-11-06
    const ctx = buildPlanContext(new Date('2026-11-06T12:00:00'));
    expect(ctx.carryPeriods).toBeDefined();
    expect(ctx.carryPeriods).toHaveLength(2);
    expect(ctx.carryPeriods![0].periodStart).toBe('2026-11-09');
    expect(ctx.carryPeriods![0].funded).toBe(5000);
    expect(ctx.carryPeriods![1].periodStart).toBe('2026-11-16');
    expect(ctx.carryPeriods![1].funded).toBe(5000);

    // Verify notifications are generated by buildNotificationPlan
    const planned = buildNotificationPlan(ctx);
    const carryNotes = planned.filter((n) => n.type === 'carry_cover');
    // two funded weeks, then ONE message on the first week that carried money no longer pays for
    expect(carryNotes.map((n) => n.id)).toEqual(['carry_2026-11-09', 'carry_2026-11-16', 'carry_end_2026-11-23']);
    expect(ctx.carryEnds).toEqual([{ date: '2026-11-23', cadence: 'weekly', budget: 5000 }]);
    const end = carryNotes[2];
    expect(end.title).toBe('Carried money has run out');
    expect(end.body).toContain('Add');
  });

  // ───────── One number everywhere + daily regression + "funding ended" message ─────────
  const homeAll = (w: World, d: string) =>
    calculatePeriodSummary({
      activeFilter: 'All', dailyBudgetAmount: 500, isAutoRenew: true, todayBudget: 0,
      totalIncome: w.expenses.filter((e) => e.type === 'income').reduce((a, e) => a + e.amount, 0),
      totalSpent: w.expenses.filter((e) => e.type !== 'income').reduce((a, e) => a + e.amount, 0),
      filtered: w.expenses, userCreatedAtStr: '2027-01-01', referenceDate: new Date(`${d}T12:00:00`),
      externalDepositsInPeriod: 0, planChanges: st().planChanges, dailyRecords: st().dailyRecords,
    }).primaryAmount;

  it('CAR-001 / BAL-001: Home All pill and the account total (guard, Gullak cap) are the SAME number across a mid-month Monthly→Weekly allocation switch, gap week included', () => {
    const w = newWorld(false);
    fresh('monthly', { monthly: 15000, from: '2027-01-01' });
    w.expenses.push(mk('inc0', 20000, '2027-01-01', 'income'));
    setDay('2027-01-10'); w.expenses.push(mk('s1', 2000, '2027-01-10')); openDay(w, '2027-01-10');
    setDay('2027-01-14'); openDay(w, '2027-01-14');
    const before = st().getTotalAccountRemaining();
    expect(before).toBe(33000);
    expect(homeAll(w, '2027-01-14')).toBe(before);

    st().setBudgetCadence('weekly', { amount: 5000, carryMode: 'allocation', carriedOverAmount: 13000 });
    const seen: Record<string, number> = {};
    for (const d of ['2027-01-15', '2027-01-18', '2027-01-25', '2027-02-01', '2027-02-08']) {
      setDay(d); openDay(w, d);
      seen[d] = st().getTotalAccountRemaining();
      expect(homeAll(w, d), `Home vs account total on ${d}`).toBe(seen[d]);
    }
    // funded weeks never grow it; the gap week (3,000 funded + 2,000 gap) grows it by the gap only; a normal week adds its full budget
    expect(seen['2027-01-15']).toBe(before);
    expect(seen['2027-01-18']).toBe(before);
    expect(seen['2027-01-25']).toBe(before + 2000);
    expect(seen['2027-02-01']).toBe(before + 2000 + 5000);
  });

  it('CAR-001: Monthly→Daily allocation keeps the account total flat (carry is not new money); Gullak still gets each unspent day', () => {
    const w = newWorld(false);
    fresh('monthly', { monthly: 15000, from: '2027-01-01' });
    w.expenses.push(mk('inc0', 20000, '2027-01-01', 'income'));
    setDay('2027-01-10'); w.expenses.push(mk('s1', 2000, '2027-01-10')); openDay(w, '2027-01-10');
    setDay('2027-01-14'); openDay(w, '2027-01-14');
    const before = st().getTotalAccountRemaining();
    st().setBudgetCadence('daily', { amount: 500, carryMode: 'allocation', carriedOverAmount: 13000 });
    const gullakStart = st().totalAccumulatedSavings;
    let gullakPrev = gullakStart;
    for (const d of ['2027-01-15', '2027-01-18', '2027-01-25', '2027-02-01']) {
      setDay(d); openDay(w, d);
      expect(st().getTotalAccountRemaining(), `total on ${d}`).toBe(before);
      expect(st().totalAccumulatedSavings).toBeGreaterThanOrEqual(gullakPrev);
      gullakPrev = st().totalAccumulatedSavings;
    }
    expect(gullakPrev).toBeGreaterThan(gullakStart); // finished days with unspent daily budget reached Gullak
  });

  it('CAR-001 / NOT-001: ONE "carried money has run out" message on the first day / week / month nothing is funded any more', () => {
    const base = (to: any): any => ({
      planChanges: [
        { id: 'old', userId: USER, effectiveFrom: '2026-11-01', isEnabled: true, cadence: to.oldCadence, amount: 1000, createdAt: '2026-10-31T10:00:00Z' },
        { id: 'new', userId: USER, effectiveFrom: to.from, isEnabled: true, cadence: to.cadence, amount: to.amount, carryMode: 'allocation', carriedOverAmount: to.carry, createdAt: '2026-11-06T10:00:00Z' },
      ],
    });
    // daily: 500/day, 1000 carry -> two funded days, cutoff on the third
    fresh('daily', { daily: 500, from: '2026-11-09' });
    useDailyBudgetStore.setState(base({ oldCadence: 'weekly', from: '2026-11-09', cadence: 'daily', amount: 500, carry: 1000 }) as any);
    let ctx = buildPlanContext(new Date('2026-11-06T12:00:00'));
    expect(ctx.carryEnds).toEqual([{ date: '2026-11-11', cadence: 'daily', budget: 500 }]);
    let ids = buildNotificationPlan(ctx).filter((n) => n.type === 'carry_cover').map((n) => n.id);
    expect(ids).toEqual(['carry_2026-11-09', 'carry_2026-11-10', 'carry_end_2026-11-11']);
    expect(ids.filter((i) => i.startsWith('carry_end_'))).toHaveLength(1);

    // monthly: 3000/month, 4000 carry -> month 1 funded, month 2 part-funded, cutoff on month 3
    fresh('monthly', { monthly: 3000, from: '2026-12-01' });
    useDailyBudgetStore.setState(base({ oldCadence: 'weekly', from: '2026-12-01', cadence: 'monthly', amount: 3000, carry: 4000 }) as any);
    ctx = buildPlanContext(new Date('2026-11-06T12:00:00'));
    expect(ctx.carryEnds).toEqual([{ date: '2027-02-01', cadence: 'monthly', budget: 3000 }]);
    const end = buildNotificationPlan(ctx).find((n) => n.id === 'carry_end_2027-02-01')!;
    expect(end.title).toBe('Carried money has run out');
    expect(end.body).toContain('monthly');
    expect(end.body).toContain('Add');

    // additive / next-day switches have no "end" message, and nothing is sent when no carry exists
    fresh('daily', { daily: 500 });
    expect(buildPlanContext(new Date('2026-11-06T12:00:00')).carryEnds ?? []).toEqual([]);
  });
});
