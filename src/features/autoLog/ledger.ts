import { format } from 'date-fns';
import * as Crypto from 'expo-crypto';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../store/authStore';
import { useExpenseStore, isValidUUID, Expense } from '../../store/expenseStore';
import { useSharesStore } from '../../store/sharesStore';
import { findExactSplitCandidates, reimbursedByShare, ReimbursementCandidate, ExpenseShare, ShareDraft } from '../../lib/shares';

/**
 * Bridge between Automatic Logging and Arthik's normal transaction store.
 * - App open (stores loaded): goes through expenseStore → optimistic UI, offline queue, budget sync.
 * - App closed (headless task): writes straight to Supabase with the saved session.
 * If neither works (offline + closed), the caller keeps the event as `queued` and retries later.
 */

export interface NewTransaction {
  amount: number;
  type: 'expense' | 'income';
  categoryId: string | null;
  note: string;
  paymentMode: 'cash' | 'upi' | 'card';
  occurredAt: number;
  /** Set when the money is a friend paying back their share of a split. */
  transactionClass?: 'normal' | 'reimbursement';
  reimbursesShareId?: string | null;
}

const storeReady = () => !!useAuthStore.getState().user && useExpenseStore.getState().isExpensesLoaded;

export const paymentModeFor = (accountKind: string | null | undefined, type: 'expense' | 'income'): 'upi' | 'card' =>
  accountKind === 'card' && type === 'expense' ? 'card' : 'upi';

export const createTransaction = async (tx: NewTransaction, presetId?: string): Promise<string | null> => {
  const id = presetId && isValidUUID(presetId) ? presetId : Crypto.randomUUID();
  const date = format(new Date(tx.occurredAt), 'yyyy-MM-dd');
  const categoryId = tx.categoryId && isValidUUID(tx.categoryId) ? tx.categoryId : null;
  const note = tx.note.slice(0, 200);

  if (storeReady()) {
    if (useExpenseStore.getState().expenses.some((e) => e.id === id)) return id;
    try {
      await useExpenseStore.getState().addExpense(tx.amount, categoryId, note, tx.paymentMode, date, tx.type, {
        id,
        transactionClass: tx.transactionClass ?? 'normal',
        reimbursesShareId: tx.reimbursesShareId ?? null,
      });
      return id;
    } catch {
      return null;
    }
  }

  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return null;
    const { error } = await supabase.from('expenses').upsert(
      {
        id, user_id: userId, amount: tx.amount, note, payment_mode: tx.paymentMode, expense_date: date, type: tx.type, category_id: categoryId,
        transaction_class: tx.transactionClass ?? 'normal', reimburses_share_id: tx.reimbursesShareId ?? null,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );
    return error ? null : id;
  } catch {
    return null;
  }
};

export const setTransactionCategory = async (expenseId: string, categoryId: string | null): Promise<boolean> => {
  const cat = categoryId && isValidUUID(categoryId) ? categoryId : null;
  const store = useExpenseStore.getState();
  const existing = store.expenses.find((e) => e.id === expenseId);
  if (storeReady() && existing) {
    try {
      await store.updateExpense(
        existing.id, existing.amount, cat, existing.note || '', existing.payment_mode, existing.expense_date, existing.type || 'expense'
      );
      return true;
    } catch {
      return false;
    }
  }
  try {
    const { error } = await supabase.from('expenses').update({ category_id: cat }).eq('id', expenseId);
    return !error;
  } catch {
    return false;
  }
};

export const setTransactionType = async (expenseId: string, type: 'expense' | 'income'): Promise<boolean> => {
  const store = useExpenseStore.getState();
  const existing = store.expenses.find((e) => e.id === expenseId);
  if (!existing) return false;
  try {
    const mode = type === 'income' && existing.payment_mode === 'card' ? 'upi' : existing.payment_mode;
    await store.updateExpense(existing.id, existing.amount, existing.category_id, existing.note || '', mode, existing.expense_date, type);
    return true;
  } catch {
    return false;
  }
};

export const deleteTransaction = async (expenseId: string): Promise<boolean> => {
  const store = useExpenseStore.getState();
  if (storeReady() && store.expenses.some((e) => e.id === expenseId)) {
    try {
      await store.deleteExpense(expenseId);
      return true;
    } catch {
      return false;
    }
  }
  try {
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
    return !error;
  } catch {
    return false;
  }
};

/** A manually-entered transaction that looks like the same payment (same amount, type, day). */
export const findManualLookalike = (
  amount: number,
  type: 'expense' | 'income',
  occurredAt: number,
  autoExpenseIds: Set<string>
): Expense | undefined => {
  if (!storeReady()) return undefined;
  const date = format(new Date(occurredAt), 'yyyy-MM-dd');
  return useExpenseStore
    .getState()
    .expenses.find(
      (e) => !autoExpenseIds.has(e.id) && e.expense_date === date && (e.type || 'expense') === type && Math.abs(Number(e.amount) - amount) < 0.01
    );
};

/**
 * Open friend shares that exactly match an incoming amount (split not settled yet).
 * App open: read from the stores. App closed (headless): read the user's rows straight from Supabase.
 * Best effort: any failure returns [] and the credit is handled the normal way. Never throws.
 */
export const findSplitRepaymentCandidates = async (amount: number, occurredAt: number): Promise<ReimbursementCandidate[]> => {
  try {
    const date = format(new Date(occurredAt), 'yyyy-MM-dd');
    let shares: ExpenseShare[];
    let expenses: Array<{ id: string; expense_date: string; amount: number | string; transaction_class?: string | null; reimburses_share_id?: string | null }>;

    if (storeReady()) {
      if (!useSharesStore.getState().isLoaded) await useSharesStore.getState().fetchAll();
      shares = useSharesStore.getState().shares;
      expenses = useExpenseStore.getState().expenses;
    } else {
      const { data: s } = await supabase.from('expense_shares').select('*');
      shares = ((s as any[]) || []).map((r) => ({ ...r, amount_owed: Number(r.amount_owed) }));
      if (shares.length === 0) return [];
      const ids = Array.from(new Set(shares.map((x) => x.expense_id)));
      const { data: e1 } = await supabase.from('expenses').select('id, expense_date, amount').in('id', ids);
      const { data: e2 } = await supabase
        .from('expenses')
        .select('id, expense_date, amount, transaction_class, reimburses_share_id')
        .eq('transaction_class', 'reimbursement');
      expenses = [...((e1 as any[]) || []), ...((e2 as any[]) || [])];
    }
    if (shares.length === 0) return [];

    const byId = new Map(expenses.map((e) => [e.id, e]));
    const withExpense = shares.flatMap((share) => {
      const exp = byId.get(share.expense_id);
      if (!exp) return [];
      return [{ share, expenseDate: exp.expense_date.split('T')[0], expenseAmount: Number(exp.amount) || 0 }];
    });
    return findExactSplitCandidates(withExpense, reimbursedByShare(expenses as any), { amount, date });
  } catch {
    return [];
  }
};

/**
 * "Split this expense" chosen while reviewing an auto-logged expense: attach the friends' shares to the
 * transaction that was just created. The expense amount itself is never changed.
 */
export const saveSharesForTransaction = async (expenseId: string, total: number, drafts: ShareDraft[]): Promise<void> => {
  if (drafts.length === 0) return;
  await useSharesStore.getState().addShares(expenseId, total, drafts);
};
