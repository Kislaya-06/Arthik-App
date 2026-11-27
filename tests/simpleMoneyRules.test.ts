/**
 * Expected values come from docs/specs/2026-11-28-simple-money-rules.md (rule numbers in the test names).
 */
import { describe, it, expect } from 'vitest';
import { computeWaterfallFromState } from '../src/lib/moneyWaterfall';
import type { BudgetPlanChange } from '../src/types';

const plan = (effectiveFrom: string, cadence: 'daily' | 'weekly' | 'monthly', amount: number, extra: Partial<BudgetPlanChange> = {}): BudgetPlanChange => ({
  id: effectiveFrom, userId: 'u', effectiveFrom, isEnabled: true, cadence, amount, createdAt: effectiveFrom, ...extra,
});
const pure = (effectiveFrom: string): BudgetPlanChange => plan(effectiveFrom, 'weekly', 1000, { isEnabled: false });
const exp = (id: string, amount: number, date: string) => ({ id, amount, type: 'expense', expense_date: date, created_at: date });
const inc = (id: string, amount: number, date: string) => ({ id, amount, type: 'income', expense_date: date, created_at: date });
const day = (date: string, saved: number, budget = 500) => ({ budget, saved, status: saved > 0 ? 'saved' : 'missed', isFinalized: true, date });

const run = (o: { today: string; plans: BudgetPlanChange[]; expenses?: any[]; records?: any; deposits?: any[]; skipped?: any[] }) =>
  computeWaterfallFromState({
    expenses: o.expenses ?? [], deposits: o.deposits ?? [], planChanges: o.plans, records: o.records ?? {},
    budgetPeriods: {}, isBudgetModeEnabled: true, isAutoRenew: true, todayStr: o.today, dailyBudgetAmount: 500,
    skipped: o.skipped,
  });

describe('Gullak is one running balance', () => {
  it('rule 5: weekly saved 600, drew 500, saved 1000 -> 1100', () => {
    const r = run({
      today: '2026-11-23', plans: [plan('2026-11-02', 'weekly', 1000)],
      expenses: [exp('a', 400, '2026-11-03'), exp('b', 1500, '2026-11-10')],
    });
    expect(r.gullakBalance).toBe(1100);
    expect(r.gullakDrawn).toBe(500);
    expect(r.deficit).toBe(0);
  });

  it('rule 4: Pure spending before income is paid by that income, never by later savings', () => {
    const r = run({
      today: '2026-11-27',
      plans: [plan('2026-11-01', 'daily', 0, { isEnabled: false }), plan('2026-11-25', 'daily', 500)],
      expenses: [exp('1', 300, '2026-11-16'), exp('2', 700, '2026-11-17'), inc('3', 2000, '2026-11-18'), exp('4', 800, '2026-11-18')],
      records: { '2026-11-25': day('2026-11-25', 500), '2026-11-26': day('2026-11-26', 500) },
    });
    expect(r.gullakBalance).toBe(1000);
    expect(r.deficit).toBe(0);
    expect(r.incomeRemaining).toBe(200);
  });

  it('rules 3 + 4: nothing to cover it -> deficit, Gullak not negative', () => {
    const r = run({ today: '2026-11-27', plans: [plan('2026-11-01', 'daily', 0, { isEnabled: false })], expenses: [exp('1', 300, '2026-11-16')] });
    expect(r.gullakBalance).toBe(0);
    expect(r.deficit).toBe(300);
    expect(r.byExpense['1']).toMatchObject({ fromGullak: 0, short: 300 });
  });

  it('rules 7 + 8: new money adds to Gullak; from income moves it', () => {
    const r = run({
      today: '2026-11-27', plans: [plan('2026-11-27', 'daily', 500)], expenses: [inc('i', 1000, '2026-11-20')],
      deposits: [{ date: '2026-11-21', amount: 700, source: 'income' }, { date: '2026-11-22', amount: 200, source: 'external' }],
    });
    expect(r.gullakBalance).toBe(900);
    expect(r.incomeRemaining).toBe(300);
  });
});

describe('Switching', () => {
  it('rule 18: Pure mid-week moves the leftover to Gullak that midnight', () => {
    const r = run({
      today: '2026-11-25', plans: [plan('2026-11-23', 'weekly', 3500), pure('2026-11-25')],
      expenses: [exp('a', 500, '2026-11-23')],
    });
    expect(r.gullakBalance).toBe(3000);
  });

  it('rule 19: same week return restores moved minus Pure Gullak draws (2400 / 2000)', () => {
    const plans = [plan('2026-11-23', 'weekly', 3500), pure('2026-11-25'), plan('2026-11-27', 'weekly', 3500)];
    const r = run({
      today: '2026-11-27', plans,
      deposits: [{ date: '2026-11-20', amount: 2000, source: 'external' }],
      expenses: [exp('a', 500, '2026-11-23'), inc('i', 400, '2026-11-25'), exp('p', 1000, '2026-11-25')],
    });
    expect(r.pools['weekly_2026-11-23']).toMatchObject({ budget: 2900, spent: 500 }); // 500 used + 2400 left
    expect(r.gullakBalance).toBe(2000);
  });

  it('rule 24: a budget closed by a cadence switch does not reopen with money', () => {
    const r = run({
      today: '2026-11-27',
      plans: [plan('2026-11-23', 'weekly', 3500), plan('2026-11-24', 'monthly', 15000), plan('2026-11-26', 'weekly', 3500)],
    });
    expect(r.pools['weekly_2026-11-23']).toMatchObject({ budget: 3500, closed: true });
    expect(r.gullakBalance).toBe(3500 + 15000);
  });

  it('rules 20-22: carry forward keeps the leftover out of Gullak', () => {
    const r = run({
      today: '2026-11-25',
      plans: [plan('2026-11-01', 'monthly', 15000), plan('2026-11-24', 'weekly', 3500, { carryMode: 'allocation', carriedOverAmount: 14000 })],
      expenses: [exp('a', 1000, '2026-11-23')],
    });
    expect(r.gullakBalance).toBe(0);
  });
});

describe('Absence (rules 29-31)', () => {
  it('a skipped period gives no budget and no savings', () => {
    const r = run({
      today: '2026-11-23', plans: [plan('2026-11-02', 'weekly', 1000)],
      skipped: [{ from: '2026-11-09', to: '2026-11-15' }],
    });
    expect(r.gullakBalance).toBe(2000);
  });
});
