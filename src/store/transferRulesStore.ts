import { create } from 'zustand';
import * as Crypto from 'expo-crypto';
import { supabase } from '../config/supabase';
import { useAuthStore, registerStoreResetCallback } from './authStore';
import { SelfTransferRule, normalizeTransferDescriptor } from '../lib/transferRules';

/**
 * Remembered self-transfer notes (TXN-003). Backed by the `self_transfer_rules` table.
 * (This used to live inside the retired Shares store; the split / reimbursement feature is gone, REF domain.)
 */
interface TransferRulesState {
  rules: SelfTransferRule[];
  isLoaded: boolean;
  fetchAll: () => Promise<void>;
  addRule: (text: string, label?: string) => Promise<SelfTransferRule | null>;
  deleteRule: (ruleId: string) => Promise<void>;
  reset: () => void;
}

export const useTransferRulesStore = create<TransferRulesState>((set, get) => ({
  rules: [],
  isLoaded: false,

  reset: () => set({ rules: [], isLoaded: false }),

  fetchAll: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('self_transfer_rules')
        .select('*')
        .order('created_at', { ascending: true });
      // The table may not exist yet if the migration has not been run; fail soft, never block the app.
      if (error) {
        if (__DEV__) console.log('[transferRules] fetch error', error);
        return;
      }
      set({ rules: data || [], isLoaded: true });
    } catch (e) {
      if (__DEV__) console.log('[transferRules] fetch failed', e);
    }
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

registerStoreResetCallback(() => useTransferRulesStore.getState().reset());
