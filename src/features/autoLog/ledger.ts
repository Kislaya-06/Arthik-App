import { format } from 'date-fns/format';
import * as Crypto from 'expo-crypto';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../store/authStore';
import { useExpenseStore, isValidUUID, Expense } from '../../store/expenseStore';
import { useDailyBudgetStore } from '../../store/dailyBudgetStore';
import { cancelTonightNudge } from '../../lib/notificationService';
import { grossAmountOf, buildPeopleLedger, matchIncomingToPeople } from '../../lib/splitLedger';
import { formatCurrency, round2 } from '../../lib/formatters';
import { categoryFromHistory } from './merchants';

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

    // Same rule as the add form (spec 2026-11-28 rule 12): more than the account holds needs income first.
    return amount > Math.max(0, budgetState.getTotalAccountRemaining());
  } catch {
    return false;
  }
};

/** How much income a bank-message expense needs first (0 = none). Same rule as the add form. */
export const liquidityShortfall = (amount: number): number => {
  if (!isExceedingVaultLiquidity(amount)) return 0;
  const available = Math.max(0, useDailyBudgetStore.getState().getTotalAccountRemaining());
  return round2(amount - available);
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

/** `note`: a new note from the review (empty / undefined keeps the saved one). */
export const setTransactionCategory = async (expenseId: string, categoryId: string | null, note?: string): Promise<boolean> => {
  const cat = categoryId && isValidUUID(categoryId) ? categoryId : null;
  const newNote = note?.trim().slice(0, 200) || null;
  const store = useExpenseStore.getState();
  const existing = store.expenses.find((e) => e.id === expenseId);
  if (storeReady() && existing) {
    try {
      await store.updateExpense(
        existing.id, grossAmountOf(existing), cat, newNote ?? (existing.note || ''), existing.payment_mode, existing.expense_date, existing.type || 'expense'
      );
      return true;
    } catch {
      return false;
    }
  }
  try {
    const { error } = await supabase.from('expenses').update(newNote ? { category_id: cat, note: newNote } : { category_id: cat }).eq('id', expenseId);
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
    await store.updateExpense(existing.id, grossAmountOf(existing), existing.category_id, existing.note || '', mode, existing.expense_date, type);
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

/**
 * The category the user usually gives this merchant in their own saved transactions (2+ entries, clear majority).
 * Needs the app's data, so it returns null while the app is closed (the user is then asked as before).
 */
export const historyCategoryFor = (merchant: string | null, type: 'expense' | 'income'): string | null => {
  if (!merchant || !storeReady()) return null;
  const id = categoryFromHistory(useExpenseStore.getState().expenses, merchant, type);
  return id && isValidUUID(id) ? id : null;
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
 * SPL-005: when money arrives from someone who owes the user (name first, then amount), the notification asks
 * "is this their payment?". Needs the app's data, so it only works while the app is loaded; otherwise null and
 * the normal notification is used (the transaction screen still offers the same question).
 */
export const owingPersonMatchFor = (amount: number | null, sender: string | null): { name: string; owed: number } | null => {
  if (!amount || !sender || !storeReady()) return null;
  const people = buildPeopleLedger(useExpenseStore.getState().expenses);
  const match = matchIncomingToPeople(people, { amount, sender })[0];
  return match ? { name: match.person.name, owed: match.person.owed } : null;
};

export const moneyBackQuestionFor = (amount: number | null, sender: string | null): string | null => {
  const match = owingPersonMatchFor(amount, sender);
  return match ? `${match.name} owes you ${formatCurrency(match.owed)}. Is this their payment?` : null;
};

export const saveSelfTransferRule = async (text: string): Promise<boolean> => {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return false;
    const { useTransferRulesStore } = await import('../../store/transferRulesStore');
    await useTransferRulesStore.getState().addRule(text, text);
    return true;
  } catch {
    return false;
  }
};

