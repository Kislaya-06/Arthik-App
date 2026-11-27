/**
 * Rules 12-13 for every place that deletes money (History swipe, the detail screens, Savings): in Budget Mode a
 * delete may not leave spending uncovered, and it says when Gullak will go down. One helper, so no delete path can
 * forget the check.
 */
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { applyRecoveries } from './splitLedger';
import { formatCurrency } from './formatters';
import type { Expense } from '../store/expense/types';
import type { GullakDeposit } from '../store/dailyBudget/types';

export interface RemovalCheck {
  /** Set = the delete must not happen; show this under "Add Income First". */
  blocked: string | null;
  /** Extra sentence for the confirm popup ('' = nothing to add). */
  warning: string;
}

const check = (change: { expenses?: Expense[]; deposits?: GullakDeposit[] }, warnGullak: boolean): RemovalCheck => {
  const state = useDailyBudgetStore.getState();
  // Pure Mode never blocks (rule 14). Optional call: screens under test mock the store.
  const impact = state.isBudgetModeEnabled ? state.previewMoneyImpact?.(change) : undefined;
  if (!impact) return { blocked: null, warning: '' };
  if (impact.shortfall > 0) {
    return { blocked: `Add ${formatCurrency(impact.shortfall)} income first. This money is already spent.`, warning: '' };
  }
  const warning =
    warnGullak && impact.gullakDrop > 0 ? ` ${formatCurrency(impact.gullakDrop)} will also be taken out of your Gullak.` : '';
  return { blocked: null, warning };
};

export const checkExpenseRemoval = (expenseId: string, expenses: Expense[]): RemovalCheck =>
  check({ expenses: applyRecoveries(expenses.filter((e) => e.id !== expenseId)) }, true);

/** Removing a deposit lowers Gullak by design, so only a shortfall matters here. */
export const checkDepositRemoval = (depositId: string): RemovalCheck =>
  check({ deposits: (useDailyBudgetStore.getState().gullakDeposits || []).filter((d) => d.id !== depositId) }, false);

/** What removing a wrong deposit does with the money (rule 9). */
export const depositRemovalMessage = (deposit: { amount: number; source?: string }): string =>
  deposit.source === 'income'
    ? `Move ${formatCurrency(deposit.amount)} back to your income?`
    : `Remove ${formatCurrency(deposit.amount)}? This money will leave your total balance.`;
