/**
 * Budget status: "how much is left, am I over, how full is the bar?" for ONE budget and ONE amount spent.
 * Daily, weekly and monthly all use this (it sits on top of calculateCycleFinancials, rule BUD-001).
 *
 * Before this file, "left = budget - spent" was written in six places with different clamping and rounding.
 */
import { calculateCycleFinancials } from '../lib/budgetCalculations';

export interface BudgetStatus {
  /** Budget money still unspent. Never below 0. */
  budgetLeftUnspent: number;
  /** How far past the budget the spending went. 0 when not over. */
  amountSpentOverBudget: number;
  isOverBudget: boolean;
  /** 0 to 1. For a progress bar. 0 when there is no budget. */
  budgetUsedRatio: number;
}

export function calculateBudgetStatus(budgetAmount: number, amountSpent: number): BudgetStatus {
  const cycle = calculateCycleFinancials({ scheduledBudget: budgetAmount, spent: amountSpent });
  const budgetUsedRatio = cycle.spendable > 0 ? Math.min(cycle.spent / cycle.spendable, 1) : 0;
  return {
    budgetLeftUnspent: cycle.remaining,
    amountSpentOverBudget: cycle.overAmount,
    isOverBudget: cycle.isOverBudget,
    budgetUsedRatio,
  };
}
