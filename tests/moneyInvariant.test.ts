/**
 * Spec 2026-11-28 rule 6, the one equation that must always hold:
 *   all budget + income + new-money deposits - spending = income left + Gullak + running budget left - deficit
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/store/authStore', () => ({ useAuthStore: { getState: () => ({ user: null }) } }));
vi.mock('../src/config/supabase', () => ({ supabase: {} }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
import { computeWaterfallFromState } from '../src/lib/moneyWaterfall';
import { allTimeBudget, poolKeyFor, getDateOwner, settleCarryAmounts, dailyCarryRemaining, periodCarryRemaining } from '../src/lib/budgetPeriods';
import { computeSpentByDate } from '../src/lib/budgetCalculations';
import { addDaysToDateKey } from '../src/money/dateKeys';
import { leftoverBeforeSwitch } from '../src/store/dailyBudget/metrics';

const plan = (effectiveFrom: string, cadence: any, amount: number, extra: any = {}) =>
  ({ id: effectiveFrom, userId: 'u', effectiveFrom, isEnabled: true, cadence, amount, createdAt: '', ...extra });
/** A "Carry forward" switch. The amount is settled from the real leftover, as the app does at midnight. */
const carry = (d: string, cadence: any, amount: number) => plan(d, cadence, amount, { carryMode: 'allocation', carriedOverAmount: 1 });
const off = (d: string, cadence: any = 'weekly') => plan(d, cadence, 1000, { isEnabled: false });

const settle = (plans: any[], day: string, expenses: any[], records: any) =>
  settleCarryAmounts(plans, day, (before, switching) =>
    leftoverBeforeSwitch(
      { planChanges: plans, dailyRecords: records, dailyBudgetAmount: 500, allowancePauses: [] },
      before,
      switching,
      expenses
    )
  );

/** Same random money on every run (small linear generator, fixed seeds). */
const rng = (seed: number) => () => (seed = (seed * 48271) % 2147483647) / 2147483647;

const SCENARIOS: Record<string, any[]> = {
  weekly: [plan('2026-11-02', 'weekly', 3500)],
  monthly: [plan('2026-11-02', 'monthly', 15000)],
  'daily': [plan('2026-11-02', 'daily', 500)],
  'pure and back in the same week': [plan('2026-11-02', 'weekly', 3500), off('2026-11-11'), plan('2026-11-13', 'weekly', 3500), off('2026-11-24'), plan('2026-12-09', 'weekly', 3500)],
  'cadence switches, saved to Gullak': [plan('2026-11-02', 'weekly', 3500), plan('2026-11-11', 'monthly', 15000), plan('2026-11-20', 'daily', 500), plan('2026-12-03', 'weekly', 3500)],
  'pure only, then daily': [off('2026-11-01', 'daily'), plan('2026-11-20', 'daily', 500)],
  'carry weekly -> daily': [plan('2026-11-02', 'weekly', 3500), carry('2026-11-11', 'daily', 500)],
  'carry monthly -> weekly': [plan('2026-11-02', 'monthly', 15000), carry('2026-11-11', 'weekly', 3500)],
  'carry weekly -> monthly -> daily': [plan('2026-11-02', 'weekly', 3500), carry('2026-11-05', 'monthly', 15000), carry('2026-12-09', 'daily', 500)],
  'carry dropped by Pure Mode': [plan('2026-11-02', 'monthly', 15000), carry('2026-11-11', 'daily', 500), off('2026-11-14', 'daily')],
  'carry dropped by a "Save to Gullak" switch': [plan('2026-11-02', 'monthly', 15000), carry('2026-11-11', 'daily', 500), plan('2026-11-14', 'weekly', 3500)],
  'carry daily -> weekly (unused carry moves on)': [plan('2026-11-02', 'monthly', 15000), carry('2026-11-11', 'daily', 500), carry('2026-11-14', 'weekly', 3500)],
};

describe('rule 6: total = income left + Gullak + running budget left - deficit', () => {
  for (const [name, chosen] of Object.entries(SCENARIOS)) {
    for (const seed of [7, 99, 2024]) {
      it(`${name} (seed ${seed})`, () => {
        const next = rng(seed);
        let plans = chosen;
        const expenses: any[] = [];
        const deposits: any[] = [];
        const records: Record<string, any> = {};
        for (let day = '2026-11-02', i = 0; day <= '2026-12-14'; day = addDaysToDateKey(day, 1), i++) {
          // Midnight: every carry starting today gets the leftover the old budget really had (rule 22).
          plans = settle(plans, day, expenses, records);
          if (next() < 0.5) expenses.push({ id: `e${i}`, amount: Math.ceil(next() * 1800), type: 'expense', expense_date: day, created_at: day });
          if (next() < 0.08) expenses.push({ id: `i${i}`, amount: Math.ceil(next() * 3000), type: 'income', expense_date: day, created_at: day });
          if (next() < 0.05) deposits.push({ amount: Math.ceil(next() * 400), date: day, source: next() < 0.5 ? 'income' : 'external' });
          const today = '2026-12-14';
          const running = getDateOwner(plans, day) === 'daily';
          const spent = computeSpentByDate(expenses)[day] || 0;
          records[day] = running
            ? { date: day, budget: 500, spent, saved: Math.max(0, 500 - spent), isFinalized: day < today, status: day < today ? 'saved' : 'active' }
            : { date: day, budget: 0, spent, saved: 0, isFinalized: day < today, status: 'unknown' };
        }
        const today = '2026-12-14';
        const w = computeWaterfallFromState({
          expenses, deposits, planChanges: plans, records, budgetPeriods: {}, isBudgetModeEnabled: true,
          isAutoRenew: true, todayStr: today, dailyBudgetAmount: 500,
        });
        const spentByDate = computeSpentByDate(expenses);
        const sum = (list: any[]) => list.reduce((s, x) => s + x.amount, 0);
        const total =
          allTimeBudget(records, plans, spentByDate, today, undefined, undefined, w.pools) +
          sum(expenses.filter((e) => e.type === 'income')) +
          sum(deposits.filter((d) => d.source === 'external')) -
          sum(expenses.filter((e) => e.type === 'expense'));
        const owner = getDateOwner(plans, today);
        let runningLeft = 0;
        if (owner === 'daily') runningLeft = Math.max(0, 500 - (spentByDate[today] || 0));
        if (owner === 'weekly' || owner === 'monthly') {
          const pool = w.pools[poolKeyFor(owner, today)];
          runningLeft = pool && !pool.closed ? Math.max(0, pool.budget - pool.spent) : 0;
        }
        // Carried money that has not become a budget yet is the user's too.
        const waiting =
          dailyCarryRemaining(plans, (d) => records[d]?.budget, 0, today) + periodCarryRemaining(plans, today);
        expect(Math.round((w.incomeRemaining + w.gullakBalance + runningLeft + waiting - w.deficit) * 100) / 100).toBe(Math.round(total * 100) / 100);
        expect(w.gullakBalance).toBeGreaterThanOrEqual(0);
      });
    }
  }
});

describe('rule 2: carried money is never lost when its budget ends', () => {
  // 3,500 weekly, nothing spent, carried into a 500 daily budget. Two days use 1,000 of it, then Pure Mode.
  const plans = [
    plan('2026-11-02', 'weekly', 3500),
    plan('2026-11-04', 'daily', 500, { carryMode: 'allocation', carriedOverAmount: 3500 }),
    off('2026-11-06', 'daily'),
  ];
  const day = (date: string) => ({ date, budget: 500, spent: 0, saved: 500, isFinalized: true, status: 'saved' as const });
  const records = { '2026-11-04': day('2026-11-04'), '2026-11-05': day('2026-11-05') };

  it('all 3,500 is still there: 1,000 saved by the two days and the unused 2,500 in Gullak', () => {
    const w = computeWaterfallFromState({
      expenses: [], planChanges: plans, records, budgetPeriods: {}, isBudgetModeEnabled: false, isAutoRenew: false,
      todayStr: '2026-11-08', dailyBudgetAmount: 500,
    });
    expect(w.gullakBalance).toBe(3500);
    expect(allTimeBudget(records, plans, {}, '2026-11-08')).toBe(3500);
  });
});
