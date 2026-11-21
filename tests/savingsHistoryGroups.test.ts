import { describe, it, expect } from 'vitest';
import {
  savingsRowValue,
  groupSavingsHistory,
  groupTotalText,
  savingsRowDateLabel,
  pageSavingsGroups,
} from '../src/lib/savingsHistoryGroups';

const TODAY = new Date(2026, 10, 20); // Friday 20 Nov 2026 (week Mon 16 – Sun 22)

const day = (date: string, saved: number, spent: number, budget: number, status: string) => ({
  id: `daily_${date}`,
  date,
  dailyRecord: { date, saved, spent, budget, status, isFinalized: true } as any,
});
const dep = (date: string, amount: number) => ({
  id: `dep_${date}`,
  date,
  deposit: { id: `d_${date}`, date, amount } as any,
});

describe('savingsRowValue (one source for the row amount and the group total)', () => {
  it('daily rows: saved, over budget, exact budget, untracked', () => {
    expect(savingsRowValue(day('2026-11-19', 250, 0, 250, 'saved'))).toEqual({ kind: 'saved', amount: 250 });
    expect(savingsRowValue(day('2026-11-18', 0, 300, 250, 'missed'))).toEqual({ kind: 'over', amount: 50 });
    expect(savingsRowValue(day('2026-11-17', 0, 250, 250, 'even'))).toEqual({ kind: 'even', amount: 0 });
    expect(savingsRowValue(day('2026-11-16', 0, 40, 0, 'unknown'))).toEqual({ kind: 'unknown', amount: 0 });
  });

  it('deposits and finished weekly / monthly periods', () => {
    expect(savingsRowValue(dep('2026-11-18', 500))).toEqual({ kind: 'deposit', amount: 500 });
    const period = (p: any) => ({ id: 'p', date: '2026-10-31', period: p });
    expect(savingsRowValue(period({ status: 'saved', amountSaved: 900, spentAmount: 100, budgetAmount: 1000 }))).toEqual({ kind: 'saved', amount: 900 });
    expect(savingsRowValue(period({ status: 'missed', amountSaved: 0, spentAmount: 1200, budgetAmount: 1000 }))).toEqual({ kind: 'over', amount: 200 });
    expect(savingsRowValue(period({ status: 'even', amountSaved: 0, spentAmount: 1000, budgetAmount: 1000 }))).toEqual({ kind: 'even', amount: 0 });
  });
});

describe('groupSavingsHistory', () => {
  const items = [
    day('2026-11-19', 250, 0, 250, 'saved'),
    dep('2026-11-18', 500),
    day('2026-11-17', 0, 300, 250, 'missed'),
    day('2026-11-15', 250, 0, 250, 'saved'), // Sunday → last week
    day('2026-11-09', 100, 150, 250, 'saved'), // Monday → week 9 – 15 Nov = last week too
    day('2026-11-08', 250, 0, 250, 'saved'), // Sunday → 2 – 8 Nov
    day('2025-12-30', 250, 0, 250, 'saved'), // other year, week crosses the year
  ];

  it('weeks start on Monday, keep newest-first order, and label this / last week', () => {
    const groups = groupSavingsHistory(items, 'week', TODAY);
    expect(groups.map((g) => g.label)).toEqual(['THIS WEEK', 'LAST WEEK', '2 – 8 NOV', '29 DEC 2025 – 4 JAN 2026']);
    expect(groups[0].items.map((i) => i.id)).toEqual(['daily_2026-11-19', 'dep_2026-11-18', 'daily_2026-11-17']);
  });

  it('group totals add up exactly what the rows show (saved + deposits, and overspend separately)', () => {
    const [thisWeek, lastWeek] = groupSavingsHistory(items, 'week', TODAY);
    expect(thisWeek.savedTotal).toBe(750);
    expect(thisWeek.overTotal).toBe(50);
    expect(lastWeek.savedTotal).toBe(350);
    expect(lastWeek.overTotal).toBe(0);
  });

  it('months: this month, then month names (year only when it is not this year)', () => {
    const groups = groupSavingsHistory(
      [day('2026-11-02', 10, 0, 10, 'saved'), day('2026-10-31', 5, 0, 5, 'saved'), day('2025-12-31', 1, 0, 1, 'saved')],
      'month',
      TODAY
    );
    expect(groups.map((g) => g.label)).toEqual(['THIS MONTH', 'OCTOBER', 'DECEMBER 2025']);
  });

  it('paise totals are rounded to 2 decimals (no float drift)', () => {
    const [g] = groupSavingsHistory([day('2026-11-19', 0.1, 0, 1, 'saved'), day('2026-11-18', 0.2, 0, 1, 'saved')], 'week', TODAY);
    expect(g.savedTotal).toBe(0.3);
  });

  it('empty list → no groups', () => {
    expect(groupSavingsHistory([], 'week', TODAY)).toEqual([]);
  });
});

describe('pageSavingsGroups ("See More" never cuts a week in half)', () => {
  const g = (n: number) => ({ items: Array.from({ length: n }) });
  it('shows whole groups until the target is reached', () => {
    const groups = [g(4), g(7), g(7), g(7)];
    expect(pageSavingsGroups(groups, 8)).toEqual({ shown: [groups[0], groups[1]], hiddenCount: 14 });
    expect(pageSavingsGroups(groups, 16).shown).toHaveLength(3);
    expect(pageSavingsGroups(groups, 100)).toEqual({ shown: groups, hiddenCount: 0 });
  });
  it('one group bigger than the target is still shown whole', () => {
    expect(pageSavingsGroups([g(12)], 8)).toEqual({ shown: [g(12)], hiddenCount: 0 });
  });
  it('nothing to show', () => {
    expect(pageSavingsGroups([], 8)).toEqual({ shown: [], hiddenCount: 0 });
  });
});

describe('groupTotalText (same look as the History day headers)', () => {
  it('saved only, over only, both, nothing', () => {
    expect(groupTotalText({ savedTotal: 1750, overTotal: 0 })).toEqual({ text: '+₹1,750', tone: 'income' });
    expect(groupTotalText({ savedTotal: 0, overTotal: 120 })).toEqual({ text: '−₹120', tone: 'expense' });
    expect(groupTotalText({ savedTotal: 500, overTotal: 50.5 })).toEqual({ text: '−₹50.50  •  +₹500', tone: 'mixed' });
    expect(groupTotalText({ savedTotal: 0, overTotal: 0 })).toEqual({ text: '₹0', tone: 'zero' });
  });
});

describe('savingsRowDateLabel (no year for this year, never repeated noise)', () => {
  it('daily rows', () => {
    expect(savingsRowDateLabel('2026-11-19', 'daily', TODAY)).toBe('Yesterday, 19 Nov');
    expect(savingsRowDateLabel('2026-11-18', 'daily', TODAY)).toBe('Wed, 18 Nov');
    expect(savingsRowDateLabel('2025-12-30', 'daily', TODAY)).toBe('Tue, 30 Dec 2025');
  });
  it('deposits', () => {
    expect(savingsRowDateLabel('2026-11-18', 'deposit', TODAY)).toBe('18 Nov');
    expect(savingsRowDateLabel('2025-12-30', 'deposit', TODAY)).toBe('30 Dec 2025');
  });
});
