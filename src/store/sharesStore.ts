import { create } from 'zustand';
import * as Crypto from 'expo-crypto';
import { supabase } from '../config/supabase';
import { useAuthStore, registerStoreResetCallback } from './authStore';
import { useExpenseStore } from './expenseStore';
import {
  ExpenseShare,
  ShareDraft,
  SelfTransferRule,
  validateShares,
  normalizeTransferDescriptor,
} from '../lib/shares';

interface SharesState {
  shares: ExpenseShare[];
  rules: SelfTransferRule[];
  isLoaded: boolean;
  fetchAll: () => Promise<void>;
  /** Persist friend shares for an already-created expense (expense row must exist server-side first). */
  addShares: (expenseId: string, expenseTotal: number, drafts: ShareDraft[]) => Promise<void>;
  /** Replace shares of an expense. Refused if any share already has a linked reimbursement. */
  replaceShares: (expenseId: string, expenseTotal: number, drafts: ShareDraft[]) => Promise<void>;
  /** Re-points a mis-classified reimbursement back to normal income (safe correction). */
  unlinkReimbursement: (expenseId: string) => Promise<void>;
  addRule: (text: string, label?: string) => Promise<SelfTransferRule | null>;
  deleteRule: (ruleId: string) => Promise<void>;
  sharesForExpense: (expenseId: string) => ExpenseShare[];
  reset: () => void;
}

export const useSharesStore = create<SharesState>((set, get) => ({
  shares: [],
  rules: [],
  isLoaded: false,

  reset: () => set({ shares: [], rules: [], isLoaded: false }),

  sharesForExpense: (expenseId) => get().shares.filter((s) => s.expense_id === expenseId),

  fetchAll: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    try {
      const [sharesRes, rulesRes] = await Promise.all([
        supabase.from('expense_shares').select('*').order('created_at', { ascending: true }),
        supabase.from('self_transfer_rules').select('*').order('created_at', { ascending: true }),
      ]);
      // Tables may not exist yet if the migration has not been run; fail soft, never block the app.
      if (sharesRes.error || rulesRes.error) {
        if (__DEV__) console.log('[shares] fetch error', sharesRes.error || rulesRes.error);
        return;
      }
      set({
        shares: (sharesRes.data || []).map((s: any) => ({ ...s, amount_owed: Number(s.amount_owed) })),
        rules: rulesRes.data || [],
        isLoaded: true,
      });
    } catch (e) {
      if (__DEV__) console.log('[shares] fetch failed', e);
    }
  },

  addShares: async (expenseId, expenseTotal, drafts) => {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('No active user session. Please log in again.');
    const clean = drafts.filter((d) => d.friendLabel.trim() && d.amount > 0);
    if (clean.length === 0) return;
    const err = validateShares(expenseTotal, clean);
    if (err) throw new Error(err);

    const rows = clean.map((d) => ({
      id: Crypto.randomUUID(),
      user_id: user.id,
      expense_id: expenseId,
      friend_label: d.friendLabel.trim(),
      amount_owed: d.amount,
    }));
    const { data, error } = await supabase.from('expense_shares').insert(rows).select();
    if (error) throw error;
    const saved = (data || rows).map((s: any) => ({ ...s, amount_owed: Number(s.amount_owed) }));
    set((state) => ({ shares: [...state.shares, ...saved] }));
  },

  replaceShares: async (expenseId, expenseTotal, drafts) => {
    const existing = get().sharesForExpense(expenseId);
    const linked = useExpenseStore
      .getState()
      .expenses.some((e) => e.transaction_class === 'reimbursement' && existing.some((s) => s.id === e.reimburses_share_id));
    if (linked) throw new Error('Some of these shares already have reimbursements. Unlink them first.');
    const err = validateShares(expenseTotal, drafts);
    if (err) throw new Error(err);
    if (existing.length > 0) {
      const { error } = await supabase.from('expense_shares').delete().eq('expense_id', expenseId);
      if (error) throw error;
      set((state) => ({ shares: state.shares.filter((s) => s.expense_id !== expenseId) }));
    }
    await get().addShares(expenseId, expenseTotal, drafts);
  },

  unlinkReimbursement: async (expenseId) => {
    const exp = useExpenseStore.getState().expenses.find((e) => e.id === expenseId);
    if (!exp || exp.transaction_class !== 'reimbursement') return;
    const { error } = await supabase
      .from('expenses')
      .update({ transaction_class: 'normal', reimburses_share_id: null })
      .eq('id', expenseId);
    if (error) throw error;
    useExpenseStore.setState((state) => ({
      expenses: state.expenses.map((e) =>
        e.id === expenseId ? { ...e, transaction_class: 'normal', reimburses_share_id: null } : e
      ),
    }));
  },

  addRule: async (text, label) => {
    const user = useAuthStore.getState().user;
    if (!user) return null;
    const descriptor = normalizeTransferDescriptor(text);
    if (!descriptor) return null; // too weak/broad to remember safely
    const existing = get().rules.find((r) => r.descriptor === descriptor);
    if (existing) return existing;
    const row = { id: Crypto.randomUUID(), user_id: user.id, descriptor, label: label ?? null };
    const { data, error } = await supabase.from('self_transfer_rules').insert(row).select().single();
    if (error) throw error;
    const saved = (data || row) as SelfTransferRule;
    set((state) => ({ rules: [...state.rules, saved] }));
    return saved;
  },

  deleteRule: async (ruleId) => {
    const { error } = await supabase.from('self_transfer_rules').delete().eq('id', ruleId);
    if (error) throw error;
    set((state) => ({ rules: state.rules.filter((r) => r.id !== ruleId) }));
  },
}));

registerStoreResetCallback(() => useSharesStore.getState().reset());
