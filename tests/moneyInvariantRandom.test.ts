/**
 * Random histories of mode switches, cadence switches, carry forward and skipped weeks, replayed day by day with the
 * real store engine. It found a real bug (Pure Mode -> same-month return -> Carry forward lost money from the total)
 * that the hand-written scenarios all passed.
 *  - rule 6: income left + Gullak + running budget + waiting carry - deficit = account total
 *  - history rows' "saved" add up to what the engine really put into Gullak from pools
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/store/authStore', () => ({ useAuthStore: { getState: () => ({ user: null }) } }));
vi.mock('../src/config/supabase', () => ({ supabase: {} }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));

import { computeWaterfallFromState } from '../src/lib/moneyWaterfall';
import {
  allTimeBudget, poolKeyFor, getDateOwner, settleCarryAmounts, dailyCarryRemaining, periodCarryRemaining,
  buildPeriodsToFinalize,
} from '../src/lib/budgetPeriods';
import { computeSpentByDate } from '../src/lib/budgetCalculations';
import { leftoverBeforeSwitch, registerMetricsStoreGetter } from '../src/store/dailyBudget/metrics';
import { addDaysToDateKey } from '../src/money/dateKeys';

const SEEDS = 300;
const TODAY = '2026-12-21';
const round = (n: number) => Math.round(n * 100) / 100;

function run(seed: number) {
  let a = seed * 7919;
  const rnd = () => (a = (a * 48271) % 2147483647) / 2147483647;
  for (let k = 0; k < 5; k++) rnd();

  const plans: any[] = [];
  let from = '2026-11-02';
  let lastCadence = '';
  while (from < '2026-12-20') {
    const cadence = ['daily', 'weekly', 'monthly'][Math.floor(rnd() * 3)];
    const on = rnd() > 0.25;
    const carry = on && plans.length > 0 && rnd() < 0.35;
    plans.push({
      id: `p${plans.length}`, userId: 'u', effectiveFrom: from, isEnabled: on,
      cadence: on ? cadence : lastCadence || cadence,
      amount: cadence === 'daily' ? 500 : cadence === 'weekly' ? 3500 : 15000,
      createdAt: '', ...(carry ? { carryMode: 'allocation', carriedOverAmount: 1 } : {}),
    });
    if (on) lastCadence = cadence;
    from = addDaysToDateKey(from, 1 + Math.floor(rnd() * 9));
  }
  const skipped = rnd() < 0.3 ? [{ from: '2026-11-09', to: '2026-11-22' }] : [];
  const isSkipped = (d: string) => skipped.some((s) => s.from <= d && d <= s.to);

  const expenses: any[] = [];
  const deposits: any[] = [];
  const records: Record<string, any> = {};
  let current = plans;
  registerMetricsStoreGetter(() => ({
    planChanges: current, dailyRecords: records, dailyBudgetAmount: 500, gullakDeposits: deposits, budgetPeriods: {},
    allowancePauses: skipped, isBudgetModeEnabled: true, isAutoRenew: true,
  }) as any);

  for (let day = '2026-11-02', n = 0; day <= TODAY; day = addDaysToDateKey(day, 1), n++) {
    vi.setSystemTime(new Date(`${day}T12:00:00`));
    // Midnight: every carry starting today gets the leftover the old budget really had (rule 22).
    current = settleCarryAmounts(current, day, (before, switching) =>
      leftoverBeforeSwitch(
        { planChanges: current, dailyRecords: records, dailyBudgetAmount: 500, allowancePauses: skipped },
        before, switching, expenses
      )
    );
    if (rnd() < 0.5 && !isSkipped(day)) expenses.push({ id: `e${n}`, amount: Math.ceil(rnd() * 2500), type: 'expense', expense_date: day, created_at: day });
    if (rnd() < 0.08 && !isSkipped(day)) expenses.push({ id: `i${n}`, amount: Math.ceil(rnd() * 3000), type: 'income', expense_date: day, created_at: day });
    if (rnd() < 0.05) deposits.push({ amount: Math.ceil(rnd() * 400), date: day, source: rnd() < 0.5 ? 'income' : 'external' });
    const spent = computeSpentByDate(expenses)[day] || 0;
    records[day] = getDateOwner(current, day) === 'daily' && !isSkipped(day)
      ? { date: day, budget: 500, spent, saved: Math.max(0, 500 - spent), isFinalized: day < TODAY, status: day < TODAY ? 'saved' : 'active' }
      : { date: day, budget: 0, spent, saved: 0, isFinalized: day < TODAY, status: 'unknown' };
  }

  const w = computeWaterfallFromState({
    expenses, deposits, planChanges: current, records, budgetPeriods: {}, isBudgetModeEnabled: true, isAutoRenew: true,
    todayStr: TODAY, dailyBudgetAmount: 500, skipped,
  });
  const spentByDate = computeSpentByDate(expenses);
  const sum = (list: any[]) => list.reduce((s, x) => s + x.amount, 0);
  const total =
    allTimeBudget(records, current, spentByDate, TODAY, {}, skipped, w.pools) +
    sum(expenses.filter((e) => e.type === 'income')) +
    sum(deposits.filter((d) => d.source === 'external')) -
    sum(expenses.filter((e) => e.type === 'expense'));

  const owner = getDateOwner(current, TODAY);
  let running = 0;
  if (owner === 'daily') running = Math.max(0, records[TODAY].budget - (spentByDate[TODAY] || 0));
  if (owner === 'weekly' || owner === 'monthly') {
    const pool = w.pools[poolKeyFor(owner, TODAY)];
    running = pool && !pool.closed ? Math.max(0, pool.budget - pool.spent) : 0;
  }
  const waiting = dailyCarryRemaining(current, (d) => records[d]?.budget, 0, TODAY) + periodCarryRemaining(current, TODAY);
  const history = buildPeriodsToFinalize(current, spentByDate, TODAY, [], undefined, {}, w.poolSavings, skipped);

  return {
    equation: round(w.incomeRemaining + w.gullakBalance + running + waiting - w.deficit - total),
    gullak: w.gullakBalance,
    history: round(history.reduce((s, r) => s + r.amountSaved, 0) - w.poolSavings.reduce((s, m) => s + m.amount, 0)),
  };
}

describe(`rule 6 on ${SEEDS} random histories`, () => {
  it('the total always adds up, Gullak is never negative, and history matches the engine', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const broken: string[] = [];
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = run(seed);
      if (Math.abs(r.equation) > 0.02 || r.gullak < -0.001 || Math.abs(r.history) > 0.02) {
        broken.push(`seed ${seed}: ${JSON.stringify(r)}`);
      }
    }
    vi.useRealTimers();
    expect(broken).toEqual([]);
  }, 120_000);
});
