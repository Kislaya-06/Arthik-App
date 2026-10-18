/** One slice of a "money back" row: how much of it went against which expense (SPL-003). */
export interface RecoveryAllocation {
  expense_id: string;
  amount: number;
  refund_target?: string;
}

/** One allocation of a multi-person split expense (SPL-001). */
export interface SplitAllocation {
  person: string;
  amount: number;
}

export interface Expense {
  id: string;
  user_id: string;
  category_id?: string | null;
  /**
   * In the store this is the COUNTED amount: the amount paid minus any money that came back for it (SPL-003).
   * The amount actually paid is `gross_amount` (when set). The database always holds the amount paid.
   */
  amount: number;
  /** Store-only: the amount paid before money-back is subtracted. Never sent to the database. */
  gross_amount?: number;
  type?: 'expense' | 'income';
  note?: string;
  payment_mode: 'cash' | 'upi' | 'card';
  expense_date: string; // YYYY-MM-DD
  /**
   * 'normal' (default), 'self_transfer' (money moved between the user's own accounts, TXN-003) or
   * 'recovery' (money that came back for an expense already paid, SPL-003).
   */
  transaction_class?: 'normal' | 'self_transfer' | 'recovery';
  /** Self-transfers only: the remembered rule that classified it. */
  transfer_rule_id?: string | null;
  /** Split expense: who shares this expense (SPL-001). */
  split_person?: string | null;
  /** Split expense: the other person's share of the amount paid (SPL-001). */
  split_amount?: number | null;
  /** Multi-person split allocations (SPL-001). */
  split_allocations?: SplitAllocation[] | null;
  /** Recovery rows only: 'settlement' (a person paid back) or 'refund' (a shop / company paid back). */
  recovery_kind?: 'settlement' | 'refund' | null;
  /** Recovery rows only: who paid back (a person for a settlement, a shop for a refund). */
  recovery_person?: string | null;
  /** Recovery rows only: which expenses this money went back to. The slices add up to `amount`. */
  recovery_allocations?: RecoveryAllocation[] | null;
  created_at?: string;
  pending?: boolean;
  retryCount?: number;
  lastRetryAt?: number;
}

export interface AddExpenseOptions {
  id?: string;
  transactionClass?: 'normal' | 'self_transfer' | 'recovery';
  transferRuleId?: string | null;
  /** Split expense: the other person(s) and their share (SPL-001). */
  split?: { person: string; amount: number; allocations?: SplitAllocation[] } | null;
  /** Money-back rows only (SPL-003). */
  recovery?: {
    kind: 'settlement' | 'refund';
    person: string;
    allocations: RecoveryAllocation[];
  } | null;
}

export interface UpdateExpenseExtras {
  /** undefined = leave the split as it is, null = remove the split, object = set / change it. */
  split?: { person: string; amount: number; allocations?: SplitAllocation[] } | null;
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
  split_person?: string | null;
  split_amount?: number | null;
  split_allocations?: SplitAllocation[] | null;
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
    options?: AddExpenseOptions
  ) => Promise<void>;
  updateExpense: (
    id: string,
    amount: number,
    categoryId: string | null | undefined,
    note: string,
    paymentMode: 'cash' | 'upi' | 'card',
    date: string,
    type?: 'expense' | 'income',
    extras?: UpdateExpenseExtras
  ) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  resetExpenses: () => void;
}

export type StoreGet = () => ExpenseState;
export type StoreSet = (partial: Partial<ExpenseState> | ((state: ExpenseState) => Partial<ExpenseState>)) => void;
