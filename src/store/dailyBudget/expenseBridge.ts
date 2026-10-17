import type { Expense } from '../expense/types';

let expenseGetter: (() => Expense[]) | null = null;
export const registerExpenseGetter = (getter: () => Expense[]) => {
  expenseGetter = getter;
};
export const getCurrentExpenses = (): Expense[] => {
  return expenseGetter ? expenseGetter() : [];
};

let expensesLoadedGetter: (() => boolean) | null = null;

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

export type AddExpenseBridgeFn = (
  amount: number,
  categoryId: string | null | undefined,
  note: string,
  paymentMode: 'cash' | 'upi' | 'card',
  date: string,
  type?: 'expense' | 'income',
  options?: {
    id?: string;
    transactionClass?: 'normal' | 'self_transfer';
    transferRuleId?: string | null;
  }
) => Promise<void>;

let addExpenseFn: AddExpenseBridgeFn | null = null;
export const registerAddExpense = (fn: AddExpenseBridgeFn) => {
  addExpenseFn = fn;
};

export const addExpenseFromBridge: AddExpenseBridgeFn = async (
  amount,
  categoryId,
  note,
  paymentMode,
  date,
  type,
  options
) => {
  if (addExpenseFn) {
    return addExpenseFn(amount, categoryId, note, paymentMode, date, type, options);
  }
};
