import { format } from 'date-fns';
import * as Crypto from 'expo-crypto';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../store/authStore';
import { useExpenseStore, isValidUUID, Expense } from '../../store/expenseStore';
import { useDailyBudgetStore } from '../../store/dailyBudgetStore';
import { cancelTonightNudge } from '../../lib/notificationService';

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
}

const storeReady = () => !!useAuthStore.getState().user && useExpenseStore.getState().isExpensesLoaded;

export const paymentModeFor = (accountKind: string | null | undefined, type: 'expense' | 'income'): 'upi' | 'card' =>
  accountKind === 'card' && type === 'expense' ? 'card' : 'upi';

export const isExceedingVaultLiquidity = (amount: number): boolean => {
  if (!storeReady()) return false;
  if (!useDailyBudgetStore.getState().isBudgetModeEnabled) return false;
  try {
    const budgetState = useDailyBudgetStore.getState();
    if (!budgetState.hydratedForUserId) return false;

    const availIncome = budgetState.getAvailableIncomeBalance();
    const gullak = budgetState.totalAccumulatedSavings;
    let activeAllowance = 0;
    if (budgetState.budgetCadence === 'weekly') {
      activeAllowance = budgetState.weeklyBudgetAmount;
    } else if (budgetState.budgetCadence === 'monthly') {
      activeAllowance = budgetState.monthlyBudgetAmount;
    } else {
      const todayRec = budgetState.getTodayRecord();
      activeAllowance = todayRec.budget || budgetState.dailyBudgetAmount;
    }

    // Strict rule: If Income is 0, Gullak is 0, and amount > allowance
    if (availIncome <= 0 && gullak <= 0 && amount > activeAllowance) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

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
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );
    if (!error && tx.type === 'expense') {
      cancelTonightNudge(date).catch(() => {});
    }
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

