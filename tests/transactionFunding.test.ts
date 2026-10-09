import { describe, it, expect } from 'vitest';
import { calculateExpenseFunding } from '../src/lib/transactionFunding';
import { Expense } from '../src/store/expenseStore';
import { Category } from '../src/store/categoryStore';

describe('calculateExpenseFunding', () => {
  const dummyCategories: Category[] = [
    { id: 'cat-food', user_id: 'u1', name: 'Food', icon: 'Utensils', color: '#FFB3BA', is_default: true },
    { id: 'cat-salary', user_id: 'u1', name: 'Salary', icon: 'Wallet', color: '#ADEBB3', is_default: true },
  ];

  it('correctly handles expense completely within daily allowance', () => {
    const expense: Expense = {
      id: 'tx-1',
      user_id: 'u1',
      amount: 250,
      payment_mode: 'upi',
      expense_date: '2026-10-10',
      category_id: 'cat-food',
    };

    const result = calculateExpenseFunding({
      expense,
      allExpenses: [expense],
      categories: dummyCategories,
      todayBudget: 500,
      dailyBudgetAmount: 500,
      isBudgetModeEnabled: true,
      todayStr: '2026-10-10',
    });

    expect(result.coveredByBudget).toBe(250);
    expect(result.coveredByIncome).toBe(0);
    expect(result.coveredByGullak).toBe(0);
    expect(result.isOverBudget).toBe(false);
    expect(result.primarySource).toBe('budget');
    expect(result.summaryLabel).toBe('Daily Allowance');
  });

  it('correctly splits expense between daily allowance and available income', () => {
    const incomeTx: Expense = {
      id: 'tx-inc',
      user_id: 'u1',
      amount: 1000,
      type: 'income',
      payment_mode: 'upi',
      expense_date: '2026-10-09',
      category_id: 'cat-salary',
    };

    const expense: Expense = {
      id: 'tx-2',
      user_id: 'u1',
      amount: 700,
      payment_mode: 'upi',
      expense_date: '2026-10-10',
      category_id: 'cat-food',
    };

    const result = calculateExpenseFunding({
      expense,
      allExpenses: [incomeTx, expense],
      categories: dummyCategories,
      todayBudget: 500,
      dailyBudgetAmount: 500,
      isBudgetModeEnabled: true,
      todayStr: '2026-10-10',
    });

    expect(result.coveredByBudget).toBe(500);
    expect(result.coveredByIncome).toBe(200);
    expect(result.coveredByGullak).toBe(0);
    expect(result.isOverBudget).toBe(true);
    expect(result.primarySource).toBe('split');
    expect(result.summaryLabel).toContain('Allowance');
    expect(result.summaryLabel).toContain('Income');
  });

  it('correctly spills over into Gullak when income is insufficient', () => {
    const incomeTx: Expense = {
      id: 'tx-inc',
      user_id: 'u1',
      amount: 150,
      type: 'income',
      payment_mode: 'upi',
      expense_date: '2026-10-09',
      category_id: 'cat-salary',
    };

    const expense: Expense = {
      id: 'tx-3',
      user_id: 'u1',
      amount: 800,
      payment_mode: 'upi',
      expense_date: '2026-10-10',
      category_id: 'cat-food',
    };

    const result = calculateExpenseFunding({
      expense,
      allExpenses: [incomeTx, expense],
      categories: dummyCategories,
      todayBudget: 500,
      dailyBudgetAmount: 500,
      isBudgetModeEnabled: true,
      todayStr: '2026-10-10',
    });

    // 800 total: 500 daily allowance, 150 income, 150 Gullak
    expect(result.coveredByBudget).toBe(500);
    expect(result.coveredByIncome).toBe(150);
    expect(result.coveredByGullak).toBe(150);
    expect(result.isOverBudget).toBe(true);
    expect(result.primarySource).toBe('split');
    expect(result.summaryLabel).toContain('Allowance');
    expect(result.summaryLabel).toContain('Income');
    expect(result.summaryLabel).toContain('Gullak');
  });

  it('correctly tracks multiple sequential expenses on the same day', () => {
    const incomeTx: Expense = {
      id: 'tx-inc',
      user_id: 'u1',
      amount: 200,
      type: 'income',
      payment_mode: 'upi',
      expense_date: '2026-10-10',
      created_at: '2026-10-10T08:00:00Z',
      category_id: 'cat-salary',
    };

    const tx1: Expense = {
      id: 'tx-1',
      user_id: 'u1',
      amount: 300,
      payment_mode: 'cash',
      expense_date: '2026-10-10',
      created_at: '2026-10-10T10:00:00Z',
      category_id: 'cat-food',
    };

    const tx2: Expense = {
      id: 'tx-2',
      user_id: 'u1',
      amount: 400,
      payment_mode: 'upi',
      expense_date: '2026-10-10',
      created_at: '2026-10-10T14:00:00Z',
      category_id: 'cat-food',
    };

    const tx3: Expense = {
      id: 'tx-3',
      user_id: 'u1',
      amount: 250,
      payment_mode: 'card',
      expense_date: '2026-10-10',
      created_at: '2026-10-10T19:00:00Z',
      category_id: 'cat-food',
    };

    const allExpenses = [incomeTx, tx1, tx2, tx3];
    const baseParams = {
      allExpenses,
      categories: dummyCategories,
      todayBudget: 500,
      dailyBudgetAmount: 500,
      isBudgetModeEnabled: true,
      todayStr: '2026-10-10',
    };

    // Tx 1: 300 -> 300 budget (200 budget left)
    const res1 = calculateExpenseFunding({ ...baseParams, expense: tx1 });
    expect(res1.coveredByBudget).toBe(300);
    expect(res1.coveredByIncome).toBe(0);
    expect(res1.coveredByGullak).toBe(0);

    // Tx 2: 400 -> 200 budget (0 budget left), 200 overspend (eats 200 income, 0 income left)
    const res2 = calculateExpenseFunding({ ...baseParams, expense: tx2 });
    expect(res2.coveredByBudget).toBe(200);
    expect(res2.coveredByIncome).toBe(200);
    expect(res2.coveredByGullak).toBe(0);

    // Tx 3: 250 -> 0 budget, 0 income left -> 250 from Gullak
    const res3 = calculateExpenseFunding({ ...baseParams, expense: tx3 });
    expect(res3.coveredByBudget).toBe(0);
    expect(res3.coveredByIncome).toBe(0);
    expect(res3.coveredByGullak).toBe(250);
    expect(res3.primarySource).toBe('gullak');
    expect(res3.summaryLabel).toBe('Paid from Gullak');
  });

  it('correctly handles pure mode (budget mode disabled)', () => {
    const incomeTx: Expense = {
      id: 'tx-inc',
      user_id: 'u1',
      amount: 300,
      type: 'income',
      payment_mode: 'upi',
      expense_date: '2026-10-10',
      category_id: 'cat-salary',
    };

    const expense: Expense = {
      id: 'tx-pure',
      user_id: 'u1',
      amount: 500,
      payment_mode: 'upi',
      expense_date: '2026-10-10',
      category_id: 'cat-food',
    };

    const result = calculateExpenseFunding({
      expense,
      allExpenses: [incomeTx, expense],
      categories: dummyCategories,
      isBudgetModeEnabled: false,
      todayStr: '2026-10-10',
    });

    expect(result.coveredByBudget).toBe(0);
    expect(result.coveredByIncome).toBe(300);
    expect(result.coveredByGullak).toBe(200);
  });

  it('correctly identifies income and self-transfer transactions', () => {
    const incomeTx: Expense = {
      id: 'tx-inc',
      user_id: 'u1',
      amount: 1000,
      type: 'income',
      payment_mode: 'upi',
      expense_date: '2026-10-10',
      category_id: 'cat-salary',
    };

    const transferTx: Expense = {
      id: 'tx-trans',
      user_id: 'u1',
      amount: 500,
      payment_mode: 'upi',
      expense_date: '2026-10-10',
      transaction_class: 'self_transfer',
    };

    const resIncome = calculateExpenseFunding({
      expense: incomeTx,
      allExpenses: [incomeTx],
      categories: dummyCategories,
    });
    expect(resIncome.isIncome).toBe(true);

    const resTrans = calculateExpenseFunding({
      expense: transferTx,
      allExpenses: [transferTx],
      categories: dummyCategories,
    });
    expect(resTrans.isTransfer).toBe(true);
  });
});
