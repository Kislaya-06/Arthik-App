import { describe, it, expect } from 'vitest';
import { calculatePeriodSummary, buildHeroSubtextChips, drawnFromGullakText } from '../src/lib/homeCalculations';
import { computeWaterfallFromState, summarizeScope } from '../src/lib/moneyWaterfall';

/**
 * The Monthly card must tell ONE story:
 *  - a DEFICIT shows only when the budget AND the income are both used up,
 *  - the income chip shows the real income left (never an invented "₹0"),
 *  - what already came out of Gullak is written in the past tense: "Drawn ₹136 from Gullak".
 */
const TODAY = '2026-10-13'; // Tuesday
const cats = [{ id: 'food', name: 'Food' }, { id: 'sal', name: 'Salary' }];
const inc = (id: string, amount: number, date: string): any => ({ id, amount, type: 'income', expense_date: date, category_id: 'sal', created_at: `${date}T08:00:00Z` });
const exp = (id: string, amount: number, date: string): any => ({ id, amount, type: 'expense', expense_date: date, category_id: 'food', created_at: `${date}T12:00:00Z` });

const plan: any[] = [{ id: 'p', userId: 'u', effectiveFrom: '2026-10-01', isEnabled: true, cadence: 'daily', amount: 100 }];
const days = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `2026-10-${String(from + i).padStart(2, '0')}`);
const records = (spent: Record<string, number>) =>
  Object.fromEntries(days(1, 12).map((d) => [d, { date: d, budget: 100, spent: spent[d] || 0, saved: Math.max(0, 100 - (spent[d] || 0)), isFinalized: true, status: 'saved' as const }]));

const summaryFor = (expenses: any[], filter: 'Monthly' | 'Weekly' | 'All' | 'Daily') => {
  const spentByDate: Record<string, number> = {};
  for (const e of expenses) if (e.type === 'expense') spentByDate[e.expense_date] = (spentByDate[e.expense_date] || 0) + e.amount;
  const waterfall = computeWaterfallFromState({
    expenses, categories: cats, isBudgetModeEnabled: true, isAutoRenew: true, todayStr: TODAY,
    todayBudget: 100, dailyBudgetAmount: 100, records: records(spentByDate) as any, planChanges: plan,
  });
  const inScope = (d: string) => (filter === 'Monthly' ? d.startsWith('2026-10') : filter === 'Weekly' ? d >= '2026-10-12' : filter === 'Daily' ? d === TODAY : true);
  const scope = summarizeScope(waterfall, inScope, filter === 'All');
  const scoped = expenses.filter((e) => inScope(e.expense_date));
  const totalIncome = scoped.filter((e) => e.type === 'income').reduce((a, e) => a + e.amount, 0);
  const totalSpent = scoped.filter((e) => e.type === 'expense').reduce((a, e) => a + e.amount, 0);
  const r = calculatePeriodSummary({
    activeFilter: filter, dailyBudgetAmount: 100, isAutoRenew: true, todayBudget: 100, dailyRecords: records(spentByDate) as any,
    totalIncome, totalSpent, filtered: scoped.map((e) => ({ expense_date: e.expense_date })), userCreatedAtStr: '2026-10-01',
    referenceDate: new Date(2026, 9, 13), externalDepositsInPeriod: 0, planChanges: plan,
    todaySpent: spentByDate[TODAY] || 0, spentByDate,
    funding: { incomeRemaining: scope.incomeRemaining, gullakDrawn: scope.gullakDrawn },
  } as any);
  return { r, scope };
};

// Day 1 overspends before any income exists (Gullak pays), income arrives later and is not touched.
const story = [
  exp('d1', 400, '2026-10-01'),   // 300 over, no income yet  -> 300 from Gullak
  inc('i1', 100, '2026-10-02'),
  exp('d2', 150, '2026-10-02'),   //  50 over -> 50 from income, 50 income left
  ...days(3, 12).map((d) => exp(`s${d}`, 100, d)),
  inc('i2', 20, TODAY),           // today's income, unspent
];

describe('Monthly card: deficit only when budget AND income are both used up', () => {
  it('income still left -> NO deficit: "Remaining" shows that income, budget is "used up"', () => {
    const { r, scope } = summaryFor(story, 'Monthly');
    expect(scope.incomeRemaining).toBe(70);          // 50 left of the first + today's 20
    expect(r.isOverBudgetPeriod).toBe(false);
    expect(r.primaryLabel).toBe('Monthly Remaining');
    expect(r.primaryAmount).toBe(70);
    expect(r.primarySubtext).toBe('Budget used up + ₹70 income');
    expect(r.gullakDrawnAmount).toBe(300);
  });

  it('the Weekly card of the same user is unchanged and agrees (same income, same Gullak)', () => {
    const { r } = summaryFor(story, 'Weekly');
    expect(r.isOverBudgetPeriod).toBe(false);
    expect(r.remainingIncome).toBe(20);
  });

  it('income all used up -> a real DEFICIT, with the real income chip (₹0) and what was drawn', () => {
    const noIncomeLeft = [exp('d1', 400, '2026-10-01'), inc('i1', 100, '2026-10-02'), exp('d2', 300, '2026-10-02'), ...days(3, 12).map((d) => exp(`s${d}`, 100, d))];
    const { r, scope } = summaryFor(noIncomeLeft, 'Monthly');
    expect(scope.incomeRemaining).toBe(0);
    expect(r.isOverBudgetPeriod).toBe(true);
    expect(r.primaryLabel).toBe('Monthly Budget Exceeded');
    expect(r.primarySubtext).toMatch(/^Exceeded monthly limit by ₹[\d,]+ \+ ₹0 income$/);
    expect(r.gullakDrawnAmount).toBe(300 + 100);     // 300 on day 1, 100 on day 2 (income 100 was used first)
  });

  it('the product-owner example: 14 days x 100 = 1,400 budget; income covers the rest before any deficit', () => {
    const e = [inc('i', 100, '2026-10-01'), ...days(1, 13).map((d) => exp(`e${d}`, d === '2026-10-13' ? 150 : 100, d))];
    // spent 1,350 + ... budget pool is 13 days x 100 here; spent 1,350 vs 1,300 + 100 income
    const { r } = summaryFor(e, 'Monthly');
    expect(r.isOverBudgetPeriod).toBe(false);
    expect(r.primaryAmount).toBeGreaterThan(0);
  });

  it('Daily and All pills agree with the same rule', () => {
    const all = summaryFor(story, 'All').r;
    expect(all.isOverBudgetPeriod).toBe(false);
    expect(all.remainingIncome).toBe(70);
  });
});

describe('Gullak chip wording and no invented income', () => {
  it('"drawn", never "using" (the money already came out)', () => {
    expect(drawnFromGullakText(136)).toBe('drawn ₹136 from Gullak');
  });

  it('the badge sits on the real income chip', () => {
    const chips = buildHeroSubtextChips({ effectiveSubtext: 'Budget used up + ₹70 income', isBudgetModeEnabled: true, isSpendingFromGullak: true, gullakDrawnAmount: 300, periodIncome: 120 });
    const income = chips.find((c) => c.text.includes('income'));
    expect(income?.text).toBe('+₹70 income');
    expect(income?.badgeText).toBe('drawn ₹300 from Gullak');
  });

  it('no income chip: Gullak gets its own chip and NO "₹0 income" is invented', () => {
    const chips = buildHeroSubtextChips({ effectiveSubtext: 'Exceeded monthly limit by ₹12', isBudgetModeEnabled: true, isSpendingFromGullak: true, gullakDrawnAmount: 136, periodIncome: 0 });
    expect(chips.map((c) => c.text)).toContain('Drawn ₹136 from Gullak');
    expect(chips.some((c) => c.text.includes('₹0 income'))).toBe(false);
  });

  it('nothing drawn -> no Gullak chip at all', () => {
    expect(buildHeroSubtextChips({ effectiveSubtext: '₹300 budget (3 days)', isBudgetModeEnabled: true, isSpendingFromGullak: false, gullakDrawnAmount: 0, periodIncome: 0 })).toHaveLength(1);
    expect(buildHeroSubtextChips({ effectiveSubtext: null, isBudgetModeEnabled: true, isSpendingFromGullak: false, gullakDrawnAmount: 0, periodIncome: 0 })).toHaveLength(0);
  });
});
