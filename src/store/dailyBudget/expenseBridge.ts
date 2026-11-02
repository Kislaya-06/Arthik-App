import type { Expense, AddExpenseOptions } from '../expense/types';

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

/**
 * OPT-63 (data safety): true only after the expense list was loaded FROM THE SERVER in this app session
 * (not from the on-phone cache). Server rows that are rewritten from the expense list
 * (`selfHealCorruptedRows`) are only written when this is true, so a stale cache can never overwrite
 * correct server data. Screens are not affected: local numbers are computed exactly as before.
 */
let expensesFreshGetter: (() => boolean) | null = null;

export const registerExpensesFreshGetter = (getter: () => boolean) => {
  expensesFreshGetter = getter;
};

export const areExpensesFreshFromServer = (): boolean => {
  return expensesFreshGetter ? expensesFreshGetter() : false;
};

export type AddExpenseBridgeFn = (
  amount: number,
  categoryId: string | null | undefined,
  note: string,
  paymentMode: 'cash' | 'upi' | 'card',
  date: string,
  type?: 'expense' | 'income',
  options?: AddExpenseOptions
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
