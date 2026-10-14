import type { Expense } from '../expense/types';

let expenseGetter: (() => Expense[]) | null = null;
export const registerExpenseGetter = (getter: () => Expense[]) => {
  expenseGetter = getter;
};
export const getCurrentExpenses = (): Expense[] => {
  return expenseGetter ? expenseGetter() : [];
};

let expensesLoadedGetter: (() => boolean) | null = null;
let sharesGetter: (() => Array<{ id: string; expense_id: string }>) | null = null;

/** Friends' shares (id -> expense), registered by sharesStore. Lets split repayments go back to their source. */
export const registerSharesGetter = (getter: () => Array<{ id: string; expense_id: string }>) => {
  sharesGetter = getter;
};

export const getCurrentShares = (): Array<{ id: string; expense_id: string }> =>
  sharesGetter ? sharesGetter() : [];

export const registerExpensesLoadedGetter = (getter: () => boolean) => {
  expensesLoadedGetter = getter;
};

export const areExpensesLoaded = (): boolean => {
  if (expensesLoadedGetter) {
    return expensesLoadedGetter();
  }
  if (__DEV__) {
    console.warn(
      '[dailyBudgetStore] areExpensesLoaded called before registerExpensesLoadedGetter was registered. Defaulting to false.'
    );
  }
  return false;
};
