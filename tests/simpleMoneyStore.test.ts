/**
 * Store flows of docs/specs/2026-11-28-simple-money-rules.md (rule numbers in the test names).
 * Real budget store; fake storage, server, notifications and expense list.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.useFakeTimers({ toFake: ['Date'] });

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
}));
const chain: any = new Proxy(function () {}, {
  get: (_t, p) => (p === 'then' ? (res: any) => res({ data: null, error: null }) : () => chain),
});
vi.mock('../src/config/supabase', () => ({ supabase: { from: () => chain } }));
vi.mock('../src/store/authStore', () => ({
  useAuthStore: { getState: () => ({ user: { id: 'u', created_at: '2026-01-01T00:00:00Z' } }) },
  registerStoreResetCallback: () => {},
}));
vi.mock('../src/store/networkStore', () => ({ useNetworkStore: { getState: () => ({ isOffline: false }) } }));
vi.mock('../src/store/notificationStore', () => ({
  useNotificationStore: { getState: () => ({ addNotification: vi.fn(), removeNotification: vi.fn(), setOwnerUserId: vi.fn() }) },
}));
vi.mock('../src/lib/notificationService', () => ({ triggerDeviceNotification: vi.fn() }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'id' }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' }, AppState: { addEventListener: () => ({ remove() {} }) } }));

import { useDailyBudgetStore, registerExpenseGetter, registerExpensesLoadedGetter } from '../src/store/dailyBudgetStore';
import { registerExpensesFreshGetter } from '../src/store/dailyBudget/expenseBridge';
import { markOpenDayKnown } from '../src/store/dailyBudget/lastOpenSync';
import { heroMoney } from '../src/money/scopeMoney';
import { absenceBudgets, needsAbsenceChoice, fewDaysLeftNotice } from '../src/lib/absence';

const st = () => useDailyBudgetStore.getState();
const at = (date: string) => vi.setSystemTime(new Date(`${date}T12:00:00`));
const plan = (effectiveFrom: string, cadence: any, amount: number, extra: any = {}) =>
  ({ id: effectiveFrom, userId: 'u', effectiveFrom, isEnabled: true, cadence, amount, createdAt: effectiveFrom, ...extra });
const exp = (id: string, amount: number, date: string) =>
  ({ id, amount, type: 'expense', expense_date: date, created_at: date, user_id: 'u', payment_mode: 'upi' }) as any;

let expenses: any[] = [];
const start = (state: Record<string, any>) => {
  expenses = [];
  registerExpenseGetter(() => expenses);
  registerExpensesLoadedGetter(() => true);
  registerExpensesFreshGetter(() => true);
  st().resetDailyBudget();
  markOpenDayKnown('u'); // this app run has hydrated
  useDailyBudgetStore.setState({
    ownerUserId: 'u', hydratedForUserId: 'u', isBudgetModeEnabled: true, isAutoRenew: true, budgetCadence: 'daily',
    dailyBudgetAmount: 100, planChanges: [plan('2026-11-01', 'daily', 100)], ...state,
  });
};
const open = (date: string) => { at(date); st().syncWithExpenses(expenses); };

describe('rules 27-30: days the app was not opened (daily 100)', () => {
  beforeEach(() => start({}));

  it('rule 28: away under 7 days, every day is saved and the popup only informs', () => {
    open('2026-11-02');
    open('2026-11-06'); // 3rd, 4th, 5th closed
    expect(st().absences[0]).toMatchObject({ status: 'saved', amount: 300, from: '2026-11-03', to: '2026-11-05' });
    expect(st().totalAccumulatedSavings).toBe(400); // 2nd + three closed days
  });

  it('rule 29: 7+ days with no expense waits for the choice; Save counts them', () => {
    open('2026-11-02');
    open('2026-11-22'); // 3rd..21st = 19 days
    expect(st().absences[0]).toMatchObject({ status: 'choice', amount: 1900 });
    expect(st().totalAccumulatedSavings).toBe(100);
    st().chooseAbsence('save');
    expect(st().totalAccumulatedSavings).toBe(2000);
    expect(st().absences).toEqual([]);
  });

  it("rule 29: Don't count keeps them out for good", () => {
    open('2026-11-02');
    open('2026-11-22');
    st().chooseAbsence('skip');
    open('2026-11-23');
    expect(st().totalAccumulatedSavings).toBe(100 + 100); // the 2nd and the 22nd
    expect(st().getTotalAccountRemaining()).toBe(100 + 100 + 100); // plus today
  });

  it('rule 29: "I spent money" counts the days only once an expense in them is saved', () => {
    open('2026-11-02');
    open('2026-11-22');
    open('2026-11-22');
    expect(st().absences[0].status).toBe('choice');
    expenses = [exp('a', 40, '2026-11-10')];
    st().syncWithExpenses(expenses);
    expect(st().absences).toEqual([]);
    expect(st().totalAccumulatedSavings).toBe(100 + 1900 - 40);
  });

  it('rule 30: one expense in the stretch means no choice', () => {
    open('2026-11-02');
    expenses = [exp('a', 40, '2026-11-10')];
    open('2026-11-22');
    expect(st().absences[0].status).toBe('saved');
    expect(st().totalAccumulatedSavings).toBe(100 + 1900 - 40);
  });
});

describe('rule 29: every long break is its own question', () => {
  beforeEach(() => start({}));
  const twoBreaks = () => {
    open('2026-11-02');
    open('2026-11-12'); // away 3rd..11th (9 days), not answered
    open('2026-11-22'); // away 13th..21st (9 days)
  };

  it('a second long break while the first is unanswered asks again, and counts nothing by itself', () => {
    twoBreaks();
    expect(st().absences.map((a) => [a.from, a.to, a.status, a.amount])).toEqual([
      ['2026-11-03', '2026-11-11', 'choice', 900],
      ['2026-11-13', '2026-11-21', 'choice', 900],
    ]);
    expect(st().totalAccumulatedSavings).toBe(200); // only the opened days: 2nd and 12th
  });

  it('each answer applies to its own break only', () => {
    twoBreaks();
    st().chooseAbsence('skip'); // the first
    st().chooseAbsence('save'); // the second
    expect(st().absences).toEqual([]);
    expect(st().totalAccumulatedSavings).toBe(200 + 900);
  });

  it('a short second break is saved on its own while the first stays asked', () => {
    open('2026-11-02');
    open('2026-11-12');
    open('2026-11-15'); // away 13th, 14th
    expect(st().absences.map((a) => a.status)).toEqual(['choice', 'saved']);
    expect(st().totalAccumulatedSavings).toBe(200 + 200);
  });

  it('an unanswered question comes back after a reinstall (saved with the account)', () => {
    open('2026-11-02');
    open('2026-11-12');
    const pauses = st().allowancePauses;
    start({ allowancePauses: pauses, lastOpenDay: '2026-11-12' });
    open('2026-11-12');
    expect(st().absences).toMatchObject([{ from: '2026-11-03', to: '2026-11-11', status: 'choice' }]);
  });
});

describe('rule 32b: a second phone with an old last opened day', () => {
  it('does not invent a gap before hydration has brought the newer day', () => {
    start({ lastOpenDay: '2026-11-12' });
    markOpenDayKnown(null); // cold start: nothing hydrated yet
    open('2026-11-22');
    expect(st().absences).toEqual([]);
    expect(st().lastOpenDay).toBe('2026-11-12');
    expect(st().allowancePauses).toEqual([]);
    // Hydration brings the account's day (the other phone was opened yesterday) and says it is known.
    useDailyBudgetStore.setState({ lastOpenDay: '2026-11-21' });
    markOpenDayKnown('u');
    open('2026-11-22');
    expect(st().absences).toEqual([]);
    expect(st().lastOpenDay).toBe('2026-11-22');
  });
});

describe('rule 31: weekly choice covers only fully empty weeks', () => {
  it('two empty weeks are the choice; the week the app was opened in and the running week count', () => {
    const budgets = absenceBudgets([plan('2026-11-02', 'weekly', 1000)], '2026-11-04', '2026-11-24', 0, () => false);
    expect(budgets.periods.map((p) => p.start)).toEqual(['2026-11-09', '2026-11-16']);
    expect(budgets.total).toBe(2000);
    expect(needsAbsenceChoice('2026-11-04', '2026-11-24', new Set(), budgets)).toBe(true);
    expect(needsAbsenceChoice('2026-11-04', '2026-11-24', new Set(['2026-11-12']), budgets)).toBe(false);
  });
});

describe('rule 22: the carried amount is the real leftover at the switch midnight', () => {
  it('spending after choosing "Carry forward" lowers what is carried', () => {
    start({
      budgetCadence: 'weekly', weeklyBudgetAmount: 1000,
      planChanges: [
        plan('2026-11-30', 'weekly', 1000),
        // Chosen on 1 Dec when 900 was left; 200 more was spent later that day.
        plan('2026-12-02', 'daily', 100, { carryMode: 'allocation', carriedOverAmount: 900 }),
      ],
    });
    expenses = [exp('a', 100, '2026-12-01'), exp('b', 200, '2026-12-01')];
    open('2026-12-02');
    expect(st().planChanges[1].carriedOverAmount).toBe(700);
  });
});

describe('rules 12-13: what a change would do', () => {
  it('deleting spent income needs income first; deleting income that fed Gullak lowers Gullak', () => {
    start({
      planChanges: [plan('2026-11-27', 'daily', 100)],
      gullakDeposits: [{ id: 'd', amount: 700, date: '2026-11-27', source: 'income', created_at: '' }],
    });
    const income = { ...exp('i', 1000, '2026-11-27'), type: 'income' };
    expenses = [income];
    open('2026-11-27');
    // Owner's example: 1000 income, 700 moved to Gullak. Removing 300 changes nothing, removing 400 takes 100.
    expect(st().previewMoneyImpact({ expenses: [{ ...income, amount: 700 }] })).toEqual({ gullakDrop: 0, shortfall: 0 });
    expect(st().previewMoneyImpact({ expenses: [{ ...income, amount: 600 }] })).toEqual({ gullakDrop: 100, shortfall: 0 });
    // Everything spent: now removing the income leaves spending uncovered.
    expenses = [income, exp('e', 1100, '2026-11-27')];
    expect(st().previewMoneyImpact({ expenses: [expenses[1]] }).shortfall).toBe(1000);
  });
});

describe('rule 12: a back-dated expense that nothing covered on its day', () => {
  it('is reported as a shortfall even though the total balance looks enough', () => {
    start({ planChanges: [plan('2026-11-01', 'daily', 100)] });
    open('2026-11-10');
    open('2026-11-11'); // the 10th saved 100 into Gullak
    open('2026-11-12'); // the 11th saved 100 more: Gullak 200
    // 150 over the 10th's budget. On the 10th Gullak was still empty, so nothing covers it.
    const backdated = exp('b', 250, '2026-11-10');
    expect(st().getTotalAccountRemaining()).toBeGreaterThan(250);
    expect(st().previewMoneyImpact({ expenses: [backdated] }).shortfall).toBe(150);
  });
});

describe('rule 22 + OPT-63: a carry is only settled from a server-fresh expense list', () => {
  it('a saved (cached) list never rewrites the carried amount', () => {
    start({
      budgetCadence: 'weekly', weeklyBudgetAmount: 1000,
      planChanges: [plan('2026-11-30', 'weekly', 1000), plan('2026-12-02', 'daily', 100, { carryMode: 'allocation', carriedOverAmount: 900 })],
    });
    registerExpensesFreshGetter(() => false);
    expenses = [exp('a', 300, '2026-12-01')];
    open('2026-12-02');
    expect(st().planChanges[1].carriedOverAmount).toBe(900);
    registerExpensesFreshGetter(() => true);
    open('2026-12-02');
    expect(st().planChanges[1].carriedOverAmount).toBe(700);
  });
});

/** The Home "All" big number and the account total the spending guard uses (BAL-001: always the same). */
const homeAll = (today: string) =>
  heroMoney(
    { ...st(), expenses } as any,
    { filter: 'All', today, todayRecord: st().getTodayRecord(), userCreatedAt: '2026-11-01' }
  ).primaryAmount;

describe('rule 6: Pure Mode Gullak spending, same-month return, then Carry forward', () => {
  it('the total keeps what Gullak paid in Pure Mode', () => {
    // 3,000 monthly. Pure from the 5th (3,000 goes to Gullak), 600 spent there, back on the 10th (2,400 returns),
    // then carried into a daily plan on the 12th.
    start({
      budgetCadence: 'daily', dailyBudgetAmount: 100,
      planChanges: [
        plan('2026-12-01', 'monthly', 3000),
        plan('2026-12-05', 'monthly', 3000, { isEnabled: false }),
        plan('2026-12-10', 'monthly', 3000),
        plan('2026-12-12', 'daily', 100, { carryMode: 'allocation', carriedOverAmount: 1 }),
      ],
    });
    expenses = [exp('p', 600, '2026-12-06')];
    open('2026-12-12');
    expect(st().planChanges[3].carriedOverAmount).toBe(2400);
    // Real money: 3,000 given, 600 spent.
    expect(st().getTotalAccountRemaining()).toBe(2400);
    expect(homeAll('2026-12-12')).toBe(2400);
  });
});

describe('rule 29: Home "All" and the account total agree about weeks the user chose not to count', () => {
  it("a week under \"Don't count\" is in neither", () => {
    start({ budgetCadence: 'weekly', weeklyBudgetAmount: 1000, planChanges: [plan('2026-11-02', 'weekly', 1000)] });
    open('2026-11-03');
    open('2026-11-24'); // away 4th..23rd: weeks of the 9th and 16th are fully empty
    expect(st().absences[0].status).toBe('choice');
    st().chooseAbsence('skip');
    expect(st().getTotalAccountRemaining()).toBe(2000); // week of the 2nd + running week
    expect(homeAll('2026-11-24')).toBe(2000);
  });
});

describe("rule 12: carried money still waiting is the user's money", () => {
  it("today's overspend is not short while carry is waiting", () => {
    // 3,500 weekly, nothing spent, carried into a 500 daily budget: 3,000 is still waiting today.
    start({
      budgetCadence: 'daily', dailyBudgetAmount: 500,
      planChanges: [plan('2026-11-30', 'weekly', 3500), plan('2026-12-02', 'daily', 500, { carryMode: 'allocation', carriedOverAmount: 3500 })],
    });
    open('2026-12-02');
    const today = exp('t', 900, '2026-12-02');
    expect(st().getTotalAccountRemaining()).toBeGreaterThanOrEqual(900);
    expect(st().previewMoneyImpact({ expenses: [today] }).shortfall).toBe(0);
  });
});

describe('rule 25: few days left', () => {
  it('weekly 2 or fewer, monthly 5 or fewer, counting the start day', () => {
    expect(fewDaysLeftNotice('weekly', '2026-11-28')).toContain('Only 2 days are left in this week');
    expect(fewDaysLeftNotice('weekly', '2026-11-27')).toBeNull();
    expect(fewDaysLeftNotice('monthly', '2026-11-26')).toContain('Only 5 days');
    expect(fewDaysLeftNotice('monthly', '2026-11-25')).toBeNull();
    expect(fewDaysLeftNotice('daily', '2026-11-30')).toBeNull();
  });
});
