import { describe, it, expect } from 'vitest';
import { parseISO } from 'date-fns';
import {
  computeYearlyInflow,
  compute12MonthCashFlow,
  ExpenseLike,
} from '../src/lib/yearlyInsightsUtils';
import type { Category } from '../src/store/categoryStore';
import type { GullakDeposit } from '../src/store/dailyBudgetStore';

describe('FIN-03: Yearly Inflow & Cash Flow Gullak Deposit Attribution (GUL-004)', () => {
  const mockCategories: Category[] = [
    { id: 'cat-income', name: 'Salary', color: '#10B981', icon: 'Wallet', user_id: 'test-user', is_default: false },
    { id: 'cat-food', name: 'Food', color: '#F07167', icon: 'Utensils', user_id: 'test-user', is_default: false },
  ];

  const y2026Start = parseISO('2026-01-01');
  const y2026End = parseISO('2026-12-31');
  const y2026Interval = { start: y2026Start, end: y2026End };
  const refDate = parseISO('2026-10-02');

  it('does NOT double count income deposits in computeYearlyInflow', () => {
    // User earned ₹50,000 salary
    const expenses: ExpenseLike[] = [
      { id: 'inc-1', amount: 50000, expense_date: '2026-01-10', category_id: 'cat-income' },
    ];

    // User deposited ₹10,000 to Gullak from income (source: 'income')
    // and ₹2,000 fresh external cash into Gullak (source: 'external')
    const deposits: GullakDeposit[] = [
      { id: 'dep-1', date: '2026-01-15', amount: 10000, source: 'income', created_at: '2026-01-15T10:00:00Z' },
      { id: 'dep-2', date: '2026-02-01', amount: 2000, source: 'external', created_at: '2026-02-01T10:00:00Z' },
    ];

    // In Pure Mode (no budget mode)
    // Expected Inflow = 50,000 (direct income) + 2,000 (external deposit) = 52,000.
    // The ₹10,000 income-funded deposit MUST NOT be counted again!
    const inflowPure = computeYearlyInflow(
      expenses,
      mockCategories,
      [],
      deposits,
      { isBudgetMode: false },
      y2026Interval,
      refDate,
      '2026-01-01'
    );

    expect(inflowPure).toBe(52000);
  });

  it('correctly handles Budget Mode inflow with external vs income deposits', () => {
    const expenses: ExpenseLike[] = [
      { id: 'inc-1', amount: 30000, expense_date: '2026-03-01', category_id: 'cat-income' },
    ];

    const deposits: GullakDeposit[] = [
      { id: 'dep-inc', date: '2026-03-05', amount: 15000, source: 'income', created_at: '2026-03-05T10:00:00Z' },
      { id: 'dep-ext', date: '2026-04-10', amount: 5000, source: 'external', created_at: '2026-04-10T10:00:00Z' },
    ];

    // Daily budget 500 across 275 active days = 1,37,500
    // Total Inflow = 1,37,500 (allowance) + 30,000 (direct income) + 5,000 (external deposit) = 1,72,500
    const inflowBudget = computeYearlyInflow(
      expenses,
      mockCategories,
      [],
      deposits,
      { isBudgetMode: true, cadence: 'daily', dailyBudgetAmount: 500 },
      y2026Interval,
      refDate,
      '2025-01-01'
    );

    expect(inflowBudget).toBe(172500);
  });

  it('does NOT inflate monthly cash flow bar in compute12MonthCashFlow for income deposits', () => {
    // January: ₹50,000 salary, ₹10,000 transferred to Gullak from income
    const expenses: ExpenseLike[] = [
      { id: 'inc-1', amount: 50000, expense_date: '2026-01-10', category_id: 'cat-income' },
      { id: 'exp-1', amount: 20000, expense_date: '2026-01-20', category_id: 'cat-food' },
    ];

    const deposits: GullakDeposit[] = [
      { id: 'dep-jan-inc', date: '2026-01-12', amount: 10000, source: 'income', created_at: '2026-01-12T10:00:00Z' },
      { id: 'dep-jan-ext', date: '2026-01-18', amount: 3000, source: 'external', created_at: '2026-01-18T10:00:00Z' },
    ];

    const cashFlow = compute12MonthCashFlow(
      y2026Start,
      y2026End,
      expenses,
      mockCategories,
      deposits,
      { isBudgetMode: false },
      '2025-01-01',
      refDate
    );

    const jan = cashFlow.months[0];
    expect(jan.label).toBe('Jan');
    // January income should be 50,000 (salary) + 3,000 (external deposit) = 53,000.
    // The ₹10,000 income-funded deposit MUST NOT inflate monthIncome to 63,000!
    expect(jan.income).toBe(53000);
    expect(jan.spent).toBe(20000);
  });
});
