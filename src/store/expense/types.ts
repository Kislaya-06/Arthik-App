export interface Expense {
  id: string;
  user_id: string;
  category_id?: string | null;
  amount: number;
  type?: 'expense' | 'income';
  note?: string;
  payment_mode: 'cash' | 'upi' | 'card';
  expense_date: string; // YYYY-MM-DD
  /** 'normal' (default) or 'self_transfer' (money moved between the user's own accounts, TXN-003). */
  transaction_class?: 'normal' | 'self_transfer';
  /** Self-transfers only: the remembered rule that classified it. */
  transfer_rule_id?: string | null;
  created_at?: string;
  pending?: boolean;
  retryCount?: number;
  lastRetryAt?: number;
}

export interface FailedSyncItem {
  id: string;
  type: 'add' | 'update' | 'delete';
  expense?: Partial<Expense>;
  errorReason: string;
  failedAt: string;
}

export interface ExpenseUpdatePayload {
  amount?: number;
  category_id?: string | null;
  note?: string;
  payment_mode?: 'cash' | 'upi' | 'card';
  expense_date?: string;
  type?: 'expense' | 'income';
}

export interface PendingUpdate {
  id: string;
  payload: ExpenseUpdatePayload;
  retryCount?: number;
  lastRetryAt?: number;
}

export interface PendingDelete {
  id: string;
  retryCount?: number;
  lastRetryAt?: number;
}

export interface ExpenseState {
  expenses: Expense[];
  loading: boolean;
  isExpensesLoaded: boolean;
  transactionType: 'expense' | 'income';
  failedSyncItems: FailedSyncItem[];
  setTransactionType: (type: 'expense' | 'income') => void;
  fetchExpenses: () => Promise<void>;
  loadPendingExpenses: () => Promise<void>;
  loadFailedSyncItems: () => Promise<void>;
  discardFailedSyncItem: (id: string) => Promise<void>;
  clearAllFailedSyncItems: () => Promise<void>;
  retryFailedSyncItems: () => Promise<void>;
  savePendingOffline: (expense: Expense) => Promise<void>;
  syncPendingExpenses: () => Promise<void>;
  addExpense: (
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
  updateExpense: (
    id: string,
    amount: number,
    categoryId: string | null | undefined,
    note: string,
    paymentMode: 'cash' | 'upi' | 'card',
    date: string,
    type?: 'expense' | 'income'
  ) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  resetExpenses: () => void;
}

export type StoreGet = () => ExpenseState;
export type StoreSet = (partial: Partial<ExpenseState> | ((state: ExpenseState) => Partial<ExpenseState>)) => void;
