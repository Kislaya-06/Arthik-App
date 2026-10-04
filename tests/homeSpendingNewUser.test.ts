import { describe, it, expect } from 'vitest';
import { filterExpenses } from '../src/lib/expenseFilters';
import { calculatePeriodSummary } from '../src/lib/homeCalculations';
import { Expense } from '../src/store/expenseStore';
import { round2 } from '../src/lib/formatters';

describe('Home Screen - New User Spendings Display Fix', () => {
  const referenceDate = new Date('2026-09-30T14:00:00+05:30'); // Wednesday 30 Sep 2026

  const sampleExpenses: Expense[] = [
    {
      id: 'exp-1',
      user_id: 'user-new',
      amount: 250,
      expense_date: '2026-09-30', // Today
      payment_mode: 'upi',
      type: 'expense',
      category_id: 'cat-food',
      created_at: '2026-09-30T14:05:00+05:30',
    },
    {
      id: 'exp-2',
      user_id: 'user-new',
      amount: 150,
      expense_date: '2026-09-29', // Yesterday
      payment_mode: 'cash',
      type: 'expense',
      category_id: 'cat-transport',
      created_at: '2026-09-30T14:06:00+05:30',
    },
    {
      id: 'exp-3',
      user_id: 'user-new',
      amount: 500,
      expense_date: '2026-09-28', // Monday of this week
      payment_mode: 'card',
      type: 'expense',
      category_id: 'cat-groceries',
      created_at: '2026-09-30T14:07:00+05:30',
    },
    {
      id: 'exp-4',
      user_id: 'user-new',
      amount: 1200,
      expense_date: '2026-09-15', // Mid-month (earlier in September)
      payment_mode: 'upi',
      type: 'expense',
      category_id: 'cat-shopping',
      created_at: '2026-09-30T14:08:00+05:30',
    },
  ];

  it('preserves all user expenses for Weekly, Monthly, and All views on HomeScreen', () => {
    // 1. Daily: includes only today (exp-1: ₹250)
    const dailyFiltered = filterExpenses(sampleExpenses, 'Daily', referenceDate);
    expect(dailyFiltered.map((e) => e.id)).toEqual(['exp-1']);

    // 2. Weekly: includes Monday (exp-3), Tuesday/Yesterday (exp-2), and Wednesday/Today (exp-1)
    const weeklyFiltered = filterExpenses(sampleExpenses, 'Weekly', referenceDate);
    expect(weeklyFiltered.map((e) => e.id)).toEqual(['exp-1', 'exp-2', 'exp-3']);

    // 3. Monthly: includes all September expenses (exp-1, exp-2, exp-3, exp-4)
    const monthlyFiltered = filterExpenses(sampleExpenses, 'Monthly', referenceDate);
    expect(monthlyFiltered.map((e) => e.id)).toEqual(['exp-1', 'exp-2', 'exp-3', 'exp-4']);

    // 4. All: includes all expenses
    const allFiltered = filterExpenses(sampleExpenses, 'All', referenceDate);
    expect(allFiltered.map((e) => e.id)).toEqual(['exp-1', 'exp-2', 'exp-3', 'exp-4']);
  });

  it('calculates non-zero spendings and correct period metrics for new users', () => {
    // Simulate Daily filter metrics
    const dailyFiltered = filterExpenses(sampleExpenses, 'Daily', referenceDate);
    const dailySpent = round2(dailyFiltered.reduce((sum, e) => sum + e.amount, 0));
    expect(dailySpent).toBe(250);

    const dailySummary = calculatePeriodSummary({
      activeFilter: 'Daily',
      dailyBudgetAmount: 250,
      isAutoRenew: true,
      todayBudget: 250,
      dailyRecords: {},
      totalIncome: 0,
      totalSpent: dailySpent,
      filtered: dailyFiltered,
      userCreatedAtStr: '2026-09-30',
      referenceDate,
      externalDepositsInPeriod: 0,
    });

    expect(dailySummary.periodSpent).toBe(250);
    expect(dailySummary.displaySpent).toBe(250);
    expect(dailySummary.totalAvailable).toBe(250);
    expect(dailySummary.primaryAmount).toBe(0); // 250 available - 250 spent = 0 remaining
    expect(dailySummary.primaryLabel).toBe('Remaining to Spend');

    // Simulate Weekly filter metrics
    const weeklyFiltered = filterExpenses(sampleExpenses, 'Weekly', referenceDate);
    const weeklySpent = round2(weeklyFiltered.reduce((sum, e) => sum + e.amount, 0));
    expect(weeklySpent).toBe(900); // 250 + 150 + 500

    const weeklySummary = calculatePeriodSummary({
      activeFilter: 'Weekly',
      dailyBudgetAmount: 250,
      isAutoRenew: true,
      todayBudget: 250,
      dailyRecords: {},
      totalIncome: 0,
      totalSpent: weeklySpent,
      filtered: weeklyFiltered,
      userCreatedAtStr: '2026-09-30',
      referenceDate,
      externalDepositsInPeriod: 0,
    });

    expect(weeklySummary.periodSpent).toBe(900);
    expect(weeklySummary.displaySpent).toBe(900);
    expect(weeklySummary.isOverBudgetPeriod).toBe(true); // 900 spent > 250 budget pool
    expect(weeklySummary.primaryLabel).toBe('Weekly Budget Exceeded');
  });
});
