import { create } from 'zustand';
import * as Crypto from 'expo-crypto';
import { supabase } from '../config/supabase';
import { useAuthStore, registerStoreResetCallback } from './authStore';
import { useNetworkStore } from './networkStore';
import { isNetworkFailure } from '../lib/networkUtils';
import { getStoredList, setStoredList, changeStoredList, removeFromStoredList } from '../lib/asyncStorageList';
import { SelfTransferRule, normalizeTransferDescriptor } from '../lib/transferRules';

/**
 * Remembered self-transfer notes (TXN-003). Backed by the `self_transfer_rules` table.
 * (This used to live inside the retired Shares store; the split / reimbursement feature is gone, REF domain.)
 *
 * Offline-first:
 * - the list is kept on the phone (`getCachedTransferRulesKey`), so a transfer is still recognised without internet;
 * - a rule added without internet is saved locally at once and queued (`getPendingTransferRulesKey`), then sent later.
 *   `syncPendingTransferRules` runs BEFORE the expense queues are sent (an expense can point to a rule, and the server
 *   rejects a pointer to a rule it does not know yet).
 */
export const getCachedTransferRulesKey = (userId: string) => `@arthik_cached_transfer_rules_${userId}`;
export const getPendingTransferRulesKey = (userId: string) => `@arthik_pending_transfer_rules_${userId}`;

interface TransferRulesState {
  rules: SelfTransferRule[];
  isLoaded: boolean;
  fetchAll: () => Promise<void>;
  addRule: (text: string, label?: string) => Promise<SelfTransferRule | null>;
  deleteRule: (ruleId: string) => Promise<void>;
  reset: () => void;
}

const saveCache = (userId: string, rules: SelfTransferRule[]) => setStoredList(getCachedTransferRulesKey(userId), rules);

/** Server rules plus rules still waiting in the queue (never drop a rule the user just made). */
const withQueued = (server: SelfTransferRule[], queued: SelfTransferRule[]): SelfTransferRule[] => {
  const ids = new Set(server.map((r) => r.id));
  return [...server, ...queued.filter((r) => !ids.has(r.id))];
};

export const useTransferRulesStore = create<TransferRulesState>((set, get) => ({
  rules: [],
  isLoaded: false,

  reset: () => set({ rules: [], isLoaded: false }),

  fetchAll: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    // Saved copy first: the rule list is available at once, also without internet.
    if (!get().isLoaded) {
      const saved = await getStoredList<SelfTransferRule>(getCachedTransferRulesKey(user.id));
      if (saved.length > 0) set({ rules: saved, isLoaded: true });
    }
    if (useNetworkStore.getState().isOffline) {
      set({ isLoaded: true });
      return;
    }

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
      const queued = await getStoredList<SelfTransferRule>(getPendingTransferRulesKey(user.id));
      const merged = withQueued(data || [], queued);
      set({ rules: merged, isLoaded: true });
      await saveCache(user.id, merged);
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

    const keepLocally = async (rule: SelfTransferRule, queue: boolean) => {
      if (queue) {
        await changeStoredList<SelfTransferRule>(getPendingTransferRulesKey(user.id), (list) => ({
          next: list.some((r) => r.id === rule.id) ? null : [...list, rule],
          result: undefined,
        }));
      }
      const next = [...get().rules, rule];
      set({ rules: next });
      await saveCache(user.id, next);
      return rule;
    };

    // No internet: keep the rule on the phone and send it later.
    if (useNetworkStore.getState().isOffline) return keepLocally(row as SelfTransferRule, true);

    const { data, error } = await supabase.from('self_transfer_rules').insert(row).select().single();
    if (error) {
      if (isNetworkFailure(error)) return keepLocally(row as SelfTransferRule, true);
      throw error;
    }
    return keepLocally((data || row) as SelfTransferRule, false);
  },

  deleteRule: async (ruleId) => {
    const { error } = await supabase.from('self_transfer_rules').delete().eq('id', ruleId);
    if (error) throw error;
    const next = get().rules.filter((r) => r.id !== ruleId);
    set({ rules: next });
    const user = useAuthStore.getState().user;
    if (user) await saveCache(user.id, next);
  },
}));

/**
 * Sends the rules that were made without internet. A rule that could not be sent stays queued; one that was sent is
 * removed from the queue (an item added while this runs is kept). Safe to run twice: the insert is an upsert by id.
 */
export const syncPendingTransferRules = async (userId: string): Promise<void> => {
  const key = getPendingTransferRulesKey(userId);
  const queued = await getStoredList<SelfTransferRule>(key);
  if (queued.length === 0) return;

  const synced: string[] = [];
  for (const rule of queued) {
    try {
      const { error } = await supabase.from('self_transfer_rules').upsert(
        { id: rule.id, user_id: userId, descriptor: rule.descriptor, label: rule.label ?? null },
        { onConflict: 'id', ignoreDuplicates: true }
      );
      if (!error) synced.push(rule.id);
    } catch {
      // Still offline: the rule stays queued.
    }
  }
  if (synced.length > 0) {
    await removeFromStoredList<SelfTransferRule>(key, (r) => synced.includes(r.id));
  }
};

registerStoreResetCallback(() => useTransferRulesStore.getState().reset());
