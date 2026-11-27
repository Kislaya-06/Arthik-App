import { describe, it, expect, vi } from 'vitest';

/**
 * Money Scope (ADR 0022): `heroMoney` / `allowanceCardMoney` are a pure MOVE of the wiring Home and Savings
 * did inline. Each scenario runs the OLD chain (copied verbatim from the screens, including the store's
 * getAvailableIncomeBalance()) and the new module, and the numbers must be identical.
 * Guards WAT-001 (budget -> income -> Gullak), BUD (period budgets, carry), MNY (real money), SPL (money back).
 */
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-10-14T12:00:00'));

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
  Appearance: { getColorScheme: vi.fn(() => 'light'), addChangeListener: vi.fn() },
}));
vi.mock('lucide-react-native', () => ({ Wallet: () => null, CheckSquare: () => null, CreditCard: () => null, HelpCircle: () => null }));
const storageMap = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => storageMap.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => { storageMap.set(k, v); }),
    removeItem: vi.fn(async (k: string) => { storageMap.delete(k); }),
    clear: vi.fn(async () => { storageMap.clear(); }),
  },
}));
vi.mock('expo-crypto', () => ({ randomUUID: vi.fn(() => '30000000-0000-4000-8000-000000000001') }));
vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })) })),
      update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    })),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
}));
vi.mock('../src/store/authStore', () => ({
  useAuthStore: { getState: vi.fn(() => ({ user: { id: 'u_scope', created_at: '2026-09-20T00:00:00Z' } })) },
  registerStoreResetCallback: vi.fn(),
}));
let mockCategories: any[] = [];
vi.mock('../src/store/categoryStore', () => ({
  useCategoryStore: { getState: vi.fn(() => ({ categories: mockCategories })) },
}));
vi.mock('../src/lib/notificationService', () => ({ triggerDeviceNotification: vi.fn() }));
vi.mock('../src/store/notificationStore', () => ({
  useNotificationStore: { getState: vi.fn(() => ({ addNotification: vi.fn(), setOwnerUserId: vi.fn() })) },
}));
const ledgerCalls = vi.hoisted(() => ({ n: 0 }));
vi.mock('../src/money/ledger', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../src/money/ledger')>();
  return {
    ...orig,
    buildLedgerEntries: (...a: Parameters<typeof orig.buildLedgerEntries>) => {
      ledgerCalls.n++;
      return orig.buildLedgerEntries(...a);
    },
  };
});

import { parseISO } from 'date-fns/parseISO';
import { useDailyBudgetStore, computeAllTimeBudget, registerExpensesLoadedGetter, registerExpenseGetter } from '../src/store/dailyBudgetStore';
import { heroMoney, allowanceCardMoney, MoneySnapshot } from '../src/money/scopeMoney';
import { FILTERS, Filter, filterExpenses } from '../src/lib/expenseFilters';
import { calculatePeriodSummary, getExternalDepositsInPeriod, calculateExpenseTotals, getCarryCoveredByDate } from '../src/lib/homeCalculations';
import { getCurrentPeriodSummary } from '../src/lib/budgetPeriods';
import { computeWaterfallFromState, summarizeScope } from '../src/lib/moneyWaterfall';
import { isDateInPeriod, FilterPeriod } from '../src/lib/dateFilters';
import { moneyBackInRows, autoSavedInScope } from '../src/lib/heroDetails';
import { round2 } from '../src/lib/formatters';
import { calculateBudgetStatus } from '../src/money/budgetStatus';
import { buildLedgerEntries, spendingTotalsByDateKey } from '../src/money/ledger';
import { calculateTodayMetrics } from '../src/lib/budgetCalculations';

const USER = 'u_scope';
const TODAY = '2026-10-14'; // Wednesday
const CREATED = '2026-09-20';
const CATS = [
  { id: 'food', name: 'Food', icon: 'x', color: '#000' },
  { id: 'sal', name: 'Salary', icon: 'x', color: '#000', is_income: true, kind: 'income' },
] as any[];

const mk = (o: any) => ({ user_id: USER, payment_mode: 'upi', created_at: `${o.expense_date}T10:00:00Z`, type: 'expense', category_id: 'food', transaction_class: 'expense', ...o });
const spend = (id: string, amount: number, date: string, extra: any = {}) => mk({ id, amount, expense_date: date, ...extra });
const income = (id: string, amount: number, date: string) => mk({ id, amount, expense_date: date, type: 'income', category_id: 'sal', transaction_class: 'income' });
const rec = (date: string, budget: number, spent: number, finalized = true) => ({
  date, budget, spent, saved: finalized ? Math.max(0, budget - spent) : 0, isFinalized: finalized,
  status: finalized ? (spent > budget ? 'missed' : spent < budget ? 'saved' : 'even') : 'unknown',
});
const plan = (id: string, from: string, cadence: 'daily' | 'weekly' | 'monthly', amount: number, extra: any = {}) =>
  ({ id, userId: USER, effectiveFrom: from, isEnabled: true, cadence, amount, createdAt: `${from}T00:00:00Z`, ...extra });

const baseExpenses = [
  income('i1', 20000, '2026-10-01'),
  spend('e1', 300, '2026-10-12'),
  spend('e2', 900, '2026-10-13'),
  spend('e3', 150, '2026-10-14'),
  spend('e4', 400, '2026-10-02'),
];
const baseRecords = {
  '2026-10-12': rec('2026-10-12', 500, 300),
  '2026-10-13': rec('2026-10-13', 500, 900),
  '2026-10-14': rec('2026-10-14', 500, 150, false),
};

interface Scenario { name: string; expenses: any[]; state: Record<string, any> }
const SCENARIOS: Scenario[] = [
  { name: 'daily Budget Mode, auto-save on', expenses: baseExpenses,
    state: { isBudgetModeEnabled: true, isAutoRenew: true, budgetCadence: 'daily', dailyBudgetAmount: 500, planChanges: [plan('p1', '2026-10-01', 'daily', 500)], dailyRecords: baseRecords } },
  { name: 'daily Budget Mode, auto-save paused (§8.1)', expenses: baseExpenses,
    state: { isBudgetModeEnabled: true, isAutoRenew: false, budgetCadence: 'daily', dailyBudgetAmount: 500, planChanges: [plan('p1', '2026-10-01', 'daily', 500)], dailyRecords: baseRecords } },
  { name: 'Pure Mode after daily budget days (real money stays)', expenses: baseExpenses,
    state: { isBudgetModeEnabled: false, isAutoRenew: false, budgetCadence: 'daily', dailyBudgetAmount: 500,
      planChanges: [plan('p1', '2026-10-01', 'daily', 500), plan('p2', '2026-10-13', 'daily', 0, { isEnabled: false })], dailyRecords: baseRecords } },
  { name: 'weekly cadence', expenses: baseExpenses,
    state: { isBudgetModeEnabled: true, isAutoRenew: true, budgetCadence: 'weekly', dailyBudgetAmount: 0, weeklyBudgetAmount: 3500, planChanges: [plan('p1', '2026-10-05', 'weekly', 3500)], dailyRecords: {} } },
  { name: 'monthly cadence', expenses: baseExpenses,
    state: { isBudgetModeEnabled: true, isAutoRenew: true, budgetCadence: 'monthly', dailyBudgetAmount: 0, monthlyBudgetAmount: 12000, planChanges: [plan('p1', '2026-10-01', 'monthly', 12000)], dailyRecords: {} } },
  { name: 'daily -> weekly switch with carry', expenses: baseExpenses,
    state: { isBudgetModeEnabled: true, isAutoRenew: true, budgetCadence: 'weekly', dailyBudgetAmount: 500, weeklyBudgetAmount: 2800,
      planChanges: [plan('p1', '2026-10-01', 'daily', 500), plan('p2', '2026-10-13', 'weekly', 2800, { carryMode: 'additive', carriedOverAmount: 200 })],
      dailyRecords: { '2026-10-12': rec('2026-10-12', 500, 300) } } },
  { name: 'overspend paid from Gullak, no income', expenses: [spend('e1', 2500, '2026-10-13'), spend('e2', 800, '2026-10-14')],
    state: { isBudgetModeEnabled: true, isAutoRenew: true, budgetCadence: 'daily', dailyBudgetAmount: 500, planChanges: [plan('p1', '2026-10-01', 'daily', 500)],
      dailyRecords: { '2026-10-12': rec('2026-10-12', 500, 0), '2026-10-13': rec('2026-10-13', 500, 2500), '2026-10-14': rec('2026-10-14', 500, 800, false) },
      gullakDeposits: [{ id: 'g1', amount: 3000, date: '2026-10-05', source: 'external', created_at: '2026-10-05T09:00:00Z' }], totalAccumulatedSavings: 1000 } },
  { name: 'split, money back and self-transfer rows (SPL)', expenses: [
      ...baseExpenses,
      spend('s1', 600, '2026-10-14', { gross_amount: 1000 }),
      mk({ id: 'r1', amount: 400, expense_date: '2026-10-14', type: 'income', category_id: null, transaction_class: 'recovery' }),
      mk({ id: 't1', amount: 5000, expense_date: '2026-10-13', type: 'income', category_id: null, transaction_class: 'self_transfer' }),
      income('i2', 1500, '2026-10-14'),
    ],
    state: { isBudgetModeEnabled: true, isAutoRenew: true, budgetCadence: 'daily', dailyBudgetAmount: 500, planChanges: [plan('p1', '2026-10-01', 'daily', 500)], dailyRecords: baseRecords,
      gullakDeposits: [{ id: 'g2', amount: 700, date: '2026-10-14', source: 'income', created_at: '2026-10-14T08:00:00Z' }], totalAccumulatedSavings: 900 } },
];

const setup = (sc: Scenario): MoneySnapshot => {
  mockCategories = CATS;
  registerExpensesLoadedGetter(() => true);
  registerExpenseGetter(() => sc.expenses as any);
  useDailyBudgetStore.setState({
    ownerUserId: USER, hydratedForUserId: USER, budgetPeriods: {}, gullakDeposits: [], totalAccumulatedSavings: 0,
    weeklyBudgetAmount: 0, monthlyBudgetAmount: 0, ...sc.state,
  } as any);
  const st = useDailyBudgetStore.getState();
  return {
    expenses: sc.expenses as any, gullakDeposits: st.gullakDeposits, dailyRecords: st.dailyRecords,
    planChanges: st.planChanges, budgetPeriods: st.budgetPeriods, dailyBudgetAmount: st.dailyBudgetAmount,
    isAutoRenew: st.isAutoRenew, isBudgetModeEnabled: st.isBudgetModeEnabled, budgetCadence: st.budgetCadence,
    totalAccumulatedSavings: st.totalAccumulatedSavings,
  };
};

// ─── OLD Home chain (HomeScreen.tsx before ADR 0022, verbatim order) ──────────
function oldHome(s: MoneySnapshot, activeFilter: Filter, todayKey: string, todayRecord: any, userCreatedAtStr: string | undefined, getAvailableIncomeBalance: () => number) {
  const { expenses, gullakDeposits, isBudgetModeEnabled, isAutoRenew, dailyBudgetAmount, dailyRecords, planChanges, budgetCadence, budgetPeriods, totalAccumulatedSavings } = s;
  const referenceDate = parseISO(todayKey);
  const filtered = filterExpenses(expenses, activeFilter, referenceDate);
  const { totalIncome, totalSpent } = calculateExpenseTotals(filtered);
  const isBudgetConfigured = isBudgetModeEnabled && isAutoRenew && dailyBudgetAmount > 0;
  const todayBudget = isBudgetConfigured ? todayRecord.budget : 0;
  const spentByDate = spendingTotalsByDateKey(buildLedgerEntries(expenses));
  const todayLiveSpent = spentByDate[todayKey] || 0;
  const todayRecordSpent = activeFilter === 'Daily' ? totalSpent : todayLiveSpent;
  const todayBudgetStatus = calculateBudgetStatus(todayBudget, todayRecordSpent);
  const todayRemaining = todayBudgetStatus.budgetLeftUnspent;
  const isOverBudget = todayBudgetStatus.isOverBudget;
  const externalDepositsInPeriod = getExternalDepositsInPeriod(gullakDeposits, activeFilter, referenceDate);
  const cadencePeriodSummary = !isBudgetModeEnabled || budgetCadence === 'daily' ? null : getCurrentPeriodSummary(planChanges, spentByDate, todayKey);
  const availableIncomeBalance = typeof getAvailableIncomeBalance === 'function' ? getAvailableIncomeBalance() : 0;
  const carryCoveredByDate = getCarryCoveredByDate(planChanges, dailyRecords, dailyBudgetAmount, todayKey);
  const fullWaterfall = computeWaterfallFromState({
    expenses, deposits: gullakDeposits, isBudgetModeEnabled, isAutoRenew, todayStr: todayKey,
    todayBudget: dailyRecords[todayKey]?.budget, dailyBudgetAmount, records: dailyRecords, planChanges, budgetPeriods: useDailyBudgetStore.getState().budgetPeriods,
  });
  const period0: FilterPeriod | null = activeFilter === 'Daily' ? 'day' : activeFilter === 'Weekly' ? 'week' : activeFilter === 'Monthly' ? 'month' : null;
  const scopeFunding = summarizeScope(fullWaterfall, (d) => (period0 ? isDateInPeriod(d, period0, referenceDate) : true), activeFilter === 'All');
  const summary = calculatePeriodSummary({
    recordsAreComplete: true,
    // BAL-001: the All view uses the account's own all-time budget (the spending guard's number).
    allTimeBudgetTotal:
      activeFilter === 'All'
        ? computeAllTimeBudget(
            dailyRecords[todayKey] ? dailyRecords : { ...dailyRecords, [todayKey]: useDailyBudgetStore.getState().getTodayRecord() },
            planChanges,
            spentByDate,
            useDailyBudgetStore.getState().budgetPeriods,
            expenses
          )
        : undefined,
    activeFilter, dailyBudgetAmount, isAutoRenew: isBudgetModeEnabled && isAutoRenew, todayBudget, dailyRecords, totalIncome, totalSpent,
    filtered, userCreatedAtStr, referenceDate, externalDepositsInPeriod: activeFilter === 'All' ? externalDepositsInPeriod : 0, planChanges, todaySpent: todayRecordSpent, spentByDate,
    availableIncomeBalance, funding: { incomeRemaining: scopeFunding.incomeRemaining, gullakDrawn: scopeFunding.gullakDrawn }, carryCoveredByDate,
  });
  // heroDetails numbers
  const period: FilterPeriod | null = activeFilter === 'Daily' ? 'day' : activeFilter === 'Weekly' ? 'week' : activeFilter === 'Monthly' ? 'month' : null;
  const inScope = (d: string) => (period ? isDateInPeriod(d, period, referenceDate) : true);
  const activeBudgetLeft = activeFilter === 'Daily' || activeFilter === 'All' || (isBudgetModeEnabled && budgetCadence === 'daily') ? todayRemaining : undefined;
  const totalRemainingBalance = summary.isOverBudgetPeriod ? 0 : summary.primaryAmount;
  const unspentInflowLeft = activeFilter === 'All'
    ? Math.min(summary.periodIncome, Math.max(0, round2(totalRemainingBalance - (todayRemaining || 0) - (totalAccumulatedSavings || 0))))
    : undefined;
  return {
    ...summary, todayBudget, todayRecordSpent, todayRemaining, isOverBudget, cadencePeriodSummary,
    details: {
      moneyBack: moneyBackInRows(filtered),
      gullakAdded: round2(externalDepositsInPeriod + autoSavedInScope(dailyRecords, budgetPeriods, inScope)),
      activeBudgetLeft, unspentInflowLeft,
    },
  };
}

// ─── OLD Savings card chain (SavingsScreen.tsx before ADR 0022) ───────────────
function oldSavings(s: MoneySnapshot, todayKey: string, todayMetrics: any) {
  const { expenses, gullakDeposits, isBudgetModeEnabled, isAutoRenew, dailyBudgetAmount, planChanges, budgetCadence } = s;
  const { budget: todayBudget, spent: todaySpent, remaining: todayRemaining, isOverBudget, overAmount } = todayMetrics;
  const spentByDate = spendingTotalsByDateKey(buildLedgerEntries(expenses));
  const cadencePeriodSummary = !isBudgetModeEnabled || budgetCadence === 'daily' ? null : getCurrentPeriodSummary(planChanges, spentByDate, todayKey);
  const isCadenceMode = isBudgetModeEnabled && budgetCadence !== 'daily';
  const cardBudget = isCadenceMode && cadencePeriodSummary ? cadencePeriodSummary.budget : todayBudget;
  const cardSpent = isCadenceMode && cadencePeriodSummary ? cadencePeriodSummary.spent : todaySpent;
  const cardRemaining = isCadenceMode && cadencePeriodSummary ? cadencePeriodSummary.remaining : todayRemaining;
  const cardIsOver = isCadenceMode && cadencePeriodSummary ? cadencePeriodSummary.isOver : isOverBudget;
  const cardOverAmount = isCadenceMode && cadencePeriodSummary ? cadencePeriodSummary.overBy : overAmount;
  const cardProgressRatio = cardBudget > 0 ? cardSpent / cardBudget : 0;
  const allDailyRecords = s.dailyRecords;
  const waterfall = computeWaterfallFromState({
    expenses, deposits: gullakDeposits, isBudgetModeEnabled, isAutoRenew, todayStr: todayKey,
    todayBudget: allDailyRecords[todayKey]?.budget, dailyBudgetAmount, records: allDailyRecords, planChanges, budgetPeriods: s.budgetPeriods,
  });
  const start = isCadenceMode && cadencePeriodSummary ? cadencePeriodSummary.periodStart : todayKey;
  const end = isCadenceMode && cadencePeriodSummary ? cadencePeriodSummary.periodEnd : todayKey;
  const cardScopeFunding = summarizeScope(waterfall, (d) => d >= start && d <= end);
  return {
    isCadenceMode, cadencePeriodSummary, budget: cardBudget, spent: cardSpent, remaining: cardRemaining,
    isOver: cardIsOver, overAmount: cardOverAmount, progressRatio: cardProgressRatio, funding: cardScopeFunding,
  };
}

describe('Money Scope module = the old screen wiring (ADR 0022, WAT-001 / BUD / MNY / SPL)', () => {
  for (const sc of SCENARIOS) {
    describe(sc.name, () => {
      for (const filter of FILTERS) {
        it(`heroMoney matches Home's old chain on the ${filter} pill`, () => {
          const s = setup(sc);
          const st = useDailyBudgetStore.getState();
          const todayRecord = st.getTodayRecord();
          const expected = oldHome(s, filter, TODAY, todayRecord, CREATED, st.getAvailableIncomeBalance);
          const actual = heroMoney(s, { filter, today: TODAY, todayRecord, userCreatedAt: CREATED });
          expect(actual).toEqual(expected);
        });
      }

      it("allowanceCardMoney matches Savings' old card chain", () => {
        const s = setup(sc);
        const todayMetrics = calculateTodayMetrics(useDailyBudgetStore.getState().getTodayRecord());
        expect(allowanceCardMoney(s, { today: TODAY, todayMetrics })).toEqual(oldSavings(s, TODAY, todayMetrics));
      });
    });
  }

  it('BAL-001: the Home "All" number is the account total, in every scenario', () => {
    const check = (name: string, s: ReturnType<typeof setup>) => {
      const st = useDailyBudgetStore.getState();
      const hero = heroMoney(s, { filter: 'All', today: TODAY, todayRecord: st.getTodayRecord() });
      expect(hero.isOverBudgetPeriod ? -hero.primaryAmount : hero.primaryAmount, name).toBe(st.getTotalAccountRemaining());
    };
    for (const sc of SCENARIOS) check(sc.name, setup(sc));
    // An old account with no plan history at all.
    const legacy = setup(SCENARIOS[0]);
    useDailyBudgetStore.setState({ planChanges: [] });
    check('no plan history', { ...legacy, planChanges: useDailyBudgetStore.getState().planChanges });
  });

  it('the old getAvailableIncomeBalance() equals the snapshot waterfall it now reads (no hidden global)', () => {
    for (const sc of SCENARIOS) {
      const s = setup(sc);
      const fromStore = useDailyBudgetStore.getState().getAvailableIncomeBalance();
      const fresh = computeWaterfallFromState({
        expenses: s.expenses, deposits: s.gullakDeposits, isBudgetModeEnabled: s.isBudgetModeEnabled,
        isAutoRenew: s.isAutoRenew, todayStr: TODAY, todayBudget: s.dailyRecords[TODAY]?.budget, dailyBudgetAmount: s.dailyBudgetAmount,
        records: s.dailyRecords, planChanges: s.planChanges, budgetPeriods: s.budgetPeriods,
      }).incomeRemaining;
      expect(fresh, sc.name).toBe(fromStore);
    }
  });

  it('a Home pill switch does not re-read the ledger (same snapshot objects)', () => {
    const s = setup(SCENARIOS[0]);
    const todayRecord = useDailyBudgetStore.getState().getTodayRecord();
    heroMoney(s, { filter: 'Daily', today: TODAY, todayRecord });
    const before = ledgerCalls.n;
    for (const filter of FILTERS) heroMoney(s, { filter, today: TODAY, todayRecord });
    allowanceCardMoney(s, { today: TODAY, todayMetrics: calculateTodayMetrics(todayRecord) });
    expect(ledgerCalls.n).toBe(before);
    // A new expense list is a new snapshot: the ledger is read again.
    heroMoney({ ...s, expenses: [...s.expenses] }, { filter: 'Daily', today: TODAY, todayRecord });
    expect(ledgerCalls.n).toBe(before + 1);
  });
});
