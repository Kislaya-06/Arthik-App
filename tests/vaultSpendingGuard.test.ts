import { describe, it, expect } from 'vitest';
import { calculateVaultLiquidity } from '../src/lib/vaultSpendingGuard';

describe('calculateVaultLiquidity (Digital Vault Spending Guard)', () => {
  describe('Pure Mode (Budget Mode Disabled)', () => {
    it('blocks expense when income is 0 and expenses are 0', () => {
      const res = calculateVaultLiquidity({
        isBudgetModeEnabled: false,
        budgetCadence: 'daily',
        dailyBudgetAmount: 0,
        weeklyBudgetAmount: 0,
        monthlyBudgetAmount: 0,
        totalIncome: 0,
        totalExpenses: 0,
      });

      expect(res.canAddExpense).toBe(false);
      expect(res.totalVaultLiquidity).toBe(0);
      expect(res.reason).toBeDefined();
    });

    it('allows expense when user has positive income', () => {
      const res = calculateVaultLiquidity({
        isBudgetModeEnabled: false,
        budgetCadence: 'daily',
        dailyBudgetAmount: 0,
        weeklyBudgetAmount: 0,
        monthlyBudgetAmount: 0,
        totalIncome: 5000,
        totalExpenses: 0,
      });

      expect(res.canAddExpense).toBe(true);
      expect(res.totalVaultLiquidity).toBe(5000);
      expect(res.reason).toBeUndefined();
    });

    it('blocks expense when expenses have exhausted all income (net = 0)', () => {
      const res = calculateVaultLiquidity({
        isBudgetModeEnabled: false,
        budgetCadence: 'daily',
        dailyBudgetAmount: 0,
        weeklyBudgetAmount: 0,
        monthlyBudgetAmount: 0,
        totalIncome: 5000,
        totalExpenses: 5000,
      });

      expect(res.canAddExpense).toBe(false);
      expect(res.totalVaultLiquidity).toBe(0);
    });

    it('blocks expense when expenses exceed income (net < 0)', () => {
      const res = calculateVaultLiquidity({
        isBudgetModeEnabled: false,
        budgetCadence: 'daily',
        dailyBudgetAmount: 0,
        weeklyBudgetAmount: 0,
        monthlyBudgetAmount: 0,
        totalIncome: 5000,
        totalExpenses: 5200,
      });

      expect(res.canAddExpense).toBe(false);
      expect(res.totalVaultLiquidity).toBe(-200);
    });
  });

  describe('Budget Mode Enabled', () => {
    it('allows expense when daily budget is active (> 0)', () => {
      const res = calculateVaultLiquidity({
        isBudgetModeEnabled: true,
        budgetCadence: 'daily',
        dailyBudgetAmount: 500,
        weeklyBudgetAmount: 0,
        monthlyBudgetAmount: 0,
        totalIncome: 0,
        totalExpenses: 0,
      });

      expect(res.canAddExpense).toBe(true);
      expect(res.totalVaultLiquidity).toBe(500);
      expect(res.activeCadenceAllowance).toBe(500);
    });

    it('allows expense when weekly budget is active (> 0)', () => {
      const res = calculateVaultLiquidity({
        isBudgetModeEnabled: true,
        budgetCadence: 'weekly',
        dailyBudgetAmount: 0,
        weeklyBudgetAmount: 7000,
        monthlyBudgetAmount: 0,
        totalIncome: 0,
        totalExpenses: 0,
      });

      expect(res.canAddExpense).toBe(true);
      expect(res.totalVaultLiquidity).toBe(7000);
    });

    it('allows expense when monthly budget is active (> 0)', () => {
      const res = calculateVaultLiquidity({
        isBudgetModeEnabled: true,
        budgetCadence: 'monthly',
        dailyBudgetAmount: 0,
        weeklyBudgetAmount: 0,
        monthlyBudgetAmount: 30000,
        totalIncome: 0,
        totalExpenses: 0,
      });

      expect(res.canAddExpense).toBe(true);
      expect(res.totalVaultLiquidity).toBe(30000);
    });

    it('blocks expense when budget is 0 and income is 0', () => {
      const res = calculateVaultLiquidity({
        isBudgetModeEnabled: true,
        budgetCadence: 'daily',
        dailyBudgetAmount: 0,
        weeklyBudgetAmount: 0,
        monthlyBudgetAmount: 0,
        totalIncome: 0,
        totalExpenses: 0,
      });

      expect(res.canAddExpense).toBe(false);
      expect(res.totalVaultLiquidity).toBe(0);
    });

    it('allows expense when budget is 0 but income has been logged', () => {
      const res = calculateVaultLiquidity({
        isBudgetModeEnabled: true,
        budgetCadence: 'daily',
        dailyBudgetAmount: 0,
        weeklyBudgetAmount: 0,
        monthlyBudgetAmount: 0,
        totalIncome: 12000,
        totalExpenses: 0,
      });

      expect(res.canAddExpense).toBe(true);
      expect(res.totalVaultLiquidity).toBe(12000);
    });

    it('permits overspending past daily allowance if overall vault liquidity is positive', () => {
      // User has 500 daily budget and 5000 income
      const res = calculateVaultLiquidity({
        isBudgetModeEnabled: true,
        budgetCadence: 'daily',
        dailyBudgetAmount: 500,
        weeklyBudgetAmount: 0,
        monthlyBudgetAmount: 0,
        totalIncome: 5000,
        totalExpenses: 0,
      });

      expect(res.canAddExpense).toBe(true);
      expect(res.totalVaultLiquidity).toBe(5500);
    });

    it('blocks expense when auto-renew is false and allowance is 0 with no income', () => {
      const res = calculateVaultLiquidity({
        isBudgetModeEnabled: true,
        budgetCadence: 'weekly',
        dailyBudgetAmount: 0,
        weeklyBudgetAmount: 7000,
        monthlyBudgetAmount: 0,
        totalIncome: 0,
        totalExpenses: 0,
        isAutoRenew: false,
      });

      expect(res.canAddExpense).toBe(false);
      expect(res.totalVaultLiquidity).toBe(0);
    });
  });
});
