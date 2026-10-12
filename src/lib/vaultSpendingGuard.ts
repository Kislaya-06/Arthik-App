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
  /**
   * What is really left across the whole account: all budgets + income + reimbursements + EXTERNAL deposits
   * minus everything spent. When given (Budget Mode), it is the liquidity. Without it the old estimate is used.
   */
  accountRemaining?: number;
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
    accountRemaining,
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

  // In budget mode: liquidity is what is really left after spending. The old estimate ignored what was already
  // spent, so paying out money that was gone was never blocked.
  const total = accountRemaining !== undefined
    ? round2(accountRemaining)
    : round2(activeAllowance + totalIncome + externalGullakDeposits);
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
