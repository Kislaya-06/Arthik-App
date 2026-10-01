/**
 * vaultSpendingGuard.ts
 *
 * Pure calculation logic for Arthik's Digital Vault Spending Guard (Invariant P0 / ADR 0011).
 * Arthik functions as a real-money financial vault:
 * Outflows (expenses) cannot occur if there is zero available capital in the vault.
 */

import { BudgetCadence, VaultLiquidityInfo } from '../types';
import { round2 } from './formatters';

export interface VaultLiquidityParams {
  isBudgetModeEnabled: boolean;
  budgetCadence: BudgetCadence;
  dailyBudgetAmount: number;
  weeklyBudgetAmount: number;
  monthlyBudgetAmount: number;
  totalIncome: number;
  totalExpenses: number;
  externalGullakDeposits?: number;
  isAutoRenew?: boolean;
}

/**
 * Calculates total available liquidity in the user's digital vault.
 * - In Pure Mode: totalVaultLiquidity = totalIncome - totalExpenses
 * - In Budget Mode: totalVaultLiquidity = activeAllowance + totalIncome + externalGullakDeposits
 *
 * An expense creation is BLOCKED when totalVaultLiquidity <= 0.
 * Overspending past daily/weekly budget is PERMITTED if overall vault liquidity is positive.
 */
export function calculateVaultLiquidity(params: VaultLiquidityParams): VaultLiquidityInfo {
  const {
    isBudgetModeEnabled,
    budgetCadence,
    dailyBudgetAmount,
    weeklyBudgetAmount,
    monthlyBudgetAmount,
    totalIncome,
    totalExpenses,
    externalGullakDeposits = 0,
    isAutoRenew = true,
  } = params;

  if (!isBudgetModeEnabled) {
    const net = round2(totalIncome - totalExpenses);
    const canAdd = net > 0;
    return {
      totalVaultLiquidity: net,
      canAddExpense: canAdd,
      activeCadenceAllowance: 0,
      availableIncome: totalIncome,
      reason: !canAdd
        ? 'No funds available in your account. Please log an Income first to start tracking expenses.'
        : undefined,
    };
  }

  // Budget Mode:
  // Active allowance depends on cadence and whether auto-renew is active
  let activeAllowance = 0;
  if (isAutoRenew) {
    if (budgetCadence === 'daily') {
      activeAllowance = dailyBudgetAmount;
    } else if (budgetCadence === 'weekly') {
      activeAllowance = weeklyBudgetAmount;
    } else if (budgetCadence === 'monthly') {
      activeAllowance = monthlyBudgetAmount;
    }
  }

  // In budget mode: liquidity is funded either by an active budget allowance,
  // logged incomes, or external deposits.
  const total = round2(activeAllowance + totalIncome + externalGullakDeposits);
  const canAdd = total > 0;

  return {
    totalVaultLiquidity: total,
    canAddExpense: canAdd,
    activeCadenceAllowance: activeAllowance,
    availableIncome: totalIncome,
    reason: !canAdd
      ? 'No funds available in your vault. Please set a budget or log an Income first.'
      : undefined,
  };
}
